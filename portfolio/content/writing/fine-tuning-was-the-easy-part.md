---
title: Fine-Tuning Was the Easy Part
summary: Fine-tuning a small model for one narrow job worked. The hard developer-platform problem is distribution: moving that improvement beyond a single adapter, up a ladder from context to open traces to a public benchmark.
date: 2026-08-04
updated: 2026-08-07
canonical: https://ryanbaumann.dev/writing/fine-tuning-was-the-easy-part/
tags: ["developer experience", "ai", "evals"]
draft: false
noindex: false
image: /img/writing/the-eval-failed-before-the-model-did.jpg
imageAlt: A completed training run with loss 0.028 is blocked at an evidence gate because raw outputs, a holdout set, and a real grader are missing
socialImage: /img/writing/the-eval-failed-before-the-model-did-social.jpg
shareTitle: Fine-Tuning Was the Easy Part
shareSummary: Tuning a small model for one narrow job worked. Distributing that improvement beyond one adapter, across every critical user journey on a platform, is the hard problem, and publishing never guarantees adoption.
shareImageAlt: Loss down does not equal proof, above evidence chips showing ten cases, zero held-out cases, and four hard-coded scores
---

Fine-tuning a model for your own app is the easy part. The hard problem for a developer platform is distribution: moving an improvement beyond one adapter and one app, up a ladder that runs from context and tools, to an owned adapter, to open traces, to a held-out public benchmark. Control drops at every rung as reach and durability climb, and publishing never forces a model lab to adopt what you shipped.

I wanted to see the easy part work before worrying about the hard one, so I picked one narrow job. Agents over-fetch Places API fields. A [field mask](https://developers.google.com/maps/documentation/places/web-service/choose-fields?utm_campaign=gmp_git_agentskills_v1) is the list that tells the Places API which fields to return, and one unnecessary field can push a call into a higher billing tier, so the output can be valid JSON and still cost too much. Base models are bad at this because their weights are a stale snapshot: an [ICSE study](https://arxiv.org/abs/2406.09834) found that across seven models and 145 API migrations, 25% to 38% of plausible completions still reached for the deprecated call. I wanted a small model that returns the minimal correct mask and nothing billable extra.

So I trained a LoRA adapter on Gemma 4 over a synthetic set of [Places field-mask requests](https://github.com/ryanbaumann/fieldwork/blob/main/evals/field-mask/dataset.v1.json) and scored exact match: a case counts only when the model returns exactly the fields the request needs, with no extra billable field. Getting Gemma 4 to train at all took some surgery. A text-only LoRA against the multimodal checkpoint meant stripping the vision and audio towers, remapping the language-model weights, and working around MLX assumptions that didn't fit. The run converged cleanly at a validation loss of `0.028`.

Then the results. Base Gemma 4 E4B, the small model, returned the exact mask 18% of the time. The tuned E4B hit 94%. The 12B model went from 42% to 97%. The tuned 4B-class model nearly caught a tuned model three times its size, and both cleared their own baselines by a wide margin. For a narrow job with a gradeable output, a small model you tuned can do the work of a big one, at a fraction of the cost per call.

[LoRA](https://arxiv.org/abs/2106.09685) is why that's cheap: it freezes the original parameters and trains small added matrices that shift behavior only when the adapter loads. The catch is that the optimizer only ever sees tokens and loss, so it can't tell that a field is current, necessary, or in the right billing tier. The weight lands on the grader and the data, and that's where I still owe some work.

## What I'd tighten before calling it a benchmark

A few assumptions need to hold before this is more than a promising local result. The set is small and synthetic, and the training and test cases overlap, so the next run needs a real held-out split the optimizer never sees. One case labels `displayName` as Essentials while the [current Places field table](https://developers.google.com/maps/documentation/places/web-service/data-fields?utm_campaign=gmp_git_agentskills_v1) puts it in Pro, so the answer key has to be checked against live billing tiers. And every attempt should be retained: the prompt, model configuration, raw output, and grader result per case, so the number can be reproduced instead of trusted.

None of that changes the direction. Weight-level tuning earns its keep on this shape of task, and it isn't only my run saying so. [Harvey's public post-training experiment](https://www.harvey.ai/blog/post-training-open-legal-agents-with-baseten-research) ran forty steps of GRPO on Qwen3.5-9B and moved criterion pass rate from 42.5% to 63.0% on held-out test data; as the score rose, grep calls fell 67% and characters read per rollout rose more than 20%. Held-out performance moved, and the tool-use behavior moved with it. Narrow tasks with a gradeable output are where tuning the weights pays off.

## The hard part is distribution

Here's where the easy part ends. My adapter fixes one job on one deployment. It helps only the requests that load it; it does nothing for the base checkpoint another developer downloads or the hosted model another team calls. A developer platform doesn't have one narrow job. It has hundreds of critical user journeys across dozens of APIs, and its developers are running models and agents the platform will never touch. Tuning an adapter per journey and hoping every developer loads it doesn't scale.

![A developer-platform distribution pyramid moves from directly controlled context and tools through an owned adapter and open traces to a held-out public benchmark with broader potential reach and more dependence on adoption.](/img/writing/fine-tuning-distribution-pyramid.svg)

So the real question is how a best practice travels. Context and tools sit at the top of the ladder: skills and an MCP service carry current facts into a session and give me the most direct control, but the agent has to load them. An owned adapter puts stable behavior into learned weights for the surfaces I run, and still reaches only my deployment. Open traces and training data make that evidence reusable outside my product, so another team can inspect the attempts, run the grader, and choose to train on them. A held-out public benchmark makes the behavior visible across models; it trains nothing by itself, but it gives model builders a durable target and lets developers see whether the gap closed. Every rung down trades control for reach.

For a platform team the order falls out of that: keep fast-changing facts in context, fine-tune the stable jobs you can grade, publish traces when you want the signal to travel, and publish a benchmark when you want the result to stay measurable across every model your developers might pick.

The field-mask run is one rung on that ladder, and I trained it before I could fully grade it. The next version fixes the answer key, holds out real cases, and keeps every trace, so the result can travel past one adapter and start covering more than one journey. If you're working the same gap between runtime context and learned model behavior across a lot of developer journeys, I'd love to compare traces and benchmarks in the comments.
