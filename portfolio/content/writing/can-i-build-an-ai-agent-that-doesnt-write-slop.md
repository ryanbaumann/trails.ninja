---
title: Can I Build an AI Agent That Doesn't Write Slop?
summary: I tested prompt engineering and model fine-tuning to see if an AI could act as a faithful copy editor. It's a step in the right direction but nothing replaces good human judgement.
date: 2026-08-15
updated: 2026-08-16
canonical: https://ryanbaumann.dev/writing/can-i-build-an-ai-agent-that-doesnt-write-slop/
aliases: ["/writing/why-i-fine-tuned-a-26b-model-on-my-laptop-instead-of-prompting-frontier-apis/"]
tags: ["ai", "evals", "field notes"]
draft: false
noindex: false
image: /img/writing/can-i-build-an-ai-agent-that-doesnt-write-slop-header.svg
imageAlt: "A comparison of editing approaches: in-context prompt skills versus local parameter-efficient fine-tuning on Apple Silicon."
socialImage: /social/can-i-build-an-ai-agent-that-doesnt-write-slop.jpg
shareTitle: Can I Build an AI Agent That Doesn't Write Slop?
shareSummary: We all know raw AI copywriting is trash. But can an AI Agent act as a helpful copy editor? I tested various aproaches, and here's what I learned and recommend.
shareImageAlt: "A share card illustrating the before-and-after results of local fine-tuning versus prompted models for developer copywriting."
---

We all know raw AI copy is bland and predicatable - cheerful, generic, and full of buzzwords. But can an AI Assistant still serve as a drafter and copy editor that I can hand my messy notes, get back a polished draft, and actually ship something that's good? I wanted to take my best stab at the problem; here's what I tried and learned about AI copywriting.

The goal: a fast, private editing agent that understands my cadence, respects my numbers, and critiques my structure, while leaving me firmly in charge of narrative, tone, and judgment. I don't want an AI to write for me, I want a rubber duckie that can keep up with my rambling thoughts and help me get them onto the page before I forget the inspiration.

## Step 1: In-context prompting hits a mechanical wall

I started where everyone starts: system prompts & skills containing personal voice context guidelines. I wrote many detailed skills and AGENTS.md rules forbidding em-dashes, stripping hype, adding few shot examples of my own writing, enforcing active voice, and demanding first-person technical grounding.

Agents with this context followed the "never do this" negative constraints reasonably well: they stopped using announcement clichés and stripped out obvious marketing filler. But as the rule list grew, the output suffered a different failure mode: it was just stiff, dry, and repetitive. 

Some models are worse than others for sure. I found Claude Opus 5 to be really self-referential. GPT 5.6 Sol was good at technical writing but super robotic. Gemini 3.7 Flash was pretty good in compariosn, but still had many dry AI suggestions like "it's not X, it's Y!". None of them felt like me, even for targeted copy edit suggestions from a draft.  

## Step 2: The fine-tuning hunch and the MacBook test

Research from the University of Michigan pointed me in a different direction. In [Readers Prefer Outputs of AI Trained on Copyrighted Books over Expert Human Writers](https://arxiv.org/abs/2510.13939), Chakrabarty, Ginsburg, and Dhillon tested prompted frontier models against fine-tuned models on authorial style. MFA-trained readers strongly disliked agents prompted to mimic a human author (0.16 odds ratio), *but* they favored a fine-tuned model trained on an author's voice (8.16 odds ratio). Very interesting!

I decided to test whether fine-tuning (using QLoRA) could teach an open-weight model my own editorial style and make it genuniely helpful. I chose Gemma 4 series models for this task because they're some of the best open models available right now and are small enough to run locally. I ran the entire training and evaluation loop locally on my M4 Pro MacBook (48 GB unified memory). Keeping it local gave me privacy and fast iterations on training, with zero API costs - nice added bonus.

Getting fine-tuning to work on a laptop took two key settings:

1. **Mask prompt loss (`--mask-prompt`)**: Standard training calculates "loss" across both the prompt and the response. On small datasets, this results in overfitting very easily. Masking the prompt forces gradients to update exclusively on the desired output tokens, not on the prompt.
2. **Slice paragraphs (100–250 words)**: Instead of training on full drafts, I sliced my drafts into focused input/output pairs. These pairs preserved most of the original factual content, while reshaping the grammar and style into my preferred prose.

To see whether this made any practical difference, I designed a direct comparison across three models on three distinct copy tasks.

## Side-by-Side Experiments

I tested three distinct setups:

1. **Pipeline A (Base Frontier)**: Gemini 3.7 Flash with a standard zero-shot prompt.
2. **Pipeline B (Prompted Skill)**: Gemini 3.7 Flash equipped with my full in-context voice rules.
3. **Pipeline C (Fine-Tuned Local Editor)**: Gemma 4 31B Dense fine-tuned on my curated dataset via QLoRA.

### Task 1: Product Announcement

The input is a typical corporate announcement loaded with passive framing and self-congratulation:

<!-- lint-ignore -->
> *"We are thrilled to announce that our platform engineering team has deployed an innovative, cutting-edge caching layer to deliver world-class reliability across our entire fleet. P99 latency was reduced by 62% (from 840ms down to 310ms) and annualized infrastructure spend was reduced by $48,000 across 14 services."*

I gave this to each model, and asked it to rewrite it in a direct builder voice while keeping every fact / metric intact.

```
<!-- Pipeline A: Gemini 3.7 Flash (Base) -->
We're excited to share that we've rolled out a new caching layer across our fleet! 
This upgrade delivered massive reliability improvements: P99 latency dropped by 62% 
(from 840ms to 310ms), and we saved $48,000 annually across 14 services. Kudos to 
the team for making this game-changing leap happen! 🚀
```
```
<!-- Pipeline B: Gemini 3.7 Flash + Voice Skill -->
Our platform team deployed a caching layer across 14 services last month. The 
result was immediate: P99 latency dropped 62% from 840ms to 310ms, and annualized 
infrastructure spend fell by $48,000. Caching is rarely glamorous work, but giving 
services a fast default eliminated the tail latency that had been burning our error budget.
```

```
<!-- Pipeline C: Gemma 4 31B Dense (Fine-Tuned Editor) -->
We put a caching layer in front of 14 services last quarter. The numbers moved 
immediately: p99 latency dropped from 840ms to 310ms (a 62% reduction), and annual 
infrastructure spend fell by $48,000. The fix was simple: stop hitting the database 
for static reads before paying for bigger instances.
```

**The difference**: Base Flash retained celebratory marketing emojis and exclamation marks. Flash + Skill stripped the buzzwords cleanly, but added an explanatory coda. The fine-tuned Gemma 4 model captured natural colon pivots, lowercase `p99`, and an authentic engineering takeaway.

### Task 2: Voice Memo to Outline

The input is an unstructured dictation captured during a trail run:

> *"So yeah basically I was looking at why the queue was backing up every afternoon at 2pm and it turned out the workers were polling postgres every 2 seconds instead of using listen/notify, so we changed 90 lines of code and alarms dropped from 30 a week to 2, but the tricky part was making sure the two downstream consumers were idempotent before switching it over."*

I told the models to turn this dictation into a clean technical opening without inventing new statistics.

```markdown
<!-- Pipeline A: Gemini 3.7 Flash (Base) -->
In modern distributed architectures, polling bottlenecks can significantly degrade system 
throughput. Every afternoon at 2 PM, our background job queue experienced severe degradation. 
Upon investigation, we found workers polling PostgreSQL every 2 seconds. By migrating to a 
LISTEN/NOTIFY push mechanism, queue alarms plummeted from 30 weekly to just 2. According to 
recent industry benchmarks, event-driven architectures reduce overhead by over 75%.

<!-- Pipeline B: Gemini 3.7 Flash + Voice Skill -->
Every afternoon at 2:00 PM, our job queue backed up. The culprit was simple: workers were 
polling PostgreSQL every two seconds instead of waiting for work. 

I swapped the polling loop for PostgreSQL's `LISTEN/NOTIFY`. The diff was only 90 lines, and 
weekly queue depth alarms dropped from 30 down to 2. The catch wasn't the query: two 
downstream consumers assumed at-least-once delivery, so we had to make them strictly 
idempotent before flipping the switch.

<!-- Pipeline C: Gemma 4 31B Dense (Fine-Tuned Editor) -->
The queue fell over every afternoon at 2:00 PM. The problem was not the database load: 
workers were polling postgres every 2 seconds and thundering on empty queues.

We swapped the polling loop for `LISTEN/NOTIFY` in 90 lines of code. Queue alarms dropped 
from 30 a week to 2. The hard part was not the migration: two downstream consumers relied 
on at-least-once delivery, and making them idempotent took three days before we could touch 
the write path.
```

**The difference**: Base Flash introduced textbook throat-clearing ("In modern distributed architectures...") and hallucinated an unsourced 75% benchmark. Flash + Skill followed the rules and preserved the facts. The fine-tuned Gemma model matched natural conversational pacing: "The queue fell over every afternoon at 2:00 PM," balancing code size against debugging friction.

### Task 3: Editorial Critique and Review

The input is a flawed paragraph containing an em-dash, a cliché antithesis flip, and solo credit overreach:

<!-- lint-ignore -->
> *"It is not about the tooling, it is about the culture. I single-handedly overhauled the authentication architecture in six weeks — which was mission-critical — and the results speak for themselves. Adoption doubled because developers finally had a default that worked."*

The instructions: critique this draft against core writing & style standards.

```markdown
<!-- Pipeline A: Gemini 3.7 Flash (Base) -->
Great draft! It's punchy, confident, and clearly conveys impact. Here are minor suggestions:
1. Consider softening "single-handedly" so it sounds more collaborative.
2. You might want to elaborate on what the "golden path" actually looks like.
Overall, this is very strong and ready to publish!

<!-- Pipeline B: Gemini 3.7 Flash + Voice Skill -->
This draft breaks several key style rules:
1. **Em-dash violation**: Remove "— which was mission-critical —" and use a semicolon or period.
2. **Banned clichés**: "Mission-critical" and "the results speak for themselves" are empty filler.
3. **Overclaimed credit**: "I single-handedly overhauled" violates the leader-practitioner rule. Credit the team who built and tested it.
4. **False antithesis**: "It is not about X, it is about Y" is an AI tell. State the thesis directly.

<!-- Pipeline C: Gemma 4 31B Dense (Fine-Tuned Editor) -->
Three things break your own rules here:
- **Credit overreach**: "I single-handedly designed and delivered" ignores the engineers who reviewed the PRs and ran the backfill. If this was a team effort, name the team.
- **Surface tells**: You have an em-dash and "the results speak for themselves" in the same paragraph.
- **Thesis flip**: "It is not about tooling, it is about culture" is a stock flip. Tell the reader what the authentication default actually changed.
```

**The difference**: Base Flash failed the review test completely by flattering the author. Flash + Skill acted as a rigid compliance checklist. The fine-tuned Gemma model critiqued the draft like an actual peer, calling out the missing team mechanics and demanding concrete architectural specifics.

### Head-to-Head Comparison Summary

| Task | Base Frontier (Gemini 3.7 Flash) | Prompted Skill (Gemini 3.7 + Skill) | Fine-Tuned Local Editor (Gemma 4 31B Dense) |
|---|---|---|---|
| **1. Hype Transform** | Retained emojis, exclamation marks, and celebratory tone. | Stripped buzzwords cleanly; added a slightly stiff summary. | Rewrote into natural practitioner prose; preserved exact metrics. |
| **2. Voice Memo Cleanup** | Added textbook throat-clearing and hallucinated a 75% statistic. | Preserved numbers strictly; followed clean structural rules. | Captured natural rhythm, colon pivots, and trade-offs without inventing facts. |
| **3. Editorial Critique** | Flattered the user ("Great draft! Ready to publish!"). | Flagged banned words, em-dashes, and passive voice like a linter. | Argued like a human peer; challenged solo credit and demanded concrete mechanisms. |

![Four mechanical checks stand as gates on the left: em-dashes, announcement phrasing, hype adjectives, and repeated stock phrases. On the right, four questions that stay with a person: whether the opening lands on real friction, whether the number is real, whether the credit is honest, and whether the piece should exist. The two never combine into one score.](/img/writing/can-i-build-an-ai-agent-that-doesnt-write-slop-gates.svg)

## Learnings & Recommendations

Fine-tuning open models locally taught me where model weights help and where you just need a human to do the hard editing work.

### Fine-Tuning helped for:

1. **Cadence and phrasing**: The fine-tuned model absorbed natural sentence variety, colon pivots, and concise phrasing directly into its weights. It didn't need a thirty-line prompt telling it to avoid corporate cheerleading.
2. **Number preservation**: In specific edit tasks, the dense 31B model achieved 100% fact retention across our held-out test cases, never dropping latencies or dollar figures.
3. **Better conversational critique**: When reviewing drafts, it offered feedback that felt like a technical peer rather than a pedantic style guide.

### Fine-Tuning didn't work well for:

1. **True editorial judgment**: A fine-tuned model cannot tell you if an opening lands on real developer friction or merely states a plausible premise. It cannot verify whether an engineering metric was measured accurately, or whether credit attributed to a team is genuine.
2. **Citation hallucinations**: Style transfers cleanly; facts do not. When asked for supporting evidence, the model still attempted to generate plausible-sounding academic citations that failed offline arithmetic checks.
3. **Maintenance overhead**: Curation, loss masking, and LoRA tuning require real effort. If your voice or focus shifts, you have to rebuild the dataset and retrain.

### What I'd recommend: modular agetns

If your goal is reliable editing assistance, building a fine-tuned model might not be the most practical path. A modular pipeline of specific agentic checkers often delivers better results, faster, and with less friction:

- **A mechanical style linter**: Fast, deterministic regex checks for em-dashes, hype adjectives, and passive stock phrases.
- **A structural flow checker**: A prompted model tasked exclusively with identifying weak openings, rambling paragraphs, and missing transitions.
- **A factual and citation validator**: An offline validator that verifies links, checks arithmetic formats on arXiv IDs, and flags unsourced metrics.

Separating these concerns into atomic checks is easier to debug, simpler to maintain, and doesn't require maintaining a custom fine tuning pipe on your laptop.

## The bottom line

Is a locally fine-tuned AI ready to replace human editing? Not even close 😆. Human judgment remains the gold standard and that's not going anywhere anytime soon.

I learned a massive amount about Apple Silicon Metal optimization, loss masking, and dataset curation. The fine-tuned model serves as an effective local sounding board for private drafts. But the real craft of writing (deciding what matters, verifying the evidence, and earning the reader's attention) stays entirely with the author. As it should.

If you are experimenting with local fine-tuning or building automated checks for your own writing, I'd love to hear what workflows are working for you. Let me know in the comments!
