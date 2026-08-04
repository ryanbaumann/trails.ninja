---
title: Context Engineering Is Not Enough
summary: A wrong field name costs four times list price. A small tuned model fixes the billing leak, but the fix never reaches developers without a share of the gradient.
date: 2026-08-04
updated: 2026-08-04
canonical: https://ryanbaumann.dev/writing/fine-tuning-was-the-easy-part/
tags: ["developer experience"]
draft: false
noindex: false
# Required before publishing: three distinct visuals, each with its own alt text.
# Point every path at a real asset, then uncomment. Never a generic site preview.
image: /img/writing/fine-tuning-was-the-easy-part.jpg
imageAlt: Artifact card stating that context engineering is not enough
socialImage: /img/writing/fine-tuning-was-the-easy-part-social.jpg
shareTitle: Context Engineering Is Not Enough
shareSummary: I taught a small model to fix a huge Maps API billing leak. But to distribute that fix, context engineering isn't enough: you have to reach the base model.
shareImageAlt: A social preview card highlighting the billing cost of legacy API calls
---

I wanted to make my backyard better for hosting guests and making it safe for kids to play. Naturally while learning about AI Agents more. I wanted somewhere nearby that stocked native plants, so I asked an agent hooked up to the public [Maps APIs](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing) to find me a plant nursery. It gave me four good options with their operating hours.

Then I looked at what the agent actually asked the Places API.

The model requested the place name, the address, the coordinates, the opening hours, the photos, and the rating. I only needed the first three. The last three were decoration, and they quietly moved my request from one billing tier to another.

[Place Details bills in three tiers](https://developers.google.com/maps/billing-and-pricing/sku-details), and you pay the highest tier that any field in your request touches. Name, address, and coordinates is Essentials, roughly five dollars per thousand calls. Add `rating` and the exact same call is Enterprise, roughly twenty dollars per thousand API calls. My agent paid four times list price to fetch data I never displayed. There was no error or failing test; the only symptom was an invoice that I wouldn't see until a month later.

AI Agents and Models do this constantly without a lot of system instruction tuning. They reach for legacy Places parameters that Google [closed to new customers](https://developers.google.com/maps/deprecations) in March 2025. The weights are a snapshot learned from an internet saturated with obsolete patterns.

Researchers at ICSE 2025 [tested seven models](https://arxiv.org/abs/2406.09834) across 145 API migrations in eight Python libraries and found deprecated calls between 25% and 38% of the time. Stale knowledge going in, zero awareness of current API status at inference, and no mechanism for the model to find out it's wrong.

So, I explored how I could teach a small model in the Gemma 4 series to actually consider my request, use the latest Places API and avoid unessesary costs. The resuts:

| Model | Variant | Exact Match Score |
| :--- | :--- | :--- |
| `google/gemma-4-12B-it` | Base | 42 |
| `google/gemma-4-12B-it` | +SFT (LoRA) | 97 |
| `google/gemma-4-E4B-it` | Base | 18 |
| `google/gemma-4-E4B-it` | +SFT (LoRA) | 94 |

![An evidence diagram showing the baseline vs fine-tuned exact match scores](/img/writing/fine-tuning-evidence-inline.jpg)

To do this tuning of Gemma 4, I created (with Gemini 3.1 Pro) 300 synthetic Places API requests using the latest and greatest [Google Maps Platform Agent Skills](https://developers.google.com/maps/ai/agent-skills). 

Then I created a basic deterministic grader. It checks for a valid schema, a live 200 response, requested mask matches required fields, and a penalty per over-fetched billable field weighted by cost. That last clause is the interesting one; because over-requesting is a billing event, a single number carries correctness and cost at the same time.

The tuning step works compared to the baseline Gemma 4 models. The base 12B model scored 42 exact matches. The E4B scored 18. After training a LoRA adapter, the E4B jumped to 94, nearly matching the tuned 12B at 97. Both wiped the floor with the generic models. 

What does this mean? You only need grounded examples to solve narrow tasks for your top developer tasks.

## The distribution problem

That got me to thinking - the fine-tuned model fixes my use case and my API calls. It helps exactly one person.

The model or agent any developer opens tomorrow morning remains broken because it didn't learn from my samples. Its opinion about your developer platform was set months or years before your last release. 

Everyone has been doing context engineering with agent skills and [MCP servers](/work/agent-skills/). That gets you far, and you should absolutely continue doing it. But context engineering has efficiency costs: token bloat, added latency, and the hard truth that not every developer is going to discover your custom skill or MCP. 

Ideally, the base model just knows how to use your API correctly out of the box. You still have the option to publish context for the agent harness, but we need to talk about how you can have even more impact on the base models themselves. That matters immensely in a world where there will be five or ten really good, popular models for every tier of task, and a lot of them are going to be open source and open weight.

Your docs reach humans; SDKs reach applications; skills reach the agent harness. You version, measure, and fix all three. 

But real fine-tuning traces are the only artifact that reaches the model weights. Can we make it easier to get those traces into the hands of the AI labs who train those models?

## The benchmark path

To see this play out in the real world, look at what Harvey did. They [published a benchmark](https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark) in May containing twelve hundred agent tasks across twenty-four legal practice areas, graded against seventy-five thousand criteria. At the time, the best frontier model scored just 7.1%. The top score since then is only 13.3%; getting that score takes a model that costs about fifty-one dollars and twenty-two minutes to run a single task!

Three weeks later, they published the follow-through [with Baseten](https://www.harvey.ai/blog/post-training-open-legal-agents-with-baseten-research). They took that benchmark signal, put it inside an evaluation harness built for long legal matters, and post-trained an open-weight 27B model. The pass rate jumped massively, from 42.5% up to 63.0%, landing it firmly in the frontier performance band.

But the detail that matters most is buried in that write-up: the harness alone barely moved the needle for the 27B model, while the massive frontier models got its benefit immediately. What does this tell us? Good context engineering has a capability floor; if your model is below that floor, you have to change the actual weights.

## Three paths to distribution

If you want to solve this for your developer platform, you generally have three paths:

**1. Tune it yourself.** You keep total control and gain an immediate result, but you have a reach of exactly one. A great example is [Desert Ant Labs](https://desertant.com/); they ship small on-device models that each perform a single job, like redacting personal data without the text ever leaving the handset. If you don't build the small model for your own narrow platform jobs, someone else will eventually build one that spans everyone's.

**2. Publish traces.** You lose control, but you achieve broad reach. For instance, Hugging Face now [hosts agent sessions natively](https://huggingface.co/docs/hub/en/agent-traces) without needing any conversion steps, making it incredibly easy for others to learn from your platform's successful agent runs.

**3. Get onto a benchmark.** You forfeit all control, but you gain the longest possible lifespan. AI labs climb leaderboards instead of reading developer documentation; if your API is in the benchmark, it gets learned.

| Tier | Control | Lifespan |
|---|---|---|
| Your own features | Total | Until you retrain |
| Developers running your model | High | Until your API changes |
| Open-weight post-training | None | A model generation |
| Frontier pretraining | Zero | Effectively forever |

Notice the pattern? Control drops at every step while durability climbs. You can have the version you steer, or you can have the version that outlasts you.

Right now, platforms like [Fireworks](https://fireworks.ai/) sell that top rung. They raised a $250M Series C and partnered with Harvey, but they are selling the tier with the absolute least reach. Nobody sells you the bottom three rungs because there's nothing to sell; you either publish your traces and benchmarks, or you don't exist to the next generation of models.

Call it "share of gradient". Share of gradient measures whether a model was shaped by you or by other content on the internet. Publishing open weight models along with traces and benchmarks offers the signal for models to train on and improve on.

## The next step

So, where should you start? Find the narrowest, most expensive job on your platform. Write a deterministic grader and explicitly put the actual billing cost inside it; a standard correctness metric will happily approve code that you absolutely cannot afford to run in production. Once you have that, measure a base model against it and start generating those traces.

I'd love to hear how you're handling open benchmarks, evals, and fine tuning traces for your developer platform. Let me know in the comments!
