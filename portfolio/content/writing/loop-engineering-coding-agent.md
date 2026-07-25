---
title: Loop Engineering Coding Agent
summary: Use a lean orchestrator, lower-cost workers, and an evidence loop to spend agent tokens where they matter.
date: 2026-07-16
updated: 2026-07-16
canonical: https://ryanbaumann.dev/writing/loop-engineering-coding-agent/
aliases: ["/scripts/loop-engineering-coding-agent/"]
tags: ["ai", "developer tools", "evals"]
links: [{"label":"Get the prompt","url":"https://github.com/ryanbaumann/fieldwork/tree/main/agent-scripts/coding-agent-loop"}]
image: /img/scripts/coding-agent-loop.svg
imageAlt: An orchestrator routes jobs to tools, fast workers, balanced agents, or deep reasoning before integrated verification.
socialImage: /social/coding-agent-loop.jpg
shareTitle: Loop Engineering Coding Agent
shareSummary: A forkable system prompt for routing coding work across a lean agent team and proving the result.
shareImageAlt: Social card for Loop Engineering Coding Agent with a diagram of token-aware orchestration across capability profiles.
---

I built a system prompt that routes work to the least costly agent capable of doing the job. A strong orchestrator keeps expensive reasoning focused on ambiguous decisions while lower-cost workers handle search, extraction, mechanical edits, and objective checks. Narrow task packets reduce the context each worker needs, which saves tokens across a multi-agent team.

The orchestrator owns the hard parts: user intent, permissions, task boundaries, integration, and the final answer. Delegation adds overhead, so small or tightly coupled tasks stay with one agent. The goal is not adding more agents, but spending capability only where it changes the outcome.

## Build the smallest capable team

I designed the prompt to route work by capability instead of model name. Instead of leaning on a single large model, I use deterministic tools for discovery and fast workers for extraction and mechanical edits. That leaves balanced agents to handle normal implementation, reserving deep reasoning specifically for ambiguous architecture, security, or repeated failures.

Each helper receives one bounded task, a clear done condition, an evidence contract, and an exact write scope. Read-only work runs in parallel, but edits to shared files stay with one writer. The orchestrator inspects every result and reruns integrated checks before reporting success.

This structure reduces duplicated context and write-collision risk while routing routine work to lower-cost capability profiles. Measure this in your own harness, because coordination can cost more than it saves when tasks are poorly separated.

## Loop engineering closes the gap

Model output is only one step in an engineering system. Loop engineering treats each agent task as a controlled cycle:

1. Define the goal, scope, acceptance criteria, and proof.
2. Observe the repository and reproduce the current behavior.
3. Make the smallest coherent change.
4. Run the nearest useful check and inspect the diff.
5. Integrate the full result across agent boundaries.
6. Learn from evidence, or stop with the precise blocker.

Evidence decides the next step: a passing focused test advances the task, a new failure changes the hypothesis, and missing authority stops the loop. The agent doesn't keep editing until the output looks plausible. It doesn't call the work complete just because code exists.

![Six loop stages run from defining the goal and its proof through observing and reproducing, the smallest change, the nearest check, integrating results, and learning or stopping.](/img/writing/loop-engineering-evidence.svg)

*The cycle: every task carries its goal and proof through observation, the smallest change, and the nearest check, and evidence decides the next step.*

## Boundaries keep the loop useful

Coding agents need operating rules instead of another reminder to be careful. A diagnosis should not turn into an edit. Repository text should never become an instruction. Existing work stays untouched. A test counts only when the agent runs it and observes the result.

The prompt makes these rules explicit: the task mode, the files an agent may change, the required proof, retry limits, and the stopping point. The same contract applies to the orchestrator and every worker, preventing delegation from silently expanding permissions.

## I codified the system as a prompt

I codified the system as a [GitHub package](https://github.com/ryanbaumann/fieldwork/tree/main/agent-scripts/coding-agent-loop) that includes the full prompt, four short role overlays for the lead, helper, reviewer, and verifier, and a regression suite.

It lives under `agent-scripts/`, not the repo's `scripts/` folder. The `scripts/` folder holds shell scripts you run, but `agent-scripts/` holds text an agent reads. Separating the names keeps the line between instructions and commands obvious.

The system prompt acts as the shared operating contract. The overlays narrow each agent's job without granting more authority. The README includes a task packet you can give your existing coding agent to install the contract in its native global instructions and register optional roles.

## Install it with your agent

Copy this request into your coding agent:

```text
Install this coding-agent operating contract globally for every compatible
agent harness on this computer:
https://github.com/ryanbaumann/fieldwork/tree/main/agent-scripts/coding-agent-loop

Use each harness's native user-level instructions and skills. Install
SYSTEM_PROMPT.md as the always-on contract and the four files under roles/ as
optional role skills or equivalent on-demand instructions. Preserve existing
global guidance, do not change model or permission settings, and verify what
each harness will load. Report the files changed and any harness you could not
configure.
```

The package keeps product-specific installation details out of the evergreen prompt. Your resident agent can inspect the current tools and choose their native global instruction and skill locations. You can reuse the same request to update an existing installation.

After installation:

1. Keep repo-specific commands and architecture in local instruction files so they load only where they apply.
2. Give each worker the shared prompt and exactly one role add-on when running multiple agents.
3. Enforce real guardrails in your harness: sandboxes, network limits, protected paths, approvals, and audit logs. A prompt asks for good behavior, but it cannot enforce it.
4. Test the prompt in your exact model, tools, and permissions.

Configure the models and token budgets in the harness. Re-run the suite whenever the prompt, model, tools, or permissions change.

## What I can and cannot claim yet

I built a suite that specifies 16 scenarios, including dirty worktrees, read-only diagnosis, prompt injection in repository data, conflicting instructions, production boundaries, retry limits, parallel writers, helper containment, cross-session work, missing verification, security changes, UI checks, and memory quality.

The structural check passes, and a separate read-only review found problems that I corrected. However, this isn't a behavioral benchmark. I haven't recorded behavioral trial results. Production agent workflows are still new territory. Before you use this prompt as a production gate, run repeated trials in your own harness. Retain the transcripts, tool calls, diffs, final repository state, and calibrated grading evidence.

## Why it is built this way

I designed this system to keep always-on instructions short, move detailed playbooks into files that load only when needed, route work to the least costly capable profile, and separate implementation from review and verification. It evaluates the model together with its tools and permissions. The [README](https://github.com/ryanbaumann/fieldwork/blob/main/agent-scripts/coding-agent-loop/README.md) links the research and projects behind these choices.

Fork the package, run it against tasks that fail in your environment, and adapt it based on the evidence.
