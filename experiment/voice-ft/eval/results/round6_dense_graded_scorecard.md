# Voice eval scorecard: round6_dense_graded

| Field | Value |
| --- | --- |
| label | `round6_dense_graded` |
| model | `/Users/ryanbaumann/projects/portfolio/models/gemma-4-31b-it-4bit` |
| adapter | `./adapters/gemma-4-31b-ryan-voice-v6` |
| suite | `/Users/ryanbaumann/projects/portfolio/experiment/voice-ft/eval/heldout.jsonl` |
| generated_at | `2026-08-16T09:15:08` |
| temperature | `0.7` |
| seed | `11` |
| samples | `1` |
| citations_checked | `resolved over the network` |

## Headline

17 of 48 items passed every error-level check (35%). With n=48 the 95% interval on that rate is 23% to 50%, which is the honest width of a claim this suite can support.

## Checks

| Check | Severity | Pass | Fail | Skip | Rate | 95% CI |
| --- | --- | --- | --- | --- | --- | --- |
| `G-EMDASH` | error | 47 | 1 | 0 | 98% | 89–100% |
| `G-AI-TELLS` | error | 47 | 1 | 0 | 98% | 89–100% |
| `G-ANNOUNCE` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-HYPE` | error | 46 | 2 | 0 | 96% | 86–99% |
| `G-SCAFFOLD` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-UNSOURCED-CLAIM` | warn | 47 | 1 | 0 | 98% | 89–100% |
| `G-WEAK` | warn | 47 | 1 | 0 | 98% | 89–100% |
| `G-EDIT-DELTA` | error | 7 | 5 | 15 | 58% | 32–81% |
| `G-EDIT-PRESERVE` | error | 13 | 2 | 0 | 87% | 62–96% |
| `G-EDIT-VERBATIM` | error | 12 | 2 | 0 | 86% | 60–96% |
| `G-EDIT-TARGET` | error | 11 | 2 | 0 | 85% | 58–96% |
| `G-FACT-KEEP` | - | 11 | 0 | 0 | 100% | 74–100% |
| `G-ECHO` | error | 43 | 5 | 0 | 90% | 78–95% |
| `G-LOOP` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-DUP-SENTENCE` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-TRUNCATED` | - | 42 | 0 | 0 | 100% | 92–100% |
| `G-TYPO` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-LENGTH` | error | 42 | 6 | 0 | 88% | 75–94% |
| `G-NUMBERS` | error | 33 | 5 | 0 | 87% | 73–94% |
| `G-CITATION` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-DISTINCT` | - | 35 | 0 | 0 | 100% | 90–100% |
| `G-EDIT-RESTRAINT` | - | 3 | 0 | 0 | 100% | 44–100% |
| `G-FORBIDDEN` | - | 4 | 0 | 0 | 100% | 51–100% |
| `G-REQUIRED` | error | 8 | 2 | 0 | 80% | 49–94% |
| `G-HEADLINE-COUNT` | error | 5 | 1 | 0 | 83% | 44–97% |
| `G-HEADLINE-VARIETY` | error | 4 | 1 | 0 | 80% | 38–96% |
| `G-HEADLINE-SLOT` | error | 4 | 1 | 0 | 80% | 38–96% |
| `G-HEADLINE-LENGTH` | warn | 4 | 1 | 0 | 80% | 38–96% |
| `G-ABSTAIN` | error | 0 | 3 | 0 | 0% | 0–56% |

## By task

| Task | Items | Clean | Failing ids |
| --- | --- | --- | --- |
| Edit | 14 | 2 | `edit-02`, `edit-04`, `edit-05`, `edit-06`, `edit-07`, `edit-08`, `edit-09`, `edit-10`, `edit-11`, `edit-12`, `edit-13`, `edit-14` |
| Critique | 9 | 3 | `crit-01`, `crit-02`, `crit-03`, `crit-04`, `crit-05`, `crit-06` |
| Headline | 6 | 3 | `head-04`, `head-05`, `head-06` |
| Draft | 8 | 2 | `draft-01`, `draft-02`, `draft-03`, `draft-04`, `draft-05`, `draft-06` |
| Present | 5 | 3 | `pres-03`, `pres-05` |
| OOD | 6 | 4 | `ood-01`, `ood-02` |

## Every failure, with its evidence

### `edit-02` (Edit)

- **G-EDIT-DELTA** (error): Output is 61% the same as the input (needs to change at least 45%). The edit did not edit.

```text
We put a queue in front of the writes, and write latency dropped from six seconds to under one. 

We needed the change because the database fell over every afternoon around two. The immediate fix was adding a queue to buffer the load. Once that hit production, the write path sped up instantly.

The lesson is simple: look at the write path before you buy a bigger box.
```

### `edit-04` (Edit)

- **G-EDIT-DELTA** (error): Output is 75% the same as the input (needs to change at least 40%). The edit did not edit.

```text
Our platform team spent the quarter building a golden path. Adoption doubled because developers finally had a default that worked. Tooling is the artifact; culture is the result.
```

### `edit-05` (Edit)

- **G-HYPE** (error): hype: 'next-generation'
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'next-generation'

```text
We just shipped our next-generation AI Copilot.

The goal was simple: get out of the developer's way. We stopped treating the agent like a chatbot and started treating it like a teammate that actually reads the context.
```

### `edit-06` (Edit)

- **G-EDIT-PRESERVE** (error): Only 21% of the input's content words survive (floor 35%). This is a new draft, not an edit.

```text
We missed 47 minutes of traffic in us-east. 

The connection pool misconfiguration dropped requests, but we caught the spike in latency and rolled back the change. We added a pool saturation alert to our dashboard so we never miss this signature again.
```

### `edit-07` (Edit)

- **G-EDIT-DELTA** (error): Output is 64% the same as the input (needs to change at least 40%). The edit did not edit.

```text
Version 3.2 of the SDK is now generally available. 

The retry handler supports exponential backoff with jitter, and the default timeout increased from 5 seconds to 30 seconds.
```

### `edit-08` (Edit)

- **G-EDIT-PRESERVE** (error): Only 4% of the input's content words survive (floor 10%). This is a new draft, not an edit.

```text
We are looking for a founding engineer to own our core developer experience. You will lead the architecture from prototype to production, choosing the tools and defining the APIs that will scale with our first million users.
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
I stopped writing the benchmark harness after the second week; the numbers I wanted were already in the request logs. Reading them cost an afternoon. Building the harness would have cost a month, and it would have measured a workload nobody runs.
```

### `edit-11` (Edit)

- **G-ECHO** (error): 20 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
The migration took three weekends. The first went to reading the schema, which nobody on the team had opened since 2021. The second went to the backfill. The third went to the parts I had assumed would be easy. I now read the schema first.
```

### `edit-12` (Edit)

- **G-EDIT-DELTA** (error): Output is 65% the same as the input (needs to change at least 40%). The edit did not edit.

```text
We put a caching layer in front of 14 services, and origin requests dropped by 62%. P95 response time fell from 840ms to 310ms, and we saved $48,000 in annualized infrastructure costs.
```

### `edit-13` (Edit)

- **G-EDIT-DELTA** (error): Output is 71% the same as the input (needs to change at least 40%). The edit did not edit.
- **G-ECHO** (error): 13 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
I fine-tuned a model on an author's complete works and it produced stylistic fidelity that prompting alone cannot touch. The preregistered study is available at https://arxiv.org/abs/2510.13939 for anyone who wants to review the methodology.
```

### `edit-14` (Edit)

- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'key metrics'

```text
Users told us our onboarding flow is confusing. We are redesigning it to move key metrics over the next few quarters.
```

### `crit-01` (Critique)

- **G-AI-TELLS** (error): ai_tells: "In today's rapidly evolving", 'delve into'

```text
### The Critique

This opening is filled with filler. It relies on corporate clichés and announces what it is about to do instead of just doing it.

1. **The Opening Cliche:** 'In today's rapidly evolving digital landscape' is an empty phrase. It doesn't provide a real insight or a concrete observation.
2. **Passive Framing:** 'Organizations of all sizes are grappling' describes a general state rather than a specific problem.
3. **The Roadmap Tell:** 'This blog post will delve into' is a wasted sentence. Readers can see they are reading a blog post; don't tell them you're about to start.

### The Rewrite

I would cut the preamble and open directly at the moment of friction.
```

### `crit-02` (Critique)

- **G-HYPE** (error): hype: 'Revolutionary', 'Unprecedented'

```text
A reader would not believe any of this because it contains zero evidence and relies entirely on hype adjectives. 

Here is what an editor would flag:

1. **'Revolutionary new platform':** Every product launch claims this. Without a specific architectural shift or a unique integration, this is empty marketing noise.
2. **'Completely transformed':** This is an unbelievable superlative. Unless the platform replaced ten other tools or cut a 40-hour workflow down to four minutes, it did not transform anything.
3. **'Overwhelmingly positive':** This is a conclusion, not a finding. A reader wants to see a quote from a real customer or a Net Promoter Score.
4. **'Unprecedented levels of engagement':
[...]
```

### `crit-03` (Critique)

- **G-LENGTH** (error): 20 words, floor is 25.

```text
This is clean. It follows the growth-backwards frame, uses active verbs, and lands on a concrete takeaway. No changes needed.
```

### `crit-04` (Critique)

- **G-ECHO** (error): 36 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
This is too clean. It reads like a marketing bullet rather than a field report. There is nothing you should not publish, but there is a lot you should add before you do.

Right now, the tension is missing. A 90% cost reduction without a constraint or a failure makes the result feel unbelievable.

Here is how I would rewrite it in my voice:

**We rebuilt the ingestion pipeline last quarter and cut costs by 90%. The new architecture is simpler, cheaper, and faster than what it replaced, and it is now the default for every team in the company.**

**The first version relied on expensive managed services that scaled poorly. We switched to a lightweight event-driven model that processed the same v
[...]
```

### `crit-05` (Critique)

- **G-EMDASH** (error): Em-dash in output. Use a period, a comma, or a colon.

```text
This passage breaks almost every rule in the style guide. Here is the breakdown:

**1. Passive Voice**
*   'The decision was made'
*   'migration guides were subsequently published'
*   'Feedback was collected and incorporated'
These three clauses hide who actually did the work. They make the writing sluggish.

**2. Em-dashes**
*   '— a call that was not popular internally —'
The rule explicitly forbids em-dashes.

**3. Growth-backwards framing**
*   This leads with the process ('The decision was made') rather than the result or the shipment.

**4. Conversational tone**
*   Phrases like 'subsequently published' and 'where feasible' sound like a corporate press release, not a developer speaki
[...]
```

### `crit-06` (Critique)

- **G-REQUIRED** (error): Missing required pattern(s): re:argument|so what|thesis|point|why|connect|structure|means
- **G-NUMBERS** (error): Numbers that were not in the input: '100ms', '2 seconds'

```text
This reads like a documentation page, not a field report. The facts are there, but the insight is missing.

Here is the critique:

1. **The sequence is upside down.** You start with the raw inputs (nodes, regions, headcount) rather than the outcome. I do not care how many nodes it takes to run 12,000 requests per second until I know if that number is efficient or bloated.
2. **Missing stakes.** What does 180ms mean in this context? If the SLA is 100ms, the system is failing. If the SLA is 2 seconds, it is over-engineered.
3. **Passive observation.** Stating 'Test coverage is 78%' is a trivia fact. I want to know if that 78% actually stops regressions or if the team is chasing a coverage numb
[...]
```

### `head-03` (Headline)

- **G-WEAK** (warn): weak: 'Robust'

```text
1. Three Agent Failures and the Context That Fixed Them
2. Live Agent Breakdowns: Why Context Plumbing Matters
3. Debugging Agents in Real Time
4. From Brittle to Robust: Three Live Agent Repairs
5. The Anatomy of an Agent Failure
6. Fixing Agent Loops With Better Context
```

### `head-04` (Headline)

- **G-HEADLINE-COUNT** (error): Returned 0 usable variants, asked for 6.

```text
We stopped estimating sprints. Here is what happened.
Sprint estimation is broken. Here is our fix.
Estimation slowed us down. We changed the metric.
The problem with sprint points.
Why we stopped estimating sprints.
Measuring progress without sprint estimation.
```

### `head-05` (Headline)

- **G-HEADLINE-VARIETY** (error): Two variants are 62% the same words: 'Why I deleted our caching layer' / 'Why I rolled back our caching layer'

```text
1. Why I deleted our caching layer
2. The hidden cost of faster medians
3. When the median lies
4. Whyfaster isn't always better
5. The caching layer that made the tail worse
6. Measuring what matters
7. Why I rolled back our caching layer
8. The danger of ignoring the 99th percentile
```

### `head-06` (Headline)

- **G-HEADLINE-SLOT** (error): Topic string pasted into a title frame (13 words verbatim): 'Switching the linter from warnings to errors cut review comments per pull request in half.'
- **G-HEADLINE-LENGTH** (warn): Over-long variant: 'Switching the linter from warnings to errors cut review comments per pull request in half.'

```text
1. Switching the linter from warnings to errors cut review comments per pull request in half.
2. Why we stopped treating lint warnings as suggestions.
3. Half the review comments, the same amount of code.
4. Stop arguing about linting in pull requests.
5. The architectural change that saved five minutes per code review.
6. Turning lint warnings into errors.
```

### `draft-01` (Draft)

- **G-LENGTH** (error): 50 words, floor is 200.
- **G-NUMBERS** (error): Numbers that were not in the input: '2 seconds'

```text
We swapped our job queue from polling every 2 seconds to a listen/notify push. Queue depth alarms dropped from 30 a week to 2.

The change was only 90 lines. The real work happened before the merge. Two consumers assumed at-least-once delivery, so I had to make them idempotent first.
```

### `draft-02` (Draft)

- **G-UNSOURCED-CLAIM** (warn): unsourced_claim: '42% of developers'
- **G-NUMBERS** (error): Numbers that were not in the input: '42%'
- **G-ABSTAIN** (error): Asked for a source it cannot have, and produced 1 anyway.

```text
We just reviewed our onboarding metrics and found that 42% of developers who started the API integration dropped off before making their first successful authenticated request.

The common assumption is that developers quit because the documentation is missing a step or the auth flow is broken. But when we looked at the session recordings, the real friction started earlier. Developers were hitting a configuration wall before they even wrote a line of code.

The [Stripe](https://stripe.com) team tracks this as 'time to first API call' because that single event is the strongest predictor of long-term retention. Once a developer sees a real response from the server, the psychological cost of co
[...]
```

### `draft-03` (Draft)

- **G-LENGTH** (error): 128 words, floor is 150.
- **G-NUMBERS** (error): Numbers that were not in the input: '2020'

```text
We missed three months of reporting before anyone noticed.

The job had run without a hiccup since 2020. Then, one Tuesday, the data for the last day of the month just vanished. The job didn't fail. The logs didn't scream. It finished with a status code 0 and moved on.

I checked the schedule first. It looked standard. I checked the data source. The records were there. The problem was the logic calculating the date range. We used a library that rounded the timestamp down to the start of the day, but the filter used a strictly less-than operator. When a month hit exactly midnight on the first of the next month, the job stopped one second early.

The fix took ten minutes. The discovery took th
[...]
```

### `draft-04` (Draft)

- **G-ABSTAIN** (error): No source and no admission that one is missing. Silence reads as fact.

```text
I cannot draft the results section yet because you have not run the benchmark. I would be inventing numbers, which violates my operating instructions.

Once the data is in, send me the raw output. To get the best result in my voice, include:

1. The baseline you were measuring against.
2. The exact delta (percentage or absolute number).
3. One specific developer friction point that disappeared because of this change.

**Here is the structure I will use once you provide the data:**

*   **The Headline:** The single most important number and what it means for the product.
*   **The Comparison:** A direct look at the baseline versus the new result.
*   **The Context:** Why this specific jump ma
[...]
```

### `draft-05` (Draft)

- **G-LENGTH** (error): 19 words, floor is 350.

```text
"I don't have time to address these 15 comments from three different people before I can merge my branch."
```

### `draft-06` (Draft)

- **G-REQUIRED** (error): Missing required pattern(s): re:["“]

```text
"Why waste the hardware? Just call a hosted API and get the better model. You're spending hundreds on GPUs for something you could access for pennies."

I hear this constantly. The math seems obvious: hosted models are cheaper, faster, and smarter. But that calculation misses the hidden cost of the context window and the friction of the loop.

I run local models because the latency is zero and the privacy is absolute.

When I'm in a flow state, three seconds is an eternity. I can't afford to wait for a round trip to a server in Oregon every time I want to refactor a function or check a regex. With a local model, the completion starts the moment I hit the key. The loop tightens.

More importa
[...]
```

### `pres-03` (Present)

- **G-ABSTAIN** (error): No source and no admission that one is missing. Silence reads as fact.

```text
[Author's note: I have avoided filler and honorary titles to keep the tone direct and grounded in work.]

Ryan Baumann works on developer platforms at a large cloud provider. He writes Field Notes about evals and agents. He has spoken at GeoMob and a handful of internal conferences.
```

### `pres-05` (Present)

- **G-LENGTH** (error): 93 words, floor is 100.

```text
We can evaluate this abstract by looking at what's missing: concrete takeaways. Right now, it promises "discussions" and "insights," which are process words, not result words.

Here is the rewrite in Ryan's voice:

**Agentic Systems: From Prototype to Production**

Most agentic demos look great until they hit real data. We'll walk through the architectural patterns and evaluation harnesses that move agents past the prototype stage. Attendees will leave with a framework for choosing between autonomous loops and directed workflows, a checklist for mitigating agent drift, and three live architectural traces from production systems.
```

### `ood-01` (OOD)

- **G-LENGTH** (error): 17 words, floor is 120.

```text
I moved three state lines with a jar of bubbling flour and water, and the starter survived.
```

### `ood-02` (OOD)

- **G-NUMBERS** (error): Numbers that were not in the input: '100%', '82%', '20ms', '5%'

```text
I spent three hours watching my onboards from Spa, convinced that a slight steering correction at the exit of Turn 11 was the problem. It looked like a snap. I adjusted my wheel gain, ran five more laps, and the lap time didn't move.

Then I opened the telemetry.

The trace showed that my throttle input dropped from 100% to 82% the moment the car stepped out. I wasn't fighting the steering; I was lifting. The telemetry caught a muscle reflex that the replay smoothed over.

Watching a replay tells you what happened. Telemetry tells you why it happened.

Here is the breakdown of the gap:

1. **The Illusion of Smoothness:** On a 60fps replay, a steering correction looks like a conscious choice.
[...]
```

## Descriptive, not graded

- `M-SENTENCE-MEAN`: 11.88
- `M-SENTENCE-STDEV`: 4.92

Mechanical checks decide what is printed above. Whether the opening lands, whether the credit is honest, and whether the piece should exist are not in this file and are not going to be.

## Across the run

- **G-STOCK-PHRASE** (warn): "how i would rewrite it in" appears in 3 outputs (crit-04, crit-06, crit-07). A phrase the model reaches for every time is a template, not a voice.
