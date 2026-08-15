---
title: Why I Fine-Tuned a 26B Model on My Laptop Instead of Prompting Frontier APIs
summary: I set out to build an AI writing partner with real taste. Prompt engineering hits an RLHF ceiling where models flatten prose into corporate mush, while unconstrained fine-tuning risks hallucinating facts. Across four iterative tuning rounds on Apple Silicon Metal, here is how we solved prompt replication, eliminated metric hallucinations, and built a local editorial studio that keeps prose authentically human.
date: 2026-08-15
updated: 2026-08-15
canonical: https://ryanbaumann.dev/writing/why-i-fine-tuned-a-26b-model-on-my-laptop-instead-of-prompting-frontier-apis/
tags: ["ai", "evals", "field notes"]
draft: true
noindex: true
stageSocial: false
image: /img/writing/why-i-fine-tuned-a-26b-model-on-my-laptop-header.svg
imageAlt: "Two paths side by side: a rented cloud GPU that produced invented percentages across held-out outputs, and an Apple Silicon laptop running a 218-pair fine-tuned local Gemma 4 model with zero metric hallucinations."
socialImage: /social/why-i-fine-tuned-a-26b-model-on-my-laptop-instead-of-prompting-frontier-apis.jpg
shareTitle: Why I Fine-Tuned a 26B Model on My Laptop Instead of Prompting Frontier APIs
shareSummary: Prompt engineering hits a wall when default RLHF flattens prose toward corporate mush. Across 4 iterative fine-tuning rounds on Apple Silicon Metal, here is how completion-only loss masking and micro-pair slicing built an authentic local writing partner.
shareImageAlt: A social card setting a rented cloud GPU that produced invented percentages against a laptop running a local fine-tuned Gemma 4 model with verified metrics.
---

Here is how my writing process usually falls apart:

I dictate a messy voice memo on a trail run or dump four hundred words of raw notes into a text editor. I hand that rough draft to a frontier model to polish and structure. Thirty seconds later, the model returns a spotless draft that opens with "In today's fast-paced technological landscape" and leans on three false dichotomies before the second paragraph.

I open the file, take a digital red pen to the text, delete half the adjectives, restore my syntax, and basically rewrite the entire piece from scratch.

When you spend more time stripping out generic AI filler than you would have spent drafting by hand, the tool isn't productive.

I wanted to see if I could make an AI copywriter and brainstormer actually have taste I like and would write with. I want to own the thinking, the technical friction, and the argument. I wanted a real writing partner I can trust to speak in my voice for drafting, reviewing, and tightening prose without stripping away the rhythm.

## Four ways to steer a model, and where each hits a wall

Before jumping into local fine-tuning, I systematically tested four levels of model steering to find where each approach breaks down:

1. **Context Engineering:** I loaded frontier models with my writing style guidelines. I specified sentence length variance targets, provided few-shot examples from published case studies, and added negative rules against em-dashes and hype adjectives.
2. **Agentic Workflows:** When single prompts plateaued, I built multi-agent loops. I fanned out candidate drafts across three parallel subagents (analytical, scene-led, and staccato), then used an independent judge subagent to evaluate and synthesize the results against structured voice rubrics.
3. **Model Exploration:** I tested different frontier architectures across multiple model families. Each model brought distinct traits; some were sharp on technical architecture, while others maintained tight narrative coherence. But every frontier model shared the same underlying friction: heavy RLHF tuning that pulls prose toward a polite, sanitized corporate mean. No matter how much context engineering or agent orchestration I wrapped around them, the outputs defaulted to generic transitions, uniform paragraph lengths, and predictable rhetoric.
4. **Base Model Fine-Tuning:** When prompting and agentic loops hit their ceiling, the next step was fine-tuning an open-weight base model directly on my own writing corpus to reshape its underlying token probabilities.

## The empirical evidence: University of Michigan research

That progression from prompting to fine-tuning is supported by academic research.

A landmark study from the University of Michigan (*Dhillon et al., 2026*, co-authored by Paramveer Dhillon, Tuhin Chakrabarty, and Jane C. Ginsburg) tested whether generative models could genuinely replicate authorial voice. The researchers evaluated state-of-the-art models against professional writers and evaluated the outputs using blind pairwise reviews by MFA writing experts from top U.S. programs:

- **In-Context Prompting:** When models were prompted with author guidelines and in-context examples, MFA judges easily identified the AI-generated prose. The expert judges preferred authentic human writing **82.7% of the time**. Prompting produced superficial mimicry rather than authentic authorial voice.
- **Fine-Tuning on Full Corpora:** When models were fine-tuned directly on an author's complete body of work, the preference completely flipped. The expert judges favored the fine-tuned AI output **62% of the time** for stylistic fidelity, narrative pacing, and sentence cadence.

Prompting gives the model instructions; fine-tuning changes the underlying token probabilities. If expert readers cannot reliably distinguish fine-tuned outputs from human prose, personal fine-tuning is the viable technical path for deep voice preservation.

## The experiment: fine-tuning on Vertex AI and Apple Silicon

Motivated by those findings, I set out to fine-tune an open-weight model directly on my own writing.

I had an added motivation: I wanted to test what I could run locally on my MacBook using Apple Silicon and MLX. Running on-device eliminates GPU rental bills and keeps raw, unvarnished drafts completely private. You should own your intelligence, especially when it comes to personal taste and unreleased ideas.

I built a dataset generation script to extract gold-standard training examples directly from my published writing and case studies. The initial dataset spanned five core tasks: Draft, Edit, Critique, Headline, and Present.

```
[ Markdown Corpus ] -> generate-ft-dataset.py -> Dataset JSONL (Train / Validation)
                                                        │
                        ┌───────────────────────────────┴───────────────────────────────┐
                        ▼                                                               ▼
            Cloud SFT (Vertex AI)                                           Local MLX (Apple Silicon)
            Gemma 4 26B-A4B (LoRA r=4)                                       Gemma 4 26B-A4B (4-bit Metal)
            1x A100 80GB GPU                                                 Sub-second, zero cloud cost
```

I launched parameter-efficient fine-tuning on Google Cloud Vertex AI with a cloud training harness, while also standing up a local Apple Silicon runner.

## The initial failure mode: metric hallucinations and template replication

When the initial cloud training run finished, I deployed the model to an ephemeral GPU endpoint and evaluated it against 20 held-out prompts across all five task categories (archived in the evaluation summary).

The stylistic cadence was immediately noticeable: the fine-tuned model naturally stripped corporate fluff, adopted first-person active verbs, used contractions, and opened on real engineering friction rather than generic announcements.

![A single bar of 117 training examples split by where each target came from: 47 real prose, 27 copies of one identical critique response, 27 synthetic round-trips, 11 from one headline template, 5 hand-written, and a zero-width slice for the Present task with none.](/img/writing/why-i-fine-tuned-a-26b-model-on-my-laptop-dataset.svg)

However, evaluation against unseen prompts exposed two fundamental traps:

1. **The model learned the shape of evidence without having the evidence itself:** In four out of twenty held-out outputs, the fine-tuned model invented quantitative metrics out of thin air: 40%, 20%, 15%, and 40%. When given a short 13-word prompt with no numbers, it fabricated a 40% query latency improvement. Because my published case studies cite real platform metrics, the model learned that sounding authentic required citing numbers, so it invented them to satisfy the learned pattern.
2. **Template replication from unmasked prompt loss:** When computing loss across the full sequence, the model spent gradient capacity memorizing the system prompt and input prompt tags (like `[Task: Edit]...`), regurgitating them into output completions.

## The breakthrough: 4 iterative rounds on Apple Silicon Metal

To fix these failure modes, I moved the entire training loop onto my MacBook using Apple Silicon Metal and `mlx_lm.lora`. Over four iterative rounds, we systematically tuned loss masking, dataset chunking, and learning rates:

| Iteration | Dataset Shape | Masking & LoRA Config | Memory (Metal) | Convergence | Key Learning & Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Round 1** | 159 examples (section-level) | Full Sequence Loss<br>$r=8, \alpha=20$<br>468 iters, $lr=1\text{e-}4$ | 36.8 GB (Warnings on $>2048$ tok) | 11.905 $\rightarrow$ 0.437 | 0 metric hallucinations & 0 em-dashes. Discovered prompt repetition bug on edit tasks caused by unmasked prompt loss. |
| **Round 2** | 159 examples (pre-chunked $\le 850\text{w}$) | `--mask-prompt`<br>$r=16, \alpha=32$<br>250 iters, $lr=1.5\text{e-}4$, accum=4 | 23.8 GB (Zero sequence warnings) | 10.099 $\rightarrow$ 1.829 | Masked loss eliminated prompt replication. Memory dropped by 13 GB. Discovered over-training (sim 7 epochs) caused repetition loops. |
| **Round 3** | 159 examples (pre-chunked) | `--mask-prompt`<br>$r=16, \alpha=32$<br>100 iters, $lr=5\text{e-}5$, accum=2 | 29.8 GB | 10.099 $\rightarrow$ 1.751 | Goldilocks 2.5 epoch window. Gentler learning rate preserved stylistic flexibility across all task categories. |
| **Round 4** | 218 examples (111 Edits, 54 Drafts, 30 Critiques, 19 Headlines) | `--mask-prompt`<br>Native chat template<br>150 iters, $lr=8\text{e-}5$, accum=2 | 24.5 GB | 9.205 $\rightarrow$ 1.361 | Highest-fidelity prose. Rich micro-pairs, dynamic diagnostic critiques, natural sentence length variance (6.4–7.9 stdev), and 0 metric hallucinations. |

## Four core architectural learnings

From these four iterations, four fundamental rules emerged for training personal voice models:

### 1. Factual preservation prevents metric hallucination
The root cause of hallucinated percentages was pairing generic, metric-free input prompts with metric-dense targets extracted from published case studies. In voice fine-tuning, edit and rewrite targets must strictly preserve the numerical spine and factual content of the prompt while shifting cadence, active voice, and register.

### 2. Completion-only loss masking (`--mask-prompt`)
Standard sequence-level cross-entropy wastes gradient capacity memorizing system prompts and user prompt scaffolding. Passing `--mask-prompt` into `mlx_lm.lora` forces 100% of the adapter weights to learn authorial style and completion tokens, eliminating prompt replication.

### 3. Micro-pair slicing vs. macro slices
Instead of training on entire multi-page essays, slicing sections into paragraph-level micro-pairs (100 to 250 words) expanded our dataset to 218 rich samples, eliminated sequence length truncation warnings, and reduced peak Metal RAM to 24.5 GB (leaving over 23 GB of free memory on a 48GB M4 Pro).

### 4. Optimal voice adaptation budget
On small personal writing corpora (150 to 250 pairs), 1.5 to 2.5 epochs (roughly 100 to 150 iterations with gradient accumulation) is the empirical sweet spot. Exceeding 3 epochs leads to mode collapse and repetitive rhetoric on open-ended tasks.

## Interactive Web App: Voice & Editorial Studio

To make evaluation and curation visual and accessible, we built a dedicated web application staged at `/voice-studio/`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Voice & Editorial Studio                           [Gemma 4 26B-A4B / 48GB] │
├─────────────────────────────────────────────────────────────────────────────┤
│ [ Blind Arena ]     [ Dictation & Pair Scrubber ]     [ Loss & Analytics ]  │
│                                                                             │
│  Model Alpha (Blind)                 Model Beta (Blind)                     │
│  "We just shipped the platform.      "We are thrilled to announce our       │
│   Here is what you can build..."      cutting-edge platform to leverage..." │
│                                                                             │
│  Rhythm StDev: 7.96                  Rhythm StDev: 0.0                      │
│  Em-Dashes: 0                        Em-Dashes: 2 [Alert]                   │
│  Buzzwords: 0                        Buzzwords: 3 [Alert]                   │
│                                                                             │
│  [ Vote Model Alpha ]                [ Vote Model Beta ]                    │
│                                                                             │
│  [ Reveal Model Identities: Gemma 4 LoRA Tuned vs Base Model ]              │
└─────────────────────────────────────────────────────────────────────────────┘
```

The studio provides three integrated capabilities:
- **Blind Arena:** Randomized pairwise comparisons between the fine-tuned adapter and base model with real-time rhythm and buzzword checkers.
- **Voice Memo Scrubber:** Direct text cleaner with an interactive Sentence Length Rhythm Spectrum and a 1-click Export Verified Pair to JSONL button.
- **Loss Analytics:** Tracks convergence curves, training loss, and Metal memory metrics across all four fine-tuning runs.

![Voice and Editorial Studio showing real-time sentence-length rhythm spectrum, side-by-side dictation-to-prose scrubber, and loss convergence analytics.](/img/writing/voice-studio-ui.jpg)

## Comparative breakdown: prompting vs. fine-tuned local models

When you compare raw human dictation, frontier cloud prompting, and our Round 4 fine-tuned local model side by side, the tradeoffs are clear:

| Attribute | Raw Dictation | Frontier Prompting | Local Fine-Tuned Model (Round 4) |
| :--- | :--- | :--- | :--- |
| **Voice & Tone** | Authentic, raw, idiosyncratic | Homogenized, polite, corporate | Authentic cadence, preserved idioms |
| **Syntax & Pacing** | Run-on clauses, speech stumbles | Rigid, uniform sentence lengths | Dynamic sentence length variance (6.4–7.9 stdev) |
| **Cliché Frequency** | Low (natural speech) | High (AI filler, buzzwords, false flips) | Zero buzzwords (suppressed via learned weights) |
| **Round-Trip Latency** | Instant (source thought) | 2.5 to 5.0 seconds (network + cloud) | Sub-second (local Metal GPU) |
| **Data Privacy** | Local device only | Transmitted over third-party API | 100% on-device |
| **Factual Stability** | Grounded in lived experience | Plausible filler if unguided | Deterministic factual preservation |

Frontier prompted models tend to cluster around 14 to 18 words per sentence with low standard deviation. Authentic human prose swings between punchy 4-word declarations and complex 35-word clauses. A fine-tuned local model preserves that variance instead of averaging it out.

## Before and after: putting the loop to work

To see the difference in practice, look at how the fine-tuned model handles a typical corporate draft versus the refined output:

### Input: Corporate Announcement Draft
```text
We are pleased to announce that our team has developed a solution that enables developers to leverage the full power of our platform's geospatial information layers.
```

### Output: Refined First-Person Prose
```text
Developers can now tap into our full suite of map data layers. We just shipped the integration that unlocks these datasets across the entire platform. 

Previously, teams had to jump through hoops to access high-fidelity map data; now it's a native part of the workflow. When you build a platform, don't just give users tools; give them the data that makes those tools indispensable.
```

The refined version drops the announcement hype, uses active voice, opens with developer capability, and follows a clear growth-backwards progression.

## The workflow: how to run it yourself

To make this workflow reproducible, the entire setup runs with scripts included in this repository.

![Mechanical checks for em-dashes, announcement phrasing, hype words, and repeated phrases stand as gates on the left; on the right, unweighted human judgments about truth, credit, and whether the piece should exist. The two never combine into one score.](/img/writing/why-i-fine-tuned-a-26b-model-on-my-laptop-gates.svg)

Here is the three-step loop:

### Step 1: Rapid human dictation
Record a voice memo or write a raw brain-dump. Focus entirely on the technical problem, the friction you hit, and the solution that worked. Do not pause to fix grammar or structure.

### Step 2: Local low-latency copyediting
Run the local Gemma 4 runner on Apple Silicon with the Round 4 fine-tuned adapter:

```bash
# Review a draft against voice standards
python3 scripts/local_gemma.py review portfolio/content/writing/my-draft.md --adapter-path adapters/gemma-4-26b-ryan-voice-v4

# Rewrite raw dictation into clean prose
python3 scripts/local_gemma.py edit "Raw messy notes here..." --adapter-path adapters/gemma-4-26b-ryan-voice-v4
```

### Step 3: Mechanical gates and human review
Run deterministic checks for em-dashes and banned buzzwords, then perform final human verification:

```bash
# Run content and style linters
npm run check:content
```

Verify every metric against live traces, check attribution, and make the final editorial call.

## What we learned

1. **The human provides 100% of the narrative direction and factual spine:** The model acts as a low-latency copyeditor and sounding board.
2. **Separate deterministic gates from model weights:** Model weights suppress tokens probabilistically; regex linters eliminate em-dashes and hype words deterministically.
3. **Use the right model for the job:** Use frontier cloud models for deep research synthesis and wide-context tool reasoning. Use fast, fine-tuned models on Apple Silicon for sub-second copyediting, privacy, and voice preservation.

If you are experimenting with personal fine-tuning or building your own local editorial loops, I would love to hear what your evaluation checks catch. Let me know in the comments!
