---
title: Can I Build an AI Agent That Doesn't Write Slop?
summary: I tested prompt engineering and model fine-tuning to see if an AI could act as a faithful copy editor. It's a step in the right direction, but nothing replaces good human judgment.
date: 2026-08-15
updated: 2026-08-18
canonical: https://ryanbaumann.dev/writing/can-i-build-an-ai-agent-that-doesnt-write-slop/
aliases: ["/writing/why-i-fine-tuned-a-26b-model-on-my-laptop-instead-of-prompting-frontier-apis/"]
tags: ["ai", "evals", "field notes"]
draft: false
noindex: false
image: /img/writing/can-i-build-an-ai-agent-that-doesnt-write-slop-header.svg
imageAlt: "A comparison of evaluation approaches: automated graders for code versus human taste for copy editing."
socialImage: /social/can-i-build-an-ai-agent-that-doesnt-write-slop.jpg
shareTitle: Can I Build an AI Agent That Doesn't Write Slop?
shareSummary: I fine-tuned a model on my own writing. Tone transferred. Judgment did not.
shareImageAlt: "A share card illustrating the evaluation gap between automated code graders and human editorial judgment."
---

Raw AI copy is predictable: cheerful, generic, and full of buzzwords. Fixing an agent's generic draft usually takes longer than writing from scratch.

I wanted a private editing agent that matches my cadence, preserves exact benchmark numbers, and challenges weak structure while leaving narrative judgment to me. Here is what worked across prompt engineering and local fine-tuning on Apple Silicon.

## Step 1: How far can we push context engineering?

I started with context engineering: system prompts and skill files containing personal voice guidelines. I wrote detailed rules forbidding em-dashes, stripping hype, adding few-shot examples of my own writing, enforcing active voice, and demanding first-person voice.

Agents with this context followed negative constraints reliably: they stopped using announcement clichés and stripped out obvious marketing filler. But as the rule list grew, the writing became stiff, dry, and repetitive. 

Some models struggled more than others. Claude Opus 5 leaned heavily into self-referential commentary. GPT 5.6 Sol handled technical syntax cleanly but felt robotic. Gemini 3.7 Flash was solid in comparison, but still fell back on stock AI turns like "it's not X, it's Y!". None of them felt like an authentic collaborator on an existing draft.  

## Step 2: Trying some model fine-tuning 

Research from the University of Michigan pointed me in a different direction. In [Readers Prefer Outputs of AI Trained on Copyrighted Books over Expert Human Writers](https://arxiv.org/abs/2510.13939), Chakrabarty, Ginsburg, and Dhillon tested prompted frontier models against fine-tuned models on authorial style. MFA-trained readers strongly disliked agents prompted to mimic a human author (0.16 odds ratio), *but* they favored a fine-tuned model trained on an author's voice (8.16 odds ratio).

I decided to test whether fine-tuning (using QLoRA on Apple Silicon) could teach an open-weight model my own editorial style. I set up an [open-source voice fine-tuning experiment](https://github.com/ryanbaumann/fieldwork/tree/main/experiment/voice-ft) using Gemma 4 series models (Gemma 4 26B-A4B and Gemma 4 31B Dense) because they are among the strongest open models available and compact enough to run locally. I ran the entire training and evaluation loop locally on my M4 Pro MacBook (48 GB unified memory). Keeping it local gave me privacy and fast iterations on training, with zero API costs.

The training setup centered on four components:

1. **Curated dataset**: A 132-example dataset generated from real git diffs of my editing, case studies, field notes, and other writing. It excluded held-out fixtures to eliminate data leakage.
2. **LoRA training config**: Configured for MLX LoRA with rank 16, alpha 32, 16 adapter layers, cosine learning rate decay, and masked prompt loss (`mask_prompt: true`) so gradients updated strictly on target completions rather than prompt scaffolding.
3. **Evals**: A 48-item held-out test suite spanning Draft, Edit, Critique, Headline, Present, and Out-of-Distribution tasks, evaluated across 27 deterministic gates.
4. **Scorecard**: An automated benchmark report tracking exact pass rates, confidence intervals, and failure mode categorizations across every check.

Getting fine-tuning to work reliably on my Macbook M4 Pro took two key adjustments to prevent memory exhaustion:

1. **Mask prompt loss (`--mask-prompt`)**: Standard training calculates loss across both the prompt and the response. On small datasets, this causes prompt echoing and rapid overfitting. Masking forces gradients to update exclusively on the desired assistant tokens.
2. **Slice paragraphs (100–250 words)**: Instead of training on entire essays, I sliced drafts into micro-pairs. These pairs preserved exact metrics while reshaping sentence variety, colon pivots, and active phrasing.

## Evaluation Results

Across the 48-item held-out evaluation suite, the fine-tuned adapter demonstrated significant quantitative improvements over earlier rounds and baseline prompting:

- **Clean Pass Rate**: **54%** Gemma 4 31B Dense (26/48 items passed every error-level check; 95% CI 40–67%).
- **Headline Format**: **100%** pass rate across count, variety, slot constraints, and length boundaries.
- **Hype Bench**: **98%** clean pass rate (47/48 items), removing marketing superlatives and stock AI phrases.
- **Em-Dash**: **98%** pass rate (47/48 items) on 31B Dense and **100%** (48/48 items) on 26B-A4B MoE.

To see whether this made a practical difference on real examples, let's compare three approaches on copy writing tasks.

## Side-by-Side Experiments

1. **Pipeline A (Base Frontier)**: Gemini 3.7 Flash with a standard zero-shot prompt.
2. **Pipeline B (Prompted Skill)**: Gemini 3.7 Flash equipped with my full in-context voice rules.
3. **Pipeline C (Fine-Tuned Round 8 LoRA)**: Gemma 4 26B-A4B and Gemma 4 31B Dense fine-tuned on the curated dataset via QLoRA.

### Task 1: Status Report to Builder Voice

The input is a passive, corporate status report with real metrics:

<!-- lint-ignore -->
> *"Leadership was provided to deploy a caching layer to improve fleet reliability. P99 latency was reduced by 62% (from 840ms to 310ms) across 14 services."*

I asked each pipeline to rewrite this into a direct builder voice without extra fluff.

| Pipeline A (Base Frontier) | Pipeline B (Prompted Skill) | Pipeline C (Fine-Tuned Round 8 LoRA) |
|---|---|---|
| "Led the deployment of a caching layer to enhance fleet reliability. This initiative reduced P99 latency by 62% (from 840ms to 310ms) across 14 services. The change significantly improved system performance and resource efficiency." | "To make our fleet reliable, I deployed a caching layer across 14 services. We cut P99 latency by 62%, dropping it from 840ms to 310ms: our systems don't bottleneck under load anymore." | "I deployed a caching layer across 14 services to improve fleet reliability. P99 latency dropped 62%, from 840ms to 310ms." |

**The difference**: The base frontier model defaulted to corporate passive constructs ("This initiative reduced...", "significantly improved resource efficiency"). The prompted model added active phrasing and a colon pivot. The fine-tuned Gemma 31B model produced the tightest direct summary (121 characters) with zero prompt scaffolding.

### Task 2: Voice Memo to Post-Mortem

The input is an unstructured voice memo capturing a production fix:

> *"Our queue was backing up at 2pm because workers polled Postgres every 2 seconds instead of using push notifications. We changed 90 lines to listen/notify and weekly alarms dropped from 30 to 2."*

I asked each model to turn this dictation into a clean post-mortem opening without inventing external stats.

| Pipeline A (Base Frontier) | Pipeline B (Prompted Skill) | Pipeline C (Fine-Tuned Round 8 LoRA) |
|---|---|---|
| "At 2:00 PM, database polling bottlenecks caused severe queue backups as workers queried Postgres every two seconds. By migrating to a push-based listen/notify pattern with a 90-line patch, we resolved the lag. Weekly alarms dramatically dropped from 30 to 2." | "To stabilize our queue under load, we replaced Postgres polling with push notifications. I shipped a 90-line listen/notify rewrite to stop the 2-second poll spam: weekly alarms dropped from 30 to 2, and we don't see backups at 2 PM." | "Weekly alarms dropped from 30 to 2. At 2pm, our queue backed up because workers polled Postgres every 2 seconds: we changed 90 lines to use listen/notify and fixed it." |

**The difference**: The base model added textbook phrasing ("caused severe queue backups", "dramatically dropped"). The prompted model wrote a clean explanation. The fine-tuned model inverted the structure naturally: leading with the measured outcome first ("Weekly alarms dropped from 30 to 2") before explaining the mechanism.

### Task 3: Editorial Critique on Draft Opening

The input is the original draft opening of this very essay:

<!-- lint-ignore -->
> *"We all know raw AI copy is bland. I don't want an AI to write for me; I want a rubber duck to help me draft."*

The instructions: critique this draft against our editorial and voice standards.

| Pipeline A (Base Frontier) | Pipeline B (Prompted Skill) | Pipeline C (Fine-Tuned Round 8 LoRA) |
|---|---|---|
| "This is a strong, highly relatable opening hook that immediately engages the reader. The rubber duck metaphor works perfectly to explain your collaborative vision. Consider expanding slightly on how this 'rubber ducking' looks in practice to build on this great setup." | "To hook busy developers, we must skip the 'AI is bland' cliché. Let's lead with negative space: define what the rubber duck does and what it doesn't do. Swap the general claim for a concrete draft trace so we don't sound like another marketing page." | "Cut 'We all know'; it's a consensus tell. The second sentence is a false antithesis flip. State what you actually did instead." |

**The difference**: The base model gave 100% conversational praise without diagnosing any issues. The prompted model suggested better framing. The fine-tuned model provided immediate, pinpoint editorial diagnoses: flagging the consensus tell and the false antithesis flip in three concise sentences.

### Comparison Summary

| Task | Base Frontier (Gemini 3.7 Flash) | Prompted Skill (Gemini 3.7 + Skill) | Fine-Tuned Round 8 LoRA (Gemma 4) |
|---|---|---|---|
| **1. Status Report Rewrite** | Added corporate filler ("initiative", "resource efficiency"). | Active voice with clean colon pivot; slightly formulaic. | Ultra-compact builder summary (121 chars); zero prompt scaffolding. |
| **2. Voice Memo Cleanup** | Textbook phrasing ("dramatically dropped", "severe backups"). | Active verbs ("shipped a 90-line rewrite"); clean structure. | Growth-backwards structure; led with the metric drop first. |
| **3. Editorial Critique** | Flattered the draft without spotting stylistic issues. | Advised concrete mechanisms over general claims. | Pinpointed the consensus tell and false antithesis flip in 3 sentences. |

![Three-stage editorial pipeline: Mechanical gates in CI catch em-dashes and banned hype deterministically in milliseconds; Structural flow with prompted models polishes sentence variety and momentum in seconds; Human judgment remains essential to decide real developer friction, honest credit, verifiable citations, and editorial taste.](/img/writing/can-i-build-an-ai-agent-that-doesnt-write-slop-gates.svg)

## What I learned

Fine-tuning open models locally helped me build intuition about where model weights help, where context engineering is enough, and where you need human editorial judgment.

### Where fine-tuning succeeded

1. **Cadence and phrasing**: Learned sentence variety, colon pivots, and concise phrasing directly into weights without a thirty-line prompt constraint.
2. **Data integrity**: 100% retention on held-out benchmark metrics, preserving latencies and dollar figures without dropping numbers.
3. **Peer tone**: Critique read like a technical collaborator challenging credit and demanding concrete mechanisms rather than a pedantic style guide.

### Where fine-tuning failed

1. **Editorial judgment**: Cannot verify if an opening lands on real developer friction, evaluate narrative weight, or confirm whether an engineering metric was measured accurately.
2. **Hallucination**: Style transfers cleanly; facts do not. When asked for supporting evidence, the model still attempted to generate plausible-sounding academic citations that failed offline arithmetic checks.
3. **Maintenance overhead**: Requires rebuilding the dataset and retraining when voice, topics, or focus change.

### The better path

A modular pipeline of deterministic regex linters, a focused structural prompt, and offline link/citation checkers outperforms a single fine-tuned model for everyday writing workflows:

- **A mechanical style linter**: Fast, deterministic regex checks for em-dashes, hype adjectives, and passive stock phrases.
- **A structural flow checker**: A prompted model tasked exclusively with identifying weak openings, rambling paragraphs, and missing transitions.
- **A factual and citation validator**: An offline validator that verifies links, checks arithmetic formats on arXiv IDs, and flags unsourced metrics.

Separating these concerns into small, atomic checks is easier to debug, simpler to maintain, and avoids the overhead of managing local fine-tuning runs. It also reinforces the human-in-the-loop steps that are essential to any good piece of writing: the author's judgment and voice remain the primary driver.

## The verdict

A locally fine-tuned model cannot replace a human editor. Not even close. Human judgment is still the gold standard.

I learned a lot about QLoRA, loss masking, and dataset curation during this build. But the real craft of writing (deciding what matters, verifying evidence, and earning attention) stays with the author. As it should.

If you are running local fine-tuning or building automated checks for your writing, tell me what workflows are working for you in the comments.
