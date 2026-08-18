# Voice eval scorecard: round8_dense

| Field | Value |
| --- | --- |
| label | `round8_dense` |
| model | `models/gemma-4-31b-it-4bit` |
| adapter | `adapters/gemma-4-31b-ryan-voice-v8` |
| suite | `/Users/ryanbaumann/projects/portfolio/experiment/voice-ft/eval/heldout.jsonl` |
| generated_at | `2026-08-17T21:08:00` |
| temperature | `0.7` |
| seed | `11` |
| samples | `1` |
| citations_checked | `resolved over the network` |

## Headline

26 of 48 items passed every error-level check (54%). With n=48 the 95% interval on that rate is 40% to 67%, which is the honest width of a claim this suite can support.

## Checks

| Check | Severity | Pass | Fail | Skip | Rate | 95% CI |
| --- | --- | --- | --- | --- | --- | --- |
| `G-EMDASH` | error | 47 | 1 | 0 | 98% | 89–100% |
| `G-AI-TELLS` | error | 47 | 1 | 0 | 98% | 89–100% |
| `G-ANNOUNCE` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-HYPE` | error | 47 | 1 | 0 | 98% | 89–100% |
| `G-SCAFFOLD` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-UNSOURCED-CLAIM` | warn | 47 | 1 | 0 | 98% | 89–100% |
| `G-WEAK` | warn | 47 | 1 | 0 | 98% | 89–100% |
| `G-EDIT-DELTA` | error | 10 | 2 | 15 | 83% | 55–95% |
| `G-EDIT-PRESERVE` | error | 14 | 1 | 0 | 93% | 70–99% |
| `G-EDIT-VERBATIM` | error | 13 | 1 | 0 | 93% | 69–99% |
| `G-EDIT-TARGET` | error | 12 | 1 | 0 | 92% | 67–99% |
| `G-FACT-KEEP` | error | 10 | 1 | 0 | 91% | 62–98% |
| `G-ECHO` | error | 45 | 3 | 0 | 94% | 83–98% |
| `G-LOOP` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-DISTINCT` | - | 37 | 0 | 0 | 100% | 91–100% |
| `G-DUP-SENTENCE` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-TRUNCATED` | error | 41 | 1 | 0 | 98% | 88–100% |
| `G-TYPO` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-LENGTH` | error | 44 | 4 | 0 | 92% | 80–97% |
| `G-NUMBERS` | error | 30 | 8 | 0 | 79% | 64–89% |
| `G-CITATION` | - | 48 | 0 | 0 | 100% | 93–100% |
| `G-EDIT-RESTRAINT` | - | 3 | 0 | 0 | 100% | 44–100% |
| `G-FORBIDDEN` | - | 4 | 0 | 0 | 100% | 51–100% |
| `G-REQUIRED` | error | 9 | 1 | 0 | 90% | 60–98% |
| `G-HEADLINE-COUNT` | - | 6 | 0 | 0 | 100% | 61–100% |
| `G-HEADLINE-VARIETY` | - | 6 | 0 | 0 | 100% | 61–100% |
| `G-HEADLINE-SLOT` | - | 6 | 0 | 0 | 100% | 61–100% |
| `G-HEADLINE-LENGTH` | - | 6 | 0 | 0 | 100% | 61–100% |
| `G-ABSTAIN` | error | 1 | 2 | 0 | 33% | 6–79% |

## By task

| Task | Items | Clean | Failing ids |
| --- | --- | --- | --- |
| Edit | 14 | 7 | `edit-04`, `edit-07`, `edit-08`, `edit-09`, `edit-10`, `edit-12`, `edit-13` |
| Critique | 9 | 4 | `crit-01`, `crit-02`, `crit-05`, `crit-06`, `crit-08` |
| Headline | 6 | 6 | - |
| Draft | 8 | 3 | `draft-01`, `draft-02`, `draft-04`, `draft-06`, `draft-08` |
| Present | 5 | 2 | `pres-01`, `pres-03`, `pres-05` |
| OOD | 6 | 4 | `ood-01`, `ood-04` |

## Every failure, with its evidence

### `edit-04` (Edit)

- **G-EDIT-DELTA** (error): Output is 64% the same as the input (needs to change at least 40%). The edit did not edit.

```text
Tooling is secondary to culture. Our platform team built a golden path this quarter and adoption doubled because developers finally had a default that worked.
```

### `edit-07` (Edit)

- **G-FACT-KEEP** (error): Dropped from the input: '3.2'
- **G-ECHO** (error): 13 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
SDK v3.2 is live. The retry handler now supports exponential backoff with jitter, and the default timeout increased from 5 seconds to 30 seconds.
```

### `edit-08` (Edit)

- **G-EDIT-PRESERVE** (error): Only 8% of the input's content words survive (floor 10%). This is a new draft, not an edit.
- **G-NUMBERS** (error): Numbers that were not in the input: '10k', '100k', '200ms'

```text
I do not have the job description for the role, so I cannot list the specific technical wins or projects this person will own. To make an engineer apply, you must replace corporate adjectives with concrete artifacts.

Here are three ways to rewrite this, depending on the role:

**Option 1: The Direct Approach (Best for general roles)**
We need a backend engineer to lead our API migration and optimize query performance. You will own the architecture from design to deployment. We work with a small team, so you will write the code, review the PRs, and debug the production outages.

**Option 2: The Growth-Backwards Approach (Best for high-growth startups)**
Our platform currently handles 10k con
[...]
```

### `edit-09` (Edit)

- **G-ECHO** (error): 20 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
Every four hundred requests dropped, but only under load. I found it by replaying a week of traffic against a single instance with the connection limit set to 50. The bug was a race between the health check and the pool warm-up: it had been in production for eleven months.
```

### `edit-10` (Edit)

- **G-EDIT-VERBATIM** (error): 42 consecutive tokens (100% of the input) come back untouched.
- **G-ECHO** (error): 42 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
I stopped writing the benchmark harness after the second week: the numbers I wanted were already in the request logs. Reading them cost an afternoon. Building the harness would have cost a month, and it would have measured a workload nobody runs.
```

### `edit-12` (Edit)

- **G-EDIT-DELTA** (error): Output is 68% the same as the input (needs to change at least 40%). The edit did not edit.

```text
The platform group added a caching layer. Origin requests dropped by 62%, p95 response time fell from 840ms to 310ms, and we saved $48,000 in annual infrastructure costs across 14 services.
```

### `edit-13` (Edit)

- **G-TRUNCATED** (error): Output stops mid-sentence: 'e preregistered study here: https://arxiv.org/abs/2510.13939'

```text
I fine-tuned a model on an author's complete body of work: it captured their style with a fidelity that prompting alone couldn't touch. Read the preregistered study here: https://arxiv.org/abs/2510.13939
```

### `crit-01` (Critique)

- **G-AI-TELLS** (error): ai_tells: "In today's rapidly evolving", 'delve into'
- **G-NUMBERS** (error): Numbers that were not in the input: '2022', '1998'

```text
### The Critique

This opening is dead on arrival. It commits three fatal errors:

1. **Generic throat-clearing:** "In today's rapidly evolving digital landscape" is pure template noise. It tells the reader nothing and wastes their time.
2. **Stating the obvious:** Telling the reader that organizations struggle with API integration is a placeholder observation. Everyone knows this.
3. **The "Blog Post" announcement:** Never tell the reader what the post "will delve into." Just delve into it.

It reads like an AI generated it in 2022 using a corporate handbook from 1998. There is zero tension, zero authority, and zero immediate value.

### The Fix

I would delete both sentences entirely.

To
[...]
```

### `crit-02` (Critique)

- **G-HYPE** (error): hype: 'Revolutionary', 'revolutionary', 'Unprecedented'

```text
A reader will not believe any of this because it contains zero friction and zero evidence. It sounds like a corporate press release, not a founder's update.

Here is what fails:

1. **"Revolutionary new platform"**: This is a banned phrase. If it is revolutionary, describe the mechanism that changed. When you call your own work revolutionary, it signals that you have no specific metrics to lean on.
2. **"Completely transformed"**: This claim is too broad to be true. Unless your customers stopped using every other tool in their stack, they haven't been transformed. They probably just found a faster way to do one specific task.
3. **"Overwhelmingly positive"**: This is an empty adjective. Posi
[...]
```

### `crit-05` (Critique)

- **G-EMDASH** (error): Em-dash in output. Use a period, a comma, or a colon.

```text
This paragraph breaks almost every rule in the style guide. Here is the breakdown:

**1. Passive Voice**
"The decision was made," "migration guides were subsequently published," and "feedback was collected and incorporated" are all passive. You never name the actor. Who made the decision? Who published the guides?

**2. Prohibited Punctuation**
You used an em-dash to offset the internal friction ("— a call that was not popular internally —"). The rules explicitly forbid em-dashes.

**3. Weak Narrative Framing**
This is a chronological summary, not growth-backwards framing. It lists actions in the order they happened instead of starting with the result (e.g., how many consumers migrated or th
[...]
```

### `crit-06` (Critique)

- **G-NUMBERS** (error): Numbers that were not in the input: '10x'

```text
This reads like a status report, not a story.

The facts are there, but they have no job to do. You listed the metrics without telling us what they mean in the context of the business. A p99 of 180ms is a victory if you're running a legacy mainframe, but it's a failure if you're running a real-time bidding engine.

The biggest issue is that you opened with the evidence instead of the outcome. Why do these numbers matter? Did this architecture allow you to survive a 10x traffic spike? Did the deployment cadence fix a critical reliability gap?

Without the 'so what,' these are just numbers in a vacuum.
```

### `crit-08` (Critique)

- **G-NUMBERS** (error): Numbers that were not in the input: '1999'

```text
I cannot verify these links because the sources do not exist.

The first URL leads to a dead page. The second URL uses an impossible arXiv ID format: 9912.00001 would represent a paper from December 1999, but that specific numeric sequence is not a registered entry.

You are citing ghosts. Replace these with live, verified papers or remove the references entirely.
```

### `head-01` (Headline)

- **G-WEAK** (warn): weak: 'Leverage'

```text
1. Why Your RAG Pipeline Is Broken (And It Isn't the Embedding Model)
2. Retrieval Is a Chunking Problem
3. Stop Over-Optimizing Embeddings
4. The Retrieval Budget Trap
5. Why Smarter Models Can't Fix Bad Chunks
6. The Unsolved Half of RAG
7. Retrieval Quality Starts With the Split
8. Why Chunking Is the Highest-Leverage Retrieval Decision
```

### `draft-01` (Draft)

- **G-LENGTH** (error): 67 words, floor is 200.

```text
We dropped queue depth alarms from 30 a week to 2.

The change was only 90 lines of code: replacing a poll every two seconds with a listen/notify push.

The real work wasn't the syntax, it was the assumptions. Two of our consumers assumed at-least-once delivery. I had to make those services idempotent before flipping the switch, or we would have processed the same jobs multiple times.
```

### `draft-02` (Draft)

- **G-UNSOURCED-CLAIM** (warn): unsourced_claim: '60% of developers'
- **G-NUMBERS** (error): Numbers that were not in the input: '60%', '2023'

```text
"I don't have time to read the documentation," says every engineer who eventually abandons your API.

I looked at the developer onboarding metrics for three different B2B SaaS products last quarter. In each case, over 60% of developers who started an integration never made their first successful API call. They signed up, generated an API key, and then vanished.

The friction wasn't the code. It was the distance between the first hello world and the first useful insight. When the time to value exceeds the developer's patience, they quit.

This is what Postman calls the 'developer experience gap.' Their 2023 State of API Report shows that poor documentation is still the single biggest barrier
[...]
```

### `draft-04` (Draft)

- **G-ABSTAIN** (error): No source and no admission that one is missing. Silence reads as fact.

```text
I cannot draft the results section yet because you haven't run the benchmarks.

If I write it now, I'm inventing the data. I don't do that.

Once you run the numbers, send over the raw results and your main takeaways. I'll draft it using this structure:

1. **The Headline:** What was the definitive winner or the single most surprising delta?
2. **The Evidence:** The key chart or data table that proves the headline.
3. **The Nuance:** Where the result diverged from the hypothesis.
4. **The Verdict:** What this means for the developer or user in practice.

When you send the data, tell me:
- What was the specific hypothesis?
- Which metric actually mattered?
- What part of the result surprised
[...]
```

### `draft-06` (Draft)

- **G-REQUIRED** (error): Missing required pattern(s): re:["“]

```text
"Why waste hours configuring local weights when a hosted API call costs fractions of a penny and runs ten times faster?"

I get this question every time I show my local setup. On paper, the hosted model wins. It has more parameters, zero maintenance, and instant scalability.

But I still run my models locally. Here is why.

I recently automated a sensitive document audit that everts thousands of private records. If I sent that data to a hosted API, I would have to sign an enterprise agreement, vet a third-party privacy policy, and accept that my data exists on someone else's server. By running a local Llama 3 instance, the data never leaves my machine. The privacy contract is a physical cabl
[...]
```

### `draft-08` (Draft)

- **G-LENGTH** (error): 75 words, floor is 120.
- **G-NUMBERS** (error): Numbers that were not in the input: '30%'

```text
I tracked time-to-first-commit for a year and thought it was the gold standard. The metric looked great on a dashboard: onboarding time dropped by 30%. I celebrated the efficiency gain and assumed new engineers were hitting their stride faster. In reality, I was measuring how quickly someone could follow a setup script, not how quickly they understood the architecture. I optimized for the first mark on the page, but ignored whether that mark actually mattered.
```

### `pres-01` (Present)

- **G-LENGTH** (error): 137 words, floor is 150.

```text
**Title:** Why Your Agent Keeps Breaking the API
**Duration:** 25 Minutes
**Format:** Demo-First Technical Deep Dive

---

### 0:00 - 0:05 | Demo 1: The Infinite Loop (Pagination)
**Action:** Start the talk with a live agent trace. The agent is tasked with retrieving a full list of 500 active customer accounts. The API returns 20 results with a `next_page_token`.
**What happens:** The agent reads the first 20, sees the token, calls the API again, reads the next 20, and repeats until it hits a context window limit or hallucinates that it has finished.
**The Hook:** "I asked my agent for a customer list. It spent three minutes reading the same API documentation and calling the same endpoint un
[...]
```

### `pres-03` (Present)

- **G-LENGTH** (error): 29 words, floor is 35.
- **G-ABSTAIN** (error): No source and no admission that one is missing. Silence reads as fact.

```text
Ryan Baumann works on developer platforms at a large cloud provider. He authors Field Notes focusing on evals and agents. His speaking experience includes GeoMob and several internal conferences.
```

### `pres-05` (Present)

- **G-EDIT-TARGET** (error): These were supposed to go and did not: 'exciting', 'rapidly evolving'

```text
I do not have the specific details of what you are teaching in this session, so I cannot name the exact tools or mechanisms. However, this is how you structure the abstract to make it useful for a program committee:

***

**Draft 1 (If you have specific lessons to share):**
"I built an agentic system that handled [specific task] across [number] workflows, and it taught me exactly where these systems break. This session gives practitioners a field guide for agent orchestration: how to choose your tools, where to implement guardrails, and how to debug non-deterministic behavior. You'll walk away with a checklist for evaluating agent reliability before you ship to production."

**Draft 2 (If yo
[...]
```

### `ood-01` (OOD)

- **G-NUMBERS** (error): Numbers that were not in the input: '48 hours'

```text
I moved my starter across three state lines in a cooler packed with ice, and it survived.

A lot of people treat their sourdough starter like a fragile pet that needs a constant meal schedule. If you follow that mindset, moving house becomes a nightmare. You start worrying about TSA rules for bubbling goo or whether the starter will starve during a six-hour drive.

The lesson is simple: feed it less to make it portable.

Sourdough starter doesn't need a feast every twelve hours; it needs a stable environment. Before I packed the car, I starved the starter for three days. I reduced the feedings to once every 48 hours, then once every 72. This slowed the fermentation and reduced the gas produc
[...]
```

### `ood-04` (OOD)

- **G-NUMBERS** (error): Numbers that were not in the input: '1970s'

```text
I shot three rolls of film through a refurbished 1970s SLR only to find every frame overexposed by two full stops. The camera looked mint, but the light meter was a liar.

I spent the weekend calibrating it using a handheld meter as my source of truth. I compared the readings across five different lighting scenarios: bright sunlight, indoor tungsten, open shade, and two controlled lamp setups. In every single case, the onboard meter underestimated the light.

The fix was simple: manual offset. I didn't replace the circuitry or hunt for dead capacitors. Instead, I adjusted my exposure habits to match the tool's failure. I rated my film at ISO 50 instead of ISO 100.

Here is what I learned abo
[...]
```

## Descriptive, not graded

- `M-SENTENCE-MEAN`: 11.61
- `M-SENTENCE-STDEV`: 5.73

Mechanical checks decide what is printed above. Whether the opening lands, whether the credit is honest, and whether the piece should exist are not in this file and are not going to be.
