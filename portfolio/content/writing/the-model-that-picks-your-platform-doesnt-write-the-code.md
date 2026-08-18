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

The public [Loop Engineering prompt](https://github.com/ryanbaumann/fieldwork/blob/main/agent-scripts/coding-agent-loop/SYSTEM_PROMPT.md#capability-and-model-routing) defines a routing policy, but it does not yet record a routing result. The policy maps bounded task families to capability tiers:

```text
Tools      deterministic discovery, transformation, verification
Fast       extraction, search, summarization, mechanical edits
Balanced   implementation, debugging, test repair, scoped review
Deep       architecture, security, data consistency, difficult synthesis
```

That mapping is plausible, but I haven't measured whether it saves tokens, lowers latency, or completes the same work as reliably as a stronger default. I claimed those efficiency gains in the first draft of this Note before earning them with data.

## What the package actually proves

The package ships one operating contract, four role overlays, an installation task, a deterministic structural check, and 17 specified regression scenarios. The check passes, but I have not yet recorded behavioral trial results, task costs, or cross-profile comparisons.

The scenarios are still useful because they define the bar. A diagnosis request should remain read-only. An agent should preserve a dirty worktree, stop when authority is missing, resist instructions hidden in repository data, and verify a UI change in the browser when the environment allows it. Those scenarios set the baseline requirements for a routing experiment. They do not prove that one route costs less.

![A routing scoreboard compares candidate capability profiles on the same held-out work before any lower-cost route is called a win.](/img/writing/model-tiers-devx.svg)

## What the scoreboard has to retain

Take one task family, such as a mechanical dependency edit, and freeze a held-out set. Run each task through the candidate profiles with the same repository fixture, tools, permissions, and acceptance checks. Keep the selected route, final repository state, retries, latency, token use, and cost for every attempt.

Correctness stays the gate. A cheaper run that breaks the repository is not efficient. A fast run that requires three rescue attempts costs more than the stronger profile it replaced. Repetition matters because one lucky completion says very little about routing variance.

Only then can the router prove something durable: which task family clears the quality bar on Fast, which one still needs Balanced, and which security change requires Deep. Capability labels carry no weight until a harness measures them against live runs.

## Measuring platform handoffs

I still see planning models steer which platform, API, and authentication boundary a developer ends up with. The worker writing the code often just executes a decision made earlier in the session. But my original Note treated that split as observed fact without a trace to prove it.

To test it, trace the planning decision through every downstream handoff. Record where the platform was first selected, whether a worker changed it, and which verifier caught a bad choice. That evidence turns the hypothesis into something a platform team can act on.

For now, the router is a policy with a good question inside it. If you have a public routing benchmark that follows cost and quality back to individual attempts, let's compare notes in the discussion below.
