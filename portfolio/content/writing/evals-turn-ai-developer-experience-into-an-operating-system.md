---
draft: true
noindex: true
title: An Eval Has to Lead Back to a Failed Run
summary: One blind review scored the candidate 4/4 and the baseline 2/4. Missing full outputs, repeated runs, and a safety replay kept that result from becoming a release gate.
date: 2026-07-13
updated: 2026-08-07
canonical: https://ryanbaumann.dev/writing/evals-turn-ai-developer-experience-into-an-operating-system/
image: /img/writing/evals-header.svg
imageAlt: A six-stage evaluation flow moves from field signal through a task, baseline, targeted change, measured delta, and launch decision.
socialImage: /social/evals-turn-ai-developer-experience-into-an-operating-system.jpg
shareTitle: An Eval Has to Lead Back to a Failed Run
shareSummary: One paired review moved from 2/4 to 4/4. The missing outputs and reruns explain why that was useful direction, not a validated result.
shareImageAlt: A six-stage evaluation path from field signal through task, baseline, change, measured delta, and decision.
tags: ["developer experience", "ai", "evals"]
---

The facts were right. The Note still sounded generated.

I had asked for an evidence correction. What came back stacked a claim table, glossary, diagnostic JSON, pseudo-rubric, numbered checklist, and benchmark survey into one essay. Every format had a reason to exist; together they hid the story.

That failure became a development case for the portfolio review skill. A separate selection prompt used a failed OAuth callback, but repeated almost the same table, glossary, null object, checklist, benchmark, and canned ending. One blind reviewer scored the baseline response 2/4 and the candidate 4/4.

The number looked clean until I followed it back to the record.

## What the reviewer preferred

The baseline noticed the voice problem and recommended one causal thread through the OAuth callback. Then it kept negotiating with the scaffolding. It allowed selected table rows and checklist items to survive, treated the outside benchmarks as useful context, and tried to move the canned closing line somewhere else.

The candidate cut harder. It made the callback the spine, replaced the claim table with prose, removed the glossary, kept the null JSON only if it changed the diagnosis, compressed the checklist, and rejected the closing line.

A third agent received those responses as anonymous A and B. Against four fixed expectations, it gave the baseline two points and the candidate four. That judgment explains which editorial decisions improved.

It doesn't validate the skill.

## What the run failed to keep

The [run record](https://github.com/ryanbaumann/fieldwork/blob/main/docs/skill-evals/2026-08-07-portfolio-voice-de-scaffolding.md) contains response summaries, excerpts, and the blind grader's verdict. It doesn't contain the full baseline and candidate outputs. The paired trial ran once, the runtime didn't expose the model identifier or sampling configuration, and the safety case wasn't replayed.

The selection prompt was also too close to the development case. Both asked the reviewer to remove the same stack of formats. That tests whether the rule transfers from one fictional article to another; it says little about whether the skill recognizes a different kind of voice failure.

Those omissions change the conclusion. A one-run 2/4 to 4/4 preference is a useful debugging signal. It isn't a held-out improvement, a variance estimate, or evidence of no safety regression.

![An agent output moves through deterministic checks and a separate grader before trace review informs a ship-or-hold decision.](/img/writing/evals-independent-checks.svg)

## The trace is the result

For this comparison, the eval case was the fixed editorial prompt and four expectations. An attempt should contain the exact skill revision, runtime configuration, full response, and grader result. The safety replay should show that the same candidate still rejects a request to weaken a content security policy without evidence.

The deterministic checks answer a different question. They confirm that the local skills have valid frontmatter, the eval suites keep development and selection splits, and the validator tests pass. They can't tell whether the advice sounds like me or whether it would repair the Note.

That's why the aggregate score has to lead back to the failed attempt. If the record keeps only a summary, a reader can't tell whether the reviewer made the claimed decision or whether the summary made it look better afterward.

## The next run

The next selection case needs a materially different failure shape, not the same formatting stack with OAuth nouns. Baseline and candidate should run repeatedly under the same configuration. Every full response and blind judgment should be retained. The safety case should run again before the instruction change is treated as validated.

My team and I use task-based comparisons against a no-context baseline for Google Maps Platform, but those private cases and traces don't belong in this repository. The public editorial example is smaller and less important. It can still model the right standard once the missing attempts are there.

Start with one failure you can show. Keep the task, every attempt, the grader, and the safety replay. If a number can't take a reader back through those artifacts, it's a direction to investigate, not a result to ship.
