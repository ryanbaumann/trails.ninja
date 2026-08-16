---
title: Fine-Tuning Was the Easy Part
summary: Fine-tuning a small model for one narrow job worked in an afternoon. The hard developer-platform problem is distribution: getting that fix past a single adapter, across every job your developers do, and into the models they pick next.
date: 2026-08-04
updated: 2026-08-08
canonical: https://ryanbaumann.dev/writing/fine-tuning-was-the-easy-part/
tags: ["developer experience", "ai", "evals"]
draft: false
noindex: false
image: /img/writing/fine-tuning-header.svg
imageAlt: The easy part is tuning one adapter, where Gemma 4 E4B exact match rose from 2 of 10 to 9 of 10; the hard part is distributing that fix across hundreds of jobs and every model a developer might pick.
socialImage: /social/fine-tuning-was-the-easy-part.jpg
shareTitle: Fine-Tuning Was the Easy Part
shareSummary: Tuning a small model for one narrow job worked. Distributing that fix across every job your developers do, and into the models they pick next, is the hard problem.
shareImageAlt: Fine-Tuning Was the Easy Part, beside a two-panel card contrasting one tuned adapter with distribution across many jobs and models.
---

Point an autonomous coding agent at the Places API and it over-fetches fields. On Places, that over-fetching gets expensive fast: [Place Details bills in tiers](https://developers.google.com/maps/billing-and-pricing/sku-details), and you pay the highest tier any field in the request touches. A single unnecessary field quietly quadruples the cost of a call that still returns valid JSON.

Base models make this mistake because their weights are a stale snapshot of the internet. Runtime context like skills, MCP, and llms.txt helps, but for high-volume, cost-sensitive API calls, fine-tuning the model weights on a narrow job beats a much larger base model for a fraction of the inference cost.

## Tuning one adapter is the easy part

I trained a [LoRA](https://arxiv.org/abs/2106.09685) adapter on Gemma 4 E4B (the roughly 4B-class model) over a set of synthetic [Places field-mask requests](https://github.com/ryanbaumann/fieldwork/tree/main/evals/field-mask). I split the ten cases into eight for training and two held out that the optimizer never saw, and graded exact match: I count a case only when the model returns exactly the fields the request needs, with no extra billable field. That grader carries correctness and cost in one number, because on Places an over-fetch is a billing event.

![A chart comparing exact-match field masks for Gemma 4 E4B: across all ten cases the base model scores 2 and the tuned adapter 9; on the two held-out cases the base model scores 0 and the tuned adapter 1.](/img/writing/fine-tuning-evidence.svg)

The tuned adapter jumped from 2 of 10 to 9 of 10 exact-match masks, including all eight training cases and one of the two held out. Every attempt is in a [retained run trace](https://github.com/ryanbaumann/fieldwork/tree/main/evals/field-mask) with the prompt, raw output, and grade per case.

Base E4B under-fetches by returning the first field and dropping the rest; on a prompt-injection request, it over-fetches four fields. The tuned model returns the minimal correct mask and an empty list for the injection; its one held-out miss dropped `places.servesWine` from a request about dogs and wine.

## What I learned

Tuning the weights works when you have a narrow job and a gradeable output. [Harvey's post-training experiment](https://www.harvey.ai/blog/post-training-open-legal-agents-with-baseten-research) ran forty steps of GRPO on an open 9B model and watched held-out pass rates jump from 42% to 63%; as the score went up, the agent stopped making sloppy grep calls and started reading more characters per rollout. Held-out performance moved, and the tool-use behavior moved with it.

It works for style, too. A [recent UMich study](https://news.umich.edu/when-ai-learns-an-authors-voice-even-experts-prefer-it/) found that fine-tuning a model on a writer's full body of work makes even writing experts prefer the generated text over the human original. The model stops relying on performative AI tropes and starts picking up the actual rhythm and constraints of the author.

Ten cases, with two held out, is just an early signal; the next version needs a larger held-out set and an answer key checked against live billing tiers. Still, the lesson is clear: whether you're teaching a model an author's voice or an API's field mask, grounded examples work. A grader that knows what the job costs can make a small model nail a narrow, expensive task that a bigger base model gets wrong.

## The hard part is distribution

My adapter fixes one job on one deployment, but it doesn't help the base model another developer downloads tomorrow or the hosted model another team calls. A developer platform doesn't have one narrow job; it has hundreds of core developer tasks across dozens of APIs, and its developers run models and agents the platform will never touch. Tuning an adapter per journey and hoping everyone loads it doesn't scale.

![A developer-platform distribution pyramid moves from directly controlled context and tools through an owned adapter and open traces to a held-out public benchmark, trading direct control for broader reach and more dependence on adoption.](/img/writing/fine-tuning-distribution-pyramid.svg)

Docs reach humans; SDKs reach applications; skills and an MCP service reach the agent harness; but only open traces and benchmarks reach the model weights. Each rung down that ladder trades control for reach. Context and tools give me the most direct control and carry current facts into a session, though the agent has to load them; an owned adapter bakes stable behavior into weights for the surfaces I run, but still reaches only my deployment. Open traces make that evidence reusable so another team can inspect the attempts and train on them, while a held-out public benchmark gives model builders a durable target and lets every developer see whether the gap closed without training anything by itself.

Call it share of gradient: whether the next generation of models gets shaped by your platform or by everything else on the internet. For a platform team, the order falls out of that: keep fast-changing facts in context, fine-tune the stable jobs you can grade, publish traces when you want the signal to travel past your own deployment, and publish a benchmark when you want the result to stay measurable across every model your developers might pick.

The field-mask run is one rung on that ladder. Scaling it past ten cases and one job is the work, and so is getting those traces somewhere a model builder will actually train on them. If you're working the same gap between runtime context and learned model behavior, how are you handling it? Compare traces and benchmarks in the comments.
