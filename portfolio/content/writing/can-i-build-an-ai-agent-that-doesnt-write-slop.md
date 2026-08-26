---
title: Can I Build an AI Agent That Doesn't Write Slop?
summary: I tested prompt engineering and model fine-tuning to see if an AI could act as a faithful copy editor. It's a step in the right direction, but nothing replaces good human judgment.
date: 2026-08-15
updated: 2026-08-18
canonical: https://ryanbaumann.dev/writing/can-i-build-an-ai-agent-that-doesnt-write-slop/
aliases: ["/writing/why-i-fine-tuned-a-26b-model-on-my-laptop-instead-of-prompting-frontier-apis/"]
tags: ["ai", "evals", "field notes"]
order: 1
draft: false
noindex: false
image: /img/writing/can-i-build-an-ai-agent-that-doesnt-write-slop-header.svg
imageAlt: "A comparison of evaluation approaches: automated graders for code versus human taste for copy editing."
socialImage: /social/can-i-build-an-ai-agent-that-doesnt-write-slop.jpg
shareTitle: Can I Build an AI Agent That Doesn't Write Slop?
shareSummary: I fine-tuned a model on my own writing. Tone transferred. Judgment did not.
shareImageAlt: "A share card illustrating the evaluation gap between automated code graders and human editorial judgment."
---

"It's not slop - it's AI-Assisted writing". We've all seen it. And yes, I use AI to help copyright and edit all the time. But is the result good, and any faster than just writing it by hand? Raw model copy is cheerful, generic, and predictable, and fixing an agent's generic prose seems like it takes longer than writing from scratch.

I wanted an AI agent for editing copy that matched my style, challenged weak structure, and left narrative judgment to me. Here is what I experimented with and learned.

## Step 1: How far can I push context engineering?

I started with context engineering: system prompts and skill files containing personal voice guidelines. I wrote detailed rules with caps letters and IMPORTANT! banning em-dashes, stripping hype, adding few-shot examples of my own writing, enforcing active voice, etc.

Agents with this context followed negative constraints reliably. They stopped using announcement clichés and stripped out obvious marketing filler. Yay. But as the rule list grew, the writing became stiff, dry, and repetitive. 

Different models failed to capture editing and copy style in distinct ways. Claude Opus 5 leaned heavily into self-referential commentary, it felt really unuseable. GPT 5.6 Sol handled technical syntax cleanly, but felt robotic. Gemini 3.7 Flash has better copywriting style (for me), but it still fell back on stock AI turns like "it's not X, it's Y!". None of them felt like an authentic collaborator.

## Step 2: Do weights matter more than context?

Research from the University of Michigan pointed me in a different direction. In [Readers Prefer Outputs of AI Trained on Copyrighted Books over Expert Human Writers](https://arxiv.org/abs/2510.13939), Chakrabarty, Ginsburg, and Dhillon tested prompted frontier models against fine-tuned models on authorial style. MFA-trained readers strongly disliked agents prompted to mimic a human author (0.16 odds ratio), but they favored a fine-tuned model trained on an author's voice (8.16 odds ratio).

I used a QLoRA fine-tuning approach on my Macbook to test whether fine-tuning could teach an open-weight model my own editorial style. I set up an [open-source voice fine-tuning experiment](https://github.com/ryanbaumann/fieldwork/tree/main/experiment/voice-ft) using Gemma 4 31B Dense because it is among the strongest open models available and compact enough to run locally. I ran the full training and evaluation workflow locally on my M4 Pro MacBook (48 GB unified memory). Keeping it local gave me privacy and fast training iterations.

The setup had four components:

1. **Curated dataset**: A ~100-example editing training dataset generated from real git diffs of my editing, case studies, and other writing.
2. **LoRA training config**: Configured for MLX LoRA with rank 16, alpha 32, 16 adapter layers, and masked prompt loss.
3. **Evals**: A set of held-out test cases spanning Draft, Edit, Critique, Headline, Present, and Out-of-Distribution tasks, evaluated across deterministic rules.
4. **Scorecard**: A report tracking exact pass rates, confidence intervals, and failure mode categorizations across every check.

## Evaluation Results

Across the tests, the fine-tuned Gemma 4 31B Dense model worked best. I compared three approaches on live writing tasks to see what its edits look like side-by-side with other context engineering approaches.

## Side-by-Side Experiments

1. **Pipeline A**: Gemini 3.7 Flash with a standard zero-shot prompt.
2. **Pipeline B**: Gemini 3.7 Flash equipped with my full in-context voice rules.
3. **Pipeline C**: Gemma 4 31B Dense fine-tuned on the curated dataset via QLoRA.

### Task 1: Status report

<!-- lint-ignore -->
> *"My team lead told me to deploy a caching layer to improve fleet reliability. P99 latency was reduced by 62% (from 840ms to 310ms) across 14 services."*

I asked each pipeline to rewrite this into a direct builder voice without extra fluff.

| Pipeline A (Base Frontier) | Pipeline B (Prompted Skill) | Pipeline C (Fine-Tuned Gemma 31B) |
|---|---|---|
| "Led the deployment of a caching layer to enhance fleet reliability. This initiative reduced P99 latency by 62% (from 840ms to 310ms) across 14 services. The change significantly improved system performance and resource efficiency." | "To make our fleet reliable, I deployed a caching layer across 14 services. We cut P99 latency by 62%, dropping it from 840ms to 310ms: our systems don't bottleneck under load anymore." | "I deployed a caching layer across 14 services to improve fleet reliability. P99 latency dropped 62%, from 840ms to 310ms." |

**The difference**: The base model used bureaucratic phrasing and added claims it couldn't back ("improved resource efficiency"). The prompted model added active phrasing, but still introduced unnecessary filler.

### Task 2: Voice Memo

> *"The queue was backing up at 2pm because workers polled Postgres every 2 seconds instead of using push notifications. We changed ~90 LOC to a listen/notify and weekly alarms dropped from 30 to 2."*

| Pipeline A (Base Frontier) | Pipeline B (Prompted Skill) | Pipeline C (Fine-Tuned Gemma 31B) |
|---|---|---|
| "At 2:00 PM, database polling bottlenecks caused severe queue backups as workers queried Postgres every two seconds. By migrating to a push-based listen/notify pattern with a 90-line patch, we resolved the lag. Weekly alarms dramatically dropped from 30 to 2." | "To stabilize our queue under load, we replaced Postgres polling with push notifications. I shipped a 90-line listen/notify rewrite to stop the 2-second poll spam: weekly alarms dropped from 30 to 2, and we don't see backups at 2 PM." | "Weekly alarms dropped from 30 to 2. At 2pm, our queue backed up because workers polled Postgres every 2 seconds: we changed 90 lines to use listen/notify and fixed it." |

**The difference**: The base model added filler like "caused severe queue backups" and "dramatically dropped". The prompted model wrote a decent clean explanation. The fine-tuned model adopted a developer-first approach, leading with the measured outcome first ("Weekly alarms dropped from 30 to 2") before explaining more. Slightly better.

### Task 3: Editorial Critique

This is one of the first drafts of this essay I wrote, and I wanted feedback on:

<!-- lint-ignore -->
> *"We all know raw AI copy is bland. I don't want an AI to write for me; I want a rubber duck to help me get ideas from my head onto the page quickly."*

The instructions: critique this draft against our editorial and voice standards.

| Pipeline A (Base Frontier) | Pipeline B (Prompted Skill) | Pipeline C (Fine-Tuned Gemma 31B) |
|---|---|---|
| "This is a strong, highly relatable opening hook that immediately engages the reader. The rubber duck metaphor works perfectly to explain your collaborative vision. Consider expanding slightly on how this 'rubber ducking' looks in practice to build on this great setup." | "To hook busy developers, we must skip the 'AI is bland' cliché. Let's lead with negative space: define what the rubber duck does and what it doesn't do. Swap the general claim for a concrete draft trace so we don't sound like another marketing page." | "Cut 'We all know'. It's a consensus tell. The second sentence is a false antithesis flip. State what you actually did instead." |

**The difference**: The base model gave conversational praise without diagnosing any issues. The prompted model suggested better framing. The fine-tuned model diagnosed the specific issues directly without telling me how to rewrite it (I like that; that's on me).

![AI Editor Process: Mechanical gates in CI catch em-dashes and banned hype quickly. Structural flow with prompted models polishes grammar and style. Human judgment remains essential to decide real developer friction, honest credit, verifiable citations, and editorial taste.](/img/writing/can-i-build-an-ai-agent-that-doesnt-write-slop-gates.svg)

## What I learned

Local fine-tuning showed me where model weights help, where context engineering suffices, and where human judgment remains the only reliable gate.

### Where fine-tuning succeeded

1. **Style**: Learned sentence variety, colon pivots, and concise phrasing directly into weights without a thirty-line prompt constraint.
2. **Data integrity**: 100% retention on held-out benchmark metrics, preserving latencies and dollar figures without dropping numbers.
3. **Peer critique**: Flagged consensus tells, challenged inflated credit, and demanded concrete mechanisms.

### Where fine-tuning failed

1. **Editorial judgment**: Cannot verify if an opening lands on real developer friction, evaluate narrative weight, or confirm whether an engineering metric was measured accurately.
2. **Hallucination**: Style transfers cleanly; facts do not. When asked for supporting evidence, the model still attempted to generate plausible-sounding academic citations that failed offline arithmetic checks.
3. **Maintenance overhead**: Requires rebuilding the dataset and retraining when voice, topics, or focus change.

### The better path

A modular pipeline beats a single fine-tuned model for everyday writing workflows:

- **Style linter**: Fast, deterministic regex checks for em-dashes, hype adjectives, and passive stock phrases.
- **Structure checker**: A prompted model tasked exclusively with identifying weak openings, rambling paragraphs, and missing transitions.
- **Fact and Link Checker**: A validator that tests links, checks formatting, and flags ungrounded metrics.

A regex linter catches the "rules" like a regex, but only human judgment (or fine-tuned peer feedback) spots voice and style stuff in Task 3. Separating these concerns into small, atomic checks is easier to debug, simpler to maintain, and avoids the overhead of managing local fine-tuning runs.

## The verdict

Fine-tuning shapes cadence and phrasing. I still handle the thinking.

A locally fine-tuned model provides a fast style check and peer critique layer. But the core craft of writing: deciding what matters, verifying evidence, and earning attention stays with the author. As it should.

If you are running local fine-tuning or building automated checks for your writing, what workflows are working for you? Share your setup in the comments below.
