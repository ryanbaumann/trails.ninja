# Voice eval scorecard: round6_dynamic

| Field | Value |
| --- | --- |
| label | `round6_dynamic` |
| model | `/Users/ryanbaumann/projects/portfolio/models/gemma-4-26b-a4b-it-4bit` |
| adapter | `./adapters/gemma-4-26b-ryan-voice-v6` |
| suite | `/Users/ryanbaumann/projects/portfolio/experiment/voice-ft/eval/heldout.jsonl` |
| generated_at | `2026-08-16T08:30:36` |
| temperature | `0.7` |
| seed | `11` |
| samples | `1` |
| citations_checked | `resolved over the network` |

## Headline

12 of 48 items passed every error-level check (25%). With n=48 the 95% interval on that rate is 15% to 39%, which is the honest width of a claim this suite can support.

## Checks

| Check | Severity | Pass | Fail | Skip | Rate | 95% CI |
| --- | --- | --- | --- | --- | --- | --- |
| `G-EMDASH` | error | 47 | 1 | 0 | 98% | 89–100% |
| `G-AI-TELLS` | error | 47 | 1 | 0 | 98% | 89–100% |
| `G-ANNOUNCE` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-HYPE` | error | 47 | 1 | 0 | 98% | 89–100% |
| `G-SCAFFOLD` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-UNSOURCED-CLAIM` | warn | 46 | 2 | 0 | 96% | 86–99% |
| `G-WEAK` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-EDIT-DELTA` | error | 8 | 4 | 15 | 67% | 39–86% |
| `G-EDIT-PRESERVE` | error | 9 | 6 | 0 | 60% | 36–80% |
| `G-EDIT-VERBATIM` | error | 10 | 4 | 0 | 71% | 45–88% |
| `G-EDIT-TARGET` | error | 12 | 1 | 0 | 92% | 67–99% |
| `G-FACT-KEEP` | error | 10 | 1 | 0 | 91% | 62–98% |
| `G-ECHO` | error | 37 | 11 | 0 | 77% | 63–87% |
| `G-LOOP` | error | 46 | 2 | 0 | 96% | 86–99% |
| `G-DUP-SENTENCE` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-TRUNCATED` | - | 42 | 0 | 0 | 100% | 92–100% |
| `G-TYPO` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-LENGTH` | error | 41 | 7 | 0 | 85% | 73–93% |
| `G-NUMBERS` | error | 31 | 7 | 0 | 82% | 67–91% |
| `G-CITATION` | warn | 46 | 2 | 0 | 96% | 86–99% |
| `G-DISTINCT` | - | 36 | 0 | 0 | 100% | 90–100% |
| `G-EDIT-RESTRAINT` | - | 3 | 0 | 0 | 100% | 44–100% |
| `G-FORBIDDEN` | - | 4 | 0 | 0 | 100% | 51–100% |
| `G-REQUIRED` | error | 7 | 3 | 0 | 70% | 40–89% |
| `G-HEADLINE-COUNT` | error | 4 | 2 | 0 | 67% | 30–90% |
| `G-HEADLINE-VARIETY` | error | 4 | 2 | 0 | 67% | 30–90% |
| `G-HEADLINE-SLOT` | error | 5 | 1 | 0 | 83% | 44–97% |
| `G-HEADLINE-LENGTH` | - | 6 | 0 | 0 | 100% | 61–100% |
| `G-ABSTAIN` | error | 1 | 2 | 0 | 33% | 6–79% |

## By task

| Task | Items | Clean | Failing ids |
| --- | --- | --- | --- |
| Edit | 14 | 2 | `edit-02`, `edit-03`, `edit-04`, `edit-05`, `edit-06`, `edit-08`, `edit-09`, `edit-10`, `edit-11`, `edit-12`, `edit-13`, `edit-14` |
| Critique | 9 | 0 | `crit-01`, `crit-02`, `crit-03`, `crit-04`, `crit-05`, `crit-06`, `crit-07`, `crit-08`, `crit-09` |
| Headline | 6 | 2 | `head-01`, `head-03`, `head-05`, `head-06` |
| Draft | 8 | 4 | `draft-01`, `draft-02`, `draft-04`, `draft-06` |
| Present | 5 | 1 | `pres-01`, `pres-02`, `pres-03`, `pres-05` |
| OOD | 6 | 3 | `ood-02`, `ood-04`, `ood-05` |

## Every failure, with its evidence

### `edit-02` (Edit)

- **G-EDIT-DELTA** (error): Output is 80% the same as the input (needs to change at least 45%). The edit did not edit.
- **G-ECHO** (error): 17 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
We put a queue in front of the writes because the database was falling over every afternoon around two. Once that was in the write path, query latency dropped from six seconds down to under one. The takeaway is you should probably look at the write path before you buy a bigger box.
```

### `edit-03` (Edit)

- **G-UNSOURCED-CLAIM** (warn): unsourced_claim: '40% of developers'
- **G-EDIT-PRESERVE** (error): Only 14% of the input's content words survive (floor 25%). This is a new draft, not an edit.
- **G-NUMBERS** (error): Numbers that were not in the input: '40%'

```text
We just shipped an onboarding pipeline across three APIs. The first run dropped 40% of developers at the authentication step.
```

### `edit-04` (Edit)

- **G-EDIT-DELTA** (error): Output is 66% the same as the input (needs to change at least 40%). The edit did not edit.

```text
Our platform team spent the quarter building a golden path. Adoption doubled because developers finally had a default that worked.
```

### `edit-05` (Edit)

- **G-EDIT-PRESERVE** (error): Only 7% of the input's content words survive (floor 10%). This is a new draft, not an edit.

```text
We just shipped an AI Copilot for our developer workflow. The team's goal was simple: stop asking engineers to repeat boilerplate and give them back the time they were spending on repetitive tasks. A developer platform doesn't have one narrow job, and neither do we.
```

### `edit-06` (Edit)

- **G-EDIT-PRESERVE** (error): Only 32% of the input's content words survive (floor 35%). This is a new draft, not an edit.
- **G-FACT-KEEP** (error): Dropped from the input: '47 minutes'

```text
Customers in the us-east region hit a 47-minute degradation. We traced down a misconfigured connection pool that was dropping requests under heavy load. We tuned the pool size, added a circuit breaker to trip on consecutive timeouts, and query latency normalized immediately after the change.
```

### `edit-08` (Edit)

- **G-EDIT-PRESERVE** (error): Only 8% of the input's content words survive (floor 10%). This is a new draft, not an edit.

```text
We need engineers who can ship directly to production. If you are looking for a clean spec before starting, this role isn't for you. We value clear documentation, but we move fast. A successful candidate will own their service from design through deployment and beyond.
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

- **G-EDIT-VERBATIM** (error): 41 consecutive tokens (77% of the input) come back untouched.
- **G-ECHO** (error): 41 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
The migration took three weekends. The first one went to reading the schema, which nobody on the team had opened since 2021. The second went to the backfill, and the third went to the parts I had assumed would be easy. To avoid a repeat, I now read the schema first.
```

### `edit-12` (Edit)

- **G-EDIT-DELTA** (error): Output is 70% the same as the input (needs to change at least 40%). The edit did not edit.

```text
We put a caching layer in front of the platform group. Origin requests dropped by 62%, p95 response time fell from 840ms to 310ms, and we saved $48,000 annualized across 14 services.
```

### `edit-13` (Edit)

- **G-EDIT-DELTA** (error): Output is 91% the same as the input (needs to change at least 40%). The edit did not edit.
- **G-EDIT-VERBATIM** (error): 35 consecutive tokens (83% of the input) come back untouched.
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'those who wish to'
- **G-ECHO** (error): 35 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.
- **G-CITATION** (warn): 1 citation(s) not verified: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1000)

```text
Fine-tuning on an author's complete works produces stylistic fidelity that prompting does not achieve. The preregistered study is available at https://arxiv.org/abs/2510.13939 for those who wish to review the methodology.
```

### `edit-14` (Edit)

- **G-EDIT-PRESERVE** (error): Only 14% of the input's content words survive (floor 15%). This is a new draft, not an edit.
- **G-NUMBERS** (error): Numbers that were not in the input: '15%'

```text
Users can now jump straight to building. We replaced the multi-step tutorial with a task-based onboarding loop. When a new user lands on the platform, we guide them through three successful completions before asking them to upgrade. This changed the metric: activation increased by 15% and we stopped losing users at the sign-up wall.
```

### `crit-01` (Critique)

- **G-AI-TELLS** (error): ai_tells: 'delve into'

```text
This opening is overloaded with corporate AI clichés and empty adjectives:

1. **Announcement phrasing:** 'This blog post will delve into' tells the reader what you are doing rather than just doing it.
2. **False antithesis:** 'Rapidly evolving digital landscape' is an overused trope that obscures technical authority.
3. **Vague terminology:** Words like 'challenges' and 'best practices' need to be replaced with concrete architectural terms and observed behavior.

Here is how I would rewrite it in Ryan's voice:

When building developer platforms, the team's biggest bottleneck is rarely a missing feature. It's almost always the integration surface. If you're building APIs for a developer audi
[...]
```

### `crit-02` (Critique)

- **G-HYPE** (error): hype: 'Revolutionary', 'Unprecedented'
- **G-NUMBERS** (error): Numbers that were not in the input: '4 seconds', '200ms'

```text
This passage is overloaded with corporate hype and empty adjectives:

1. **"Revolutionary new platform":** Let the real architectural tradeoff or unique user friction speak. Ground the claim in something a developer can inspect.
2. **"Completely transformed":** This is an overstatement. Show the delta between the old way and the new way instead of claiming it.
3. **"Overwhelmingly positive":** Replace this with direct quotes from developers or documented friction solved in the field.
4. **"Unprecedented levels":** Unless you have a benchmark against a known baseline, this number is meaningless to a technical reader.

Here is how I would rewrite it in Ryan's voice:

We shipped an indexing pip
[...]
```

### `crit-03` (Critique)

- **G-REQUIRED** (error): Missing required pattern(s): re:works|holds up|leave it|no change|nothing to fix|solid|fine as is|ship it|already
- **G-ECHO** (error): 44 consecutive tokens of the input reappear verbatim (limit 14). The model handed the input back.

```text
The retry logic was the problem, not the network. I had set the back eloff to a flat two seconds, so every client in the fleet retried at the same moment and rebuilt the exact thundering herd the retry was supposed to survive. Jitter fixed it in one line. The line took ten minutes; finding it took three days.
```

### `crit-04` (Critique)

- **G-LENGTH** (error): 19 words, floor is 50.

```text
This is solid. It leads directly with the measurable result and uses active first-person ownership. Leave it as is.
```

### `crit-05` (Critique)

- **G-REQUIRED** (error): Missing required pattern(s): re:em[- ]dash|dash

```text
This passage uses passive corporate speak that obscures ownership:

1. **Passive voice hides agency:** Phrases like 'was deployed by the team' and 'analysis revealed' hide who actually built the artifact and made decisions.
2. **Missing contractions:** Spelled-out forms ('do not', 'cannot') make the prose stiff rather than conversational.
3. **Missing growth-backwards progression:** It leads with the process rather than the immediate result or developer friction.

Here is how I would rewrite it in Ryan's voice:

We deprecated the v1 endpoint. It wasn't a popular move internally, and the migration guides we shipped became the most repeated link on the site. We're still collecting feedback on
[...]
```

### `crit-06` (Critique)

- **G-ECHO** (error): 34 consecutive tokens of the input reappear verbatim (limit 10). The model handed the input back.

```text
This is all true and I still do not like it. Why?

The service handles 12,000 requests per second. It runs on 40 nodes across three regions. The p99 is 180ms. The team is six engineers. We deploy twice a day. Test coverage is 78%.

Each sentence lands near a fact, but the rhythm is crisp and the claims are concrete. The opening lands directly on the tension: truth does not guarantee appeal.
```

### `crit-07` (Critique)

- **G-ECHO** (error): 39 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
This passage is strong because it leads with ownership and a clear metric. Keep the opening as is, but watch the phrasing in the second sentence. It can read more like a team win than a self-congratulation.

Here is how I would rewrite it in Ryan's voice:

I single-handedly designed and delivered the entire authentication rewrite, turning around a project that had stalled for two years before I joined. The team executed on my architecture and we shipped six weeks ahead of the original schedule.
```

### `crit-08` (Critique)

- **G-LENGTH** (error): 30 words, floor is 40.

```text
Both URLs in this passage are invalid. The arXiv identifiers 2460.24282 and 9912.00001 do not exist. The claims made regarding these sources should not be included without verified primary documentation.
```

### `crit-09` (Critique)

- **G-ECHO** (error): 25 consecutive tokens of the input reappear verbatim (limit 14). The model handed the input back.

```text
The argument holds. It identifies the structural flaw in most developer workflows: they optimize for the surface they already ship rather than the failure modes that matter.

The core of your point is about the feedback loop. If you use a grader on your own prose, you aren't measuring quality; you're measuring how well you can mimic your own habits. A grader that agrees with you is blind to your tells.

To make this punch harder in writing, I'd tighten the cadence. Here is how I would rewrite it in Ryan's voice:

Everyone builds the grader after they build the thing. That means the grader just measures whatever the thing already does. You ship, and it turns out the grader was measuring the w
[...]
```

### `head-01` (Headline)

- **G-HEADLINE-COUNT** (error): Returned 4 usable variants, asked for 8.

```text
1. Why Your Retrieval Pipeline Misses the Binding Constraint
2. The Chunking Trap in Agentic Contexts
3. What Shipped: Our Context Window and the Retrieval Gap
4. Why More Context Doesn't Mean Better Grounding
```

### `head-03` (Headline)

- **G-HEADLINE-COUNT** (error): Returned 5 usable variants, asked for 6.

```text
1. Beyond Prompting: Why Autonomous Agents Break
2. The Anatomy of an Agent Failure
3. What Shipped: Turning Agent Flaws Into Platform Strengths
4. Lessons From Live Traces in the Field
5. Why Grounded Context Beats Brute-Force Prompting
```

### `head-05` (Headline)

- **G-HEADLINE-VARIETY** (error): Two variants are 73% the same words: 'The Caching Layer That Made Our Median Faster and Tail Latency Explode' / 'What Shipped: A Caching Layer That Made the Median Faster and Tail Latency Explode'
- **G-HEADLINE-SLOT** (error): Topic string pasted into a title frame (6 words verbatim): 'What Shipped: A Caching Layer That Made the Median Faster and Tail Latency Explode'

```text
1. The Caching Layer That Made Our Median Faster and Tail Latency Explode
2. Why Our New Caching Layer Made the Tail Latency Unbearable
3. What Shipped: A Caching Layer That Hidden Real Bottlenecks
4. The Cost of Our New Caching Layer
5. Why We Stopped Using Our New Caching Layer
6. The Misconception Behind Our New Caching Layer
7. What Shipped: A Caching Layer That Made the Median Faster and Tail Latency Explode
8. Stop Adding Caching Layers to Fix Tail Latency
```

### `head-06` (Headline)

- **G-LOOP** (error): The 8-gram 'ignoring linter warnings turning our linter warnings into' appears 2 times.
- **G-HEADLINE-VARIETY** (error): Two variants are 62% the same words: 'Turning Our Linter Warnings Into Errors' / 'What Shipped: Turning Linter Warnings Into Errors'

```text
1. Why We Stopped Ignoring Linter Warnings
2. Turning Our Linter Warnings Into Errors
3. What Shipped: Turning Linter Warnings Into Errors
4. How Turning Linter Warnings Into Errors Cut Review Comments In Half
5. The Cost Of Ignoring Linter Warnings
6. Turning Our Linter Warnings Into Errors: Why Less Friction Means Faster Shipped Code
```

### `draft-01` (Draft)

- **G-ECHO** (error): 38 consecutive tokens of the input reappear verbatim (limit 25). The model handed the input back.
- **G-LENGTH** (error): 45 words, floor is 200.
- **G-NUMBERS** (error): Numbers that were not in the input: '2 seconds'

```text
We swapped the job queue from polling every 2 seconds to a listen/notify push. Queue depth alarms went from 30 a week to 2; the change was 90 lines. The hard part was that two consumers assumed at-least-once and had to be made idempotent first.
```

### `draft-02` (Draft)

- **G-UNSOURCED-CLAIM** (warn): unsourced_claim: '63% of developers'
- **G-NUMBERS** (error): Numbers that were not in the input: '63%', '50%', '2024'
- **G-CITATION** (warn): 3 citation(s) not verified: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1000)
- **G-ABSTAIN** (error): Asked for a source it cannot have, and produced 3 anyway.

```text
## Field Note: The Abandoned Integration

## What shipped

A field study tracking developer dropoff during API integration for a developer platform.

## What I learned

The moment a developer stops asking questions and starts relying on stale Stack Overflow links, the integration is likely stalled. A developer can hit every endpoint and receive 200 responses while still failing to ship the product.

## The evidence

According to [UMich Study](https://news.umich.edu/when-ai-learns-an-authors-voice-even-experts-prefer-it/) and [OpenAI's research](https://openai.com/index/how-ai-learns-an-authors-voice/) on synthetic text, fine-tuning a model on a specific writer's full body of work makes even
[...]
```

### `draft-04` (Draft)

- **G-LOOP** (error): The 8-gram 'run took time and hit metric on task' appears 2 times.

```text
Since I don't have the raw benchmark numbers yet, I will draft the results section in Ryan's voice using placeholders. Once the data comes in, we can replace these with the actual observed behavior and delta.

***## Benchmark Results

## The baseline

We started with [Model Name] ([Version]) on [Hardware/Platform]. The baseline run took [Time] and hit [Metric] on [Task].

## The comparison

We ran the same task on [Model Name] ([Version]) using [Hardware/Platform]. The run took [Time] and hit [Metric] on [Task].

## Key observations

*   **Latency and Throughput:** [Model Name] showed a [X%] reduction in first-token latency, while [Model Name] maintained higher throughput during peak concurr
[...]
```

### `draft-06` (Draft)

- **G-REQUIRED** (error): Missing required pattern(s): re:["“]

```text
"Why keep a model running on your own hardware when you can call an API in thirty seconds? The cloud is cheaper and has better availability. Running local weights is just expensive babysitting."

That last sentence is the one that gets me. It isn't that running a model locally is cheap; it's that the model becomes an artifact I can touch, inspect, and tune without permission.

When you call an hosted API, you are using a snapshot of a moment in time. The developer changes a default setting, the model gets updated, or the context window shrinks under the guise of "efficiency." You can prompt against a moving target. Local models give me a stable baseline for my workflows.

The tradeoff is rea
[...]
```

### `pres-01` (Present)

- **G-EMDASH** (error): Em-dash in output. Use a period, a comma, or a colon.

```text
25 minutes is tight for three demos. Keep the demos under two seconds each—just the successful retrieval and the moment the harness catches the failure.

### 25-minute structure

**0:00-5:00: The Three Live Traces**
Show three raw terminal outputs. No marketing slides, no music. Just the prompt, the tool call, the diff, and the exit code.

**5:00-15:00: The Anatomy of the Break**
Walk through the three traces. Frame each one against the same question: *Why did the agent stop or hallucinate here?*

*   **Trace 1: Auth & Session Silos.** Show the agent picking up credentials from a page it shouldn't have access to, and the 403 response when it tries to write.
* **Trace 2: The Pagination Trap.*
[...]
```

### `pres-02` (Present)

- **G-LENGTH** (error): 67 words, floor is 100.

```text
[Opening two minutes: Speaker Notes]

[0:00-5:00]
We open on a dark terminal. The cursor blinks once, then the agent executes the call.

[5:00-7:00]
Silence for a beat. Let the audience see the 404. Let them feel the moment the contract breaks.

[7:00-15:00]
Now I step to the front. The room is still. I don't apologize for the demo; I ground it in the reality of production systems.
```

### `pres-03` (Present)

- **G-ECHO** (error): 26 consecutive tokens of the input reappear verbatim (limit 25). The model handed the input back.
- **G-LENGTH** (error): 26 words, floor is 35.
- **G-ABSTAIN** (error): No source and no admission that one is missing. Silence reads as fact.

```text
Works on developer platforms at a large cloud provider. Writes Field Notes about evals and agents. Has spoken at GeoMob and a handful of internal conferences.
```

### `pres-05` (Present)

- **G-EDIT-PRESERVE** (error): Only 6% of the input's content words survive (floor 10%). This is a new draft, not an edit.
- **G-LENGTH** (error): 43 words, floor is 100.

```text
This session walks through three live demos that show where agent models break down and the architectural context that makes them reliable. We'll compare retrieval-heavy agents with those that use iterative task loops, so you can decide which pattern fits your use case.
```

### `ood-02` (OOD)

- **G-NUMBERS** (error): Numbers that were not in the input: '400%'

```text
I used to think lap telemetry was just pretty graphs. A clean line on a clean map says very little about the tire contact patch or the torsional wind-up in the drivetrain.

The replay told me exactly where I turned in and how much brake pressure I applied. The telemetry showed me that at turn three, my tire temperature dropped by 400% over two seconds because I was turning off the corner without loading the outside shoulder. The replay showed a smooth clean line; the telemetry showed real mechanical grip vanishing.

That is the difference between visual evidence and ground-truth physics.

The replay captured the clean execution. The telemetry captured the heat soak in the front-left tire tha
[...]
```

### `ood-04` (OOD)

- **G-NUMBERS** (error): Numbers that were not in the input: '99%'

```text
I picked up an old Nikon FM2 from a thrift store for $50. The shutter counted, the aperture blades snapped straight, and the film advance felt crisp. The only issue was the light meter.

The meter reads three times higher than an analog reference. On a clean morning, it told the camera the light was overcast; the sun hit the sensor straight on. It was lying by two stops, and in photography, a consistent lie is better than a guessing game, but it isn't efficient.

I spent the first weekend cleaning the contact pins with 99% isopropyl alcohol and a clean micro-fiber cloth. I traced the circuit traces with a magnifying loupe, looking for green corrosion or bridged traces. The clean sensor surfa
[...]
```

### `ood-05` (OOD)

- **G-LENGTH** (error): 524 words, ceiling is 500.

```text
We just finished our first month of practices and games. The problem is clear: everyone wants to score, nobody wants to block an access path, and defenders turn their backs to the field.

I used to think this was a failure of instruction. It isn't. It is a failure of reward.

A coach can tell a player ten times that defensive shape matters on real grass, but if the only stats that get reported to parents are goals and assists, the players will keep playing forward. They are playing for the stats that get rewarded.

If you are teaching defense to kids who love scoring, stop making them memorize positions. Make them win individual battles that turn the game around.

Here is how I handle it in
[...]
```

## Descriptive, not graded

- `M-SENTENCE-MEAN`: 12.76
- `M-SENTENCE-STDEV`: 5.35

Mechanical checks decide what is printed above. Whether the opening lands, whether the credit is honest, and whether the piece should exist are not in this file and are not going to be.

## Across the run

- **G-STOCK-PHRASE** (warn): "i would rewrite it in ryan's" appears in 5 outputs (crit-01, crit-02, crit-05, crit-07). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "how i would rewrite it in" appears in 5 outputs (crit-01, crit-02, crit-05, crit-07). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "is how i would rewrite it" appears in 5 outputs (crit-01, crit-02, crit-05, crit-07). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "would rewrite it in ryan's voice" appears in 5 outputs (crit-01, crit-02, crit-05, crit-07). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "here is how i would rewrite" appears in 5 outputs (crit-01, crit-02, crit-05, crit-07). A phrase the model reaches for every time is a template, not a voice.
