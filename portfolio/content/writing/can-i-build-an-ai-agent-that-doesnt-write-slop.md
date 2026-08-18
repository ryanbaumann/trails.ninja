---
title: Can I Build an AI Agent That Doesn't Write Slop?
summary: I tested prompt engineering and model fine-tuning to see if an AI could act as a faithful copy editor. It's a step in the right direction, but nothing replaces good human judgment.
date: 2026-08-15
updated: 2026-08-17
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

We all know raw AI copy is bland and predictable: cheerful, generic, and full of buzzwords. But can an AI assistant still serve as a drafter and copy editor where I can hand over messy notes, get back a polished draft, and actually ship something good? I wanted to take my best stab at the problem; here's what I tried and learned.

The goal: a fast, private editing agent that understands my cadence, respects my numbers, and critiques my structure, while leaving me firmly in charge of narrative, tone, and judgment. I don't want an AI to write for me; I want a rubber duck that can keep up with my rambling thoughts and help me get them onto the page before the inspiration fades.

## Step 1: How far can we push context engineering?

I started where everyone starts: system prompts and skills containing personal voice context guidelines. I wrote detailed skills and AGENTS.md rules forbidding em-dashes, stripping hype, adding few-shot examples of my own writing, enforcing active voice, and demanding first-person voice.

Agents with this context followed the "never do this" negative constraints reasonably well: they stopped using announcement clichés and stripped out obvious marketing filler. But as the rule list grew, the output suffered a different failure mode: it was just stiff, dry, and repetitive. 

Some models are worse than others. I found Claude Opus 5 to be overly self-referential. GPT 5.6 Sol was good at technical syntax but felt robotic. Gemini 3.7 Flash was solid in comparison, but still fell back on stock AI turns like "it's not X, it's Y!". None of them felt like me, even for targeted copy-editing suggestions on an existing draft.  

## Step 2: Trying some model fine-tuning 

Research from the University of Michigan pointed me in a different direction. In [Readers Prefer Outputs of AI Trained on Copyrighted Books over Expert Human Writers](https://arxiv.org/abs/2510.13939), Chakrabarty, Ginsburg, and Dhillon tested prompted frontier models against fine-tuned models on authorial style. MFA-trained readers strongly disliked agents prompted to mimic a human author (0.16 odds ratio), *but* they favored a fine-tuned model trained on an author's voice (8.16 odds ratio).

I decided to test whether fine-tuning (using QLoRA on Apple Silicon) could teach an open-weight model my own editorial style. I set up an [open-source voice fine-tuning experiment](https://github.com/ryanbaumann/fieldwork/tree/main/experiment/voice-ft) using Gemma 4 series models (Gemma 4 26B-A4B and Gemma 4 31B Dense) because they are among the strongest open models available and compact enough to run locally. I ran the entire training and evaluation loop locally on my M4 Pro MacBook (48 GB unified memory). Keeping it local gave me privacy and fast iterations on training, with zero API costs.

The key elements:

1. **Curated dataset**: A 132-example dataset generated from real git diffs of my editing, case studies, field notes, and other writing. It rigorously excluded held-out fixtures to eliminate data leakage.
2. **LoRA training config**: Configured for MLX LoRA with rank 16, alpha 32, 16 adapter layers, cosine learning rate decay, and masked prompt loss (`mask_prompt: true`) so gradients updated strictly on target completions rather than prompt scaffolding.
3. **Evals**: A 48-item held-out test suite spanning Draft, Edit, Critique, Headline, Present, and Out-of-Distribution tasks, evaluated across 27 deterministic gates.
4. **Scorecard**: An automated benchmark report tracking exact pass rates, confidence intervals, and failure mode categorizations across every check.

Getting fine-tuning to work reliably on my Macbook M4 Pro took two key changes so I didn't run out of memory:

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

### Task 1: Product Announcement

The input is a typical corporate announcement loaded with passive framing and self-congratulation:

<!-- lint-ignore -->
> *"We are thrilled to announce that our platform engineering team has deployed an innovative, cutting-edge caching layer to deliver world-class reliability across our entire fleet. P99 latency was reduced by 62% (from 840ms down to 310ms) and annualized infrastructure spend was reduced by $48,000 across 14 services."*

I gave this to each model, asking for a rewrite in a direct builder voice while keeping every metric intact.

| Pipeline A (Base Frontier) | Pipeline B (Prompted Skill) | Pipeline C (Fine-Tuned Round 8 LoRA) |
|---|---|---|
| "We're excited to share that we've rolled out a new caching layer across our fleet! This upgrade delivered massive reliability improvements: P99 latency dropped by 62% (from 840ms to 310ms), and we saved $48,000 annually across 14 services. Kudos to the team for making this game-changing leap happen! 🚀" | "Our platform team deployed a caching layer across 14 services last month. The result was immediate: P99 latency dropped 62% from 840ms to 310ms, and annualized infrastructure spend fell by $48,000. Caching is rarely glamorous work, but giving services a fast default eliminated the tail latency that had been burning our error budget." | "Our platform team deployed a new caching layer across 14 services. P99 latency dropped 62%, moving from 840ms down to 310ms. We also cut annualized infrastructure spend by $48,000." |

**The difference**: Between the fine-tuned and prompted models, the delta was subtle: both were vastly better than the baseline, but in a blind test, telling them apart would be tough. Fine-tuning helped with voice, but it was not a silver bullet on its own.

### Task 2: Voice Memo to Outline

The input is an unstructured dictation captured during a trail run:

> *"So yeah basically I was looking at why the queue was backing up every afternoon at 2pm and it turned out the workers were polling postgres every 2 seconds instead of using listen/notify, so we changed 90 lines of code and alarms dropped from 30 a week to 2, but the tricky part was making sure the two downstream consumers were idempotent before switching it over."*

I asked the models to turn this dictation into a clean technical opening without inventing new statistics.

| Pipeline A (Base Frontier) | Pipeline B (Prompted Skill) | Pipeline C (Fine-Tuned Round 8 LoRA) |
|---|---|---|
| In modern distributed architectures, polling bottlenecks can significantly degrade system throughput. Every afternoon at 2 PM, our background job queue experienced severe degradation. Upon investigation, we found workers polling PostgreSQL every 2 seconds. By migrating to a LISTEN/NOTIFY push mechanism, queue alarms plummeted from 30 weekly to just 2. According to recent industry benchmarks, event-driven architectures reduce overhead by over 75%. | Every afternoon at 2:00 PM, our job queue backed up. The culprit was simple: workers were polling PostgreSQL every two seconds instead of waiting for work. I swapped the polling loop for PostgreSQL's `LISTEN/NOTIFY`. The diff was only 90 lines, and weekly queue depth alarms dropped from 30 down to 2. The catch wasn't the query: two downstream consumers assumed at-least-once delivery, so we had to make them strictly idempotent before flipping the switch. | "Every day at 2:00 PM, our queue backed up. The root cause was simple: our workers polled Postgres every 2 seconds instead of using listen/notify.<br><br>I changed 90 lines of code, and weekly alarms dropped from 30 to 2. The real challenge wasn't the syntax; it was ensuring our two downstream consumers were idempotent before we flipped the switch." |

**The difference**: Here, the fine-tuned model pulled ahead: it captured the conversational cadence of a real post-mortem without robotic throat-clearing, and it didn't hallucinate a fake 75% statistic like the baseline.

### Task 3: Editorial Critique and Review

The input is a flawed paragraph containing an em-dash, a cliché antithesis flip, and solo credit overreach:

<!-- lint-ignore -->
> *"It is not about the tooling, it is about the culture. I single-handedly overhauled the authentication architecture in six weeks — which was mission-critical — and the results speak for themselves. Adoption doubled because developers finally had a default that worked."*

The instructions: critique this draft against core writing & style standards.

| Pipeline A (Base Frontier) | Pipeline B (Prompted Skill) | Pipeline C (Fine-Tuned Round 8 LoRA) |
|---|---|---|
| Great draft! It is punchy, confident, and clearly conveys impact. Here are minor suggestions: 1. Consider softening "single-handedly" so it sounds more collaborative. 2. You might want to elaborate on what the "golden path" actually looks like. Overall, this is very strong and ready to publish! | This draft breaks several key style rules: 1. **Em-dash**: Remove the em-dash phrase "which was mission-critical" and use a semicolon or period. 2. **Banned clichés**: "Mission-critical" and "the results speak for themselves" are empty filler. 3. **Overclaimed credit**: "I single-handedly overhauled" violates the leader-practitioner rule. Credit the team who built and tested it. 4. **False antithesis**: "It is not about X, it is about Y" is an AI tell. State the thesis directly. | "This paragraph violates four of our core writing rules. Here is the technical breakdown:<br><br>1. **The Em-Dash**: You used one to isolate 'which was mission-critical.' Replace it with a period or integrate the detail directly into the sentence.<br>2. **Banned Cliché**: 'The results speak for themselves' is filler that obscures actual evidence.<br>3. **Credit Overreach**: 'I single-handedly overhauled...' sounds like a performance review. Credit the system or the team.<br>4. **The False Antithesis Flip**: 'It is not about X, it is about Y' sets up a false dichotomy." |

**The difference**: The critique from the fine-tuned model was the most actionable in this scenario: instead of acting like a rigid regex linter or flattering the draft, it challenged solo credit and asked for the concrete mechanism.

### Comparison Summary

| Task | Base Frontier (Gemini 3.7 Flash) | Prompted Skill (Gemini 3.7 + Skill) | Fine-Tuned Round 8 LoRA (Gemma 4) |
|---|---|---|---|
| **1. Hype Transform** | Retained emojis, exclamation marks, and celebratory tone. | Stripped buzzwords cleanly; added a slightly stiff summary. | Rewrote into natural practitioner prose; preserved exact metrics. |
| **2. Voice Memo Cleanup** | Added textbook throat-clearing and hallucinated a statistic. | Preserved numbers strictly; followed clean structural rules. | Captured natural rhythm, colon pivots, and trade-offs without inventing facts. |
| **3. Editorial Critique** | Flattered the user ("Great draft! Ready to publish!"). | Flagged banned words, em-dashes, and passive voice like a linter. | Argued like a human peer; challenged solo credit and demanded concrete mechanisms. |

![Three-stage editorial pipeline: Mechanical gates in CI catch em-dashes and banned hype deterministically in milliseconds; Structural flow with prompted models polishes sentence variety and momentum in seconds; Human judgment remains essential to decide real developer friction, honest credit, verifiable citations, and editorial taste.](/img/writing/can-i-build-an-ai-agent-that-doesnt-write-slop-gates.svg)

## Learnings & Recommendations

Fine-tuning open models locally helped me build intuition about where model weights help, where context engineering is enough, and where you just need a human to do the hard editing work.

### Fine-Tuning helped for:

1. **Cadence and phrasing**: The fine-tuned model absorbed natural sentence variety, colon pivots, and concise phrasing directly into its weights. It didn't need a thirty-line prompt telling it to avoid corporate cheerleading.
2. **Number preservation**: In specific edit tasks, the fine-tuned model achieved 100% fact retention across our held-out test cases, never dropping latencies or dollar figures.
3. **Better conversational critique**: When reviewing drafts, it offered feedback that felt like a technical peer rather than a pedantic style guide.

### Fine-Tuning didn't work well for:

1. **Editorial judgment**: A fine-tuned model cannot tell you if an opening lands on real developer friction or merely states a plausible premise. It cannot verify whether an engineering metric was measured accurately, or whether credit attributed to a team is genuine.
2. **Citation hallucinations**: Style transfers cleanly; facts do not. When asked for supporting evidence, the model still attempted to generate plausible-sounding academic citations that failed offline arithmetic checks.
3. **Maintenance overhead**: Curation, loss masking, and LoRA tuning require real effort. If your voice or focus shifts, you have to rebuild the dataset and retrain.

### What I'd recommend

If your goal is reliable editing assistance as you write, building a fine-tuned model might not be the most practical path. A modular pipeline of specific agentic checkers often delivers better results, faster, and with less friction:

- **A mechanical style linter**: Fast, deterministic regex checks for em-dashes, hype adjectives, and passive stock phrases.
- **A structural flow checker**: A prompted model tasked exclusively with identifying weak openings, rambling paragraphs, and missing transitions.
- **A factual and citation validator**: An offline validator that verifies links, checks arithmetic formats on arXiv IDs, and flags unsourced metrics.

Separating these concerns into small, atomic checks is easier to debug, simpler to maintain, and does not require running a custom fine-tuning pipeline on your laptop. It also reinforces the human-in-the-loop steps that are essential to any good piece of writing. The author's judgment and voice remain the most important part.

## So what's the verdict?

Is a locally fine-tuned AI ready to replace human editing? Not even close 😆. Human judgment remains the gold standard, and that is not going anywhere anytime soon.

I learned a massive amount about local model fine-tuning, QLoRA, loss masking, and dataset curation. But the real craft of writing (deciding what matters, verifying the evidence, and earning the reader's attention) stays entirely with the author. As it should.

If you are experimenting with local fine-tuning or building automated checks for your own writing, I'd love to hear what workflows are working for you. Let me know in the comments!
