---
title: Fine-Tuning Was the Easy Part
summary: Fine-tuning can change learned model behavior. The harder developer-platform problem is getting that improvement beyond one adapter, through context, traces, and public benchmarks.
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
shareSummary: Context changes what a model sees for one run. Post-training changes learned behavior. The platform problem is distributing that improvement beyond one model and one app.
shareImageAlt: Loss down does not equal proof, above evidence chips showing ten cases, zero held-out cases, and four hard-coded scores
---

I wanted a small model to stop over-fetching Places API fields. A skill or MCP service could put current guidance into an agent session. Fine-tuning offered a different bet: teach the pattern through learned weights instead of explaining the whole policy again at runtime.

The LoRA run completed. My proof that it worked did not.

The first eval case asks for three things about nearby nurseries: name, address, and coordinates. Its expected field mask includes `places.displayName`, then labels the request Essentials. The [current Places field table](https://developers.google.com/maps/documentation/places/web-service/data-fields?utm_campaign=gmp_git_agentskills_v1) puts `displayName` in Pro. Even a working grader would have rewarded the wrong billing answer; this grader didn't run at all.

The field-mask experiment reports a jump from 18% to 94% exact match after fine-tuning. But the [evaluator underneath that number](https://github.com/ryanbaumann/fieldwork/blob/main/evals/field-mask/test_mlx.py#L21-L60) builds commands for the base model and the tuned adapter, then never runs them. Four scores are assigned by hand instead:

```python
# Mocking evaluation
pass

results = {
    "gemma-4-12B-it Base": {"exact_match": 42},
    "gemma-4-12B-it +SFT": {"exact_match": 97},
    "gemma-4-E4B-it Base": {"exact_match": 18},
    "gemma-4-E4B-it +SFT": {"exact_match": 94}
}
```

The training work was real. A text-only LoRA run against a multimodal Gemma checkpoint completed 100 iterations at a validation loss of `0.028`. Getting there took stripping the vision and audio towers, remapping the language-model weights, and working around MLX assumptions that didn't fit the checkpoint.

That is as far as the public evidence goes. There is no run log, checkpoint, or retained output behind the task scores. The dataset has [ten cases](https://github.com/ryanbaumann/fieldwork/blob/main/evals/field-mask/dataset.v1.json), eight of them selected for training. The test script selects the same eight. Nothing is held out.

![The field-mask experiment contains ten cases, reuses the same eight for training and testing, and never executes the model commands.](/img/writing/the-eval-failed-experiment-audit.jpg)

## Why field masks were still worth testing

[Field masks](https://developers.google.com/maps/documentation/places/web-service/choose-fields?utm_campaign=gmp_git_agentskills_v1) tell the Places API which data to return. I chose them because the output can be syntactically perfect and still be expensive or wrong. A model can return valid JSON, the request can succeed, and one unnecessary field can move the call into another billing tier.

The task was small on purpose. I wanted a behavior with a crisp output and a product consequence. But I hadn't pinned the endpoint, and the dataset mixed the `places.*` response-mask syntax used by search endpoints with a story about Place Details pricing. Then the answer key mislabeled its first case.

[LoRA](https://arxiv.org/abs/2106.09685) freezes the original model parameters and trains small added matrices that alter the model's behavior when the adapter is loaded. The optimizer sees tokens and loss. It can't tell that a field is current, necessary, or in the wrong billing tier. Feed it a bad answer key and a clean run can make the model better at repeating the mistake.

An [ICSE study](https://arxiv.org/abs/2406.09834) found the same failure shape in generated code. It tested seven models on 28,125 prompts covering 145 API migrations in eight Python libraries. Among plausible completions that used one of those APIs, 25% to 38% still chose the deprecated version.

## What I mean by a trace

The nursery row is an eval case: a request, an expected mask, and a billing label. A trace starts when a model actually attempts it.

For that one attempt, I need the exact model and adapter revisions, the prompt, the raw response, and the result of each check. Did the response parse? Did it include all three requested fields? Did it add anything else? Were the fields valid for the pinned API revision? Which billing tier did the final mask trigger?

Those answers matter separately. If the tuned model returns valid JSON with an extra expensive field, an exact-match failure tells me it missed. The trace tells me how. If the answer key is stale, the same trace lets me catch the grader instead of rewarding it.

The current repository has the case, but no attempt. There is no model output to inspect and no grader result to reproduce. The aggregate score leads back to four constants.

## Context and weights solve different jobs

Context engineering changes what the model can see during this attempt. A skill or MCP service can supply current documentation, a workflow, and tools without retraining, and the platform team can update that material as the API changes. But the agent still has to discover, load, and follow it.

A LoRA adapter changes a small set of added weights while leaving the original checkpoint frozen. It can make a stable, repeated behavior more likely without carrying the full policy in every prompt. But the improvement stops at the deployment boundary: it helps only the applications and requests that load that adapter. It doesn't update the base checkpoint another developer downloads or the hosted model another team calls.

The two approaches belong together. Keep fast-changing API facts in retrievable context. Use post-training for stable behavior you can grade. Use the same eval to decide whether either intervention actually improved the job.

## Weight-level intervention can work

My field-mask run doesn't yet prove that it changed task behavior. [Harvey's public post-training experiment](https://www.harvey.ai/blog/post-training-open-legal-agents-with-baseten-research) shows what that proof can look like. Forty steps of GRPO on Qwen3.5-9B moved criterion pass rate from 42.5% to 63.0% on held-out test data. Grep calls fell 67%, while characters read per rollout rose more than 20%.

That doesn't isolate the cause of every changed action, but it establishes the important part: held-out performance changed, and the reported tool-use measurements changed with it. Post-training can be effective. My experiment still needs the same evidence.

## The hard part is distribution

An adapter attached to my application only helps requests that load it. Context is easier to ship because docs, skills, and tools can change today, but it remains an opt-in dependency of each agent session.

For a developer platform, the real problem is moving an API best practice from an instruction I control into evidence another team can test, learn from, and possibly train on. “Possibly” matters. Publishing traces or a benchmark doesn't force a model lab to use either one.

![A developer-platform distribution pyramid moves from directly controlled context and tools through an owned adapter and open traces to a held-out public benchmark with broader potential reach and more dependence on adoption.](/img/writing/fine-tuning-distribution-pyramid.svg)

At the top of the pyramid, **context and tools** carry current facts and workflows. They offer the most direct control, but the agent has to load them.

An **owned adapter** puts stable, repeated behavior into learned weights for the surfaces you operate. It can work well and still reach only one deployment.

**Open traces and training data** make the evidence reusable outside your product. Another team can inspect the attempts, run the grader, and choose to train against them. Adoption is possible, never automatic.

At the base, a **held-out public benchmark** makes the behavior visible across models. A benchmark doesn't train anything by itself. It gives model builders a durable target and lets developers see whether the gap closed.

The choice for a platform team is practical: keep fast-changing facts in context; fine-tune stable behavior you can grade; publish traces when you want the training signal to travel; publish a benchmark when you want the result to remain measurable.

## I built this backward

I trained adapter weights before I had a test that could tell me whether the behavior changed.

The rerun starts by fixing the nursery case and pinning one Places endpoint and documentation revision. Then I need a holdout the optimizer never sees, with near-duplicate prompts kept on the same side of the split. Every base and tuned attempt should leave behind the prompt, model configuration, raw output, and each grader result. Only then does another LoRA run answer a useful question.

The rerun has to earn the local claim first. Then I want to publish the trace schema, grader, and held-out cases so the result can travel beyond one adapter without pretending that publication guarantees adoption.

If you're working on the same gap between runtime context and learned model behavior, I'd love to compare traces and benchmarks in the comments.
