---
title: I Fine-Tuned the Model Before I Built the Test
summary: The LoRA run reached 0.028 validation loss. The repository behind it had ten cases, no holdout, one bad answer key, and an evaluator that never called a model.
date: 2026-08-04
updated: 2026-08-07
canonical: https://ryanbaumann.dev/writing/fine-tuning-was-the-easy-part/
tags: ["developer experience", "ai", "evals"]
draft: false
noindex: false
image: /img/writing/the-eval-failed-before-the-model-did.jpg
imageAlt: A completed training run with loss 0.028 is blocked at an evidence gate because raw outputs, a holdout set, and a real grader are missing
socialImage: /img/writing/the-eval-failed-before-the-model-did-social.jpg
shareTitle: The Training Run Worked. My Eval Didn't.
shareSummary: I followed a fine-tuning result back to the code and found ten cases, zero retained outputs, one wrong label, and four scores typed by hand.
shareImageAlt: Loss down does not equal proof, above evidence chips showing ten cases, zero held-out cases, and four hard-coded scores
---

The first eval case asks for three things about nearby nurseries: name, address, and coordinates. Its expected field mask includes `places.displayName`, then labels the request Essentials. The [current Places field table](https://developers.google.com/maps/documentation/places/web-service/data-fields?utm_campaign=gmp_git_agentskills_v1) puts `displayName` in Pro.

Even a working grader would have rewarded the wrong billing answer. This grader didn't run at all.

I was preparing to publish a jump from 18% to 94% exact match after fine-tuning. The [evaluator underneath that claim](https://github.com/ryanbaumann/fieldwork/blob/main/evals/field-mask/test_mlx.py#L21-L60) builds commands for the base model and the tuned adapter, but it never executes them. The loop ends here, then four scores are assigned by hand:

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

The training work was real. My [learning log](https://github.com/ryanbaumann/fieldwork/blob/main/LEARNINGS.md) records a text-only LoRA run against a multimodal Gemma checkpoint that completed 100 iterations with validation loss of `0.028`. Getting there took stripping the vision and audio towers, remapping the language-model weights, and working around assumptions in MLX that didn't fit the checkpoint.

That is as far as the public evidence goes. There is no run log, checkpoint, or retained output behind the task scores. The dataset has [ten cases](https://github.com/ryanbaumann/fieldwork/blob/main/evals/field-mask/dataset.v1.json), not the 300 training examples and 100-case holdout in my first draft. Eight cases are selected for training, and the test script selects the same eight. Nothing is held out.

![The field-mask experiment contains ten cases, reuses the same eight for training and testing, and never executes the model commands.](/img/writing/the-eval-failed-experiment-audit.jpg)

## Why field masks were still worth testing

[Field masks](https://developers.google.com/maps/documentation/places/web-service/choose-fields?utm_campaign=gmp_git_agentskills_v1) tell the Places API which data to return. I chose them because the output can be syntactically perfect and still be expensive or wrong. A model can return valid JSON, the request can succeed, and one unnecessary field can move the call into another billing tier.

The task was small on purpose. I wanted a behavior with a crisp output and a product consequence. But I hadn't pinned the endpoint, and the dataset mixed the `places.*` response-mask syntax used by search endpoints with a story about Place Details pricing. Then the answer key mislabeled its very first case.

[LoRA](https://arxiv.org/abs/2106.09685) freezes the base model and trains small added matrices to make the supplied completions more likely. The optimizer sees tokens and loss. It can't tell that a field is current, necessary, or in the wrong billing tier. Feed it a bad answer key and a clean run can make the model better at repeating the mistake.

An [ICSE study](https://arxiv.org/abs/2406.09834) found the same failure shape in generated code. It tested seven models on 28,125 prompts covering 145 API migrations in eight Python libraries. Among plausible completions that used one of those APIs, 25% to 38% still chose the deprecated version.

## What I mean by a trace

The nursery row is an eval case: a request, an expected mask, and a billing label. A trace starts when a model actually attempts it.

For that one attempt, I need the exact model and adapter revisions, the prompt, the raw response, and the result of each check. Did the response parse? Did it include all three requested fields? Did it add anything else? Were the fields valid for the pinned API revision? Which billing tier did the final mask trigger?

Those answers matter separately. If the tuned model returns valid JSON with an extra expensive field, an exact-match failure tells me it missed. The trace tells me how. If the answer key is stale, the same trace lets me catch the grader instead of rewarding it.

The current repository has the case, but no attempt. There is no model output to inspect and no grader result to reproduce. The aggregate score leads back to four constants.

The clearest public counterexample I found came from [Harvey's Legal Agent Benchmark](https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark). It started with more than 1,200 tasks across 24 practice areas and over 75,000 expert-written criteria. In a later [post-training experiment](https://www.harvey.ai/blog/post-training-open-legal-agents-with-baseten-research), 40 steps of GRPO on Qwen3.5-9B moved criterion pass rate from 42.5% to 63.0% on held-out test data.

The traces moved with the score. Grep calls fell 67%, while characters read per rollout rose more than 20%. That doesn't isolate the cause of every behavior change, but it gives a reviewer something useful to inspect: the held-out result changed, and the way the agent worked changed alongside it.

## I built this backward

I changed the weights before I had a test that could tell me whether the behavior changed.

The rerun starts by fixing the nursery case and pinning one Places endpoint and documentation revision. Then I need a holdout the optimizer never sees, with near-duplicate prompts kept on the same side of the split. Every base and tuned attempt should leave behind the prompt, model configuration, raw output, and each grader result. Only then does another LoRA run answer a useful question.

Next time I don't want the aggregate score to be the first thing I see. I want to open one failed request and know which model ran, what it returned, which check failed, and whether the answer key was current.

The fine-tuning run may still turn out to work. I haven't earned that sentence yet.

If you have a public eval where a reader can follow the score back to a failed trace, send it my way. That is the bar for the rerun.
