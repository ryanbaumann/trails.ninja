---
title: Fine-Tuning Was the Easy Part
summary: Fine-tuning a model for your own app is the easy part. The hard developer-platform problem is distribution: moving one improvement beyond a single adapter, up a ladder from context to open traces to a public benchmark.
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
shareSummary: Tuning a model for your own app is the easy part. Distributing that improvement beyond one adapter, through open traces and a public benchmark, is the hard platform problem, and publishing never guarantees adoption.
shareImageAlt: Loss down does not equal proof, above evidence chips showing ten cases, zero held-out cases, and four hard-coded scores
---

Fine-tuning a model for your own app is the easy part. The hard problem for a developer platform is distribution: moving an improvement beyond one adapter and one app, up a ladder that runs from context and tools, to an owned adapter, to open traces, to a held-out public benchmark. Control drops at every rung as reach and durability climb, and publishing never forces a model lab to adopt what you shipped.

I learned that shape by getting the first rung wrong. I wanted a small model to stop over-fetching Places API fields. A [field mask](https://developers.google.com/maps/documentation/places/web-service/choose-fields?utm_campaign=gmp_git_agentskills_v1) is the list that tells the Places API which fields to return, and one unnecessary field can push a call into a higher billing tier. Current guidance can ride into an agent session through a skill or an MCP service; fine-tuning was a different bet, teaching the pattern through learned weights instead of re-explaining the whole policy on every request. So I trained a LoRA and went looking for proof it worked.

The training was real. A text-only LoRA against a multimodal Gemma checkpoint completed 100 iterations at a validation loss of `0.028`. Getting there meant stripping the vision and audio towers, remapping the language-model weights, and working around MLX assumptions that didn't fit the checkpoint.

The proof was not. The experiment reports exact match jumping from 18% to 94% after fine-tuning, but [the evaluator under that number](https://github.com/ryanbaumann/fieldwork/blob/main/evals/field-mask/test_mlx.py#L21-L60) builds commands for the base model and the tuned adapter and then never runs them. Four scores are assigned by hand:

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

Nothing sits behind those constants: no run log, no checkpoint, no retained output. The dataset has [ten cases](https://github.com/ryanbaumann/fieldwork/blob/main/evals/field-mask/dataset.v1.json), eight chosen for training, and the test script reuses the same eight, so nothing is held out. The first case asks for a nursery's name, address, and coordinates, lists `places.displayName` in its expected mask, and labels the request Essentials; the [current Places field table](https://developers.google.com/maps/documentation/places/web-service/data-fields?utm_campaign=gmp_git_agentskills_v1) puts `displayName` in Pro, so even a working grader would have scored the wrong billing answer as correct.

![The field-mask experiment contains ten cases, reuses the same eight for training and testing, and never executes the model commands.](/img/writing/the-eval-failed-experiment-audit.jpg)

I built it backward. I trained adapter weights before I had a test that could tell me whether the behavior changed.

## What a LoRA can and can't learn

I picked field masks because the output can be perfectly valid JSON and still cost too much, exactly the kind of quiet, repeated mistake weights are supposed to fix.

But [LoRA](https://arxiv.org/abs/2106.09685) freezes the original parameters and trains small added matrices that shift behavior when the adapter loads, and the optimizer only ever sees tokens and loss. It can't tell that a field is current, necessary, or in the right billing tier. Feed it a bad answer key and a clean run just teaches the model to repeat the mistake more reliably. An [ICSE study](https://arxiv.org/abs/2406.09834) found the same failure in generated code: across seven models and 28,125 prompts covering 145 API migrations, 25% to 38% of plausible completions that used one of those APIs still chose the deprecated version.

## Weight tuning can work

My run doesn't prove the behavior changed. [Harvey's public post-training experiment](https://www.harvey.ai/blog/post-training-open-legal-agents-with-baseten-research) shows what that proof looks like. Forty steps of GRPO on Qwen3.5-9B moved criterion pass rate from 42.5% to 63.0% on held-out test data, and as the score rose, grep calls fell 67% while characters read per rollout rose more than 20%. That doesn't isolate which change caused which, but it settles the part that matters: held-out performance moved, and the tool-use measurements moved with it. Post-training earns its keep when a test the model never saw says so. Mine still needs that test.

## The hard part is distribution

Everything above still lives inside one app. An adapter attached to my deployment only helps requests that load it, and context is easier to ship but stays an opt-in dependency of each agent session. For a platform, the real work is carrying an API best practice from an instruction I control into evidence another team can test, learn from, and maybe train on.

![A developer-platform distribution pyramid moves from directly controlled context and tools through an owned adapter and open traces to a held-out public benchmark with broader potential reach and more dependence on adoption.](/img/writing/fine-tuning-distribution-pyramid.svg)

Context and tools sit at the top: they carry current facts and workflows and give me the most direct control, but the agent has to load them. An owned adapter puts stable behavior into learned weights for the surfaces I run, which can work well and still reach only one deployment. Open traces and training data make that evidence reusable outside my product, so another team can inspect the attempts, run the grader, and choose to train on them. A held-out public benchmark makes the behavior visible across models; it trains nothing by itself, but it gives model builders a durable target and lets developers see whether the gap closed. Every rung down trades control for reach and durability.

So the practical order for a platform team is: keep fast-changing facts in context, fine-tune stable behavior you can grade, publish traces when you want the signal to travel, and publish a benchmark when you want the result to stay measurable.

## What the rerun has to earn

The rerun starts by fixing the nursery case and pinning one Places endpoint and documentation revision. Then it needs a holdout the optimizer never sees, with near-duplicate prompts kept on the same side of the split, and every base and tuned attempt has to leave behind its prompt, model configuration, raw output, and each grader result. Only after the local claim holds up will I publish the trace schema, grader, and held-out cases, so the result can travel beyond one adapter.

If you're working the same gap between runtime context and learned model behavior, I'd love to compare traces and benchmarks in the comments.
