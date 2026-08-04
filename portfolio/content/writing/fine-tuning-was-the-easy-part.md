---
title: Fine-Tuning Was the Easy Part
summary: A wrong field name costs four times list price. A small tuned model fixes the billing leak, but the fix never reaches developers.
date: 2026-08-04
updated: 2026-08-04
canonical: https://ryanbaumann.dev/writing/fine-tuning-was-the-easy-part/
tags: ["developer experience"]
draft: false
noindex: false
# Required before publishing: three distinct visuals, each with its own alt text.
# Point every path at a real asset, then uncomment. Never a generic site preview.
image: /img/writing/fine-tuning-was-the-easy-part.svg
imageAlt: Artifact card stating that fine-tuning was the easy part
socialImage: /img/writing/fine-tuning-was-the-easy-part.svg
shareTitle: Fine-Tuning Was the Easy Part
shareSummary: A wrong field name costs four times list price. A small tuned model fixes the billing leak, but the fix never reaches developers.
shareImageAlt: Artifact card stating that fine-tuning was the easy part
---

I wired a small agent to the public [Maps APIs](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing) to find local nurseries. It returned four nearby locations with operating hours. I then checked the exact API request it constructed.

The model requested name, address, coordinates, opening hours, photos, and rating. I only required the first three. The additional three fields triggered a higher billing tier.

[Place Details bills in three tiers](https://developers.google.com/maps/billing-and-pricing/sku-details). You pay the highest tier that any field in your request touches. Name, address, and coordinates fall into Essentials, roughly five dollars per thousand calls. Add `rating` and the call becomes Enterprise at twenty dollars. My agent paid four times list price to fetch data I never displayed. There was no error or failing test. The only signal was a larger invoice a month later.

Models make this mistake constantly. They reach for legacy Places parameters that Google [closed to new customers](https://developers.google.com/maps/deprecations) in March 2025. The weights are fixed to an internet saturated with obsolete patterns.

Researchers at ICSE 2025 [tested seven models](https://arxiv.org/abs/2406.09834) across 145 API migrations in eight Python libraries. They found deprecated calls between 25% and 38% of the time. The root cause is stale parametric knowledge combined with zero awareness of current API status at inference.

I built a grader and fine-tuned a small model to solve this.

| Model | Variant | Exact Match Score |
| :--- | :--- | :--- |
| `google/gemma-4-12B-it` | Base | 42 |
| `google/gemma-4-12B-it` | +SFT (LoRA) | 97 |
| `google/gemma-4-E4B-it` | Base | 18 |
| `google/gemma-4-E4B-it` | +SFT (LoRA) | 94 |

The task set contains three hundred synthetic requests. The reward has no human judge. It checks for a valid schema, a live 200 response, and an exact match to required fields. It deducts a penalty for each over-fetched billable field, weighted by actual SKU cost. A single number evaluates both correctness and billing efficiency.

The tuning step creates the capability. The 12B model scored 42 exact matches on the field mask extraction. The E4B scored 18. I trained a LoRA adapter on the dataset and re-ran the suite. The fine-tuned E4B model jumped to 94. It nearly matched the tuned 12B at 97. Both outperformed the generic base models. You only need grounded examples to solve narrow syntax tasks.

## The distribution problem

The tuned model fixes my API calls. It helps exactly one person.

The generic model a developer uses tomorrow remains broken. I do not own it or host it. Its context about your platform was finalized months before your last release.

Your docs reach humans. SDKs reach applications. [Skills or MCP servers](/work/agent-skills/) reach the agent harness. You version, measure, and fix all three. Traces are the only artifact that shapes the weights.

## The benchmark path

Harvey [published a benchmark](https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark) in May. It contains twelve hundred agent tasks across twenty-four legal practice areas and seventy-five thousand rubric criteria. The best frontier model scored 7.1%. The top score since is 13.3%, costing roughly fifty-one dollars and twenty-two minutes per task.

Three weeks later they published the follow-through [with Baseten](https://www.harvey.ai/blog/post-training-open-legal-agents-with-baseten-research). They took that benchmark signal, placed it inside a harness built for long legal matters, and post-trained an open-weight 27B model. The criterion pass rate increased from 42.5% to 63.0%, matching the closed-source frontier band.

The harness alone barely moved the 27B model. The frontier models received its benefit immediately. Good context has a capability floor. Below that floor, you must train.

## Three paths to distribution

**Tune it yourself.** You keep total control and gain an immediate result for a reach of one. [Desert Ant Labs](https://desertant.com/) ships small on-device models that each perform a single job. Their models redact personal data without text leaving the handset. They own the narrow on-device tier.

**Publish traces.** You lose control but achieve broad reach. Hugging Face [hosts agent sessions natively](https://huggingface.co/docs/hub/en/agent-traces) without conversion steps.

**Get onto a benchmark.** You forfeit all control and gain the longest lifespan. Labs climb leaderboards instead of reading documentation.

| Tier | Control | Lifespan |
|---|---|---|
| Your own features | Total | Until you retrain |
| Developers running your model | High | Until your API changes |
| Open-weight post-training | None | A model generation |
| Frontier pretraining | Zero | Effectively forever |

Control drops at every step. Durability rises at every step. The tier you steer most precisely expires fastest.

[Fireworks](https://fireworks.ai/) sells the top rung. They raised a $250M Series C and partnered with Harvey. They sell the tier with the least reach. Nobody sells the bottom three rungs.

This is share of gradient. It measures whether a model was shaped by you. Publishing traces offers the signal that `robots.txt` lacks.

## The next step

Find the narrowest expensive job on your platform. Write a grader and put the actual cost inside it. A correctness metric will approve code you cannot afford to run. Measure a base model against it.

The fine-tune takes a weekend. Distribution takes years.
