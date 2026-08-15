# Ryan Voice Fine-Tuning: Gemma 4 26B-A4B

This directory contains the training data, generation pipeline, held-out evaluation suite, and results for fine-tuning **Gemma 4 26B-A4B** on Ryan Baumann's writing voice.

---

## 1. Overview and Objectives

The goal is to adapt the open-weight **Gemma 4 26B-A4B** model (26B Mixture-of-Experts with 4B active parameters per token) to serve as an authentic writing collaborator. The model assists with drafting, editing, reviewing, and presenting across five core developer platform tasks:

1. **Draft**: Cold generation with opening scenario hooks and growth-backwards framing (*Result $\rightarrow$ Shipped $\rightarrow$ Lesson*).
2. **Edit / Rewrite**: Transforming passive corporate text into concise, active first-person copy with contractions and zero em-dashes.
3. **Critique**: Diagnosing tone, structure, and cliché failures with actionable remediation steps.
4. **Headline**: Brainstorming thesis-first, misconception-led title variations.
5. **Present**: Structuring demo-first talk abstracts, deck outlines, and practitioner speaker notes.

---

## 2. Dataset Architecture

The fine-tuning dataset is generated deterministically from source text using `scripts/generate-ft-dataset.py`.

### Task Distribution (129 Examples Total)

| Task Type | Examples | % of Dataset | Description |
|---|---|---|---|
| **Draft** | 49 | 38.0% | Full Field Notes, section-level deep dives, and work case studies. |
| **Edit** | 33 | 25.6% | Corporate/passive paragraph pairs mapped to authentic first-person rewrites. |
| **Critique** | 28 | 21.7% | Degraded drafts paired with diagnostic critique and line-by-line fixes. |
| **Headline** | 10 | 7.8% | Sets of 6–8 thesis-driven, misconception-first title variants per topic. |
| **Present** | 4 | 3.1% | Demo-first talk abstracts and slide outlines. |
| **Out-of-Domain (OOD)** | 5 | 3.8% | Voice transfer tests on novel topics (gravel racing, espresso, bridge engineering). |

### Data Splits

- **Training (`training/dataset.jsonl`)**: 117 examples (90%)
- **Validation (`training/validation.jsonl`)**: 12 examples (10%)
- **Held-Out Test (`eval/prompts.jsonl`)**: 20 unseen prompts evaluated after training

### Format Specifications (Examples)

#### Example 1: Edit Task
```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are Ryan Baumann's writing voice. You draft, edit, rewrite, critique, and present in his style: first person, active, direct. Growth-backwards framing. Lead with the result, then what shipped, then the lesson. Conversational but evidence-led. Use contractions. No em-dashes. No passive voice for your own work. When editing, preserve the author's intent while shifting register and structure to match Ryan's patterns. When drafting from scratch, open with a real scenario or quoted objection, not a thesis statement."
    },
    {
      "role": "user",
      "content": "[Task: Edit]\nRewrite this corporate draft in Ryan's voice:\n\nOur team leveraged resources to deliver an API migration..."
    },
    {
      "role": "assistant",
      "content": "I led the API migration to eliminate unnecessary database round-trips. We cut query latency by 40%..."
    }
  ]
}
```

#### Example 2: Critique Task
```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are Ryan Baumann's writing voice. You draft, edit, rewrite, critique, and present in his style: first person, active, direct. Growth-backwards framing. Lead with the result, then what shipped, then the lesson. Conversational but evidence-led. Use contractions. No em-dashes. No passive voice for your own work. When editing, preserve the author's intent while shifting register and structure to match Ryan's patterns. When drafting from scratch, open with a real scenario or quoted objection, not a thesis statement."
    },
    {
      "role": "user",
      "content": "[Task: Critique]\nCritique this draft section and explain what Ryan would fix:\n\nWe are pleased to announce our revolutionary new developer tool..."
    },
    {
      "role": "assistant",
      "content": "This draft falls into classic corporate patterns. Here is what to fix:\n\n1. **Kill the hype:** 'Pleased to announce' hides the developer capability. Open on the friction the tool solves.\n2. **Strip filler:** Remove buzzwords like 'revolutionary'. Let the benchmarks and real traces speak for themselves.\n3. **Use contractions:** Use 'we've', 'don't', 'it's' to maintain a conversational register."
    }
  ]
}
```

---

## 3. Training Approach and Configuration

The model was trained using Supervised Fine-Tuning (SFT) with LoRA on Google Cloud Vertex AI Managed Tuning.

### Hyperparameters

- **Base Model**: `google/gemma-4-26b-a4b-it`
- **Method**: Parameter-Efficient Fine-Tuning (LoRA / PEFT)
- **Epochs**: 4
- **Adapter Size / Rank ($r$)**: 4
- **Learning Rate Multiplier**: 1.0
- **Context Length**: 4,096 tokens
- **Output Artifact**: `projects/${PROJECT_ID}/locations/us-central1/models/ryan-voice-gemma-4-26b-v1`

---

## 4. Evaluation and Results

Evaluation was conducted against **20 held-out prompts** spanning all 5 task categories. Outputs were generated on an ephemeral GPU endpoint and saved to `eval/results/finetuned/`.

Detailed qualitative breakdowns and task comparisons are documented in [`eval/summary.md`](eval/summary.md).

### Summary of Behavioral Improvements

1. **Elimination of Hype and Fluff**: The tuned model automatically strips corporate buzzwords (*"excited to announce"*, *"game-changer"*, *"leverage"*) and opens with developer capability.
2. **Zero Em-Dashes**: Consistently uses colons, periods, and semicolons instead of em-dashes.
3. **Growth-Backwards Structure**: Organizes drafts around *Result $\rightarrow$ Shipped $\rightarrow$ Lesson*.
4. **Out-of-Domain Generalization**: Successfully applies Ryan's pacing, cadence, and vulnerability to non-technical topics like gravel racing and espresso extraction without collapsing into generic assistant voice.

---

## 5. Directory Structure

```text
experiment/voice-ft/
├── README.md                          # This experiment document & template
├── eval/
│   ├── prompts.jsonl                  # 20 held-out test prompts
│   ├── summary.md                     # Comprehensive qualitative evaluation report
│   └── results/
│       └── finetuned/                 # Raw predictions from the fine-tuned model (eval_01 - eval_20)
└── training/
    └── .gitignore                     # Gitignores generated training JSONL datasets
```

---

## 6. How to Run

### Regenerate the Dataset

```bash
python3 scripts/generate-ft-dataset.py
```

### Local Execution (Apple Silicon MLX)

Review, edit, or critique any file locally using Metal acceleration:

```bash
# Review a note
./scripts/gemma-local.sh review portfolio/content/writing/fine-tuning-was-the-easy-part.md

# Edit text
./scripts/gemma-local.sh edit "Corporate text here..."

# Draft new content
./scripts/gemma-local.sh draft "Topic outline..."
```

### Cloud Execution (Vertex AI Ephemeral Endpoint)

```bash
# Check endpoint status
python3 scripts/ryan_voice.py status

# Spin up endpoint, run review, spin down
python3 scripts/ryan_voice.py review portfolio/content/writing/my-post.md
```
