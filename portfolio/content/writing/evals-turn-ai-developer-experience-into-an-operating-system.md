---
draft: true
noindex: true
title: Evals Are How You Know an AI Developer Tool Got Better
summary: Task-based evals show whether a context, tool, or prompt improved the developer's actual job.
date: 2026-07-13
updated: 2026-07-15
canonical: https://ryanbaumann.dev/writing/evals-turn-ai-developer-experience-into-an-operating-system/
image: /img/writing/evals-header.svg
imageAlt: A six-stage evaluation flow moves from field signal through a task, baseline, targeted change, measured delta, and launch decision.
socialImage: /social/evals-turn-ai-developer-experience-into-an-operating-system.jpg
shareTitle: Evals Are How You Know an AI Developer Tool Got Better
shareSummary: Test whether a context, tool, or prompt improved the developer's actual job.
shareImageAlt: Evals Are How You Know an AI Developer Tool Got Better beside a task-to-launch evaluation loop.
tags: ["developer experience", "ai", "evals"]
---

A task-based evaluation proves an agent became better at a developer's job. A polished demo proves only that one path worked once. Without evals, a team can ship context, prompts, tools, and skills, but it can't tell whether the AI actually improved the developer experience.

## Measure the developer task

Our team built an [agentic eval suite](/work/agentic-evals/) for Google Maps Platform because we needed a shared quality bar for retrieval, skills, and agent integrations. I wrote the initial eval harness to prove the pattern, and we now compare context products against a no-context baseline to inform launch and roadmap decisions.

The unit of quality is the job the developer is trying to complete instead of an abstract benchmark. For a developer platform, that means adding a map, choosing the right API, configuring authentication, or fixing code that uses an outdated surface. We run that task through an agent and inspect the result. Depending on the job, useful measures include grounded code accuracy, tool-call behavior, token cost, and end-to-end completion. The important comparison is the delta between a baseline and the proposed change.

## Connect failures back to field signal

An eval set must represent the failures that matter to developers and the business instead of a collection of clever prompts. That evidence comes from support, GitHub issues, community questions, field engineering, documentation gaps, and traces from real workflows when privacy and access rules allow it. 

A repeated failure becomes a task. The task becomes a test. The scored result shows whether a context or product change addressed the problem. This creates a loop:

1. Find repeated friction in the field.
2. Encode the developer task and expected behavior.
3. Run the baseline.
4. Change one part of the context, tool, or workflow.
5. Compare the result and inspect the failures.
6. Ship only when the evidence supports the decision.

The loop tells the team which class of failure moved and which cases still need work, which is more useful than a single aggregate score.

## Keep the evaluator independent

The system proposing a change should not be the only system judging it because an optimizer that grades its own output can learn the shape of the rubric without improving the developer outcome.

Use deterministic checks where possible. Compile generated code. Validate required APIs and tool calls. Check that the result follows security constraints. Use a separate grader for behavior that needs judgment, then review failure traces directly.

Trust deltas more than absolute scores. Model behavior, agent harnesses, and adaptive graders move. A stable baseline and a focused metric make the before-and-after comparison useful even when the surrounding system changes.

![An agent output moves through deterministic checks and a separate grader before trace review informs a ship-or-hold decision.](/img/writing/evals-independent-checks.svg)

## Make the eval the shared quality gate

A shared eval lets product, documentation, and engineering test changes against the same developer task. The same tasks can test a documentation update, a retrieval change, or a tool release. Everyone can inspect which failures moved and which did not.

That shared mechanism reduces opinion-driven debate and keeps AI Developer Experience connected to product growth. If a change improves a task in evals, the team can ship it into a real distribution surface and then measure whether adoption changes. The eval is not the business outcome. It is the quality gate between field signal and scaled distribution.

## Start with ten real tasks

We're still mapping these patterns, but building a baseline is the necessary first step. Choose ten failures from issues, support, community questions, or traces. Run them with no added context. Inspect the failures, make one targeted change, and run the same tasks again. Let the delta decide what to fix next.
