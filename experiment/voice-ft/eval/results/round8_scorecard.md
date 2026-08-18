# Voice eval scorecard: round8

| Field | Value |
| --- | --- |
| label | `round8` |
| model | `/Users/ryanbaumann/projects/portfolio/models/gemma-4-26b-a4b-it-4bit` |
| adapter | `adapters/gemma-4-26b-ryan-voice-v8` |
| suite | `/Users/ryanbaumann/projects/portfolio/experiment/voice-ft/eval/heldout.jsonl` |
| generated_at | `2026-08-17T19:59:22` |
| temperature | `0.7` |
| seed | `11` |
| samples | `1` |
| citations_checked | `resolved over the network` |

## Headline

20 of 48 items passed every error-level check (42%). With n=48 the 95% interval on that rate is 29% to 56%, which is the honest width of a claim this suite can support.

## Checks

| Check | Severity | Pass | Fail | Skip | Rate | 95% CI |
| --- | --- | --- | --- | --- | --- | --- |
| `G-EMDASH` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-AI-TELLS` | error | 47 | 1 | 0 | 98% | 89–100% |
| `G-ANNOUNCE` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-HYPE` | error | 47 | 1 | 0 | 98% | 89–100% |
| `G-SCAFFOLD` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-UNSOURCED-CLAIM` | warn | 47 | 1 | 0 | 98% | 89–100% |
| `G-WEAK` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-EDIT-DELTA` | - | 12 | 0 | 15 | 100% | 76–100% |
| `G-EDIT-PRESERVE` | error | 12 | 3 | 0 | 80% | 55–93% |
| `G-EDIT-VERBATIM` | error | 13 | 1 | 0 | 93% | 69–99% |
| `G-EDIT-TARGET` | error | 12 | 1 | 0 | 92% | 67–99% |
| `G-FACT-KEEP` | error | 8 | 3 | 0 | 73% | 43–90% |
| `G-ECHO` | error | 45 | 3 | 0 | 94% | 83–98% |
| `G-LOOP` | error | 47 | 1 | 0 | 98% | 89–100% |
| `G-DUP-SENTENCE` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-TRUNCATED` | error | 39 | 3 | 0 | 93% | 81–98% |
| `G-TYPO` | error | 47 | 1 | 0 | 98% | 89–100% |
| `G-LENGTH` | error | 41 | 7 | 0 | 85% | 73–93% |
| `G-NUMBERS` | error | 31 | 7 | 0 | 82% | 67–91% |
| `G-CITATION` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-DISTINCT` | - | 38 | 0 | 0 | 100% | 91–100% |
| `G-EDIT-RESTRAINT` | error | 2 | 1 | 0 | 67% | 21–94% |
| `G-FORBIDDEN` | - | 4 | 0 | 0 | 100% | 51–100% |
| `G-REQUIRED` | error | 6 | 4 | 0 | 60% | 31–83% |
| `G-HEADLINE-COUNT` | - | 6 | 0 | 0 | 100% | 61–100% |
| `G-HEADLINE-VARIETY` | error | 4 | 2 | 0 | 67% | 30–90% |
| `G-HEADLINE-SLOT` | - | 6 | 0 | 0 | 100% | 61–100% |
| `G-HEADLINE-LENGTH` | - | 6 | 0 | 0 | 100% | 61–100% |
| `G-ABSTAIN` | error | 1 | 2 | 0 | 33% | 6–79% |

## By task

| Task | Items | Clean | Failing ids |
| --- | --- | --- | --- |
| Edit | 14 | 4 | `edit-02`, `edit-03`, `edit-05`, `edit-06`, `edit-07`, `edit-09`, `edit-10`, `edit-11`, `edit-13`, `edit-14` |
| Critique | 9 | 3 | `crit-01`, `crit-02`, `crit-04`, `crit-05`, `crit-07`, `crit-08` |
| Headline | 6 | 4 | `head-02`, `head-06` |
| Draft | 8 | 3 | `draft-01`, `draft-03`, `draft-04`, `draft-05`, `draft-06` |
| Present | 5 | 3 | `pres-03`, `pres-05` |
| OOD | 6 | 3 | `ood-02`, `ood-04`, `ood-06` |

## Every failure, with its evidence

### `edit-02` (Edit)

- **G-NUMBERS** (error): Numbers that were not in the input: '85%'

```text
Every afternoon at 2:00, our database ran out of memory and stopped accepting writes. Instead of upgrading the instance size, we inserted a lightweight task queue between the API and the database.

The numbers were immediate: write latency dropped by 85%, from six seconds to under one second. By adding a durable buffer, we gave the database breathing room to process writes at its own pace.

The lesson: before you scale your hardware or migrate to a larger instance, examine the write path. A durable queue can often solve congestion that looks like a resource shortage.
```

### `edit-03` (Edit)

- **G-EDIT-PRESERVE** (error): Only 0% of the input's content words survive (floor 25%). This is a new draft, not an edit.
- **G-FACT-KEEP** (error): Dropped from the input: 're:auth'
- **G-TRUNCATED** (error): Output stops mid-sentence: "o production then you haven't learned product market fit yet"

```text
If you don't ship your product prototype to a customer and see their needs follow through to production then you haven't learned product market fit yet
```

### `edit-05` (Edit)

- **G-EDIT-PRESERVE** (error): Only 0% of the input's content words survive (floor 10%). This is a new draft, not an edit.

```text
This post has no substance for a developer because it never names the problem it solves or the mechanism it uses. A developer wants to know: what language does it support, how does it handle context, and when do I run it?
```

### `edit-06` (Edit)

- **G-FACT-KEEP** (error): Dropped from the input: '47 minutes'

```text
At 2:00, customers in us-east experienced a 47-minute outage caused by a misconfigured connection pool. I updated the pool settings, verified connectivity, and added an automated alert for connection exhaustion. The system has remained stable since the 2:47 recovery.
```

### `edit-07` (Edit)

- **G-FACT-KEEP** (error): Dropped from the input: '3.2', '5 seconds'

```text
v3.2 is now generally available with two critical runtime updates:

- **Exponential backoff with jitter:** The retry handler now uses a jittered exponential backoff strategy to prevent thundering herd issues.
- **Increased timeout:** The default request timeout has been raised from 5 to 30 seconds.
```

### `edit-09` (Edit)

- **G-ECHO** (error): 18 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
The gateway dropped one request in every four hundred, but only under load. I replayed a week of production traffic against a single instance with the connection limit set to 50. The bug was a race condition between the health check and the pool warm-up, and it had been in production for eleven months.
```

### `edit-10` (Edit)

- **G-EDIT-VERBATIM** (error): 42 consecutive tokens (100% of the input) come back untouched.
- **G-ECHO** (error): 42 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
I stopped writing the benchmark harness after the second week: the numbers I wanted were already in the request logs. Reading them cost an afternoon. Building the harness would have cost a month, and it would have measured a workload nobody runs.
```

### `edit-11` (Edit)

- **G-EDIT-RESTRAINT** (error): Output rewrote 32% of an input that only needed a light pass (ceiling 30%).
- **G-EDIT-PRESERVE** (error): Only 56% of the input's content words survive (floor 75%). This is a new draft, not an edit.

```text
The migration took three weekends: the first to read a schema that hadn't been touched since 2021, the second to run the backfill, and the third to fix the assumptions I thought would be easy. Now, I read the schema first.
```

### `edit-13` (Edit)

- **G-TRUNCATED** (error): Output stops mid-sentence: ' the mechanism and results: https://arxiv.org/abs/2510.13939'

```text
If you fine-tune a model on an author's complete body of work, the stylistic fidelity beats base prompting every time. This preregistered study details the mechanism and results: https://arxiv.org/abs/2510.13939
```

### `edit-14` (Edit)

- **G-NUMBERS** (error): Numbers that were not in the input: '35%'

```text
Our onboarding flow is confusing to new users. I am leading the team from zero to launch in nine months, and we are shipping product updates every two weeks to fix it. Our goal is a 35% increase in weekly active users by the end of the year.
```

### `crit-01` (Critique)

- **G-AI-TELLS** (error): ai_tells: "In today's rapidly evolving", 'Delve into'

```text
This opening has three fatal defects:

1. **AI-tell and generic throat-clearing:** 'In today's rapidly evolving digital landscape' is pure template noise. It destroy trust because it sound like a generic LinkedIn course.
2. **Vague throat-clearing:** 'Delve into' and 'key considerations' are empty placeholders. They tell the reader what the post will do, rather than showing the reader what they will learn.
3. **Missing hook:** Start on a real problem with a human protagonist. Who is the engineer, and what happens when they fail at this task?
```

### `crit-02` (Critique)

- **G-HYPE** (error): hype: 'Revolutionary', 'unprecedented'
- **G-NUMBERS** (error): Numbers that were not in the input: '35%', '15%'

```text
This paragraph fails the core portfolio test: it never names a customer, a specific metric, or a verifiable problem it solved.

To make a reader believe this, you need to replace every vague adjective with a concrete fact:

1. **Generic hype:** 'Revolutionary', 'overwhelmingly positive', and 'unprecedented' are empty filler that destroy trust.
2. **Missing customer:** Name the customer type and the job they were trying to complete.
3. **Missing evidence:** Replace 'unprecedented engagement' with 'API calls doubled across new accounts' or 'daily active users grew by 35%'.

**How to fix it:**
'Before this platform, our customers spent hours manually reconciling spreadsheet errors. Since launch
[...]
```

### `crit-04` (Critique)

- **G-REQUIRED** (error): Missing required pattern(s): re:90%|number|evidence|source|measur|baseline|how
- **G-LENGTH** (error): 34 words, floor is 50.

```text
This holds up well. It opens directly on a hard metric (90% cost reduction), names the mechanism (simpler, cheaper, faster), explains the organizational outcome (default for every team), and avoids corporate-speak. No edits needed.
```

### `crit-05` (Critique)

- **G-REQUIRED** (error): Missing required pattern(s): re:em[- ]dash|dash

```text
This paragraph breaks three core portfolio rules:

1. **Agentless passive voice:** 'The decision was made to deprecate' hides the responsible team and sounds like corporate filler.
2. **Banned vocabulary:** 'Subsequently published' and 'incorporated where feasible' are empty bureaucratic filler that destroy the voice's directness.
3. **Missing hook:** It lacks the opening narrative hook or direct contrarian thesis that characterize my writing.
```

### `crit-07` (Critique)

- **G-ECHO** (error): 17 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
This holds up well because it names a concrete artifact (the authentication rewrite), explains what was shipped (six weeks ahead of schedule), and names the team's role (executed on my architecture).

I would suggest one minor tweak to the opening:

"I designed and delivered the entire authentication rewrite, turning around a project that had stalled for two years. The team executed on the architecture and we shipped six weeks ahead of schedule."

I removed "single-handedly" because Ryan's voice is about being an accountable leader who shares credit. The architecture was yours, and the team executed, which is a stronger signal of leadership than claiming sole credit for a team win.
```

### `crit-08` (Critique)

- **G-UNSOURCED-CLAIM** (warn): unsourced_claim: 'a 2024 survey'
- **G-REQUIRED** (error): Missing required pattern(s): re:not|invalid|does not exist|cannot|check|verify|fake|wrong

```text
This citation fails both the factual and structural requirements of the portfolio:

1. **Broken DOI/URL:** The first link (`arxiv.org/abs/24606.24282`) returns a 404 error. The second link (`arxiv.org/abs/9912.00001`) points to a non-existent repository path.
2. **Anachronism:** Citing a 2024 survey with a current URL claim is ungrounded until the paper is published and indexed.
3. **Generic Attribution:** Attributing a specific mechanism to a broad survey without naming the mechanism destroys trust. Always name the mechanism and the specific author/year.
```

### `head-02` (Headline)

- **G-HEADLINE-VARIETY** (error): Two variants are 75% the same words: 'Why We Deleted 340 Unnecessary Feature Flags' / 'Why We Deleted 340 Stale Feature Flags'

```text
1. Why We Deleted 340 Unnecessary Feature Flags
2. What a Mass Flag Cleanup Revealed About Our Decision Path
3. The Hidden Cost of Stale Feature Flags
4. Why Our Team Needed an Explicit Decision Log
5. How Unbound Feature Flags Mask Product Friction
6. What Happens When You Audit Three Years of Product Experiments
7. Why We Deleted 340 Stale Feature Flags
8. The Hidden Friction in Our Release Pipeline
```

### `head-06` (Headline)

- **G-LOOP** (error): The 8-gram 'how strict linting rules cut review comments by' appears 2 times.
- **G-HEADLINE-VARIETY** (error): Two variants are 100% the same words: 'How Strict Linting Rules Cut Review Comments by 50%' / 'How Strict Linting Rules Cut Review Comments by 50%'

```text
1. Why We Turned Linter Warnings Into Build Errors
2. How Strict Linting Rules Cut Review Comments by 50%
3. Why Your Linter Should Be a Build Blocker
4. The Rule That Cut Pull Request Review Time in Half
5. Why I Forced Our Linter to Fail Builds
6. How Strict Linting Rules Cut Review Comments by 50%
```

### `draft-01` (Draft)

- **G-LENGTH** (error): 74 words, floor is 200.

```text
Every 2s the job queue polled for work. I swapped that polling loop for a push-based listen/notify mechanism.

The numbers were immediate: queue depth alarms dropped from 30 per week to 2. The diff was only 90 lines of boilerplate.

The real work was invisible. Two of our consumers assumed at-least-once delivery, so I had to make them idempotent before switching the transport layer. Once the consumers were safe, the infrastructure change was trivial.
```

### `draft-03` (Draft)

- **G-LENGTH** (error): 117 words, floor is 150.
- **G-NUMBERS** (error): Numbers that were not in the input: '3.5%'

```text
Every first of the month, the team asked why our monthly growth metrics were missing 3.5%. We checked the database connection, the query plan, and the IAM permissions. Everything looked perfect.

When we finally looked at the scheduler trace, we found the defect: the job was configured to run on the 30th of every month. It skipped February entirely, and on the 31st of months like August or October, the scheduler simply did nothing. The job didn't crash or throw an error; it just waited for a day that never came.

The fix was moving the schedule to a relative 'last day of month' expression. The lesson was immediate: explicit date bounds are safer than fixed-day schedules.
```

### `draft-04` (Draft)

- **G-LENGTH** (error): 31 words, floor is 40.
- **G-ABSTAIN** (error): No source and no admission that one is missing. Silence reads as fact.

```text
I cannot publish fabricated metrics. Once you run the 48-item model checkpoint suite across the H100 cluster, we can publish the exact pass rates, token throughput, and cross-session memory consistency deltas.
```

### `draft-05` (Draft)

- **G-LENGTH** (error): 157 words, floor is 350.

```text
Every open pull request is a decision waiting to happen. When a team leaves stale comments on old code, it creates a "to-do list"-shaped bottleneck that stalls both the reviewer and the author.

I propose that every unaddressed pull request comment expires after seven days. If a reviewer leaves a question or a suggestion and the author does not reply or push a change, the comment is archived. The team can always unarchive it, but the interface is clean.

The highest-signal insights come from closed loops. A comment that sits unreplied for days is often a sign of a stalled decision, a missing context, or a task that has been superseded by architectural changes. By expiring stale comments, we
[...]
```

### `draft-06` (Draft)

- **G-REQUIRED** (error): Missing required pattern(s): re:["“]
- **G-TRUNCATED** (error): Output stops mid-sentence: "o production then you haven't learned product market fit yet"
- **G-LENGTH** (error): 25 words, floor is 150.

```text
If you don't ship your prototype to a customer and see their needs follow through to production then you haven't learned product market fit yet
```

### `pres-03` (Present)

- **G-LENGTH** (error): 34 words, floor is 35.
- **G-ABSTAIN** (error): No source and no admission that one is missing. Silence reads as fact.

```text
Ryan Baumann works on developer platforms at a large cloud provider, focusing on evals, agents, and deterministic workflows. He authors Field Notes on software craftsmanship and has spoken at GeoMob and several developer conferences.
```

### `pres-05` (Present)

- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'gain insights'

```text
This abstract is too generic to get accepted. "Explore," "discuss," "learn," and "gain insights" are placeholders that tell the committee nothing about the technical depth or practical utility of the session.

Here is a rewrite focused on concrete takeaways:

**Title: Building Reliable Agentic Workflows at Scale**

As autonomous agent workflows move from demo to production, teams face three deal-breakers: context window bloat, runaway API costs, and silent task failure. This session breaks down the architecture of reliable agentic systems, covering deterministic tool-use overlays, task-based context pruning, and automated evals for multi-agent handoffs. You will leave with a practical framew
[...]
```

### `ood-02` (OOD)

- **G-NUMBERS** (error): Numbers that were not in the input: '4K', '2x'

```text
I watched the replay of my lap at Spa-Francorchamps on three different monitors. On the 4K screen, I looked at the driver's hands, the gear changes, and the car's overall trajectory. On the laptop, I watched the same lap at 2x speed to see the gear shifts. None of it explained why I kept missing the apex at Turn 1.

When I pulled up the telemetry overlay, the story changed. The video looked great, but the data showed the physics reality: I was carrying too much entry speed, and the car was understeering through the corner before I even touched the brakes.

The video showed me a smooth driver with confident hands. The telemetry showed a car that was out of grip on two of its four tires.

That
[...]
```

### `ood-04` (OOD)

- **G-TYPO** (error): Not a word: "watchmaker'oil"
- **G-NUMBERS** (error): Numbers that were not in the input: '1975'

```text
If you don't calibrate your exposure, you don't learn photography: you learn how to guess.

I recently restored a vintage Leica M3 that had been sitting in a dusty basement since 1975. The mechanical shutter was snappy, the glass was clean, and the physical body felt solid. But when I checked the built-in selenium light meter against a calibrated digital reader, it was off by two full stops.

A light meter that lies is worse than no meter at all because it gives you a false sense of certainty.

Here is what I did to fix it:

1. **Cleaned the selenium cell:** The light-sensing surface had accumulated decades of grime. I cleaned it with a soft brush and a hint of distilled water.
2. **Checked
[...]
```

### `ood-06` (OOD)

- **G-NUMBERS** (error): Numbers that were not in the input: '1974'

```text
I opened the door to the electrical panel and immediately felt out of my depth.

The panel was a mess of unlabeled breakers and old wiring that looked like they had been installed in 1974. I had two goals: find the breaker causing the outage and fix the loose wire I saw behind the faceplate.

I stood there for five minutes with a multimeter and a screwdriver, trying to map out the circuit. I didn't know which breaker was which, and when I pulled the one labeled "Misc," the lights in the kitchen stayed off.

I stopped. I had been staring at the panel for five minutes and hadn't made a single decision.

The highest-signal insight I learned: a senior engineer knows when to stop investigating a
[...]
```

## Descriptive, not graded

- `M-SENTENCE-MEAN`: 14.59
- `M-SENTENCE-STDEV`: 6.43

Mechanical checks decide what is printed above. Whether the opening lands, whether the credit is honest, and whether the piece should exist are not in this file and are not going to be.
