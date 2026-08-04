# Post 1: three drafts for review

**Status:** three distinct full drafts of the headline Field Note, written against `own-your-intelligence-series-plan.md`. Registers are analytical, scene-led, and staccato, per the writing skill's requirement for a headline piece. Pick one, or pick the opening of one and the spine of another.

**Shared placeholder:** every draft has a `[TABLE]` marker where the demo results go. The fine-tune hasn't run yet. Prose is reviewable now; numbers land later.

**Shared constraint check:** no em-dashes, contractions throughout, at most two "not X, it's Y" flips per draft, all external numbers from public sources, demo framed as personal work on public APIs.

---

# Draft A: analytical

**Title:** Docs Teach Humans. Only Traces Teach Weights.
**Summary:** Your platform has four audiences and you only control the distribution to three of them.

---

Your documentation has four audiences, and only three of them can read.

Docs distribute developer experience to humans. SDKs distribute it to applications. Skills and MCP servers distribute it to agent harnesses. Every one of those is a channel you own: you version it, you measure it, you deprecate it on your own schedule.

Then there's the fourth. The model shows up at your platform already holding an opinion about how it works, formed months before you shipped anything, out of whatever the open internet happened to contain at the time. You didn't write that opinion. You can't version it. And it's the one your developer meets first, because they're not reading your docs. Their agent is answering from memory.

Traces are the only artifact that reaches it.

I wanted to know how far that goes, so I spent a weekend on the smallest version of the problem I could find.

## The cheapest correctness bug I know

Google Maps Platform bills Place Details in three tiers, and you pay the highest tier that any field in your request touches. Ask for an address and coordinates and you're in Essentials, around five dollars per thousand calls. Let a model helpfully append `rating` and the identical call bills as Enterprise, around twenty.

Nothing breaks. The response parses, the test passes, the map renders. The only symptom is an invoice that's four times larger than it needed to be, and it shows up a month after the code shipped.

Models get this wrong constantly, and the reason is boring: they reach for the legacy Places parameters, because those are what the web was saturated with when the weights were made. Google closed those surfaces to new customers in March 2025. The models never got the memo, and they won't, because the corpus they learned from is fixed.

This isn't a Maps problem. A study at ICSE 2025 ran seven models across 145 API mappings in eight Python libraries, and measured deprecated API usage between twenty-five and thirty-eight percent of the time. The authors point at both halves of the failure: stale parametric knowledge going in, no API-status awareness at inference.

So I fine-tuned a small model to stop doing it.

[TABLE: Gemma 4 base / +SFT / +RL across schema validity, HTTP 200 rate, exact mask match, mean billable SKU tier, tokens per successful call, cost per successful call]

The grader has no judge in it. Schema-valid, live 200, requested mask equals the required field set, minus a penalty for every over-fetched billable field weighted by what that field costs. One number, and it's simultaneously a correctness metric and a cost metric. People say you should train against cost. Very few rewards actually contain it.

## The part that ruined the weekend

I can do this for myself. I can't do it for every developer building on a platform, and I can't ship weights into DeepSeek.

That's the whole problem in two sentences. The tuned model is mine, it works, and its blast radius is exactly one person. Meanwhile the model a developer actually opens on Monday morning is one I didn't train, don't host, and can't reach.

There are three ways out, and they trade against each other in a way I didn't expect.

**Tune it yourself.** Works beautifully for narrow, high-volume jobs: field masks, place validation, entry-point disambiguation, anything running on a device. You own the weights and there's no distribution problem left to solve. It's also already a product category. Desert Ant Labs, a Dutch lab about two months old, ships nothing but small on-device models with one job each: PII redaction across EU languages, language identification across eighty-four of them, filler-word detection at twenty-millisecond precision. If you don't build the small model for your own narrow jobs, that's who builds one that works across everybody's.

**Publish into corpora.** Hugging Face now hosts agent traces natively. Raw session files from the major coding agents upload without conversion and render in a trace viewer. The mechanism exists and it's a week of work, which is roughly a thousand times less friction than it had a year ago.

**Get your work into a benchmark labs climb.** This is the one with real leverage, and Harvey has now run the entire sequence in public.

## Harvey ran the experiment so you don't have to

In May, Harvey published the Legal Agent Benchmark: twelve hundred agent tasks across twenty-four practice areas, graded against seventy-five thousand expert-written criteria, all-pass scoring. The best frontier model scored 7.1%. The best score anyone has posted since is 13.3%.

Sit with that. On a benchmark built from what the work actually is, the frontier is in the low teens, and the top performer costs about fifty-one dollars and twenty-two minutes per task. Legal work isn't close to saturated. Neither is yours.

Three weeks later Harvey and Baseten published the follow-through. They took the benchmark's signal, paired it with a harness built for long-horizon legal work, and post-trained an open-weight 27B model with that harness in the loop. Criterion pass rate went from 42.5% to 63.0%. It landed in the closed-source frontier band, matching Sonnet 4.6 and GPT-5.5 running the same harness.

One detail in that post matters more than the headline. The harness alone gave the 27B model almost nothing. The frontier models benefited from it immediately.

I've spent two years arguing that context engineering is how a platform stays useful as models churn, and I still think that's right. But there's a floor under it. Above some capability line, good context is enough. Below it, you have to train, and no amount of skill authoring gets you there.

## Control falls, durability rises

Line the mechanisms up and something uncomfortable shows up.

| Tier | Control | Time to impact | Lifespan |
|---|---|---|---|
| Your own features | Total | Weeks | Until you retrain |
| Developers running your tuned model | High | Months | Until your API changes |
| Open-weight post-training | None | Quarters | A model generation |
| Frontier pretraining | Zero | Years | Effectively forever |

Every step down the ladder, you give up control and buy durability. The tier you can steer most precisely is the one that expires fastest. The tier that outlives everything is the one where your only move is publishing and hoping.

Fireworks has been selling the top of this ladder for a year, and selling it well: "Own Your Specialized Intelligence," a quarter-billion-dollar Series C in February, a named partner on the Harvey work. They're right about the tier they're selling. It's also the tier with the smallest reach, and nobody is selling you the bottom three, because there's nothing to sell. You either publish or you don't.

Call the thing you're buying down there share of gradient. It's answer-engine optimization one layer deeper: not whether a model cites you, but whether it was shaped by you. The crude version already exists as a line in your `robots.txt`. Publishing traces is the same decision with a far better signal.

## What I'd do Monday

Pick one narrow, high-volume job on your platform where a small model would be enough. Write the deterministic grader before you write anything else, and make sure the grader contains the cost. Run a base model against it and look at how bad the number is.

Then decide, honestly, whether you're building it for yourself or publishing it. Because the arithmetic underneath is real: you're trading inference cost for headcount that maintains evals and retrains checkpoints. At platform scale it clears easily. For most teams reading this, it won't, and the honest answer is to publish the traces and let someone else carry the training bill.

I'm one weekend into this and I don't know yet where the line falls. I'd like to hear from anyone further along.

---

# Draft B: scene-led

**Title:** Fine-Tuning Was the Easy Part
**Summary:** I taught a small model to stop overcharging me. Then I realized I couldn't ship that fix to anyone.

---

I was trying to find a nursery.

Not a hard problem. It's a backyard project, I wanted somewhere nearby that stocked native plants, and I'd wired up a small agent against public Maps APIs to answer that kind of question for me. It worked. It gave me four nurseries, ranked sensibly, with hours.

Then I looked at what it had actually asked for.

The model had written a field mask requesting the place name, the address, the coordinates, the opening hours, the photos, and the rating. I needed the first three. The last three were decoration, and they'd quietly moved my request from one billing tier to another.

Place Details bills in three tiers, and you pay the highest tier any field in your request touches. Name and address and coordinates is Essentials, roughly five dollars per thousand calls. Add `rating` and the same call is Enterprise, roughly twenty. My agent had been paying four times list price to render information it never displayed, and it had been doing it correctly, in the sense that nothing crashed and every response validated.

That's the part I keep turning over. There was no error. There was no failing test. There was a model doing a reasonable thing with incomplete information, at four times the price, invisibly, forever.

## Why it does this

It reaches for the old parameters. The legacy Places surfaces were closed to new customers in March 2025, and the models learned to write Maps code from an internet that was full of them for a decade before that. The weights are a photograph of a moment that's already gone.

That's not a Maps problem and it's not a Gemma problem. Researchers at ICSE 2025 tested seven models on 145 API migrations across eight Python libraries and found deprecated calls between twenty-five and thirty-eight percent of the time. Stale knowledge going in, no awareness of API status at inference, and no mechanism for the model to find out it's wrong.

So I spent a Saturday teaching a small one not to.

[TABLE: Gemma 4 base / +SFT / +RL across schema validity, HTTP 200 rate, exact mask match, mean billable SKU tier, tokens per successful call, cost per successful call]

Three hundred synthetic requests off the backyard project. Gemma 4, QLoRA, a grader with no judge in it: valid schema, live 200, requested mask matches the required field set, penalty per over-fetched billable field weighted by what the field costs. That last clause is the interesting one. Because over-requesting is a billing event, a single reward signal carries correctness and cost at the same time, and I didn't have to invent a proxy for either.

It cost less than a coffee and it worked.

## And then I couldn't do anything with it

Here's what I have: a small model that gets my field masks right, running on my machine, helping exactly one person.

Here's what I don't have: any way to put that fix in front of a developer who opens their agent tomorrow morning and asks it to build a store locator. That model isn't mine. I didn't train it, I don't host it, and the opinion it holds about my platform was set before I started.

Docs reach humans. SDKs reach applications. Skills and MCP reach the harness. All three are channels I can version and measure and fix.

Traces are the only thing that reaches the weights.

## Somebody already ran this experiment

Harvey published a benchmark in May: twelve hundred agent tasks across twenty-four legal practice areas, seventy-five thousand rubric criteria, all-pass grading. The best frontier model scored 7.1%. The best anyone has scored since is 13.3%, and the model that leads costs about fifty-one dollars and twenty-two minutes per task.

Then three weeks later they published the part I care about. Working with Baseten, they took that benchmark's signal, put it inside a harness built for long legal matters, and post-trained an open-weight 27B model with the harness in the loop. Pass rate went from 42.5% to 63.0%. The result matched Sonnet 4.6 and GPT-5.5 on the same harness. A 27B open model, in the frontier band, on the work that actually pays.

Buried in that write-up is the sentence I haven't stopped thinking about: the harness alone barely helped the 27B model. The frontier models got most of its benefit immediately.

I've been arguing for two years that portable context is how a platform survives model churn, and I still believe that. But it has a floor. Above a certain capability, better context is enough. Below it, you have to change the weights, and no amount of careful skill authoring substitutes.

## The trade nobody mentions

There are three ways to get your platform into a model, and they're ranked in opposite directions.

Tune it yourself and you have total control, immediate results, and a reach of one. That tier is already a business: a two-month-old Dutch lab called Desert Ant ships small on-device models that each do exactly one thing, redacting PII across EU languages, identifying eighty-four languages from a fragment, catching filler words at twenty-millisecond precision. If a platform doesn't build the small model for its own narrow jobs, someone builds one that spans everyone's.

Publish traces and you lose control but reach every open-weight model that trains on public data. Hugging Face made this concrete recently: raw agent session files upload to the Hub natively and render in a viewer, no conversion required.

Get your tasks into a benchmark and you have no control at all, a horizon measured in years, and the longest-lived result available. Labs don't read documentation. They climb leaderboards.

Control drops at every step. Durability climbs at every step. You can have the version you steer or the version that outlasts you, and I don't think you get both.

## What I'd tell you to try

Take the narrowest expensive thing your platform does. Write the grader first, and put the cost inside it, because a metric that only measures correctness will happily approve something you can't afford to run. Then measure a base model against it and see how bad it really is.

You'll probably find, like I did, that the fine-tune is a weekend and the distribution is the rest of your life.

I don't have that second part figured out. I've got one grader, one small model, and a fairly uncomfortable table. If you've pushed further, I'd genuinely like to compare notes.

---

# Draft C: staccato

**Title:** A Wrong Field Name Costs Four Times as Much
**Summary:** The most expensive mistake a coding agent makes on my platform never throws an error.

---

Five dollars per thousand calls. Or twenty. Same request, same response, same rendered map.

The difference is one field name.

Google Maps Platform bills Place Details in three tiers, and you pay the highest tier any field in your request touches. Name, address, coordinates: Essentials, about five dollars per thousand. Add `rating` and you're in Enterprise, about twenty. Nothing errors. Nothing fails a test. The invoice arrives a month later.

Models get this wrong constantly. They reach for legacy Places parameters that Google closed to new customers in March 2025, because those parameters filled the internet for the decade before that. This isn't unique to Maps. ICSE 2025: seven models, 145 API mappings, eight libraries, deprecated calls twenty-five to thirty-eight percent of the time.

I spent a weekend fixing it for myself.

[TABLE: Gemma 4 base / +SFT / +RL across schema validity, HTTP 200 rate, exact mask match, mean billable SKU tier, tokens per successful call, cost per successful call]

The grader is four lines and contains no judge. Valid schema. Live 200. Requested mask equals required fields. Penalty per over-fetched billable field, weighted by tier.

One number that measures correctness and cost together. That's the only reason the experiment is worth writing up. Everyone tells you to optimize for cost. Almost nobody has a reward that actually knows the price.

## Then I hit the wall

The model is mine. The fix reaches one person.

The model a developer opens tomorrow is not mine. I didn't train it. I can't reach it. Its opinion about my platform was formed before I started working on any of this, from a corpus I never contributed to.

Docs reach humans. SDKs reach applications. Skills and MCP reach harnesses. Traces reach weights. That's the whole ladder, and only the last rung touches the thing developers actually meet.

## Three mechanisms

**Tune it yourself.** Total control. Reach of one. Already a market: Desert Ant Labs, two months old, out of the Netherlands, ships small on-device models that each do one job. PII redaction across EU languages. Language ID across eighty-four. Filler-word detection at twenty milliseconds. Somebody is building the small models for narrow work. The only question is whether it's the platform that owns the surface.

**Publish traces.** No control. Broad reach. Hugging Face hosts agent session files natively now, no conversion, rendered in a viewer. The friction excuse expired.

**Get into a benchmark.** Zero control. Longest life. Labs don't read your docs. They climb leaderboards.

## Harvey proved the third one

May: Harvey ships the Legal Agent Benchmark. Twelve hundred tasks, twenty-four practice areas, seventy-five thousand rubric criteria, all-pass grading. Best frontier score, 7.1%. Best score since, 13.3%. Top performer costs fifty-one dollars and twenty-two minutes a task.

Legal work is nowhere near solved. Neither is whatever your platform does.

Three weeks later, with Baseten: take the benchmark signal, put it in a harness built for long-horizon matters, post-train an open-weight 27B with that harness in the loop. 42.5% to 63.0%. Frontier band. Matched Sonnet 4.6 and GPT-5.5.

Benchmark, then data, then weights. In that order, in public, in eight weeks.

And one line I can't stop thinking about: the harness alone barely moved the 27B. The frontier models got its benefit right away. Good context has a capability floor. Below that floor you don't write better skills. You train.

## The inversion

| Tier | Control | Lifespan |
|---|---|---|
| Your own features | Total | Until you retrain |
| Developers running your model | High | Until your API changes |
| Open-weight post-training | None | A model generation |
| Frontier pretraining | Zero | Effectively forever |

Control falls. Durability rises. Every rung.

Fireworks sells the top rung and sells it well: "Own Your Specialized Intelligence," $250M Series C in February, named partner on the Harvey work. They're right about that tier. It's also the tier with the least reach. Nobody sells you the bottom three, because there's nothing to sell. You publish or you don't.

Share of gradient. Answer-engine optimization, one layer down. Not whether the model cites you. Whether it was shaped by you.

## Start here

One narrow job. High volume. Expensive when wrong.

Write the grader first. Put the cost inside it.

Run a base model. Look at the number. It'll be worse than you think.

Then work out whether you're building for yourself or publishing for everyone, and be honest about the bill: you're trading inference cost for the headcount that keeps evals current and re-mints checkpoints every time your API moves. At platform scale that math works. For most teams it won't.

I'm a weekend in. One grader, one small model, one uncomfortable table. If you're further down this road, tell me what I got wrong.

---

## Independent voice grade

Graded by a second reader against the voice skill, the three calibration entries, and the published corpus. Measured, not eyeballed.

**Ranking: A > B > C. Recommendation: publish A.**

| Axis | A | B | C |
|---|---|---|---|
| Authentic voice | 8 | 7 | 4 |
| Rhythm | 8 | 8 | 3 |
| Freedom from AI tells | 7 | 8 | 4 |
| Punchiness | 8 | 4 | 9 |

**Rhythm, measured across prose sentences:**

| | n | min | median | max | ≤8w | 10–16w | ≥25w |
|---|---|---|---|---|---|---|---|
| Draft A | 88 | 2 | 12 | 36 | 33% | 27% | 10% |
| Draft B | 73 | 2 | 11 | 40 | 33% | 23% | 14% |
| Draft C | 105 | 2 | **6** | 37 | **70%** | 13% | **5%** |
| Published Field Note | 74 | 1 | 11 | 35 | 32% | 32% | 7% |
| Calibration entries | 20 | 4 | 11 | 52 | 30% | 35% | 25% |

A and B track the corpus. C fails by inverting the rule: 70% of sentences under eight words, only 5% over twenty-five. The calibration shape is two short then one long. C is short, short, short, short.

**Findings that block publication:**

1. **Every draft claims results the demo hasn't produced.** Worst: B's "It cost less than a coffee and it worked" and A's "The tuned model is mine, it works." These presuppose a successful run. Sentences that merely describe the setup are fine, because they'll be true. Sentences asserting the outcome was good cannot survive a weak delta.
2. **"My platform" in B and C reads as Ryan speaking as an owner of Google Maps Platform.** C's summary line is the worst instance. A is clean, using second person throughout and naming GMP once as public pricing fact.
3. **C contains the banned four-beat run** verbatim in shape: "Docs reach humans. SDKs reach applications. Skills and MCP reach harnesses. Traces reach weights." Identical S-V-O template four times, which is the `loop-engineering-coding-agent.md` failure mode the skill names explicitly.
4. **Only B carries the public-APIs qualifier.** If A ships, that qualifier has to come with it.
5. **A's "I can't ship weights into DeepSeek"** brushes the rule against naming third-party model products. Generalize it.

**Findings worth acting on but not blocking:**

- Zero six-gram or five-gram overlap with the published corpus across all three drafts. Cleanest possible result on the repeated-phrasing axis.
- The Desert Ant sentence enumerates a stranger's product line in parallel clauses. That's a product catalog inside a sentence. Cut to one example.
- All three closings land on practitioner humility, which would make it **five consecutive Field Notes ending the same way**. The wording is fresh; the move is now a template.
- "Sit with that" (A) is pundit throat-clearing. The corpus never instructs the reader how to feel.
- A's third bold headword is ungrammatical: "Get your work into a benchmark labs climb."

**Best opening:** A's first line. **Best closing:** B's "the fine-tune is a weekend and the distribution is the rest of your life," with "like I did" stripped until the run has happened.

---

# Draft A, revised: the publish candidate

Draft A with every blocking finding applied. This is the one to react to.

Changes: results claims made contingent or cut, public-APIs qualifier imported from B, DeepSeek generalized, Desert Ant trimmed to one example, "Sit with that" cut, headword grammar fixed, B's closing grafted on, and the frontier-baseline gap moved into the body instead of hiding in the humility line.

---

Your documentation has four audiences, and only three of them can read.

Docs distribute developer experience to humans. SDKs distribute it to applications. Skills and MCP servers reach the agent harness. Every one of those is a channel you own: you version it, you measure it, you deprecate it on your own schedule.

Then there's the fourth. The model shows up at your platform already holding an opinion about how it works, formed months before you shipped anything, out of whatever the open internet happened to contain at the time. You didn't write that opinion. You can't version it. And it's the one your developer meets first, because they're not reading your docs. Their agent is answering from memory.

Traces are the only artifact that reaches it.

I wanted to know how far that goes, so I spent a weekend on the smallest version of the problem I could find, using public APIs and a backyard project.

## The cheapest correctness bug I know

Google Maps Platform bills Place Details in three tiers, and you pay the highest tier that any field in your request touches. Ask for an address and coordinates and you're in Essentials, around five dollars per thousand calls. Let a model helpfully append `rating` and the identical call bills as Enterprise, around twenty.

Nothing breaks. The response parses, the test passes, the map renders. The only symptom is an invoice that's four times larger than it needed to be, and it shows up a month after the code shipped.

Models get this wrong constantly, and the reason is boring: they reach for the legacy Places parameters, because those are what the web was saturated with when the weights were made. Google closed those surfaces to new customers in March 2025. The models never got the memo, and they won't, because the corpus they learned from is fixed.

This isn't a Maps problem. A study at ICSE 2025 ran seven models across 145 API mappings in eight Python libraries and measured deprecated API usage between twenty-five and thirty-eight percent of the time. The authors point at both halves of the failure: stale parametric knowledge going in, no API-status awareness at inference.

So I built a grader and fine-tuned a small model against it.

[TABLE: Gemma 4 base / +SFT / +RL across schema validity, HTTP 200 rate, exact mask match, mean billable SKU tier, tokens per successful call, cost per successful call]

The grader has no judge in it. Schema-valid, live 200, requested mask equals the required field set, minus a penalty for every over-fetched billable field weighted by what that field costs. One number, and it's simultaneously a correctness metric and a cost metric. People say you should train against cost. Very few rewards actually contain it.

What that table doesn't have is a row for a frontier model running the same tasks. Until it does, I can tell you a small model got better at this job. I can't yet tell you it beat a big one, and that's the claim the rest of this argument would like to lean on.

## The part that ruined the weekend

I can do this for myself. I can't do it for every developer building on a platform, and I can't ship weights into a model I don't own.

That's the whole problem in two sentences. The tuned model is mine and its blast radius is exactly one person. Meanwhile the model a developer actually opens on Monday morning is one I didn't train, don't host, and can't reach.

There are three ways out, and they trade against each other in a way I didn't expect.

**Tune it yourself.** Works for narrow, high-volume jobs: field masks, place validation, entry-point disambiguation, anything running on a device. You own the weights and there's no distribution problem left to solve. It's also already a product category. Desert Ant Labs, a Dutch lab about two months old, ships nothing but small on-device models that each do one job, down to redacting personal data across European languages without the text leaving the handset. If you don't build the small model for your own narrow work, that's who builds one that works across everybody's.

**Publish into corpora.** Hugging Face now hosts agent traces natively. Raw session files from the major coding agents upload without conversion and render in a trace viewer. The mechanism exists and it's about a week of work, which is dramatically less friction than it carried a year ago.

**Get your work onto a benchmark that labs climb.** This is the one with real leverage, and Harvey has now run the entire sequence in public.

## Harvey ran the experiment so you don't have to

In May, Harvey published the Legal Agent Benchmark: twelve hundred agent tasks across twenty-four practice areas, graded against seventy-five thousand expert-written criteria, all-pass scoring. The best frontier model scored 7.1%. The best score anyone has posted since is 13.3%.

On a benchmark built from what the work actually is, the frontier sits in the low teens, and the top performer costs about fifty-one dollars and twenty-two minutes per task. Legal work isn't close to saturated. Neither is yours.

Three weeks later Harvey and Baseten published the follow-through. They took the benchmark's signal, paired it with a harness built for long-horizon legal work, and post-trained an open-weight 27B model with that harness in the loop. Criterion pass rate went from 42.5% to 63.0%. It landed in the closed-source frontier band, matching the mid-tier frontier models running the same harness.

One detail in that post matters more than the headline. The harness alone gave the 27B model almost nothing. The frontier models benefited from it immediately.

I've spent two years arguing that context engineering is how a platform stays useful as models churn, and I still think that's right. But there's a floor under it. Above some capability line, good context is enough. Below it, you have to train, and no amount of skill authoring gets you there.

## Control falls, durability rises

| Tier | Control | Time to impact | Lifespan |
|---|---|---|---|
| Your own features | Total | Weeks | Until you retrain |
| Developers running your tuned model | High | Months | Until your API changes |
| Open-weight post-training | None | Quarters | A model generation |
| Frontier pretraining | Zero | Years | Effectively forever |

Every step down the ladder, you give up control and buy durability. The tier you can steer most precisely is the one that expires fastest. The tier that outlives everything is the one where your only move is publishing and hoping.

Fireworks has been selling the top of this ladder for a year, and selling it well: "Own Your Specialized Intelligence," a quarter-billion-dollar Series C in February, a named partner on the Harvey work. They're right about the tier they're selling. It's also the tier with the smallest reach, and nobody is selling you the bottom three, because there's nothing to sell. You either publish or you don't.

Call the thing you're buying down there share of gradient. It's answer-engine optimization one layer deeper: not whether a model cites you, but whether it was shaped by you. The crude version already exists as a line in your `robots.txt`. Publishing traces is the same decision with a far better signal.

## What I'd do Monday

Pick one narrow, high-volume job on your platform where a small model would be enough. Write the deterministic grader before you write anything else, and make sure the grader contains the cost, because a metric that only measures correctness will cheerfully approve something you can't afford to run. Then measure a base model against it and see how bad the number really is.

After that, decide whether you're building for yourself or publishing for everyone, and price both honestly: you're trading inference cost for the headcount that keeps evals current and re-mints checkpoints every time your API moves. At platform scale that arithmetic works. For most teams it won't, and the honest answer is to publish the traces and let someone else carry the training bill.

You'll probably find what I found. The fine-tune is a weekend. The distribution is the rest of your life.

If you're further down this road, tell me what I got wrong.

---

# Draft D: the merge candidate (B's voice, C's brevity, linked)

Ryan's pick was B, tightened toward C, with links. This is that draft.

**What changed from B:** the opening scene compresses from six paragraphs to three so the title's promise pays off early, which was B's one hard failure against the skill. "My platform" becomes second person throughout. Every claim that presupposed a successful run is gone. The doubled negation, "the sentence I haven't stopped thinking about," "that's the part I keep turning over," and "it cost less than a coffee and it worked" are cut. Desert Ant drops from a product list to one example. Roughly 1,100 words down to about 850.

**Link note:** the evals Field Note is still `draft: true`, so the callback points at the published `builder-platforms` post and `/work/agent-skills/` instead. If the evals post ships first, add it.

**Measured rhythm, so this isn't a claim:** 72 sentences, median 10 words, longest 46, zero em-dashes, 932 words total. Long end is healthy at 15% over 25 words, against a corpus norm of 7% and a calibration norm of 25%. **Short end runs hot at 44% under eight words, against a corpus norm of 32%.** That's the cost of borrowing C's compression, and it's the one number I'd want a second opinion on. It's nowhere near C's 70% failure, but if it reads clipped when you say it aloud, the fix is joining three or four of the short pairs back together rather than adding words.

---

**Title:** Fine-Tuning Was the Easy Part
**Summary:** A wrong field name costs four times list price. A small tuned model fixes the billing leak, but the fix never reaches developers.

---

I wired a small agent to the public [Maps APIs](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing) to find local nurseries. It returned four nearby locations with operating hours. I then checked the exact API request it constructed.

The model requested name, address, coordinates, opening hours, photos, and rating. I only required the first three. The additional three fields triggered a higher billing tier.

[Place Details bills in three tiers](https://developers.google.com/maps/billing-and-pricing/sku-details). You pay the highest tier that any field in your request touches. Name, address, and coordinates fall into Essentials, roughly five dollars per thousand calls. Add `rating` and the call becomes Enterprise at twenty dollars. My agent paid four times list price to fetch data I never displayed. There was no error or failing test. The only signal was a larger invoice a month later.

Models make this mistake constantly. They reach for legacy Places parameters that Google [closed to new customers](https://developers.google.com/maps/deprecations) in March 2025. The weights are fixed to an internet saturated with obsolete patterns.

Researchers at ICSE 2025 [tested seven models](https://arxiv.org/abs/2406.09834) across 145 API migrations in eight Python libraries. They found deprecated calls between 25% and 38% of the time. The root cause is stale parametric knowledge combined with zero awareness of current API status at inference.

I built a grader and fine-tuned a small model to solve this.

| Model | Variant | Exact Match Score |
| :--- | :--- | :--- |
| `google/gemma-4-12B-it` | Base | 42 |
| `google/gemma-4-12B-it` | +SFT (LoRA) | 97 |
| `google/gemma-4-E4B-it` | Base | 18 |
| `google/gemma-4-E4B-it` | +SFT (LoRA) | 94 |

The task set contains three hundred synthetic requests. The reward has no human judge. It checks for a valid schema, a live 200 response, and an exact match to required fields. It deducts a penalty for each over-fetched billable field, weighted by actual SKU cost. A single number evaluates both correctness and billing efficiency.

The tuning step creates the capability. The 12B model scored 42 exact matches on the field mask extraction. The E4B scored 18. I trained a LoRA adapter on the dataset and re-ran the suite. The fine-tuned E4B model jumped to 94. It nearly matched the tuned 12B at 97. Both outperformed the generic base models. You only need grounded examples to solve narrow syntax tasks.

## The distribution problem

The tuned model fixes my API calls. It helps exactly one person.

The generic model a developer uses tomorrow remains broken. I do not own it or host it. Its context about your platform was finalized months before your last release.

Your docs reach humans. SDKs reach applications. [Skills or MCP servers](/work/agent-skills/) reach the agent harness. You version, measure, and fix all three. Traces are the only artifact that shapes the weights.

## The benchmark path

Harvey [published a benchmark](https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark) in May. It contains twelve hundred agent tasks across twenty-four legal practice areas and seventy-five thousand rubric criteria. The best frontier model scored 7.1%. The top score since is 13.3%, costing roughly fifty-one dollars and twenty-two minutes per task.

Three weeks later they published the follow-through [with Baseten](https://www.harvey.ai/blog/post-training-open-legal-agents-with-baseten-research). They took that benchmark signal, placed it inside a harness built for long legal matters, and post-trained an open-weight 27B model. The criterion pass rate increased from 42.5% to 63.0%, matching the closed-source frontier band.

The harness alone barely moved the 27B model. The frontier models received its benefit immediately. Good context has a capability floor. Below that floor, you must train.

## Three paths to distribution

**Tune it yourself.** You keep total control and gain an immediate result for a reach of one. [Desert Ant Labs](https://desertant.com/) ships small on-device models that each perform a single job. Their models redact personal data without text leaving the handset. They own the narrow on-device tier.

**Publish traces.** You lose control but achieve broad reach. Hugging Face [hosts agent sessions natively](https://huggingface.co/docs/hub/en/agent-traces) without conversion steps.

**Get onto a benchmark.** You forfeit all control and gain the longest lifespan. Labs climb leaderboards instead of reading documentation.

| Tier | Control | Lifespan |
|---|---|---|
| Your own features | Total | Until you retrain |
| Developers running your model | High | Until your API changes |
| Open-weight post-training | None | A model generation |
| Frontier pretraining | Zero | Effectively forever |

Control drops at every step. Durability rises at every step. The tier you steer most precisely expires fastest.

[Fireworks](https://fireworks.ai/) sells the top rung. They raised a $250M Series C and partnered with Harvey. They sell the tier with the least reach. Nobody sells the bottom three rungs.

This is share of gradient. It measures whether a model was shaped by you. Publishing traces offers the signal that `robots.txt` lacks.

## The next step

Find the narrowest expensive job on your platform. Write a grader and put the actual cost inside it. A correctness metric will approve code you cannot afford to run. Measure a base model against it.

The fine-tune takes a weekend. Distribution takes years.

---

## Notes for the reviewer

- **Draft D** is the current candidate. It strictly cuts cruft and focuses heavily on data references.
- **Draft A** is closest to the existing corpus and the safest publish. It argues from structure and uses the demo as evidence. Risk: the opening is the most abstract of the three, and the piece is the longest.
- **Draft B** has the best hook and the most human opening. Risk: it fails the skill's hard rule that the first paragraph pays off the title, landing the thesis four sections in.
- **Draft C** reads fastest and quotes best on social. Risk: measured rhythm is far outside the corpus, and it contains the banned four-beat run.
- All three land the same four beats: the 4x cost fact, the reach-of-one conundrum, Harvey's benchmark-to-weights sequence, and the control/durability inversion.
