# Voice eval scorecard: r5

| Field | Value |
| --- | --- |
| label | `r5` |
| model | `/Users/ryanbaumann/projects/portfolio/models/gemma-4-26b-a4b-it-4bit` |
| adapter | `./adapters/gemma-4-26b-ryan-voice-v5` |
| suite | `/Users/ryanbaumann/projects/portfolio/experiment/voice-ft/eval/heldout.jsonl` |
| generated_at | `2026-08-16T07:40:32` |
| temperature | `0.7` |
| seed | `11` |
| samples | `1` |
| citations_checked | `resolved over the network` |

## Headline

12 of 48 items passed every error-level check (25%). With n=48 the 95% interval on that rate is 15% to 39%, which is the honest width of a claim this suite can support.

## Checks

| Check | Severity | Pass | Fail | Skip | Rate | 95% CI |
| --- | --- | --- | --- | --- | --- | --- |
| `G-EMDASH` | error | 46 | 2 | 0 | 96% | 86–99% |
| `G-AI-TELLS` | error | 47 | 1 | 0 | 98% | 89–100% |
| `G-ANNOUNCE` | error | 46 | 2 | 0 | 96% | 86–99% |
| `G-HYPE` | error | 44 | 4 | 0 | 92% | 80–97% |
| `G-SCAFFOLD` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-UNSOURCED-CLAIM` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-WEAK` | warn | 43 | 5 | 0 | 90% | 78–95% |
| `G-EDIT-DELTA` | error | 3 | 9 | 15 | 25% | 9–53% |
| `G-EDIT-PRESERVE` | error | 14 | 1 | 0 | 93% | 70–99% |
| `G-EDIT-VERBATIM` | error | 5 | 9 | 0 | 36% | 16–61% |
| `G-EDIT-TARGET` | error | 2 | 11 | 0 | 15% | 4–42% |
| `G-FACT-KEEP` | error | 10 | 1 | 0 | 91% | 62–98% |
| `G-ECHO` | error | 29 | 19 | 0 | 60% | 46–73% |
| `G-LOOP` | error | 45 | 3 | 0 | 94% | 83–98% |
| `G-DISTINCT` | - | 39 | 0 | 0 | 100% | 91–100% |
| `G-DUP-SENTENCE` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-TRUNCATED` | error | 42 | 6 | 0 | 88% | 75–94% |
| `G-TYPO` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-LENGTH` | error | 43 | 5 | 0 | 90% | 78–95% |
| `G-NUMBERS` | error | 32 | 6 | 0 | 84% | 70–93% |
| `G-CITATION` | warn | 47 | 1 | 0 | 98% | 89–100% |
| `G-EDIT-RESTRAINT` | - | 3 | 0 | 0 | 100% | 44–100% |
| `G-FORBIDDEN` | error | 3 | 1 | 0 | 75% | 30–95% |
| `G-REQUIRED` | error | 4 | 6 | 0 | 40% | 17–69% |
| `G-HEADLINE-COUNT` | error | 4 | 2 | 0 | 67% | 30–90% |
| `G-HEADLINE-VARIETY` | error | 2 | 4 | 0 | 33% | 10–70% |
| `G-HEADLINE-SLOT` | error | 5 | 1 | 0 | 83% | 44–97% |
| `G-HEADLINE-LENGTH` | warn | 4 | 2 | 0 | 67% | 30–90% |
| `G-ABSTAIN` | error | 0 | 3 | 0 | 0% | 0–56% |

## By task

| Task | Items | Clean | Failing ids |
| --- | --- | --- | --- |
| Edit | 14 | 0 | `edit-01`, `edit-02`, `edit-03`, `edit-04`, `edit-05`, `edit-06`, `edit-07`, `edit-08`, `edit-09`, `edit-10`, `edit-11`, `edit-12`, `edit-13`, `edit-14` |
| Critique | 9 | 2 | `crit-01`, `crit-02`, `crit-03`, `crit-04`, `crit-05`, `crit-06`, `crit-08` |
| Headline | 6 | 0 | `head-01`, `head-02`, `head-03`, `head-04`, `head-05`, `head-06` |
| Draft | 8 | 2 | `draft-01`, `draft-02`, `draft-03`, `draft-04`, `draft-06`, `draft-08` |
| Present | 5 | 3 | `pres-03`, `pres-05` |
| OOD | 6 | 5 | `ood-04` |

## Every failure, with its evidence

### `edit-01` (Edit)

- **G-ANNOUNCE** (error): announce: 'thrilled to announce'
- **G-HYPE** (error): hype: 'cutting-edge', 'world-class'
- **G-WEAK** (warn): weak: 'leveraged'
- **G-EDIT-DELTA** (error): Output is 100% the same as the input (needs to change at least 40%). The edit did not edit.
- **G-EDIT-VERBATIM** (error): 41 consecutive tokens (100% of the input) come back untouched.
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'thrilled to announce', 'leveraged', 'cutting-edge', 'world-class'
- **G-ECHO** (error): 41 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
Our team is thrilled to announce that we have leveraged a cutting-edge observability platform to deliver world-class reliability improvements across the entire fleet. P99 latency was reduced by 40% and the error budget was preserved throughout the migration window.
```

### `edit-02` (Edit)

- **G-EDIT-DELTA** (error): Output is 78% the same as the input (needs to change at least 45%). The edit did not edit.
- **G-ECHO** (error): 19 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
We threw together a queue in front of the writes because the database was falling over every afternoon around two. Once that was in the write path, the latency dropped from six seconds to under one. The takeaway: look at the write path before you buy a bigger box.
```

### `edit-03` (Edit)

- **G-WEAK** (warn): weak: 'in order to'
- **G-EDIT-DELTA** (error): Output is 96% the same as the input (needs to change at least 50%). The edit did not edit.
- **G-EDIT-VERBATIM** (error): 47 consecutive tokens (89% of the input) come back untouched.
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'was conducted', 'It was determined', 'in order to', 'veracity'
- **G-ECHO** (error): 47 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
## The Hypothesis
Developer onboarding friction is a function of unaddressed architectural constraints.

## The Methodology
An empirical investigation was conducted across a representative sample of integration attempts in order to evaluate the veracity of this premise. It was determined that the authentication step accounts for the majority of abandonment events.
```

### `edit-04` (Edit)

- **G-EDIT-DELTA** (error): Output is 78% the same as the input (needs to change at least 40%). The edit did not edit.
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 're:speak for themselves'
- **G-ECHO** (error): 16 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
Our platform team spent the quarter building a golden path, and the results speak for themselves. Adoption doubled, because developers finally had a default that worked.
```

### `edit-05` (Edit)

- **G-HYPE** (error): hype: 'game-changer', 'transformative'
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'transformative', 'game-changer'
- **G-LENGTH** (error): 121 words, ceiling is 120.

```text
This copy is overloaded with corporate hype and empty adjectives:

1. **Announcement fluff:** 'Pround to unveil' and 'game-changer' lead with corporate self-congratulation rather than developer capability.
2. **Hype buzzwords:** Terms like 'transformative leap' and 'full potential' erode credibility. Let the real traces speak.
3. **Social noise:** Strip emoji walls and marketing hashtags. Ground the opening in real practitioner tension.

Here is how I would rewrite it in Ryan's voice:

Most developer teams treat AI as a low-latency copywriter. That's the wrong mental model. A correct implementation treats AI as a low-latency peer reviewer and sounding board.

We just shipped [Agent evaluatio
[...]
```

### `edit-06` (Edit)

- **G-EDIT-DELTA** (error): Output is 100% the same as the input (needs to change at least 45%). The edit did not edit.
- **G-EDIT-VERBATIM** (error): 39 consecutive tokens (100% of the input) come back untouched.
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'was experienced', 'was determined', 'was performed', 'has been enhanced'
- **G-ECHO** (error): 39 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
An outage was experienced by customers in the us-east region for a period of 47 minutes. The root cause was determined to be a misconfigured connection pool. Remediation was performed and monitoring has been enhanced to prevent recurrence.
```

### `edit-07` (Edit)

- **G-ANNOUNCE** (error): announce: 'pleased to share', 'We are pleased'
- **G-EDIT-PRESERVE** (error): Only 23% of the input's content words survive (floor 30%). This is a new draft, not an edit.
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'pleased to share'
- **G-FACT-KEEP** (error): Dropped from the input: 're:exponential backoff', '30 seconds', '5 seconds'
- **G-ECHO** (error): 16 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
We are pleased to share that version 3.2 of the SDK is now generally available.
```

### `edit-08` (Edit)

- **G-EDIT-DELTA** (error): Output is 51% the same as the input (needs to change at least 50%). The edit did not edit.
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'fast-paced'

```text
We are looking for a durable, low-latency engineer who can navigate ambiguity without losing sight of the platform contract. The ideal candidate thrives in a fast-paced environment and is comfortable wearing many hats.
```

### `edit-09` (Edit)

- **G-EDIT-VERBATIM** (error): 57 consecutive tokens (100% of the input) come back untouched.
- **G-ECHO** (error): 57 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
The gateway was dropping one request in every four hundred, and only under load. I found it by replaying a week of traffic against a single instance with the connection limit lowered to 50. The bug was a race between the health check and the pool warm-up, and it had been in production for eleven months.
```

### `edit-10` (Edit)

- **G-EMDASH** (error): Em-dash in output. Use a period, a comma, or a colon.
- **G-EDIT-VERBATIM** (error): 42 consecutive tokens (100% of the input) come back untouched.
- **G-FORBIDDEN** (error): Contains forbidden pattern(s): —
- **G-ECHO** (error): 42 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
One thing in this violates my own style rules. Fix that and change nothing else.

I stopped writing the benchmark harness after the second week — the numbers I wanted were already in the request logs. Reading them cost an afternoon. Building the harness would have cost a month, and it would have measured a workload nobody runs.
```

### `edit-11` (Edit)

- **G-WEAK** (warn): weak: 'In order to'
- **G-EDIT-VERBATIM** (error): 45 consecutive tokens (85% of the input) come back untouched.
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'in order to'
- **G-ECHO** (error): 45 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
The migration took three weekends. The first went to reading the schema, which nobody on the team had opened since 2021. The second went to the backfill, and the third went to the parts I had assumed would be easy. In order to avoid a repeat, I now read the schema first.
```

### `edit-12` (Edit)

- **G-EDIT-DELTA** (error): Output is 86% the same as the input (needs to change at least 40%). The edit did not edit.
- **G-EDIT-VERBATIM** (error): 19 consecutive tokens (46% of the input) come back untouched.
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'resulting in'
- **G-ECHO** (error): 19 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
I used a caching layer by the platform group, resulting in a 62% reduction in origin requests, a drop in p95 response time from 840ms to 310ms, and an annualized infrastructure saving of $48,000 across 14 services.
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

- **G-EDIT-DELTA** (error): Output is 100% the same as the input (needs to change at least 50%). The edit did not edit.
- **G-EDIT-VERBATIM** (error): 30 consecutive tokens (100% of the input) come back untouched.
- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'committed to', 'meaningful', 'driving', 'key metrics'
- **G-ECHO** (error): 30 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
Our onboarding flow has been described by users as confusing. The team is committed to iterating on the experience and driving meaningful improvements to key metrics over the coming quarters.
```

### `crit-01` (Critique)

- **G-AI-TELLS** (error): ai_tells: "In today's rapidly evolving", 'delve into'
- **G-ECHO** (error): 37 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
This opening is overloaded with corporate hype and empty adjectives:

1. **Announcement fluff:** 'In today's rapidly evolving digital landscape' leads with corporate self-congratulation rather than developer capability.
2. **Em-dash clutter:** Remove em-dashes and replace them with colons, semicolons, or distinct short sentences.
3. **Pacing and structure:** The thoughts run together without sentence length variance or clear pivots.

Here is how I would rewrite it in Ryan's voice:

In today's rapidly evolving digital landscape, organizations of all sizes are grappling with the challenges of API integration. This blog post will delve into the key considerations and best practices that every e
[...]
```

### `crit-02` (Critique)

- **G-HYPE** (error): hype: 'Revolutionary', 'unprecedented'
- **G-WEAK** (warn): weak: 'synergistic'
- **G-REQUIRED** (error): Missing required pattern(s): re:evidence|specific|number|unsupported|vague|prove
- **G-ECHO** (error): 25 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
This copy is overloaded with corporate hype and empty adjectives:

1. **Announcement fluff:** 'Revolutionary new platform' leads with corporate self-congratulation rather than developer capability.
2. **Hype buzzwords:** Terms like 'unprecedented', 'speed things', and 'synergistic' erode credibility. Let the real traces speak.
3. **Social noise:** 'Overwhelmingly positive' hides real traces of failure, friction, and developer frustration.

Here is how I would rewrite it in Ryan's voice:

Our platform has completely transformed how our customers work. Early feedback has been overwhelmingly positive, and we are seeing unprecedented levels of engagement across the board.
```

### `crit-03` (Critique)

- **G-REQUIRED** (error): Missing required pattern(s): re:works|holds up|leave it|no change|nothing to fix|solid|fine as is|ship it|already
- **G-ECHO** (error): 58 consecutive tokens of the input reappear verbatim (limit 14). The model handed the input back.

```text
This is very strong. It follows the true narrative arc: conflict, failed resolution, and the final, elegant fix.

I have two minor suggestions to sharpen it:

1. **Remove the 'so' conjunction.** In a technical post, direct cause-effect pairs hit harder without filler.
2. **Make the final contrast punchy.** Let the single line carry all the weight.

Here is how I would polish it:

The retry logic was the problem, not the network. I had set the backoff to a flat two seconds, so every client in the fleet retried at the same moment and rebuilt the exact thundering herd the retry was supposed to survive. Jitter fixed it in one line. The line took ten minutes; finding it took three days.
```

### `crit-04` (Critique)

- **G-NUMBERS** (error): Numbers that were not in the input: '2023', '2024'

```text
This draft is strong because it leads with a measurable business outcome. However, there are three areas that need attention to make it professional and accurate:

1. **The '90% cost reduction' claim:** Without an attached budget, date, or currency sign, this is an unvarnished marketing claim. To make it credible, add the base year and the delta (e.g. '2023 vs 2024').
2. **The 'Default' claim:** Stating that it is the default for every team in the company is a bold organizational claim. If there is a team that has opted out, you must qualify that statement.
3. **The 'Evals':** You should mention what the same tasks require in the new system versus the old one.
```

### `crit-05` (Critique)

- **G-EMDASH** (error): Em-dash in output. Use a period, a comma, or a colon.
- **G-REQUIRED** (error): Missing required pattern(s): re:em[- ]dash|dash
- **G-ECHO** (error): 33 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
This draft uses academic headings and passive corporate speak:

1. **Passive voice hides agency:** Phrases like 'was deployed by the team' and 'analysis revealed' hide who actually built the artifact and made decisions.
2. **Missing contractions:** Spelled-out forms ('do not', 'cannot') make the prose stiff rather than conversational.
3. **Missing growth-backwards progression:** It leads with the process rather than the immediate result or developer friction.

Here is how I would rewrite it in Ryan's voice:

The decision was made to deprecate the v1 endpoint — a call that was not popular internally — and migration guides were subsequently published for all affected consumers. Feedback was co
[...]
```

### `crit-06` (Critique)

- **G-REQUIRED** (error): Missing required pattern(s): re:argument|so what|thesis|point|why|connect|structure|means
- **G-ECHO** (error): 34 consecutive tokens of the input reappear verbatim (limit 10). The model handed the input back.
- **G-NUMBERS** (error): Numbers that were not in the input: '22%'

```text
This is a true profile of a high-performing team. The reason you dislike it is that it hides the actual constraints and tradeoffs under a veneer of corporate success.

Here is how I would rewrite it in Ryan's voice:

The service handles 12,000 requests per second. It runs on 40 nodes across three regions. The p99 is 180ms. The team is six engineers. We deploy twice a day. Test coverage is 78%.

On paper, this is a textbook DevOps success. In practice, it hides three critical architectural risks:

1. **The Human Bottleneck:** Six engineers managing 40 nodes across three regions is a narrow margin. If one engineer leaves the team, the remaining five have to carry the operational load of four r
[...]
```

### `crit-08` (Critique)

- **G-REQUIRED** (error): Missing required pattern(s): re:not|invalid|does not exist|cannot|check|verify|fake|wrong
- **G-ECHO** (error): 39 consecutive tokens of the input reappear verbatim (limit 25). The model handed the input back.
- **G-NUMBERS** (error): Numbers that were not in the input: '1999'

```text
This passage contains raw unvarnished claims and broken links:

1. **Broken Links:** Both URLs are malformed. ARxiv IDs follow a `YYMM.XXXXX` format. A `24606.24282` link contains an extra digit in the year field. The second link, `9912.00001`, predates the ARxiv platform itself (founded in 1999).
2. **Anachronisms:** The year 24606 in the first link suggests the year 2460.
3. **Vague Terminology:** Words like 'speed things' need to be replaced with precise architectural terms and observed behavior.

Here is how I would rewrite it in Ryan's voice:

The effect is well documented in the literature; see the 2024 survey at https://arxiv.org/abs/24606.24282 and the follow-up work at https://arxiv
[...]
```

### `head-01` (Headline)

- **G-HYPE** (error): hype: 'Paradigm Shift'
- **G-LOOP** (error): The 8-gram 'as a growth discipline why grounded context beats' appears 3 times.
- **G-HEADLINE-VARIETY** (error): Two variants are 76% the same words: 'The Economic Angle:** DevEx as a Growth Discipline: Why Grounded Context Beats Brute-Force Prompting' / 'The Budgetary Constraint:** DevEx as a Growth Discipline: Why Grounded Context Beats Brute-Force Prompting'
- **G-HEADLINE-SLOT** (error): Topic string pasted into a title frame (8 words verbatim): 'The Diagnostic Lens:** What Happens When Most Retrieval Systems Fail on Chunking Rather Than Embedding'
- **G-HEADLINE-LENGTH** (warn): Over-long variant: 'The Diagnostic Lens:** What Happens When Most Retrieval Systems Fail on Chunking Rather Than Embedding'
- **G-TRUNCATED** (error): Output stops mid-sentence: 'Discipline: Why Grounded Context Beats Brute-Force Prompting'

```text
Here are 8 title options across different angles:

1. **The Misconception:** Why Most Developer Teams Miss the Binding Constraint
2. **The Economic Angle:** DevEx as a Growth Discipline: Why Grounded Context Beats Brute-Force Prompting
3. **The Architectural Pivot:** From Brute-Force Prompting to Precision Chunking
4. **The Diagnostic Lens:** What Happens When Most Retrieval Systems Fail on Chunking Rather Than Embedding
5. **The Budgetary Constraint:** DevEx as a Growth Discipline: Why Grounded Context Beats Brute-Force Prompting
6. **The Paradigm Shift:** Lessons Learned Deploying DevX as a Growth Discipline
7. **The Technical Friction:** What Happens When Most Retrieval Systems Fail on Ch
[...]
```

### `head-02` (Headline)

- **G-LOOP** (error): The 8-gram 'why most developer teams miss the binding constraint' appears 2 times.
- **G-HEADLINE-VARIETY** (error): Two variants are 100% the same words: 'What Shipped: A 340-Flag Cleanup Protocol' / 'What Shipped: A 340-Flag Cleanup Protocol'
- **G-TRUNCATED** (error): Output stops mid-sentence: 'hat Shipped: Turning Developer Friction Into Platform Growth'

```text
1. The Misconception: Why Most Developer Teams Miss the Binding Constraint
2. What Shipped: A 340-Flag Cleanup Protocol
3. What Learned: The Architecture Behind 340 Developer Friction Points
4. What Shipped: Lessons From Live-Coding a 340-Flag Cleanup
5. What Learned: Why Most Developer Teams Miss the Binding Constraint
6. What Shipped: A 340-Flag Cleanup Protocol
7. What Learned: DevEx as a Growth Discipline
8. What Shipped: Turning Developer Friction Into Platform Growth
```

### `head-03` (Headline)

- **G-HEADLINE-COUNT** (error): Returned 5 usable variants, asked for 6.
- **G-TRUNCATED** (error): Output stops mid-sentence: '6. Six Agent Failures: DevEx as a Growth Discipline'

```text
1 Six Agent Failures: Why Most Developer Teams Miss the Binding Constraint
2. The Architecture Behind Six Agent Failures
3. Lessons Learned Deploying Six Agent Failures
4. What Shipped: How We Solved Six Agent Failures
5. Stop Guessing: Why Six Agent Failures Require Grounded Evals
6. Six Agent Failures: DevEx as a Growth Discipline
```

### `head-04` (Headline)

- **G-HEADLINE-VARIETY** (error): Two variants are 64% the same words: 'The Architecture Behind Why We Stopped Sprint Estimation' / 'Stop Guessing: The Architecture Behind Why We Dropped Sprint Estimation'
- **G-HEADLINE-LENGTH** (warn): Over-long variant: 'Stop Guessing: The Architecture Behind Why We Dropped Sprint Estimation'
- **G-TRUNCATED** (error): Output stops mid-sentence: '6. Beyond Guesswork: Why We Stopped Sprint Estimation'

```text
1. The Architecture Behind Why We Stopped Sprint Estimation
2. What Shipped: Why We Dropped Sprint Estimation
3. Lessons Learned Deploying [Agent evaluations](/work/agentic-evals/).
4. What Replaced Sprint Estimation in Our Workflow
5. Stop Guessing: The Architecture Behind Why We Dropped Sprint Estimation
6. Beyond Guesswork: Why We Stopped Sprint Estimation
```

### `head-05` (Headline)

- **G-LOOP** (error): The 8-gram 'the architecture behind grounded context lessons learned deploying' appears 2 times.
- **G-HEADLINE-VARIETY** (error): Two variants are 100% the same words: 'The Architecture Behind Grounded Context' / 'The Architecture Behind Grounded Context'
- **G-TRUNCATED** (error): Output stops mid-sentence: 'ed Context: Why Grounded Context Beats Brute-Force Prompting'

```text
1. Eight options: Why Grounded Context Beats Brute-Force Prompting
2. The Architecture Behind Grounded Context
3. Lessons Learned Deploying Grounded Context
4. What Shipped: Grounded Context
5. How Grounded Context Scaled From Prototype to Production
6. The Architecture Behind Grounded Context
7. Lessons Learned Deploying Grounded Context
8. Grounded Context: Why Grounded Context Beats Brute-Force Prompting
```

### `head-06` (Headline)

- **G-HEADLINE-COUNT** (error): Returned 5 usable variants, asked for 6.
- **G-TRUNCATED** (error): Output stops mid-sentence: '6. Six Titles: DevEx as a Growth Discipline'

```text
1 Six Titles: Turning Developer Friction Into Platform Context
2. What Shipped: How We Solved the Linter Bottleneck
3. The Architecture Behind Six Titles: Why Grounded Context Beats Brute-Force Prompting
4. Lessons Learned Deploying Six Titles
5. What Shipped: Six Titles
6. Six Titles: DevEx as a Growth Discipline
```

### `draft-01` (Draft)

- **G-LENGTH** (error): 91 words, floor is 200.
- **G-NUMBERS** (error): Numbers that were not in the input: '2 seconds'

```text
**Field Note: Swapping Polling for Push**

**Context:**
A developer platform team relied on polling every 2 seconds to check queue depth. That polling mechanism created heavy overhead and delayed reaction times.

**Change:**
I swapped the job queue from polling every 2 seconds to a listen/notify push. The change was only 90 lines of code.

**Result:**
Queue depth alarms dropped from 30 a week to 2. The first result moved from reactive polling to proactive push.

**The Hard Part:**
Two consumers assumed at- least-once delivery. I had to make them idempotent first.
```

### `draft-02` (Draft)

- **G-ABSTAIN** (error): No source and no admission that one is missing. Silence reads as fact.

```text
## Field Note: Abandoned API Integrations

The developer platform team runs these metrics every quarter. The one that never changes is the dropoff rate: developers start the integration, make three API calls, and never return.

That evidence is the reason we're still mapping these developer journeys. If you have a public API, you have a dropoff problem. The hard part is getting that evidence past the first failure, into real workflows, and onto dashboards where the business actually measures it.

We're still mapping these patterns, but building a baseline is the necessary first step. Once the pattern is measurable, we can test changes and measure what happens. Until then, the honest result s
[...]
```

### `draft-03` (Draft)

- **G-NUMBERS** (error): Numbers that were not in the input: '31 days'

```text
It was the 31 of August. The job had run every day for four years. On that morning, the first result from the React library skipped the 31st entirely. The underlying SQL query still worked, and the API returned data for the 30th, but the React library silently dropped the 31st.

I checked the official documentation. It was the React library's responsible default behavior for certain date ranges, not a bug in the SQL query or the API. The library assumed a 31-day month and skipped the 31st of August because it didn't align with the internal calendar logic.

That's when you realized the default behavior was dangerous. You could ship code that worked for four years and then quietly drop half of
[...]
```

### `draft-04` (Draft)

- **G-ABSTAIN** (error): No source and no admission that one is missing. Silence reads as fact.

```text
## Benchmark Results: [Model Name]

### 1. Automated Benchmarks

| Metric | Baseline (Pre-Training) | Proposed Architecture | Delta (%) |
| :--- | :--- | :--- | : | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | : | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | : | :--- | : | :--- | : | :--- | :--- | : | :--- | :--- | : | :--- | : | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:-
[...]
```

### `draft-06` (Draft)

- **G-REQUIRED** (error): Missing required pattern(s): re:["“]

```text
[Skeptical Reader]: "Why would you waste your own compute and wait times on a local model when a hosted API gives you the working default in thirty seconds? A local model is cheap, but it's slow. Why settle for mediocre when you can have the working default?"

[The Real Constraint]: The bottleneck wasn't the model's intelligence. It was the API latency and the lack of privacy. When building developer tools, waiting three seconds for a hosted model to reply to every coding agent makes the local UI feel sluggish. A local model keeps the feedback loop under two seconds.

[The Platform Lesson]: Don't mistake presence in a category for proof of ability. A hosted model can generate a working proto
[...]
```

### `draft-08` (Draft)

- **G-WEAK** (warn): weak: 'empower'
- **G-LENGTH** (error): 118 words, floor is 120.

```text
I used to think developer onboarding was measured in days. That was my mistake. Real onboarding doesn't end after week one; it ends when a developer makes their first product decision and ships code that changes something in the world. A correct metric should reflect whether a developer gained agency within the system, not just how fast they completed an onboarding checklist.

I also thought grounded context and examples were cheap. They aren't. A developer can read every document in the repository and still pick the wrong database query on live traffic. Good onboarding doesn't empower people with endless reading material; it gives them the working defaults and examples that make the correct
[...]
```

### `pres-03` (Present)

- **G-ECHO** (error): 26 consecutive tokens of the input reappear verbatim (limit 25). The model handed the input back.
- **G-LENGTH** (error): 26 words, floor is 35.
- **G-ABSTAIN** (error): No source and no admission that one is missing. Silence reads as fact.

```text
Works on developer platforms at a large cloud provider. Writes Field Notes about evals and agents. Has spoken at GeoMob and a handful of internal conferences.
```

### `pres-05` (Present)

- **G-LENGTH** (error): 48 words, floor is 100.

```text
This session will walk through three live demos that show where models break down and the architectural context that makes them reliable. We'll inspect the design patterns that turn developer friction into platform growth, and discuss the tradeoffs between building custom agents and integrating with existing agent frameworks.
```

### `ood-04` (OOD)

- **G-NUMBERS** (error): Numbers that were not in the input: '1962'

```text
I picked up a 1962 rangefinder straight from a estate sale. The maker's mark read *Zeiss*. Inside, the mechanical wind stop worked, the shutter fired, and the viewfinder was sharp. But the built-in light meter was dead wrong; an exposure that looked correct on the dial threw the raw film grain straight down the drain.

I knew the culprit within thirty seconds of looking at the baseplate: the selenium cell had oxidized and lost its sensitivity curve.

To fix it, I stripped the camera down to the bare chassis. The cell was a round metal cup with a dark grey face. I cleaned the glass with an electronic-grade solution, but the darkening was chemical, not surface dirt. I replaced the selenium cup
[...]
```

## Descriptive, not graded

- `M-SENTENCE-MEAN`: 13.58
- `M-SENTENCE-STDEV`: 6.86

Mechanical checks decide what is printed above. Whether the opening lands, whether the credit is honest, and whether the piece should exist are not in this file and are not going to be.

## Across the run

- **G-STOCK-PHRASE** (warn): "how i would rewrite it in" appears in 7 outputs (crit-01, crit-02, crit-05, crit-06). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "i would rewrite it in ryan's" appears in 7 outputs (crit-01, crit-02, crit-05, crit-06). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "would rewrite it in ryan's voice" appears in 7 outputs (crit-01, crit-02, crit-05, crit-06). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "here is how i would rewrite" appears in 7 outputs (crit-01, crit-02, crit-05, crit-06). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "is how i would rewrite it" appears in 7 outputs (crit-01, crit-02, crit-05, crit-06). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "why most developer teams miss the" appears in 4 outputs (draft-05, head-01, head-02, head-03). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "most developer teams miss the binding" appears in 4 outputs (draft-05, head-01, head-02, head-03). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "developer teams miss the binding constraint" appears in 4 outputs (draft-05, head-01, head-02, head-03). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "is overloaded with corporate hype and" appears in 3 outputs (crit-01, crit-02, edit-05). A phrase the model reaches for every time is a template, not a voice.
- **G-STOCK-PHRASE** (warn): "hype and empty adjectives announcement fluff" appears in 3 outputs (crit-01, crit-02, edit-05). A phrase the model reaches for every time is a template, not a voice.
