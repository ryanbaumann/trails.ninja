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

Fine-tuning a model for one narrow job is the easy part. The hard problem for a developer platform is distribution: getting that improvement to travel past a single adapter and a single app, across the hundreds of jobs your developers actually do, and into the models they reach for tomorrow. Control drops at every step of that path, and shipping something never forces a model to adopt it. I wanted to watch the easy part work before wrestling with the hard one, so I ran a small experiment.

## The hypothesis

Base models are bad at using current APIs because their weights are a stale snapshot of the internet. Point an agent at the Places API and it over-fetches fields: an [ICSE study](https://arxiv.org/abs/2406.09834) found that across seven models and 145 API migrations, 25% to 38% of plausible completions still reached for a deprecated call. On Places that is expensive, not just untidy. [Place Details bills in tiers](https://developers.google.com/maps/billing-and-pricing/sku-details), and you pay the highest tier any field in the request touches, so a single unnecessary field can quietly quadruple the cost of a call that still returns valid JSON. My hypothesis: a small model, fine-tuned on this one job, would return the minimal correct [field mask](https://developers.google.com/maps/documentation/places/web-service/choose-fields?utm_campaign=gmp_git_agentskills_v1) and beat a much larger base model at it, for a fraction of the cost per call.

## The test

I trained a [LoRA](https://arxiv.org/abs/2106.09685) adapter on Gemma 4 E4B, the roughly 4B-class model, over a set of synthetic [Places field-mask requests](https://github.com/ryanbaumann/fieldwork/blob/main/evals/field-mask/dataset.v1.json). LoRA freezes the original weights and trains small added matrices that shift behavior only when the adapter loads, which is what makes tuning cheap. I split the cases eight for training and two held out that the optimizer never saw, and graded exact match: a case counts only when the model returns exactly the fields the request needs, with no extra billable field. That grader carries correctness and cost in one number, because on Places an over-fetch is a billing event. Getting Gemma 4 to train at all took some surgery, since a text-only adapter against the multimodal checkpoint meant stripping the vision and audio towers, remapping the language weights, and working around MLX assumptions that didn't fit.

## The result

![A chart comparing exact-match field masks for Gemma 4 E4B: across all ten cases the base model scores 2 and the tuned adapter 9; on the two held-out cases the base model scores 0 and the tuned adapter 1.](/img/writing/fine-tuning-evidence.svg)

Base E4B returned the exact mask twice out of ten, and never on the two held-out cases. The tuned adapter got nine of ten: all eight training cases and one of the two held out. Every attempt is in a [retained run trace](https://github.com/ryanbaumann/fieldwork/blob/main/evals/field-mask/results.v1.json) with the prompt, raw output, and grade per case. The failures tell the story. Base E4B under-fetches, returning the first field and dropping the rest, and on a prompt-injection request it over-fetches four fields; the tuned model returns the minimal correct mask and an empty list for the injection. Its one held-out miss dropped `places.servesWine` from a request about dogs and wine.

## What I learned

For a narrow job with a gradeable output, tuning the weights works, and it isn't only my run saying so. [Harvey's post-training experiment](https://www.harvey.ai/blog/post-training-open-legal-agents-with-baseten-research) ran forty steps of GRPO on an open 9B model and moved criterion pass rate from 42.5% to 63.0% on held-out test data; as the score rose, grep calls fell 67% and characters read per rollout rose more than 20%. Held-out performance moved, and the tool-use behavior moved with it.

The honest caveat is size. Ten cases, two of them held out, is a direction, not a benchmark, and one held-out miss out of two is a wide error bar. I also had to fix the answer key mid-run: it labeled `displayName` as Essentials when the [current field table](https://developers.google.com/maps/documentation/places/web-service/data-fields?utm_campaign=gmp_git_agentskills_v1) puts it in Pro. The next version needs a larger held-out set and an answer key checked against live billing tiers. Still, the lesson is clear enough to act on: grounded examples plus a grader that knows what the job costs can make a small model nail a narrow, expensive task that a bigger base model gets wrong.

## The hard part is distribution

Here is where the easy part ends. My adapter fixes one job on one deployment. It does nothing for the base model another developer downloads tomorrow, or the hosted model another team calls. A developer platform doesn't have one narrow job. It has hundreds of critical user journeys across dozens of APIs, and its developers run models and agents the platform will never touch. Tuning an adapter per journey and hoping everyone loads it doesn't scale.

![A developer-platform distribution pyramid moves from directly controlled context and tools through an owned adapter and open traces to a held-out public benchmark, trading direct control for broader reach and more dependence on adoption.](/img/writing/fine-tuning-distribution-pyramid.svg)

So the real question is how a fix travels. Docs reach humans; SDKs reach applications; skills and an MCP service reach the agent harness; but only open traces and benchmarks reach the model weights. Each rung down that ladder trades control for reach. Context and tools give me the most direct control and carry current facts into a session, though the agent has to load them. An owned adapter bakes stable behavior into weights for the surfaces I run, and still reaches only my deployment. Open traces make that evidence reusable, so another team can inspect the attempts, run the grader, and train on them. A held-out public benchmark trains nothing by itself, but it gives model builders a durable target and lets every developer see whether the gap closed.

Call it share of gradient: whether the next generation of models gets shaped by your platform or by everything else on the internet. For a platform team the order falls out of that. Keep fast-changing facts in context. Fine-tune the stable jobs you can grade. Publish traces when you want the signal to travel past your own deployment. Publish a benchmark when you want the result to stay measurable across every model your developers might pick.

The field-mask run is one rung on that ladder, with a fixed answer key, a real held-out split, and every trace kept. Scaling it past ten cases and one job is the work, and so is getting those traces somewhere a model builder will actually train on them. If you're working the same gap between runtime context and learned model behavior across a lot of developer journeys, I'd love to compare traces and benchmarks in the comments.
