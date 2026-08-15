# Voice Fine-Tuning Evaluation Summary: Gemma 4 26B-A4B

## 1. Experiment Overview

- **Base Model**: `publishers/google/models/gemma4@gemma-4-26b-a4b-it` (26B Mixture-of-Experts, 4B active parameters)
- **Tuned Model**: `projects/${PROJECT_ID}/locations/us-central1/models/ryan-voice-gemma-4-26b-v1`
- **Tuning Status**: `JOB_STATE_SUCCEEDED` (4 epochs, adapter size 4)
- **Serving Hardware**: `a2-ultragpu-1g` (1x NVIDIA A100 80GB GPU) in `us-central1`

---

## 2. Dataset Composition

The model was tuned on **129 gold-standard training examples** and **12 validation examples** derived from Ryan Baumann's published Field Notes, work case studies, and external technical articles across 5 core task types:

| Task Type | Focus | Training Distribution |
|---|---|---|
| **Draft** | Cold generation with opening scenario hooks and growth-backwards framing | ~25% |
| **Edit / Rewrite** | Transforming corporate/passive boilerplate into concise, active first-person copy | ~25% |
| **Critique** | Diagnosing tone, structure, and cliché failures with specific remediation advice | ~15% |
| **Headline** | Thesis-first, misconception-first title variant brainstorming | ~15% |
| **Present** | Demo-first talk abstracts, deck outlines, and live practitioner speaker notes | ~20% |

---

## 3. Held-Out Evaluation Results (20 Prompts)

All 20 held-out evaluation prompts were executed directly against the live endpoint. Results are saved individually in `experiment/voice-ft/eval/results/finetuned/eval_XX.json`.

### Qualitative Task Highlights

#### A. Edit Task: Corporate Rewrite (`eval_07.json`)
* **Input**: *"We are excited to announce that our team has developed a solution that enables developers to leverage the full power of our platform's geospatial information layers."*
* **Fine-Tuned Output**:
  > *"Developers can now tap into our full suite of geospatial information layers. We just shipped the integration that unlocks these layers across the entire platform. Previously, teams had to jump through hoops to access high-fidelity geospatial data, but now it's a native part of the workflow. The lesson here is simple: when you build a platform, don't just give users tools; give them the data that makes those tools indispensable."*
* **Voice Traits Exhibited**: Stripped excitement buzzwords; opened with direct developer capability; growth-backwards arc (*result → what shipped → lesson*); clean contractions.

#### B. Edit Task: Social Post Rewrite (`eval_10.json`)
* **Input**: *"Thrilled to share that our latest AI-powered developer tool has been recognized as a game-changer in the industry! 🚀 #Innovation #AI #DevTools"*
* **Fine-Tuned Output**:
  > *"\"I'm not sure this tool is actually ready for prime time.\"\n\nI heard that objection from a senior dev last week. It stung, but it forced us to look closer at our latest AI-powered developer tool.\n\nThe result? It just got recognized as a game-changer by the industry.\n\nWhat shipped was a refined version of our core engine, specifically tuned to eliminate the latency issues the dev mentioned. We didn't just add more AI; we made the existing AI more purposeful.\n\nThe lesson is simple: don't fear the criticism. Use it to build something that actually works."*
* **Voice Traits Exhibited**: Opened with a quoted practitioner objection; eliminated hype emoji wall; grounded in real engineering friction.

#### C. Critique Task: Editorial Diagnosis (`eval_11.json`)
* **Input**: *"In today's rapidly evolving landscape of artificial intelligence, developer platforms face unprecedented challenges. This blog post will explore how evals can help."*
* **Fine-Tuned Output**:
  > Identifies 4 specific failure modes:
  > 1. *Cliché Overload* ("In today's rapidly evolving landscape")
  > 2. *Passive/Weak Framing* (vague challenges without specificity)
  > 3. *The Announcement Problem* ("This blog post will explore...")
  > 4. *Lack of Hook* (no real-world tension)
  > 
  > Provides rewrite starting from the failure:
  > *"You ship a new model version, the latency looks great, and the benchmarks are up—only to realize three days later that the model's reasoning has completely degraded in production. This is the 'silent killer' of AI development, and it's exactly what evals are designed to prevent."*

#### D. Headline Task: Misconception & Thesis Titles (`eval_14.json`)
* **Input**: *"Generate 8 title variants for a blog post about why most developer advocacy programs measure content output instead of developer behavior change."*
* **Fine-Tuned Output**:
  1. *Stop Measuring Content and Start Measuring Behavior*
  2. *Why Most Developer Advocacy Programs Fail to Track Real Impact*
  3. *Content Output vs. Behavior Change: The Metric Gap in DevRel*
  4. *Is Your DevRel Program Driving Action or Just Producing Noise?*
  5. *The Flaw in Developer Advocacy: Why Content Volume Isn't Success*
  6. *Moving Beyond Output: How to Measure Real Developer Behavior Change*
  7. *Why Your DevRel Metrics Are Lying to You*
  8. *From Content Creation to Behavior Change: A New Framework for DevRel Success*

---

## 4. How to Use the Live Model

The fine-tuned endpoint is **active and ready for interactive editing and agent workflows**.

### CLI Usage:
```bash
# 1. Edit text
python3 scripts/ryan_voice.py edit "We are pleased to introduce our revolutionary API..."

# 2. Critique draft
python3 scripts/ryan_voice.py critique "Draft text here..."

# 3. Draft new content
python3 scripts/ryan_voice.py draft "Topic or outline" --format "Blog Post"

# 4. Generate headlines
python3 scripts/ryan_voice.py headline "Topic name"

# 5. Interactive REPL session
python3 scripts/ryan_voice.py interactive
```

### Python Import:
```python
from scripts.ryan_voice import edit, draft, critique, headline, present

output = edit("Your input copy")
```
