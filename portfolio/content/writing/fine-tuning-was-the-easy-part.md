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

I wanted to make my backyard better for hosting guests and safe for kids to play.

It was a weekend project. I wanted somewhere nearby that stocked native plants, so I asked an agent hooked up to the public [Maps APIs](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing) to find me a nursery. It gave me four good options with their operating hours.

Then I looked at what it actually asked the API.

The model requested the place name, the address, the coordinates, the opening hours, the photos, and the rating. I only needed the first three. The last three were decoration, and they quietly moved my request from one billing tier to another.

[Place Details bills in three tiers](https://developers.google.com/maps/billing-and-pricing/sku-details), and you pay the highest tier that any field in your request touches. Name, address, and coordinates is Essentials, roughly five dollars per thousand calls. Add `rating` and the exact same call is Enterprise, roughly twenty dollars. My agent paid four times list price to fetch data I never displayed. There was no error. There was no failing test. The only symptom is an invoice that shows up a month later.

Models do this constantly. They reach for legacy Places parameters that Google [closed to new customers](https://developers.google.com/maps/deprecations) in March 2025. The weights are a photograph of an internet saturated with obsolete patterns.

Researchers at ICSE 2025 [tested seven models](https://arxiv.org/abs/2406.09834) across 145 API migrations in eight Python libraries and found deprecated calls between 25% and 38% of the time. Stale knowledge going in, zero awareness of current API status at inference, and no mechanism for the model to find out it's wrong.

I spent a Saturday teaching a small model to stop doing it.

| Model | Variant | Exact Match Score |
| :--- | :--- | :--- |
| `google/gemma-4-12B-it` | Base | 42 |
| `google/gemma-4-12B-it` | +SFT (LoRA) | 97 |
| `google/gemma-4-E4B-it` | Base | 18 |
| `google/gemma-4-E4B-it` | +SFT (LoRA) | 94 |

Three hundred synthetic requests off the backyard project. The grader has no judge in it. Valid schema, live 200 response, requested mask matches required fields, penalty per over-fetched billable field weighted by cost. That last clause is the interesting one. Because over-requesting is a billing event, a single number carries correctness and cost at the same time.

The tuning step works. The base 12B model scored 42 exact matches. The E4B scored 18. After training a LoRA adapter, the E4B jumped to 94, nearly matching the tuned 12B at 97. Both wiped the floor with the generic models. You only need grounded examples to solve narrow syntax tasks.

## The distribution problem

The tuned model fixes my API calls. It helps exactly one person.

The model a developer opens tomorrow morning remains broken. I didn't train it. I don't host it. The opinion it holds about your platform was set months before your last release.

Your docs reach humans. SDKs reach applications. [Skills or MCP servers](/work/agent-skills/) reach the agent harness. You version, measure, and fix all three. Traces are the only artifact that reaches the weights.

## The benchmark path

Harvey [published a benchmark](https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark) in May: twelve hundred agent tasks across twenty-four legal practice areas, graded against seventy-five thousand criteria. The best frontier model scored 7.1%. The top score since is 13.3%, and the model that leads costs about fifty-one dollars and twenty-two minutes per task.

Three weeks later they published the follow-through [with Baseten](https://www.harvey.ai/blog/post-training-open-legal-agents-with-baseten-research). They took that benchmark signal, put it inside a harness built for long legal matters, and post-trained an open-weight 27B model. The pass rate jumped from 42.5% to 63.0%, landing in the frontier band.

The detail that matters most is buried in that write-up. The harness alone barely moved the 27B model. The frontier models got its benefit immediately. Good context has a capability floor. Below that floor, you have to change the weights.

## Three paths to distribution

**Tune it yourself.** You keep total control and gain an immediate result for a reach of one. [Desert Ant Labs](https://desertant.com/) ships small on-device models that each perform a single job. Their models redact personal data without text leaving the handset. If you don't build the small model for your own narrow jobs, they build one that spans everyone's.

**Publish traces.** You lose control but achieve broad reach. Hugging Face [hosts agent sessions natively](https://huggingface.co/docs/hub/en/agent-traces) without conversion steps.

**Get onto a benchmark.** You forfeit all control and gain the longest lifespan. Labs climb leaderboards instead of reading documentation.

| Tier | Control | Lifespan |
|---|---|---|
| Your own features | Total | Until you retrain |
| Developers running your model | High | Until your API changes |
| Open-weight post-training | None | A model generation |
| Frontier pretraining | Zero | Effectively forever |

Control drops at every step. Durability climbs at every step. You can have the version you steer or the version that outlasts you.

[Fireworks](https://fireworks.ai/) sells the top rung. They raised a $250M Series C and partnered with Harvey. They sell the tier with the least reach. Nobody sells you the bottom three rungs because there's nothing to sell. You publish or you don't.

Call it share of gradient. It measures whether a model was shaped by you. Publishing traces offers the signal that `robots.txt` lacks.

## The next step

Find the narrowest expensive job on your platform. Write a grader and put the actual cost inside it, because a correctness metric will happily approve code you can't afford to run. Measure a base model against it.

You'll probably find what I found. The fine-tune is a weekend. The distribution is the rest of your life.
