---
title: Can AI Be My Copy Editor Without Slopifying Everything?
summary: I set out to build an AI writing partner with real taste. Prompt engineering hits a ceiling where RLHF flattens prose into corporate mush, while fine-tuning risks hallucinating the shape of evidence. Here is what happened when I trained and tested a custom voice model.
date: 2026-08-15
updated: 2026-08-15
canonical: https://ryanbaumann.dev/writing/i-use-the-untuned-one/
tags: ["ai", "evals", "field notes"]
draft: true
noindex: true
stageSocial: false
image: /img/writing/i-use-the-untuned-one-header.svg
imageAlt: "Two paths side by side: a cloud tune on an A100 with 117 training examples that invented a percentage in four of twenty held-out outputs, and a laptop running the base model with no training examples whose edits shipped."
socialImage: /social/i-use-the-untuned-one.jpg
shareTitle: Can AI Be My Copy Editor Without Slopifying Everything?
shareSummary: Prompt engineering hits a wall when default RLHF flattens prose toward corporate mush. Academic research proves fine-tuning captures voice, but small datasets create overfitting traps. Here is the workflow that actually works.
shareImageAlt: A social card setting a rented A100 that produced invented percentages against a laptop running a prompted base model whose edits shipped.
---

Here is how my writing process usually falls apart:

I dictate a messy voice memo on a trail run or dump four hundred words of raw notes into a text editor. I hand that rough draft to a frontier model to polish and structure. Thirty seconds later, the model returns a grammatically spotless draft that opens with "In today's fast-paced technological landscape" and leans on three false dichotomies before the second paragraph.

I open the file, take a digital red pen to the text, delete half the adjectives, restore my syntax, and basically rewrite the entire piece from scratch.

It is not productive. When you spend more time stripping out generic AI filler than you would have spent drafting by hand, the tool is a distraction.

I wanted to see if I could make an AI copywriter and brainstormer actually have taste I like and would write with. Not an autonomous bot to write the post for me; I want to own the thinking, the technical friction, and the argument. I wanted a real writing partner I can trust to speak in my voice for drafting, reviewing, and tightening prose without stripping away the rhythm.

## Four ways to steer a model, and where each hits a wall

Before jumping into fine-tuning, I systematically tested the four levels of model steering to find where each approach breaks down:

1. **Context Engineering:** I started by loading frontier models with my [portfolio writing style guide](https://github.com/ryanbaumann/fieldwork/blob/main/.agents/skills/portfolio-writing/SKILL.md). I specified sentence length variance targets, provided few-shot examples from published case studies, and added negative rules against em-dashes and hype adjectives.
2. **Agentic Workflows:** When single prompts plateaued, I built multi-agent loops. I fanned out candidate drafts across three parallel subagents (analytical, scene-led, and staccato), then used an independent judge subagent to evaluate and synthesize the results against structured voice rubrics.
3. **Model Exploration:** I tested different frontier architectures, including Gemini 3.7 Flash, GPT-5.6, and Fable. Each model brought distinct traits; Gemini was sharp on technical architecture, GPT-5.6 maintained tight narrative coherence, and Fable leaned into stylistic experimentation. But every frontier model shared the same underlying friction: heavy RLHF tuning that pulls prose toward a polite, sanitized corporate mean. No matter how much context engineering or agent orchestration I wrapped around them, the outputs defaulted to generic transitions, uniform paragraph lengths, and predictable rhetoric.
4. **Base Model Fine-Tuning:** When prompting and agentic loops hit their ceiling, the next step was fine-tuning an open-weight base model directly on my own writing corpus to reshape its underlying token probabilities.

## The empirical evidence: University of Michigan research

That progression from prompting to fine-tuning is supported by academic research.

A landmark study from the University of Michigan (*Dhillon et al., 2026*, co-authored by Paramveer Dhillon, Tuhin Chakrabarty, and Jane C. Ginsburg) tested whether generative models could genuinely replicate authorial voice. The researchers evaluated state-of-the-art models against professional writers and evaluated the outputs using blind pairwise reviews by MFA writing experts from top U.S. programs:

- **In-Context Prompting:** When models were prompted with author guidelines and in-context examples, MFA judges easily identified the AI-generated prose. The expert judges preferred authentic human writing **82.7% of the time**. Prompting produced superficial mimicry, not true voice.
- **Fine-Tuning on Full Corpora:** When models were fine-tuned directly on an author's complete body of work, the preference completely flipped. The expert judges favored the fine-tuned AI output **62% of the time** for stylistic fidelity, narrative pacing, and sentence cadence.

Prompting gives the model instructions; fine-tuning changes the underlying math. If expert readers cannot reliably distinguish fine-tuned outputs from human prose, personal fine-tuning is the only viable technical path for deep voice preservation.

## The experiment: fine-tuning on Vertex AI and Apple Silicon

Motivated by those findings, I set out to fine-tune an open-weight model directly on my own writing.

I had an added motivation: I wanted to test what I could run locally on my MacBook using Apple Silicon and MLX. Running on-device eliminates GPU rental bills and keeps raw, unvarnished drafts completely private. You should own your intelligence, especially when it comes to personal taste and unreleased ideas.

I built a [dataset generation script](https://github.com/ryanbaumann/fieldwork/blob/main/scripts/generate-ft-dataset.py) to extract 117 gold-standard training examples directly from my published [writing and case studies](https://github.com/ryanbaumann/fieldwork/tree/main/portfolio/content). The dataset spanned five core tasks: Draft, Edit, Critique, Headline, and Present.

```
[ Markdown Corpus ] -> generate-ft-dataset.py -> 117 Training Examples (JSONL)
                                                        │
                        ┌───────────────────────────────┴───────────────────────────────┐
                        ▼                                                               ▼
            Cloud SFT (Vertex AI)                                           Local MLX (Apple Silicon)
            Gemma 4 26B-A4B (LoRA r=4)                                       Gemma 4 26B-A4B (4-bit Metal)
            1x A100 80GB GPU                                                 Sub-second, zero cloud cost
```

I launched parameter-efficient fine-tuning (LoRA, rank $r=4$, 4 epochs) on Google Cloud Vertex AI with a [custom training harness](https://github.com/ryanbaumann/fieldwork/blob/main/scripts/ryan_voice.py), while also testing a [local Apple Silicon runner](https://github.com/ryanbaumann/fieldwork/blob/main/scripts/local_gemma.py).

## Fine-tuning vs. overfitting

When the training run finished, I deployed the model to an ephemeral GPU endpoint and evaluated it against 20 held-out prompts across all five task categories (archived in the [evaluation summary](https://github.com/ryanbaumann/fieldwork/blob/main/experiment/voice-ft/eval/summary.md)).

The stylistic cadence was immediately noticeable: the fine-tuned model naturally stripped corporate fluff, adopted first-person active verbs, used contractions, and opened on real engineering friction rather than generic announcements.

![A single bar of 117 training examples split by where each target came from: 47 real prose, 27 copies of one identical critique response, 27 synthetic round-trips, 11 from one headline template, 5 hand-written, and a zero-width slice for the Present task with none.](/img/writing/i-use-the-untuned-one-dataset.svg)

However, evaluation against unseen prompts exposed a fundamental trap: **the model learned the shape of evidence without having the evidence itself.**

In four out of twenty held-out outputs, the fine-tuned model invented quantitative metrics out of thin air: 40%, 20%, 15%, and 40%. When given a short 13-word prompt with no numbers, it fabricated a 40% query latency improvement. Because my published case studies frequently cite real platform metrics, the model learned that sounding authentic required citing numbers, so it invented them to satisfy the learned pattern.

This is the central tension of fine-tuning on personal writing: style and cadence transfer remarkably well, but small datasets risk overfitting to specific tokens and hallucinating factual claims.

## What makes fine-tuning work in practice

To make a personal voice model dependable in a real daily workflow, you need clear task boundaries and higher-quality training data:

1. **Pure Dictation-to-Prose Pairs:** Construct training pairs strictly from `[Raw Human Dictation]` $\rightarrow$ `[Final Human Edited Prose]`. Synthetic regex corruptions and machine-damaged round-trips teach the model to repair templates rather than refine natural human speech.
2. **Scope the Task to Copyediting:** Never ask an ungrounded voice model to invent facts or arguments from scratch. When scoped to editing, critique, and syntax polishing over raw human dictation, the model delivers authentic cadence without the risk of hallucinating facts.
3. **Local Fine-Tuning Iterations:** Move the fine-tuning loop directly to Apple Silicon with MLX. Training locally allows rapid dataset experimentation without spinning up cloud GPU infrastructure for every revision.

## Comparative breakdown: prompting vs. fine-tuned local models

When you compare raw human dictation, frontier cloud prompting, and a local fine-tuned model side by side, the tradeoffs become clear:

| Attribute | Raw Dictation | Frontier Prompting (Gemini 3.7 Flash) | Local Fine-Tuned Model |
| :--- | :--- | :--- | :--- |
| **Voice & Tone** | Authentic, raw, idiosyncratic | Homogenized, polite, corporate | Authentic cadence, preserved idioms |
| **Syntax & Pacing** | Run-on clauses, speech stumbles | Rigid, uniform sentence lengths | Dynamic sentence length variance |
| **Cliché Frequency** | Low (natural speech) | High (AI filler, buzzwords, false flips) | Low (suppressed via learned weights) |
| **Round-Trip Latency** | Instant (source thought) | 2.5 to 5.0 seconds (network + cloud) | Sub-second (local Metal GPU) |
| **Data Privacy** | Local device only | Transmitted over third-party API | 100% on-device |
| **Factual Stability** | Grounded in lived experience | Hallucinates plausible filler if unguided | Deterministic when constrained to edit |

Frontier prompted models tend to cluster around 14 to 18 words per sentence with low standard deviation. Authentic human prose swings between punchy 4-word declarations and complex 35-word clauses. A fine-tuned local model preserves that variance instead of averaging it out.

## Before and after: putting the loop to work

To see the difference in practice, look at how the fine-tuned model handles a typical corporate draft versus the refined output:

### Input: Corporate Announcement Draft
```text
We are pleased to announce that our team has developed a solution that enables developers to leverage the full power of our platform's geospatial information layers.
```

### Output: Refined First-Person Prose
```text
Developers can now tap into our full suite of geospatial information layers. We just shipped the integration that unlocks these layers across the entire platform. 

Previously, teams had to jump through hoops to access high-fidelity geospatial data; now it is a native part of the workflow. The lesson here is simple: when you build a platform, do not just give users tools. Give them the data that makes those tools indispensable.
```

The refined version drops the announcement hype, uses active voice, opens with developer capability, and follows a clear growth-backwards progression.

## The workflow: how to run it yourself

To make this workflow reproducible, the entire setup runs with scripts included in this repository.

![Mechanical checks for em-dashes, announcement phrasing, hype words, and repeated phrases stand as gates on the left; on the right, unweighted human judgments about truth, credit, and whether the piece should exist. The two never combine into one score.](/img/writing/i-use-the-untuned-one-gates.svg)

Here is the three-step loop:

### Step 1: Rapid human dictation
Record a voice memo or write a raw brain-dump. Focus entirely on the technical problem, the friction you hit, and the solution that worked. Do not pause to fix grammar or structure.

### Step 2: Local low-latency copyediting
Run the [local Gemma 4 runner](https://github.com/ryanbaumann/fieldwork/blob/main/scripts/gemma-local.sh) on Apple Silicon to clean up syntax and stumbles while preserving your cadence:

```bash
# Review a draft against voice standards
./scripts/gemma-local.sh review portfolio/content/writing/my-draft.md

# Rewrite raw dictation into clean prose
./scripts/gemma-local.sh edit "Raw messy notes here..."
```

### Step 3: Mechanical gates and human review
Run deterministic checks for em-dashes and banned buzzwords, then perform final human verification:

```bash
# Run content and style linters
npm run check:content
```

Verify every metric against live traces, check attribution, and make the final editorial call.

## What we learned

1. **Do not ask an LLM to invent your thesis:** The human provides 100% of the narrative direction and factual spine. The model acts as a low-latency copyeditor and sounding board.
2. **Separate deterministic gates from model weights:** Model weights suppress tokens probabilistically; regex linters eliminate em-dashes and hype words deterministically.
3. **Use the right model for the job:** Use frontier cloud models (like Gemini 3.7 Flash) for deep research synthesis and multi-step tool reasoning. Use fast, fine-tuned models on Apple Silicon for sub-second copyediting, privacy, and voice preservation.

If you are experimenting with personal fine-tuning or building your own local editorial loops, I would love to hear what your evaluation checks catch. Let me know in the comments!
