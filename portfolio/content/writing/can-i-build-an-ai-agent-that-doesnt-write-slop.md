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

- **Clean Pass Rate**: **54%** on Gemma 4 31B Dense (26/48 items passed every error-level check; 95% CI 40–67%) and **42%** on Gemma 4 26B-A4B MoE, up from **23% in Round 7** and **31% on base Gemma 4**.
- **Headline Format (`G-HEADLINE-*`)**: **100%** pass rate across count, variety, slot constraints, and length boundaries.
- **Hype Bench (`G-HYPE` & `G-AI-TELLS`)**: **98%** clean pass rate (47/48 items), systematically removing marketing superlatives and stock AI phrases.
- **Em-Dash Suppression (`G-EMDASH`)**: **98%** pass rate (47/48 items) on 31B Dense and **100%** (48/48 items) on 26B-A4B MoE.

To see whether this made a practical difference, let's compare three approaches on copy writing tasks.

## Side-by-Side Experiments

1. **Pipeline A (Base Frontier)**: Gemini 3.7 Flash with a standard zero-shot prompt.
2. **Pipeline B (Prompted Skill)**: Gemini 3.7 Flash equipped with my full in-context voice rules.
3. **Pipeline C (Fine-Tuned Round 8 LoRA)**: Gemma 4 26B-A4B and Gemma 4 31B Dense fine-tuned on the curated dataset via QLoRA.

### Task 1: Status Report to Builder Voice

The input is a passive, hype-heavy status draft for a real platform tool (Google Maps Platform Code Assist MCP):

<!-- lint-ignore -->
> *"Leadership was provided to build and ship Code Assist: a cutting-edge MCP server that empowers AI coding agents with official documentation. By leveraging state-of-the-art semantic retrieval across our entire SDK footprint, hallucination rates were significantly mitigated and developer velocity was supercharged across 3,500 active weekly integration sessions."*

I asked each model to rewrite this passive status report into a direct builder voice while keeping every metric intact.

| Pipeline A (Base Frontier) | Pipeline B (Prompted Skill) | Pipeline C (Fine-Tuned Round 8 LoRA) |
|---|---|---|
| "We're thrilled to share the launch of Code Assist! 🚀 This game-changing MCP server empowers AI agents with official documentation and code samples. Thanks to semantic retrieval, developers are seeing massive productivity boosts across 3,500 weekly sessions! Kudos to the team for making this milestone happen! #AI #Innovation" | "Our team built and shipped Code Assist: an MCP server that grounds AI coding agents in official documentation, code samples, and architecture guides. I led the technical strategy. Connecting agents directly to current API documentation reduced outdated syntax errors across 3,500 weekly integration sessions. When agents work from current docs instead of training memory, developers spend less time fixing broken imports." | "Our team shipped Code Assist: an MCP server that grounds AI coding agents in official documentation and code samples through retrieval. I led the strategy and stayed close to the implementation. Connecting agents to current API surfaces dropped outdated syntax errors across 3,500 weekly sessions." |

**The difference**: Between the prompted frontier model and the fine-tuned local model, both cleanly stripped corporate cheerleading and kept the exact metric (3,500 sessions). But the fine-tuned model absorbed the preference for active builder verbs (`shipped`, `led`, `stayed close`) without needing a long list of negative prompt instructions.

### Task 2: Voice Memo to Technical Post-Mortem

The input is an unstructured voice memo captured while troubleshooting local fine-tuning memory crashes on Apple Silicon:

> *"So yeah basically I was looking at why our local fine-tuning run was locking up the GPU after 40 steps on Apple Silicon, and it turned out we had mid-training validation loops evaluating the full dataset with dynamic padding in Metal, so we set steps_per_eval to 9999, dropped the batch size to 1 with max_seq_length capped at 1024, and training memory dropped from 28GB down to 6.2GB with zero device stalls."*

I asked the models to turn this dictation into a clean technical post-mortem without inventing new statistics.

| Pipeline A (Base Frontier) | Pipeline B (Prompted Skill) | Pipeline C (Fine-Tuned Round 8 LoRA) |
|---|---|---|
| In modern machine learning workloads on Apple Silicon, unified memory contention during fine-tuning can cause severe GPU thrashing. After 40 steps, our pipeline encountered memory exhaustion. Investigation revealed unoptimized validation loops with dynamic padding. By configuring steps_per_eval to 9999, batch size to 1, and max_seq_length to 1024, unified memory consumption dropped from 28GB to 6.2GB. According to industry studies, optimizing Metal sequence padding improves throughput by over 65%. | Forty steps into our local fine-tuning run, Apple Silicon locked up. The culprit was memory contention: mid-training validation loops were evaluating the entire dataset using dynamic padding, forcing Metal to reallocate GPU buffers on every step. I made two adjustments: setting `steps_per_eval: 9999` to disable mid-run evals, and capping `max_seq_length: 1024` with `batch_size: 1`. Unified memory footprint dropped from 28GB down to 6.2GB, and the training run finished without a single stall. | "Forty steps into our fine-tuning run on Apple Silicon, the GPU stalled. The root cause was simple: our mid-training validation loop evaluated the full dataset with dynamic sequence padding, triggering constant Metal buffer reallocations.<br><br>I made two adjustments: I set `steps_per_eval: 9999` and capped `max_seq_length: 1024` with `batch_size: 1`. Peak memory usage dropped from 28GB down to 6.2GB, and the run completed without a single device reset." |

**The difference**: The baseline frontier model hallucinated a fake 65% throughput statistic. Both the prompted and fine-tuned models preserved the exact technical flags (`steps_per_eval: 9999`, `max_seq_length: 1024`, `28GB down to 6.2GB`). The fine-tuned model structured the post-mortem naturally with a clean paragraph break and colon pivot without prompt coaxing.

### Task 3: Editorial Critique on a Real Draft

The input is the actual draft opening of this very essay:

<!-- lint-ignore -->
> *"We all know raw AI copy is bland and predictable: cheerful, generic, and full of buzzwords. I don't want an AI to write for me; I want a rubber duck that can keep up with my rambling thoughts and help me get them onto the page before the inspiration fades."*

The instructions: critique this draft against our core editorial and voice standards.

| Pipeline A (Base Frontier) | Pipeline B (Prompted Skill) | Pipeline C (Fine-Tuned Round 8 LoRA) |
|---|---|---|
| Great draft! It is engaging, punchy, and uses relatable analogies like "rubber duck" to build rapport with developers. The conversational tone makes the premise immediately accessible and ready to publish. | This draft breaks two style guidelines:<br>1. **Opening generalization**: "We all know..." relies on assumed consensus rather than direct evidence.<br>2. **Cliché analogy**: "Rubber duck" is overused in tech commentary.<br>3. **Structure**: Lead with concrete developer friction. | "This opening has two core weaknesses:<br><br>1. **Problem framing**: 'We all know...' opens with a generalized consensus statement rather than real developer friction.<br>2. **False antithesis flip**: 'I don't want an AI to write for me; I want a rubber duck...' is a classic 'not X, but Y' false dichotomy.<br><br>Lead directly with the friction: spending more time debugging an agent's generic draft than writing the post from scratch." |

**The difference**: The baseline model offered generic cheerleading. The prompted model operated like a compliance checklist. The fine-tuned Gemma 31B Dense model provided the exact editorial insight that reshaped this article's opening: diagnosing the "not X, but Y" antithesis tell and proposing the friction-first lead.

### Comparison Summary

| Task | Base Frontier (Gemini 3.7 Flash) | Prompted Skill (Gemini 3.7 + Skill) | Fine-Tuned Round 8 LoRA (Gemma 4) |
|---|---|---|---|
| **1. Status Report Rewrite** | Added announcement clichés, hashtags, and congratulatory filler. | Stripped buzzwords cleanly; produced clear but slightly stiff prose. | Rewrote into natural builder voice; preserved exact metrics (3,500 sessions). |
| **2. Voice Memo Cleanup** | Invented a fake 65% throughput benchmark and textbook throat-clearing. | Preserved exact configuration numbers; followed clean structural rules. | Captured natural rhythm, colon pivots, and trade-offs without hallucination. |
| **3. Editorial Critique** | Flattered the draft ("Great opening! Ready to publish!"). | Flagged style rules like a checklist. | Diagnosed false antithesis flips and proposed the friction-first framing used in this essay. |

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
