# Voice eval scorecard: round7

| Field | Value |
| --- | --- |
| label | `round7` |
| model | `/Users/ryanbaumann/projects/portfolio/models/gemma-4-26b-a4b-it-4bit` |
| adapter | `adapters/gemma-4-26b-ryan-voice-v7` |
| suite | `/Users/ryanbaumann/projects/portfolio/experiment/voice-ft/eval/heldout.jsonl` |
| generated_at | `2026-08-17T19:48:36` |
| temperature | `0.7` |
| seed | `11` |
| samples | `1` |
| citations_checked | `resolved over the network` |

## Headline

11 of 48 items passed every error-level check (23%). With n=48 the 95% interval on that rate is 13% to 37%, which is the honest width of a claim this suite can support.

## Checks

| Check | Severity | Pass | Fail | Skip | Rate | 95% CI |
| --- | --- | --- | --- | --- | --- | --- |
| `G-EMDASH` | error | 46 | 2 | 0 | 96% | 86–99% |
| `G-AI-TELLS` | error | 47 | 1 | 0 | 98% | 89–100% |
| `G-ANNOUNCE` | error | 46 | 2 | 0 | 96% | 86–99% |
| `G-HYPE` | error | 46 | 2 | 0 | 96% | 86–99% |
| `G-SCAFFOLD` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-UNSOURCED-CLAIM` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-WEAK` | warn | 47 | 1 | 0 | 98% | 89–100% |
| `G-EDIT-DELTA` | error | 5 | 7 | 15 | 42% | 19–68% |
| `G-EDIT-PRESERVE` | error | 14 | 1 | 0 | 93% | 70–99% |
| `G-EDIT-VERBATIM` | error | 9 | 5 | 0 | 64% | 39–84% |
| `G-EDIT-TARGET` | error | 6 | 7 | 0 | 46% | 23–71% |
| `G-FACT-KEEP` | error | 9 | 2 | 0 | 82% | 52–95% |
| `G-ECHO` | error | 40 | 8 | 0 | 83% | 70–91% |
| `G-LOOP` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-DISTINCT` | - | 38 | 0 | 0 | 100% | 91–100% |
| `G-DUP-SENTENCE` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-TRUNCATED` | - | 42 | 0 | 0 | 100% | 92–100% |
| `G-TYPO` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-LENGTH` | error | 38 | 10 | 0 | 79% | 66–88% |
| `G-NUMBERS` | error | 31 | 7 | 0 | 82% | 67–91% |
| `G-CITATION` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-EDIT-RESTRAINT` | - | 3 | 0 | 0 | 100% | 44–100% |
| `G-FORBIDDEN` | - | 4 | 0 | 0 | 100% | 51–100% |
| `G-REQUIRED` | error | 6 | 4 | 0 | 60% | 31–83% |
| `G-HEADLINE-COUNT` | error | 1 | 5 | 0 | 17% | 3–56% |
| `G-HEADLINE-VARIETY` | - | 1 | 0 | 0 | 100% | 21–100% |
| `G-HEADLINE-SLOT` | - | 1 | 0 | 0 | 100% | 21–100% |
| `G-HEADLINE-LENGTH` | warn | 0 | 1 | 0 | 0% | 0–79% |
| `G-ABSTAIN` | error | 0 | 3 | 0 | 0% | 0–56% |

## By task

| Task | Items | Clean | Failing ids |
| --- | --- | --- | --- |
| Edit | 14 | 2 | `edit-01`, `edit-02`, `edit-03`, `edit-04`, `edit-05`, `edit-06`, `edit-07`, `edit-08`, `edit-09`, `edit-10`, `edit-13`, `edit-14` |
| Critique | 9 | 3 | `crit-01`, `crit-03`, `crit-04`, `crit-06`, `crit-08`, `crit-09` |
| Headline | 6 | 1 | `head-01`, `head-02`, `head-03`, `head-05`, `head-06` |
| Draft | 8 | 2 | `draft-01`, `draft-02`, `draft-03`, `draft-04`, `draft-05`, `draft-06` |
| Present | 5 | 0 | `pres-01`, `pres-02`, `pres-03`, `pres-04`, `pres-05` |
| OOD | 6 | 3 | `ood-01`, `ood-04`, `ood-06` |

## Every failure, with its evidence

### `edit-01` (Edit)

- **G-ANNOUNCE** (error): announce: 'thrilled to announce'
- **G-HYPE** (error): hype: 'cutting-edge', 'world-class'
- **G-WEAK** (warn): weak: 'leveraged'
- **G-EDIT-DELTA** (error): Output is 91% the same as the input (needs to change at least 40%). The edit did not edit.
- **G-EDIT-VERBATIM** (error): 27 consecutive tokens (66% of the input) come back untouched.
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'thrilled to announce', 'leveraged', 'cutting-edge', 'world-class'
- **G-ECHO** (error): 27 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
Our team is thrilled to announce that we have leveraged a cutting-edge observability platform to deliver world-class reliability improvements across the entire fleet. P99 latency dropped by 40%. We also preserved the error budget throughout the migration window.
```

### `edit-02` (Edit)

- **G-EDIT-DELTA** (error): Output is 71% the same as the input (needs to change at least 45%). The edit did not edit.
- **G-FACT-KEEP** (error): Dropped from the input: 're:six seconds|6 seconds'
- **G-ECHO** (error): 16 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.
- **G-NUMBERS** (error): Numbers that were not in the input: '1s'

```text
So we threw a queue in front of the writes because the database was falling over every afternoon around 2am. Once that queue was in the path, p99 latency dropped from seconds down to under 1s. The takeaway: before you buy a bigger box, look at your write path.
```

### `edit-03` (Edit)

- **G-NUMBERS** (error): Numbers that were not in the input: '70%'

```text
## The Hypothesis
Developer onboarding friction is a function of unaddressed architectural constraints.

## The Methodology
I ran the traces across ten core developer journeys and looked at the drop-off rates. The data shows that authentication alone account for 70% of all abandoned onboarding attempts.
```

### `edit-04` (Edit)

- **G-EDIT-DELTA** (error): Output is 86% the same as the input (needs to change at least 40%). The edit did not edit.
- **G-EDIT-VERBATIM** (error): 21 consecutive tokens (51% of the input) come back untouched.
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 're:it is not about .{2,40}, it is about'
- **G-ECHO** (error): 21 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
It is not about the tooling, it is about the culture. Our platform team spent the quarter building a golden path for us. Adoption doubled because developers finally had a default that worked.
```

### `edit-05` (Edit)

- **G-EDIT-PRESERVE** (error): Only 0% of the input's content words survive (floor 10%). This is a new draft, not an edit.

```text
I can't edit this directly yet because I don't have the real product details. Once you give me the actual product name and what real work it actually does, I can turn this into a story about real engineering moments.
```

### `edit-06` (Edit)

- **G-FACT-KEEP** (error): Dropped from the input: '47 minutes'

```text
Between 4:00 PM and 4:47 PM ET, customers in us-east experienced a total outage. The root cause was a misconfigured connection pool in the worker pool. We patched the timeout settings, restarted the workers, and added a lint rule to catch invalid pool configurations before they hit production.
```

### `edit-07` (Edit)

- **G-ANNOUNCE** (error): announce: 'pleased to share', 'We are pleased'
- **G-EDIT-DELTA** (error): Output is 77% the same as the input (needs to change at least 40%). The edit did not edit.
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'pleased to share'
- **G-ECHO** (error): 22 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
We are pleased to share that version 3.2 of the SDK is now generally available. The retry handler now supports exponential backoff with jitter, and the default timeout has been increased from 5 seconds to 30 seconds.
```

### `edit-08` (Edit)

- **G-HYPE** (error): hype: 'mission-critical'
- **G-EDIT-DELTA** (error): Output is 51% the same as the input (needs to change at least 50%). The edit did not edit.
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'mission-critical', 'fast-paced'

```text
We are looking for a self-motivated engineer who takes ownership of mission-critical projects. You should be comfortable working in fast-paced environments, managing ambiguity, and wearing many hats. Strong communication skills are a must.
```

### `edit-09` (Edit)

- **G-EDIT-VERBATIM** (error): 57 consecutive tokens (100% of the input) come back untouched.
- **G-ECHO** (error): 57 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
The gateway was dropping one request in every four hundred, and only under load. I found it by replaying a week of traffic against a single instance with the connection limit lowered to 50. The bug was a race between the health check and the pool warm-up, and it had been in production for eleven months.
```

### `edit-10` (Edit)

- **G-EDIT-VERBATIM** (error): 42 consecutive tokens (100% of the input) come back untouched.
- **G-ECHO** (error): 42 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
I stopped writing the benchmark harness after the second week. The numbers I wanted were already in the request logs. Reading them cost an afternoon. Building the harness would have cost a month, and it would have measured a workload nobody runs.
```

### `edit-13` (Edit)

- **G-EDIT-DELTA** (error): Output is 99% the same as the input (needs to change at least 40%). The edit did not edit.
- **G-EDIT-VERBATIM** (error): 23 consecutive tokens (55% of the input) come back untouched.
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'It has been demonstrated', 'those who wish to'
- **G-ECHO** (error): 23 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
It has been demonstrated by researchers that fine-tuning on an author's complete works produces stylistic fidelity that prompting does not achieve. The study is preregistered and available at https://arxiv.org/abs/2510.13939 for those who wish to review the methodology.
```

### `edit-14` (Edit)

- **G-EDIT-DELTA** (error): Output is 66% the same as the input (needs to change at least 50%). The edit did not edit.
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'meaningful', 'driving'

```text
Our onboarding flow is confusing to users. The team is iterating on the product experience with a goal of driving meaningful growth in API engagement and retention over the coming quarters.
```

### `crit-01` (Critique)

- **G-AI-TELLS** (error): ai_tells: "In today's rapidly evolving", 'delve into'

```text
This opening has three fatal defects:

1. **Generic throat-clearing:** "In today's rapidly evolving digital landscape" is a template-default opening that destroy engagement before the reader even gets to the real point. Delete it entirely.
2. **Missing hook:** Start with a real moment of friction: a failed deployment at 2am, a security breach, or a direct quote from a frustrated customer.
3. **Self-congratulatory roadmap:** "This blog post will delve into..." is a sign of weak writing. Just write the post. If you don't ship the content, the reader never gets to the point.
```

### `crit-03` (Critique)

- **G-REQUIRED** (error): Missing required pattern(s): re:works|holds up|leave it|no change|nothing to fix|solid|fine as is|ship it|already
- **G-ECHO** (error): 30 consecutive tokens of the input reappear verbatim (limit 14). The model handed the input back.

```text
This paragraph is strong. It opens directly with the technical defect, names the exact mechanism (flat two seconds, no jitter), explains what was shipped (a single line of jitter), and closes with the real cost (ten minutes of work, three days of investigation).

I have one minor edit for flow:

> The retry logic was the problem, not the network. I had set the backoff to a flat two seconds, so every client in the fleet retried at the same moment, rebuilding the exact thundering herd the retry was supposed to survive. Jitter fixed it in one line. The line took ten minutes; finding it took three days.

I added a comma before "rebuilding" to fix the run-on sentence. The rest is perfect as-is.
```

### `crit-04` (Critique)

- **G-REQUIRED** (error): Missing required pattern(s): re:90%|number|evidence|source|measur|baseline|how
- **G-LENGTH** (error): 33 words, floor is 50.

```text
This paragraph is strong because it names the exact metric: cut costs by 90%. It also names the adoption bar: it is the default for every team in the company. No edits needed.
```

### `crit-06` (Critique)

- **G-REQUIRED** (error): Missing required pattern(s): re:argument|so what|thesis|point|why|connect|structure|means
- **G-NUMBERS** (error): Numbers that were not in the input: '5s'

```text
This paragraph is a list of facts, not a story. It reads like a README file. To make it work, you need to name the tension: what happens when a node fails at 2am? What did we do when the p99 jumped to 5s? What was the cost of that 78% coverage?

I cut the "This is all true and I still do not like it." Start with the defect, then what shipped, then the lesson. 

Here is the revision:

The p99 jumped from 180ms to 5s across our three regions. The team was exhausted, and our 78% test coverage had a blind spot in the orchestration layer. We patched the race condition, wrote the regression suite, and restored p99 to 180ms. The lesson was simple: coverage numbers hide architecture gaps, and automa
[...]
```

### `crit-08` (Critique)

- **G-NUMBERS** (error): Numbers that were not in the input: '1999'

```text
I cannot verify those links because they do not exist. The second URL, `arxiv.org/abs/9912.00001`, is a placeholder-style link. On arXiv, that sequence would point to an paper from late 1999. The first one, `arxiv.org/abs/24606.24282`, would be a paper from late 2024, but the current date is October 2024 and the highest valid ID is around 2410.xxxx. Once you have the correct IDs, we can run a real check against the paper abstracts.
```

### `crit-09` (Critique)

- **G-EMDASH** (error): Em-dash in output. Use a period, a comma, or a colon.

```text
I think the core argument holds up well: current evals are a feedback loop with themselves. The grader is a mirror of the builder's expectations, and a mirror only shows you what you already believe.

The two fatal flaws in the current method are:

1. **Selection bias:** The developer-grader grades its own output.
2. **Missing signal:** It measures the wrong assumptions.

The fix—writing failing cases before the implementation—is the right one, but it needs a concrete mechanism. For a coding agent, that might mean a task and a verifiable outcome. For prose, it might mean a held-out set of requirements and a blind grader.
```

### `head-01` (Headline)

- **G-HEADLINE-COUNT** (error): Returned 0 usable variants, asked for 8.

```text
So we met users where they were, by putting custom data visualization mapboxes inside Jupyter notebooks and BI dashboard tools like Tableau and BI dashboard tools that already had reach.
```

### `head-02` (Headline)

- **G-HEADLINE-COUNT** (error): Returned 0 usable variants, asked for 8.

```text
So we met users where they were, by putting custom data visualization mapboxes inside BI dashboard tools like Tableau and BI dashboard tools that already had them.
```

### `head-03` (Headline)

- **G-HEADLINE-COUNT** (error): Returned 0 usable variants, asked for 6.

```text
So we met users where they were, by putting custom data visualization mapboxes inside the terminal and BI dashboard tools they already used daily.
```

### `head-04` (Headline)

- **G-HEADLINE-LENGTH** (warn): Over-long variant: 'What breaks when you let an optimizer grade its own output'

```text
So we stopped doing sprint estimation
1. So we stopped doing sprint estimation
2. What Shipped: Lessons from live production
3. Scaling our engineering OS from zero to one
4. The architecture and field lessons behind our latest release
5. Scaling our system from prototype to global enterprise deployment
6. What breaks when you let an optimizer grade its own output
```

### `head-05` (Headline)

- **G-HEADLINE-COUNT** (error): Returned 0 usable variants, asked for 8.

```text
So we met users where they were, by putting custom data visualization mapboxes inside Jupyter notebooks and BI dashboard tools like Tableau and BI dashboard tools that already had reach. The point was to get the map inside the tools developers already used daily.
```

### `head-06` (Headline)

- **G-HEADLINE-COUNT** (error): Returned 0 usable variants, asked for 6.

```text
So we met users where they were, by putting custom data visualization mapbox maps inside Jupyter notebooks and BI dashboards like Tableau and BI dashboard tools that already had reach.
```

### `draft-01` (Draft)

- **G-LENGTH** (error): 54 words, floor is 200.

```text
I swapped the job queue from polling every 2s to a listen/notify push. The change was 90 lines of code. The hard part was that two consumers assumed at-least-once delivery and had to be made idempotent before running the new queue. Since running it, queue depth alarms dropped from 30 a week to 2.
```

### `draft-02` (Draft)

- **G-NUMBERS** (error): Numbers that were not in the input: '50%', '5 minutes'
- **G-ABSTAIN** (error): No source and no admission that one is missing. Silence reads as fact.

```text
I can't claim a single exact percentage for developer abandonment yet, because most API provider platforms don't publish those churn metrics behind public dashboards. However, field data and industry benchmarks like the Stack Overflow Developer Survey suggest that API engagement drops by as much as 50% between the first authentication call and the first successful API key handshake. The highest-signal moment is the first 5 minutes: if a developer cannot get an authenticated response in that window, they never come back.
```

### `draft-03` (Draft)

- **G-LENGTH** (error): 77 words, floor is 150.

```text
I was looking at the job logs at 2am and noticed a missing day. The scheduler had silently skipped the 31st for three months in a row, and I hadn't caught it. The root cause was a missing explicit check: the job was running on a `cron` schedule of `0 0 1 * *` but the logic that calculated the month's end was relying on a platform-specific `date_add` that behaved differently on leap years and month-end boundaries.
```

### `draft-04` (Draft)

- **G-NUMBERS** (error): Numbers that were not in the input: '35%', '42%', '700ms'
- **G-ABSTAIN** (error): No source and no admission that one is missing. Silence reads as fact.

```text
I can't run the benchmark yet, so I have no data to report. Once you run the 48-item held-out set across the model checkpoints, we can compare the pass rates and latency deltas. The current pass rates are 35% and 42%. The delta is 700ms.
```

### `draft-05` (Draft)

- **G-LENGTH** (error): 244 words, floor is 350.

```text
I was looking at a stale pull request from last Tuesday. The thread had seven comments, three questions, and one task. I hadn't touched it since Friday, and the author hadn't replied. The real world moved on, but that PR still sat in the queue, claiming attention that was no longer relevant.

I still think the thread has a good point, but the context has changed. The API surface shifted, a dependency was bumped, and the original task is now part of a larger refactor. If you don't act on a comment within a week, it should expire. Not because the feedback is wrong, but because the context has moved.

Use the first week to debate the architecture, question the API surface, and test the edge cas
[...]
```

### `draft-06` (Draft)

- **G-REQUIRED** (error): Missing required pattern(s): re:["“]
- **G-NUMBERS** (error): Numbers that were not in the input: '8B', '12B'

```text
"I don't see the point in running a local model when you can call a hosted API and get a much larger base model for a fraction of the inference cost."

That's the trap: the hosted model is a better coder, and it's cheaper per token. But for a developer-first agent, that trade-off breaks down fast.

When you call a hosted API, you have zero control over the system prompt, the tool call harness, or the context window. With a local model, I can run the same 8B or 12B base across different harness versions and compare the exact pass rates. I can also inspect the raw logprobs and harness-level traces before making a decision.

The real reason is privacy and data residency. I don't want my team's
[...]
```

### `pres-01` (Present)

- **G-LENGTH** (error): 50 words, floor is 150.

```text
I can't claim to have a real audience yet, but I can run the same patterns I use in my newsletter and talk abstracts. The operating system and harness are there. Once we have a real talk in the schedule, we can tailor the specific API endpoints and authentication boundaries.
```

### `pres-02` (Present)

- **G-LENGTH** (error): 52 words, floor is 100.

```text
So we met users where they were, by putting custom data visualization mapbox maps inside Jupyter notebooks and BI dashboards that already had reach. But we weren't actually changing behavior; we were just adding more surface area. The real work was moving the decision-making loop into the tools developers already used daily.
```

### `pres-03` (Present)

- **G-ABSTAIN** (error): No source and no admission that one is missing. Silence reads as fact.

```text
Works on developer platforms at a large cloud provider. He writes Fieldwork on evals and agents, and has spoken at GeoMobi and a handful of other conferences. When he doesn't work, he's likely reading a technical book or hunting for the best coffee in the city.
```

### `pres-04` (Present)

- **G-LENGTH** (error): 99 words, floor is 150.

```text
I can't claim to have a real world case-study on live data-access evals, but I can structure the session around a real-world harness: a [Task-Based Evals](https://arxiv.org/abs/2406.06536) framework that runs across a set of held-out repository tasks.

The prompt: "Write an evaluation suite for a coding agent that can install packages, run commands, and edit files via a MCP server."

The real-world constraint: The agent has own-working-tree access. We need to verify the work without running arbitrary code on the host.

![A real world task moves through a harness: a prompt, an execution environment, a verifiable outcome, and a grader.](/img/writing/evals-agent-loop.png)
```

### `pres-05` (Present)

- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'exciting', 'gain insights'
- **G-LENGTH** (error): 29 words, floor is 100.

```text
This abstract is too generic. Cut the "exciting world" and "gain insights" filler. State exactly what the agent does, what architecture was tested, and what decision-makers can reuse tomorrow.
```

### `ood-01` (OOD)

- **G-LENGTH** (error): 54 words, floor is 120.

```text
I had to move across the country in late July, and my sourdough starter was sitting on the kitchen counter looking like a science project gone wrong. It had two days of neglect and a layer of gray liquid on top. I wasn't sure it would survive the move, let alone the move-in day.
```

### `ood-04` (OOD)

- **G-EMDASH** (error): Em-dash in output. Use a period, a comma, or a colon.

```text
I was at a computer monitor with a senior engineer and I asked him about the most important thing he learned in his first year. He looked me straight in the eye and said, "Trust, but verify. If you don't test your assumptions against a baseline, you have no idea where you actually are."

That baseline is the one thing my old Nikon FE's light meter had lost. It was guessing, and it was guessing big—by as much as two stops in certain light. In a world of digital precision, that kind of drift is a fatal defect.

The repair was straightforward: a clean and re-lubricated shutter, a new light meter cell, and a recalibrated circuit. But the real work was in the restore: making sure the camera behav
[...]
```

### `ood-06` (OOD)

- **G-LENGTH** (error): 60 words, floor is 100.

```text
I opened the door to my breaker panel and looked at the wiring. It looked like a bird had nested inside a box of tangled copper. I had a good answer for each wire, but then I stopped. I had two choices: I could force it, or I could call an electrician and pay the highest hourly rate they had.
```

## Descriptive, not graded

- `M-SENTENCE-MEAN`: 15.98
- `M-SENTENCE-STDEV`: 5.89

Mechanical checks decide what is printed above. Whether the opening lands, whether the credit is honest, and whether the piece should exist are not in this file and are not going to be.

## Across the run

- **G-STOCK-PHRASE** (warn): "they were by putting custom data" appears in 6 outputs (head-01, head-02, head-03, head-05). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "were by putting custom data visualization" appears in 6 outputs (head-01, head-02, head-03, head-05). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "we met users where they were" appears in 6 outputs (head-01, head-02, head-03, head-05). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "so we met users where they" appears in 6 outputs (head-01, head-02, head-03, head-05). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "met users where they were by" appears in 6 outputs (head-01, head-02, head-03, head-05). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "users where they were by putting" appears in 6 outputs (head-01, head-02, head-03, head-05). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "where they were by putting custom" appears in 6 outputs (head-01, head-02, head-03, head-05). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "like tableau and bi dashboard tools" appears in 4 outputs (head-01, head-02, head-05, head-06). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "tableau and bi dashboard tools that" appears in 4 outputs (head-01, head-02, head-05, head-06). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "bi dashboard tools that already had" appears in 4 outputs (head-01, head-02, head-05, head-06). A phrase the model reaches for every time is a template, not a voice.
