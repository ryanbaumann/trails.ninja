# Ryan Voice Fine-Tuning

Training data, generation pipeline, held-out evaluation suite, and results for adapting an open-weight model to Ryan Baumann's writing voice on an Apple M4 Pro.

The current base is **Gemma 4 26B-A4B** (4-bit, MLX). Section 6 argues for moving to a dense model and says how to test that rather than assume it.

---

## 1. Objectives

Five tasks, because those are the five things I actually hand to a model:

1. **Draft**: cold generation with an opening scenario hook and growth-backwards framing (*Result → Shipped → Lesson*).
2. **Edit / Rewrite**: passive corporate text into concise, active first person. Contractions. Zero em-dashes. Facts preserved exactly.
3. **Critique**: diagnose tone, structure, and cliché failures with a fix for each.
4. **Headline**: thesis-first, misconception-led title variants that are not the topic string in a frame.
5. **Present**: demo-first talk abstracts, deck outlines, speaker notes.

The only consumer of the output is a person. That constrains evaluation more than it constrains training, which is most of what this directory is about.

---

## 2. Dataset

Generated deterministically from the repository's own markdown by `scripts/generate-ft-dataset.py`. No manual curation, so a corpus edit is a dataset edit.

### Task distribution (221 examples)

| Task | Examples | Description |
|---|---|---|
| **Edit** | 108 | Corrupted paragraph paired with the published prose. Five corruption modes: passive corporate, hype announcement, academic thesis, messy dictation, buzzword soup. |
| **Draft** | 55 | Section-level prose, sliced to paragraph micro-pairs. |
| **Critique** | 27 | Degraded draft paired with a diagnosis specific to how it was degraded. |
| **Headline** | 19 | Sets of 6–8 title variants per topic. |
| **Present** | 8 | Talk abstracts and slide outlines. |
| **OOD** | 4 | Voice transfer onto topics outside the corpus. |

Splits: 199 train, 22 validation. Both are gitignored; regenerate with `python3 scripts/generate-ft-dataset.py`.

Two bugs were fixed in the generator in the round-5 work:

- `content_type == "talk"` was compared against a corpus that labels talks `"talks"`, so **Present produced zero examples** for four rounds while the README claimed four. Present tasks were being evaluated against a model that had never seen one.
- The generator **overwrote `eval/prompts.jsonl` on every run**, which made the held-out set a function of the training set. It no longer writes there at all.

### Format

```json
{
  "messages": [
    {"role": "system", "content": "You are Ryan Baumann's writing voice..."},
    {"role": "user", "content": "[Task: Edit]\nRewrite this corporate draft in Ryan's voice:\n\nOur team leveraged resources to deliver an API migration..."},
    {"role": "assistant", "content": "I led the API migration to cut database round-trips. Query latency dropped 40%..."}
  ]
}
```

`mask_prompt: true` means loss lands only on the assistant turn. Without it the model memorises the `[Task: Edit]` scaffold and emits it at inference.

---

## 3. Training

Local QLoRA via `mlx_lm.lora` on Apple Silicon Metal.

```bash
mlx_lm.lora --config experiment/voice-ft/config_r5.yaml
```

| Round | Data | Iters | LR | Peak RAM | Outcome |
|---|---|---|---|---|---|
| 1 | 159, full-sequence loss | 468 | 1.5e-4 | 36.8 GB | Memorised the prompt template. |
| 2 | 159 chunked, `--mask-prompt` | 250 | 1.5e-4 | 23.8 GB | Template gone. Repetition loops from 7 epochs. |
| 3 | 159 chunked | 100 | 5e-5 | 29.8 GB | Found the 1.5–2.5 epoch window. |
| 4 | 218 micro-pairs, native chat template | 150 | 8e-5 | 24.5 GB | Voice held. Judgment did not. See section 4. |
| 5 | 221 micro-pairs, warmup + cosine decay | 200 | 5e-5 → 1e-6 | 31.5 GB | Fixed learning rate decay; verified zero leakage. |
| 6 | 245 micro-pairs (surgical edits + abstention) | 300 | 5e-5 → 1.6e-6 | 38.6 GB | Fixed Draft task (50% clean rate); deployed local subagent aide. |

Round 6 adds 24 surgical edit and negative grounding pairs directly preserving numbers and factual nouns, preventing fabricated citations, and enforcing hard length bounds. Evaluated across the 48-item held-out suite with zero 8-word shingle leakage.

### Hardware & Memory Rules (Apple Silicon Metal)

- **Zero Parallel Training**: Never train multiple models concurrently or run fine-tuning and eval simultaneously on unified memory. Metal GPU memory contention triggers memory spikes (55+ GB), gradient explosion, kernel stalls, and OS-level crashes. Run all training and eval runs strictly serially.
- **Dynamic Sequence Capping**: Keep `max_seq_length` bounded (1024–1536) to prevent unnecessary attention allocation for short micro-pairs.
- **Skip Mid-Training Validation Loops**: Ensure `steps_per_eval: 9999` and remove `valid.jsonl` before training to avoid secondary compute graph allocations in Metal.
- **Pre-flight Guard**: Always check for running `mlx_lm.lora` or `voice_eval` processes (`pgrep -f "mlx_lm.lora|voice_eval"`) before launching jobs.


---

## 4. Evaluation

Round 4 carried the voice on all six held-out prompts and failed on judgment in five of them. Six prompts is a signal, not a result: the 95% Wilson interval on 1/6 clean is **[3%, 56%]**, which is wide enough to be worth nothing. Hence this harness.

### The suite

`eval/heldout.jsonl` holds **48 items**: Edit 14, Critique 9, Draft 8, Headline 6, OOD 6, Present 5. Every item carries a `why` field naming the specific failure it targets, and phrasing was deliberately moved away from the training templates. `scripts/voice_eval.py leakage` proves it: **zero 8-word shingles** are shared with the 221-example training set.

### The checks

Generation needs MLX and a GPU. Grading is pure stdlib Python over JSON, so it runs anywhere, in CI, and over results from months ago.

| Check | Catches |
|---|---|
| `G-EDIT-DELTA` | An edit that changed nothing. The gap the Field Note named. |
| `G-EDIT-PRESERVE` | An edit that threw the facts away instead. |
| `G-EDIT-TARGET` | The specific word the brief said to remove, still there. |
| `G-EDIT-RESTRAINT` | Rewriting prose that was already fine. |
| `G-FACT-KEEP` | A number or name from the source, dropped. |
| `G-ECHO` | The input handed back verbatim under a heading. |
| `G-CITATION` | An invented source. The other gap the Field Note named. |
| `G-ABSTAIN` | Asked for a figure it cannot have, and produced one. |
| `G-NUMBERS` | A measurement nothing in the prompt supports. |
| `G-LOOP`, `G-DUP-SENTENCE`, `G-DISTINCT` | Repetition. |
| `G-TRUNCATED` | Stopped mid-sentence or left a code fence open. |
| `G-TYPO` | Malformed contractions. Round 4 wrote `doesn's`. |
| `G-HEADLINE-SLOT`, `G-HEADLINE-VARIETY`, `G-HEADLINE-COUNT` | The topic string pasted into eight title frames. |
| `G-HYPE`, `G-ANNOUNCE`, `G-AI-TELLS`, `G-SCAFFOLD` | Lexical tells, from the same lexicon the site linter uses. |
| `G-STOCK-PHRASE` | The same closing line across items in one run. |

The word lists live in `scripts/lib/voice-lexicon.json`, read by both `scripts/lib/content-rules.mjs` (published prose) and `scripts/voiceeval/lexicon.py` (model output). One file, so the two cannot drift.

Checks are reported individually and never averaged into a score. The moment there is one number, the tuning starts optimising for the number.

### Edits fail in three directions

An edit grader that only measures similarity to the source can be gamed from either end. This one measures three things at once, and an output has to sit inside all three:

- **change** below `min_change` means it did nothing
- **preserve** below `min_preserve` means it threw the facts away
- `must_remove` terms surviving means it moved words around and missed the point

`must_remove` terms are stripped from the source before the preservation floor is computed, so "rewrite this to drop *pleased to announce*" cannot demand that "pleased" be preserved.

### The citation resolver

Offline, `check_format` rejects anything that is not a plausible arXiv ID, DOI, or RFC. Round 4's `arxiv.org/abs/24606.24282` fails with no network at all, because arXiv IDs are `YYMM.NNNNN` and `2460` is not a month.

Online, the resolver does HEAD then GET, caches to disk, and is deliberately asymmetric: 404 and 410 are `invented` and fail the run; a timeout, a DNS failure, or a 403 from a publisher that blocks bots is `unknown` and warns. A link is never marked `ok` because the check could not run.

### Running it

```bash
# Generate on the Mac. Needs mlx-lm and the weights.
python3 scripts/voice_eval.py run --adapter ./adapters/gemma-4-26b-ryan-voice-v5 --label r5

# Grade. Runs anywhere, including over an old results file.
npm run eval:grade -- --results experiment/voice-ft/eval/results/r5_results.json

# Prove the suite is still held out
npm run eval:leakage

# Check every link in a draft before publishing
npm run eval:citations -- --file portfolio/content/writing/my-post.md

# What did round 5 fix, and what did it break
python3 scripts/voice_eval.py compare \
  --baseline experiment/voice-ft/eval/results/round4_results.json \
  --candidate experiment/voice-ft/eval/results/r5_results.json

# Advisory only, never gates: base model judges the adapter, every verdict
# must quote a span, pairwise runs both orders to control position bias
python3 scripts/voice_eval.py judge --results .../r5_results.json
```

Exit codes: `0` clean, `1` an error-level check failed, `2` the harness itself broke.

### Regression evidence

The graders are pinned to the real round-4 outputs checked into `eval/results/round4_results.json`:

```bash
npm run test:voice   # 52 tests
```

Re-grading round 4 offline reports 1/6 clean and fires `G-AI-TELLS`, `G-HYPE`, `G-ECHO`, `G-LOOP`, `G-DUP-SENTENCE`, `G-TRUNCATED`, `G-TYPO`, `G-HEADLINE-SLOT`, and `G-CITATION`. Every failure written up in the Field Note is caught mechanically, including the fabricated citation, with the network off. See `eval/results/round4_regraded_scorecard.md`.

---

## 5. What the harness cannot do

Mechanical checks solve the surface tells. They do not measure whether a sentence is worth reading. `scripts/voiceeval/judge.py` exists for that and is advisory by construction: it never sets the exit code, every verdict must quote a literal span from the draft (a verdict whose quote is not in the text is downgraded), and pairwise comparisons run in both orders and return `no_preference` unless the winner survives the swap.

Taste is the whole substance of an artifact whose only consumer is a person, and no grader in this directory measures it.

---

## 6. Model selection and empirical findings

Round 6 evaluated **Gemma 4 31B Dense** against **Gemma 4 26B-A4B MoE** across the frozen 48-item held-out evaluation suite.

### Dense vs MoE empirical results

| Metric / Check | Gemma 4 26B-A4B MoE (`round6_dynamic`) | Gemma 4 31B Dense (`round6_dense`) | Advantage |
|---|---|---|---|
| **Clean Pass Rate (All Error Checks)** | 12 / 48 (25%, 95% CI 15–39%) | **17 / 48 (35%, 95% CI 23–50%)** | **+10% gain (+42% relative)** |
| **Total Error Violations** | 56 errors | **39 errors** | **-30.4% error reduction** |
| **Fact Retention (`G-FACT-KEEP`)** | 10 / 11 (91%) | **11 / 11 (100%)** | **Dense: zero dropped facts** |
| **Verbatim Echo Reduction (`G-ECHO`)** | 37 / 48 passed (11 fails) | **43 / 48 passed (5 fails)** | **-54.5% fewer echo failures** |
| **Edit Preservation (`G-EDIT-PRESERVE`)** | 9 / 15 passed (60%) | **13 / 15 passed (87%)** | **+27% preservation rate** |
| **Repetition Loops (`G-LOOP`)** | 46 / 48 (2 loops) | **48 / 48 (0 loops)** | **Dense: zero token loops** |
| **Average Generation Latency / Item** | **~2.5 seconds** | ~8.1 seconds | **MoE is ~3.2x faster** |

For complete research synthesis and error taxonomy, see [`RESEARCH_FINDINGS.md`](./RESEARCH_FINDINGS.md).

### Operational routing

- **Dense 31B (`adapters/gemma-4-31b-ryan-voice-v6`)**: Selected for deep editorial reviews (`npm run voice:review`) and high-fidelity copyediting where structure and fact retention outrank speed.
- **MoE 26B-A4B (`adapters/gemma-4-26b-ryan-voice-v6`)**: Selected for fast interactive completions, headline brainstorming (`npm run voice:headline`), and social packaging (`npm run voice:social`).

---

## 7. Directory structure

```text
experiment/voice-ft/
├── README.md                       # this document
├── RESEARCH_FINDINGS.md            # comprehensive empirical research synthesis
├── config_r2.yaml                  # round 2, kept for the record
├── config_r5.yaml                  # round 5, MoE base
├── config_r5_dense.yaml            # round 5, dense Gemma 4 31B
├── config_r6.yaml                  # round 6, final multi-task config
├── eval/
│   ├── heldout.jsonl               # 48 held-out items with per-item checks
│   ├── prompts.jsonl               # original 6 prompts, kept for regression tests
│   ├── summary.md                  # Vertex AI and early endpoint notes
│   └── results/
│       ├── round1..4_results.json
│       ├── round4_regraded_scorecard.md
│       ├── r5.json & r5_scorecard.md
│       ├── r6.json & r6_scorecard.md
│       ├── round6_dense.json & round6_dense_scorecard.md
│       ├── round6_dynamic.json & round6_dynamic_scorecard.md
│       └── compare_*.md
└── training/                       # generated dataset splits, gitignored
```

Grading code lives in `scripts/voiceeval/`, the local CLI and model routing in `scripts/local_gemma.py`, and the evaluation tests in `scripts/test/voiceeval_test.py`.
