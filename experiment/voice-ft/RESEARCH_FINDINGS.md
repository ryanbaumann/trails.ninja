# Empirical Research & Experiment Findings: Local Voice Fine-Tuning

Author: Ryan Baumann  
Date: August 16, 2026  
Repository: `ryanbaumann/fieldwork` (`experiment/voice-ft/`)  
Hardware: Apple M4 Pro (48 GB Unified Memory, 16-core Neural Engine / Metal GPU)

---

## 1. Executive Summary

This document synthesizes findings from six rounds of local Parameter-Efficient Fine-Tuning (QLoRA) and evaluation on Apple Silicon Metal, adapting open-weight language models to Ryan Baumann's authentic engineering voice, rhythm, and editorial standards.

### Key Takeaways

1. **Architecture Tradeoffs (Dense vs MoE)**:
   - **Gemma 4 31B Dense** outperforms **Gemma 4 26B-A4B MoE** on complex, diffuse stylistic constraints (35% vs 25% clean pass rate on held-out suite; 100% vs 91% fact preservation; 55% reduction in verbatim echoes).
   - **Gemma 4 26B-A4B MoE** achieves ~3x faster interactive token generation (~2.5s vs ~8.1s per item on Metal), making it optimal for interactive completions, headline brainstorming, and short social packaging.
2. **Dataset & Loss Engineering**:
   - Training with `--mask-prompt` (completion-only loss) is mandatory; full-sequence loss causes models to memorize and regurgitate system prompts and task tags.
   - Paragraph-level micro-pairs (100–250 words) prevent sequence truncation, reduce peak training VRAM from 36.8 GB to 23.8 GB, and improve task boundary clarity.
   - Surgical edit pairs that explicitly preserve exact numbers, metrics, and entity names prevent hallucination and anchor true copyediting behavior.
3. **Evaluation Dynamics**:
   - Multi-dimensional bounded checks (`G-EDIT-DELTA`, `G-EDIT-PRESERVE`, `G-EDIT-TARGET`, `G-FACT-KEEP`) are required; single similarity scores fail to distinguish between verbatim copying and destructive overwriting.
   - Mechanical link resolvers with arithmetic verification reject fabricated arXiv and DOI identifiers offline before network queries.
   - Dynamic token budgeting across task categories eliminates artificial truncation artifacts on length-sensitive tasks.
4. **Hardware & Metal Execution**:
   - Strictly serialize training and evaluation jobs on Apple Silicon unified memory. Parallel runs trigger memory spikes (>55 GB), Metal compute graph contention, gradient instability, and kernel stalls.

---

## 2. Experimental Evolution Across Rounds 1–6

| Round | Model Architecture | Dataset Size & Strategy | Training Parameters | Peak RAM | Empirical Outcome |
|---|---|---|---|---|---|
| **Round 1** | Gemma 4 26B-A4B (4-bit) | 159 pairs, full-sequence loss, full-length essay sections | 468 iters, lr=1.5e-4 | 36.8 GB | Memorized system prompt and `[Task: Edit]` tags; sequence truncations. |
| **Round 2** | Gemma 4 26B-A4B (4-bit) | 159 pairs, `--mask-prompt`, sliced sections | 250 iters, lr=1.5e-4 (7 epochs) | 23.8 GB | Eliminated prompt memorization; severe token repetition loops (`G-LOOP`). |
| **Round 3** | Gemma 4 26B-A4B (4-bit) | 159 pairs, reduced learning rate | 100 iters, lr=5e-5 (~2 epochs) | 29.8 GB | Identified optimal epoch window (1.5–2.5 epochs); fluid cadence restored. |
| **Round 4** | Gemma 4 26B-A4B (4-bit) | 218 micro-pairs, native chat template | 150 iters, lr=8e-5 | 24.5 GB | Stylistic register transferred; judgment failed (1/6 clean on 6-item set; fabricated citation `arxiv.org/abs/24606.24282`). |
| **Round 5** | Gemma 4 26B-A4B (4-bit) | 221 micro-pairs, warmup + cosine decay | 200 iters, lr=5e-5 → 1e-6 | 31.5 GB | Fixed learning rate schedule; expanded held-out eval suite from 6 to 48 items; verified zero 8-word shingle leakage. |
| **Round 6 (MoE)** | Gemma 4 26B-A4B (4-bit) | 245 micro-pairs (surgical edits + negative grounding) | 300 iters, lr=5e-5 → 1.6e-6 | 38.6 GB | Fixed Draft task clean pass rate to 50% (4/8 items); fast ~2.5s interactive turnaround. |
| **Round 6 (Dense)** | Gemma 4 31B Dense (4-bit) | 245 micro-pairs (surgical edits + negative grounding) | 300 iters, lr=5e-5 → 1.6e-6 | 41.2 GB | Achieved highest overall quality: 35% clean pass rate (17/48 items, 95% CI 23–50%), 100% fact retention, zero loops, 55% fewer echoes. |

---

## 3. Dense 31B vs MoE 26B-A4B Head-to-Head Comparison

Evaluation conducted across the frozen 48-item held-out evaluation suite (`experiment/voice-ft/eval/heldout.jsonl`) with identical random seeds (`seed=11`, `temp=0.7`).

### 3.1 Quantitative Scorecard

| Metric / Check | Gemma 4 26B-A4B MoE (`round6_dynamic`) | Gemma 4 31B Dense (`round6_dense`) | Delta / Advantage |
|---|---|---|---|
| **Clean Pass Rate (All Error Checks)** | 12 / 48 (25%, 95% CI 15–39%) | **17 / 48 (35%, 95% CI 23–50%)** | **+10% absolute gain (+42% relative)** |
| **Total Error-Level Violations** | 56 | **39** | **-30.4% error reduction** |
| **Fact Retention (`G-FACT-KEEP`)** | 10 / 11 (91%) | **11 / 11 (100%)** | **Dense: 0 dropped facts** |
| **Verbatim Echo Reduction (`G-ECHO`)** | 37 / 48 passed (11 fails) | **43 / 48 passed (5 fails)** | **-54.5% fewer echo failures** |
| **Edit Preservation (`G-EDIT-PRESERVE`)** | 9 / 15 passed (60%) | **13 / 15 passed (87%)** | **+27% preservation rate** |
| **Repetition Loops (`G-LOOP`)** | 46 / 48 (2 loops detected) | **48 / 48 (0 loops detected)** | **Dense: zero token loops** |
| **Average Generation Latency / Item** | **~2.5 seconds** | ~8.1 seconds | **MoE is ~3.2x faster** |

### 3.2 Performance by Task Type

```
Task Clean Pass Rates (Round 6 Dense vs MoE):
┌────────────────────────────────────────────────────────┐
│ Task        │ MoE (26B-A4B)    │ Dense (31B)           │
├─────────────┼──────────────────┼───────────────────────┤
│ Edit (14)   │ 2 / 14 (14%)     │ 2 / 14 (14%)          │
│ Critique (9)│ 0 / 9  (0%)      │ 3 / 9  (33%)  ▲ +3    │
│ Headline (6)│ 2 / 6  (33%)     │ 3 / 6  (50%)  ▲ +1    │
│ Draft (8)   │ 4 / 8  (50%)     │ 2 / 8  (25%)  ▼ -2    │
│ OOD (6)     │ 2 / 6  (33%)     │ 4 / 6  (67%)  ▲ +2    │
│ Present (5) │ 2 / 5  (40%)     │ 3 / 5  (60%)  ▲ +1    │
└────────────────────────────────────────────────────────┘
```

### 3.3 Architectural Analysis

Why does Dense 31B outperform MoE 26B-A4B on stylistic transfer?

- **Stylistic features are diffuse**: Writing register, rhythm, syntax variety, and structural pivots are distributed across global semantic representations rather than isolated into discrete domain clusters.
- **LoRA capacity allocation**: On Dense 31B, low-rank updates modify attention projections and feed-forward networks across all 31B active parameters. On MoE 26B-A4B, only ~4B parameters are active per token, and expert routing mechanisms can fragment style signals across experts during generation.
- **Latency vs Quality Frontier**: Where real-time interactive response is critical (headline drafting, interactive CLI editing), MoE 26B-A4B provides unmatched developer responsiveness. Where rigorous critique and long-form narrative consistency are required, Dense 31B provides superior fidelity.

---

## 4. Hardware Optimization & Apple Silicon Metal Dynamics

Fine-tuning 20B+ parameter models on Apple Silicon (M4 Pro unified memory) introduces unique memory constraints:

```mermaid
flowchart TD
    subgraph Unified Memory (48GB/64GB)
        BaseWeights["Base Model 4-bit Weights (~15-18 GB)"]
        LoRAWeights["LoRA Rank-16 Adapters (~1.2 GB)"]
        MetalGraph["Metal Compute Graph & Activations (~6-12 GB)"]
        GradBuffer["Optimizer States & Gradients (~4-8 GB)"]
    end

    subgraph Optimization Controls
        P1["batch_size: 1"] --> GradBuffer
        P2["pad_to_max_length: false"] --> MetalGraph
        P3["max_seq_length: 1024-1536"] --> MetalGraph
        P4["steps_per_eval: 9999 (No mid-eval)"] --> MetalGraph
        P5["pgrep process locks"] --> BaseWeights
    end
```

### Critical Operating Rules

1. **Zero Concurrent ML Jobs**: Apple Silicon shares unified memory between CPU and GPU. Running multiple fine-tuning processes concurrently causes memory thrashing (>55 GB allocated), Metal context resets, and kernel panics.
2. **Pre-flight Concurrency Lock**: All execution scripts must execute `pgrep -f "mlx_lm.lora|voice_eval"` before starting.
3. **Dynamic Sequence Padding**: Disable static batch padding (`pad_to_max_length: false`) and cap sequence lengths to 1024–1536 tokens to minimize attention activation memory.
4. **Bypass Mid-Training Validation Graphs**: Set `steps_per_eval: 9999` and remove `valid.jsonl` during training runs to avoid secondary compute graph allocations in Metal.

---

## 5. Model Routing & Operational Strategy

To balance latency and analytical depth across workflows, automated routing is codified in `scripts/local_gemma.py`:

| Workflow Task | Command | Target Model & Adapter | Rationale |
|---|---|---|---|
| **Editorial Review & Critique** | `npm run voice:review -- <file>` | **Gemma 4 31B Dense** (`adapters/gemma-4-31b-ryan-voice-v6`) | Maximizes narrative coherence, structure analysis, and fact retention. |
| **Surgical Copyediting** | `npm run voice:edit -- "<text>"` | **Gemma 4 26B MoE** / **31B Dense** | MoE for fast interactive rewrites; Dense for complex paragraph edits. |
| **Headline Generation** | `npm run voice:headline -- "<topic>"` | **Gemma 4 26B MoE** (`adapters/gemma-4-26b-ryan-voice-v6`) | ~3s latency for generating 8 thesis-driven headline variants. |
| **Social Media Packaging** | `npm run voice:social -- <file>` | **Gemma 4 26B MoE** (`adapters/gemma-4-26b-ryan-voice-v6`) | Rapid generation of tight (<120 word) developer-focused posts. |
| **Citation Verification** | `npm run eval:citations -- --file <file>` | **Deterministic Python Resolver** | Instant offline arXiv/DOI format validation + cached online HTTP resolution. |
| **Leakage Audit** | `npm run eval:leakage` | **Deterministic Shingle Checker** | Asserts zero 8-word shingle overlap between training and held-out splits. |

---

## 6. Research Questions & Future Directions

1. **Direct Preference Optimization (DPO)**: Can pairwise preference tuning over the 48-item evaluation suite resolve the remaining `G-ECHO` and `G-EDIT-DELTA` edge cases without degrading conversational cadence?
2. **Quantization Scaling**: Does 8-bit or unquantized float16 LoRA on cloud endpoints (Vertex AI / A100) yield measurable quality improvements over 4-bit OptiQ on Apple Silicon?
3. **Cross-Architecture Validation**: Evaluating whether Qwen 3.8 27B or Gemma 4 12B Dense replicate these scaling dynamics.
