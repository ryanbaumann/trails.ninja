---
title: A Model Router Needs a Scoreboard
summary: A routing policy is a hypothesis until the same held-out tasks preserve quality and measure retries, latency, tokens, and cost across capability profiles.
date: 2026-07-20
updated: 2026-08-07
canonical: https://ryanbaumann.dev/writing/the-model-that-picks-your-platform-doesnt-write-the-code/
image: /img/writing/model-tiers-header.svg
imageAlt: One routing policy assigns bounded tasks to several capability profiles, with measurement still required before calling a route efficient.
socialImage: /social/the-model-that-picks-your-platform-doesnt-write-the-code.jpg
shareTitle: A Model Router Needs a Scoreboard
shareSummary: Routing by capability sounds efficient. It becomes a result only when held-out tasks preserve quality and record the real cost.
shareImageAlt: A routing policy assigning tasks to candidate capability profiles before success, attempts, latency, tokens, and cost are measured.
tags: ["developer experience", "ai", "evals"]
draft: false
noindex: false
---

A model routing policy is just a hypothesis until you record what happens across actual attempts.

The public [Loop Engineering prompt](https://github.com/ryanbaumann/fieldwork/blob/main/agent-scripts/coding-agent-loop/SYSTEM_PROMPT.md#capability-and-model-routing) contains a routing policy, but it doesn't contain a routing result. The policy maps bounded task families to capability tiers:

```text
Tools      deterministic discovery, transformation, verification
Fast       extraction, search, summarization, mechanical edits
Balanced   implementation, debugging, test repair, scoped review
Deep       architecture, security, data consistency, difficult synthesis
```

That mapping is plausible, but I haven't measured whether it saves tokens, lowers latency, or completes the same work as reliably as a stronger default. The first version of this Note claimed those efficiency gains as if the prompt had already earned them.

## What the package actually proves

The package ships one operating contract, four role overlays, an installation task, a deterministic structural check, and 17 specified regression scenarios. The check currently passes. No behavioral trial results, task costs, or cross-profile comparisons are recorded.

The scenarios are still useful because they define the bar. A diagnosis request should remain read-only. An agent should preserve a dirty worktree, stop when authority is missing, resist instructions hidden in repository data, and verify a UI change in the browser when the environment allows it. Those are requirements for a routing experiment, not evidence that one route is cheaper.

![A routing scoreboard compares candidate capability profiles on the same held-out work before any lower-cost route is called a win.](/img/writing/model-tiers-devx.svg)

## What the scoreboard has to retain

Take one task family, such as a mechanical dependency edit, and freeze a held-out set. Run each task through the candidate profiles with the same repository fixture, tools, permissions, and acceptance checks. Keep the selected route, final repository state, retries, latency, token use, and cost for every attempt.

Correctness stays the gate. A cheaper run that leaves the repository broken is not efficient, and a fast run that needs three rescue attempts may cost more than the stronger profile it replaced. Repetition matters because one lucky completion says very little about routing variance.

Only then can the router learn something defensible: this task family clears the quality bar on Fast, that one still needs Balanced, and this security change belongs with Deep. The labels do not carry meaning across harnesses until the harness measures them.

## The platform decision is another measurement problem

I still think the model doing the planning can influence which platform, API, and authentication boundary a developer ends up with. The worker that writes the code may simply execute a decision made earlier in the session. But the original Note treated that split as observed fact without a trace showing it.

To test it, run the planning decision and every downstream handoff through a trace. Record where the platform was first selected, whether a worker changed it, and which verifier caught a bad choice. That evidence would turn the thesis into something a platform team can act on.

For now, the router is a policy with a good question inside it. If you have a public routing benchmark that follows cost and quality back to individual attempts, let's compare notes in the discussion below.
