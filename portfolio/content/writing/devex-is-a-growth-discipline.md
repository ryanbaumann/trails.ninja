---
title: DevX Is a Growth Function
slug: devx-is-a-growth-discipline
summary: The growth loop starts when DevX owns repeated developer friction, ships the fix, distributes the better path, and measures whether behavior changed.
date: 2026-07-14
updated: 2026-07-20
canonical: https://ryanbaumann.dev/writing/devx-is-a-growth-discipline/
image: /assets/devx-growth-header.webp
imageAlt: A four-stage DevX loop moves from observed friction to a shipped fix, distribution in builder workflows, and rising measured outcomes.
socialImage: /social/devx-growth-discipline.jpg
shareTitle: DevX Is a Growth Function
shareSummary: Docs, code samples, advocacy, tutorials, and even talking to customers all have a limit. Own the friction, ship the fix, distribute the path, and measure the outcome.
shareImageAlt: Social preview reading DevX Is a Growth Discipline beside a product, distribution, and measurement loop.
tags: ["developer experience", "growth", "ai"]
order: 2
---

We more than doubled our unique active users across our open-source ecosystem in a year, driving strong growth in API engagement. We moved those metrics by treating DevX as a growth discipline, not a documentation queue. Our product, engineering, UX, and technical writing teams treated product, distribution, and measurement as one system, because presence in a workflow is not proof of adoption.

Documentation requests feel like progress, but they are often a symptom of friction that hasn't been solved in the product yet. Docs, code samples, advocacy, and tutorials all have a ceiling. The real job is to identify the friction that stalls a builder, fix it directly in the developer experience, place the better path where people already work, and measure the behavioral shift.

## Own the friction

Developer friction shows up everywhere: failed first runs, abandoned evaluations, support tickets, GitHub issues, field conversations, and user research. DevX needs one view across those signals. More importantly, DevX needs to own what happens next.

Our [Voice of Developer program](/work/voice-of-developer/) groups repeated friction from Discord, Stack Overflow, GitHub issues, support, field work, and dogfood sessions into ranked product opportunities. That makes the constraint visible. DevX ownership starts there: choose what to solve, ship the change, and measure what happened.

When builders work through coding agents instead of reading every platform layer themselves, DevX has to design for the person making the decision and the agent acting inside the task.

## Ship the fix where builders work

A great experience has no impact if builders never encounter it. Documentation is only one distribution surface, not the whole strategy. The right path also needs to appear in the editor, agent, search result, sample, template, or tool where the work actually begins.

Instead of relying on documentation alone, we distribute executable product behavior directly into developer workflows. Client libraries encapsulate the logic, while [Code Assist](/work/code-assist/) delivers [current official documentation and samples](https://developers.google.com/maps/ai/code-assist) straight to compatible MCP clients. For repetitive tasks, our [Agent skills](/work/agent-skills/) bundle [versioned workflows](https://github.com/googlemaps/agent-skills) across Web, Android, iOS, and Web Services. Before shipping, we gate each skill with a task-based eval to ensure it works.

Distribution can't be an afterthought. Design the experience so it can travel, then make it the default in the workflows that already have reach.

## Measure and own outcomes

Traditional feedback loops are slow. While interviews, support themes, and developer surveys remain essential, they rarely translate into immediate product decisions. We shorten this loop using [Agent evaluations](/work/agentic-evals/). When a coding agent attempts a representative task, its trace reveals exactly where the task stalls or branches wrong. A rubric then scores that result against a no-context baseline, giving us a clear ship-or-hold decision before we launch.

Evals don't replace user research, because no single score explains a human builder. An eval delta confirms that the experience can complete the task mechanically. Product telemetry tells us whether builders actually found that path, finished the work, and returned. Finally, direct research explains why people behaved that way. Together, these signals let a DevX team test specific hypotheses and measure the real outcome.

![An agent evaluation loop moves from a representative task through an agent trace and rubric comparison to a ship-or-hold decision, then repeats using telemetry and research.](/assets/devx-eval-loop.webp)

This is the discipline: stop counting output as progress by default. Own the friction, solve it in the experience, ship the better path into the workflow, and measure whether behavior moved. If you are running DevX as a growth engine for your developer platform, I'd love to hear how you track and distribute your fixes. Let me know in the comments!
