---
title: Can I Build an AI Agent That Doesn't Write Slop?
summary: I fine-tuned open-weight models on my own writing to find out. A 31B Dense model learned my cadence, active verbs, and structural pivots. It also handed back edits that changed nothing and citations with impossible dates. Register transferred; judgment did not.
date: 2026-08-15
updated: 2026-08-16
canonical: https://ryanbaumann.dev/writing/can-i-build-an-ai-agent-that-doesnt-write-slop/
aliases: ["/writing/why-i-fine-tuned-a-26b-model-on-my-laptop-instead-of-prompting-frontier-apis/"]
tags: ["ai", "evals", "field notes"]
draft: false
noindex: false
image: /img/writing/can-i-build-an-ai-agent-that-doesnt-write-slop-header.svg
imageAlt: "Code ships into free graders: a compiler, a type checker, a test suite, and a runtime, all of which reject bad work in seconds. Prose ships into none of them. Its only grader is the person reading it."
socialImage: /social/can-i-build-an-ai-agent-that-doesnt-write-slop.jpg
shareTitle: Can I Build an AI Agent That Doesn't Write Slop?
shareSummary: I fine-tuned open-weight models on my own writing to find out. Full-parameter Dense LoRA captured my style, but judgment stays with the human. Here is what the evaluations proved and how the local loop works.
shareImageAlt: A share card contrasting stylistic register transfer with human judgment in local AI fine-tuning.
---

Nobody argues that raw AI copy is good on the first pass. It arrives fluent, confident, on topic, and empty. The standard defense is that a human editor closes the gap: hand a frontier model your notes, get back a tidy draft, spend twenty minutes cutting adjectives and restoring your syntax, and you end up with a usable post.

Does that workflow actually beat writing it yourself? Or writing the draft cold and using a model only at the end as a grammar and consistency pass? I've run both approaches for over a year, and prompting frontier models consistently hit a ceiling of agreeable, homogeneous filler.

So I built the strongest version of the idea I could run on my own hardware. I fine-tuned open-weight models on my published posts and case studies, built a multi-dimensional evaluation suite to grade the outputs, and tested whether the prose that came out needed less of me.

Here is what the architecture required, what the evaluations proved, and what the loop looks like in practice.

## Prose has no compiler

Before looking at model weights, it helps to understand why writing is harder to automate than code.

When an agent writes code, machines grade it immediately. The compiler rejects broken syntax, the type checker flags mismatched interfaces, unit tests go red, and staging runtimes catch exceptions. Most code in a production system is never read directly by a person; it is executed by a runtime that acts as a fast, brutally honest reviewer. That is why coding agents became useful so quickly: they ship into a world already full of free machine feedback.

Prose has none of that. A paragraph doesn't compile and never throws a stack trace. It has exactly one consumer: a reader. The only test that matters is whether that person keeps reading and believes what they read. Technical documentation gets halfway to a grader because a reader can run the code sample and discover that an API call fails. A Field Note doesn't even get that far. The prose is the product.

Prompting frontier models hits a wall here because their alignment training pulls them toward agreeable consensus. When you prompt against a specific tell, the model doesn't find your voice; it just finds a different polite pattern. Paragraphs settle into identical lengths, transitions become uniformly neat, and sentences hover around fifteen words. You can prompt against a specific habit. You can't prompt against a model's center of gravity.

## The research points at fine-tuning, with a catch

Chakrabarty, Ginsburg, and Dhillon ran this experiment properly in [Readers Prefer Outputs of AI Trained on Copyrighted Books over Expert Human Writers](https://arxiv.org/abs/2510.13939). It is a preregistered study: 50 award-winning authors, MFA-trained writers, and frontier models producing excerpts in an author's style, judged blind in pairs by 28 MFA-trained readers and 516 general readers.

Prompting lost badly. MFA readers disfavored prompted models on stylistic fidelity at an odds ratio of 0.16. Fine-tuning on an author's complete works reversed the result: the same readers favored the fine-tuned AI at an odds ratio of 8.16, and detectors flagged only 3% of the fine-tuned outputs compared to 97% of the prompted ones.

Then comes the sentence worth pausing on: the authors noted their result did not measure the editorial effort required to turn AI output into publishable prose. That editorial effort is the entire question.

## System design: why naive fine-tuning fails

I moved to local Parameter-Efficient Fine-Tuning (QLoRA) on Apple Silicon Metal using an M4 Pro with 48 GB of unified memory. Keeping training and inference local matters when the dataset contains unpublished drafts and notes.

Naive fine-tuning on personal writing fails in subtle, frustrating ways. Getting reliable adaptation required solving five architectural problems across the training pipeline and evaluation harness:

1. **Masked prompt loss (`--mask-prompt`)**: Standard sequence training computes loss across both the instruction prompt and the completion. On small personal datasets, the model quickly memorizes prompt templates and task tags, regurgitating task markers instead of executing the transform. Masking prompt loss forces cross-entropy gradients to compute exclusively on the assistant's voice tokens.
2. **Paragraph micro-pairs (100–250 words)**: Feeding full-length essay drafts into training causes sequence truncation and spikes attention activation memory. Slicing essays into focused paragraph pairs bounded at section breaks cut peak training memory from 36.8 GB to 23.8 GB while expanding task variety across drafting, editing, critique, and headline generation.
3. **Surgical edit pairs**: Without explicit constraints, a fine-tuned model treats an edit prompt as a license to regenerate prose from scratch, hallucinating new claims and dropping technical nouns, exact latencies, percentages, and dollar figures. Training on surgical micro-pairs where 70–95% of factual content is preserved while only sentence structure and passive boilerplate are changed anchors true copyediting behavior.
4. **Multi-dimensional evaluation bounds**: A single similarity score cannot grade a stylistic edit. An edit transform fails in multiple opposing directions: below `min_change` it did nothing; below `min_preserve` it threw the facts away; with a target buzzword still present it moved words around without fixing the brief; above `max_change` it rewrote prose that was already clean. The evaluation harness tests each constraint independently rather than averaging them into a deceptive composite metric.
5. **Offline arithmetic citation checks**: A model that learns your style will happily invent plausible academic citations. An arXiv identifier follows `YYMM.NNNNN`. Before making any network request, an offline validator checks whether the year and month are mathematically valid. An impossible identifier like `24606.24282` fails immediately without hitting the network because month 606 does not exist.

![Four mechanical checks stand as gates on the left: em-dashes, announcement phrasing, hype adjectives, and repeated stock phrases. On the right, four questions that stay with a person: whether the opening lands on real friction, whether the number is real, whether the credit is honest, and whether the piece should exist. The two never combine into one score.](/img/writing/can-i-build-an-ai-agent-that-doesnt-write-slop-gates.svg)

## What the evaluations proved: Dense vs MoE and Register vs Judgment

I evaluated the fine-tuned adapters across a frozen 48-item held-out evaluation suite with zero n-word phrase leakage from training data. I compared two base architectures: Gemma 4 31B Dense versus Gemma 4 26B-A4B Sparse Mixture of Experts (MoE).

### Dense 31B vs Sparse MoE tradeoffs

Writing voice is diffuse across global semantic representations rather than isolated into discrete domain clusters. Because of this, full-parameter LoRA across Dense 31B's active weights captured nuanced stylistic constraints significantly better than sparse expert routing:

- **Clean pass rate**: Dense 31B achieved a 35% clean pass rate (17/48 items, 95% CI 23–50%) across all error checks, compared to 25% (12/48) for MoE 26B-A4B. Total error violations dropped from 56 down to 39 (a 30.4% reduction).
- **Fact retention (`G-FACT-KEEP`)**: Dense 31B preserved 100% of factual anchors (11/11 items) without dropping metrics, compared to 91% (10/11) on MoE.
- **Repetition loops and echoes**: Dense 31B eliminated token repetition loops entirely (0 loops vs 2 on MoE) and achieved a 54.5% reduction in verbatim echoes (`G-ECHO` errors dropped from 11 down to 5). Edit preservation (`G-EDIT-PRESERVE`) rose from 60% to 87%.
- **Generation latency**: MoE retained a massive speed advantage on Apple Silicon Metal, generating at ~2.5 seconds per item (~3.2x faster) compared to ~8.1 seconds on Dense 31B.

### Register transferred; judgment did not

The fine-tuned model mastered the stylistic surface. Across the held-out evaluations, outputs consistently matched my cadence, active verbs, and structural pivots, producing zero em-dashes, zero announcement hype, and zero invented percentages.

![Six held-out prompts run against the fine-tuned adapter. All six carried the right register, with zero em-dashes and zero invented percentages. Five failed on judgment instead: an edit that changed nothing, a critique that pasted the input back, headlines that were templates, a looping draft, and a citation that does not exist.](/img/writing/can-i-build-an-ai-agent-that-doesnt-write-slop-heldout.svg)

What the model cannot do is exercise editorial judgment:

- It cannot verify whether an engineering metric is accurate or whether a benchmark was run under fair conditions.
- It cannot decide whether an opening lands on genuine developer friction or merely states a generic premise.
- It cannot determine whether credit given to a team is honest and complete.
- Most importantly, it cannot decide whether an essay should exist at all.

## Practically what it means: the local workflow

These findings led directly to a dual-model routing setup on my machine. Instead of expecting one model to do everything, I route tasks based on latency and analytical depth:

- **Gemma 4 26B-A4B MoE** handles real-time interactive tasks: generating eight thesis-driven headline variants in ~3 seconds, drafting short social packaging, and rapid interactive rewrites.
- **Gemma 4 31B Dense** runs asynchronous background passes: deep editorial critique, structural flow reviews, and high-fidelity copyediting where fact retention is critical.

Here is the loop that actually runs when I write:

```bash
# 1. Ask the local Dense model to critique structure and spot weak openings
npm run voice:review -- portfolio/content/writing/my-draft.md

# 2. Brainstorm headline variants using the fast MoE adapter
npm run voice:headline -- "Why local fine-tuning changes editing workflows"

# 3. Verify mechanical content rules and citation integrity
npm run check:content
npm run eval:citations -- --file portfolio/content/writing/my-draft.md
```

The workflow breaks down into four clear steps:

1. **Dictate the raw argument**: I talk through a problem on a trail run or jot down unstructured notes. The goal is capturing raw friction and concrete details without worrying about grammar or transitions.
2. **Run local Gemma review**: The local 31B Dense model analyzes the draft to spot abstract openings, passive phrasing, and missing structure. Because it runs locally in seconds, I can run multiple critique passes as I revise.
3. **Run deterministic gates**: Automated scripts verify mechanical constraints: no em-dashes, no hype adjectives, no repeated stock phrases, and valid citation formats.
4. **Read and edit directly**: I make the final editing pass myself, verifying every claim, adjusting the rhythm, and making sure the piece earns its place.

## The durable takeaway

Fine-tuning open-weight models locally gave me a fast, private reviewer that understands my cadence and argues with my drafts. It did not replace the work of writing.

Mechanical checks easily catch surface tells, and local adapters provide useful feedback on structure and tone. But taste and judgment remain the entire substance of writing where the only consumer is a human reader.

If you are experimenting with local fine-tuning or automated checks on your own writing, I'd love to hear what your gates catch and how you balance AI assistance against authentic voice. Let me know in the comments!
