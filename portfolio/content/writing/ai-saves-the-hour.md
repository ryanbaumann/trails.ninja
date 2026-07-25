---
title: When the Answer Gets Cheap, the Question Becomes the Job
slug: ai-saves-the-hour
summary: Cheap simulation ate the middle of mechanical engineering in 2009 and left behind the constraint, the case selection, and the confidently wrong result. AI is running the same play, and the hour it hands back belongs to judgment and to time with users.
date: 2026-07-22
updated: 2026-07-25
canonical: https://ryanbaumann.dev/writing/ai-saves-the-hour/
image: /img/writing/ai-judgment-shift.svg
imageAlt: Before the tool, most engineering time went to running the cases and a little to judgment; after the tool, the proportions invert.
socialImage: /social/ai-saves-the-hour.jpg
shareTitle: The Tools Ate My Job Once Already
shareSummary: CAD and CFD compressed mechanical engineering in 2009. What survived was judgment, and AI is compressing the same layer now.
shareImageAlt: A social card showing the mechanics of engineering work shrinking and judgment expanding to fill what the tool left behind.
tags: ["ai", "product", "field notes"]
draft: true
noindex: true
---

The machine room was warm at seven in the morning, which is how you knew the solve had run all night. Ten hours of compute, and an answer you could read in four minutes if it was ugly and all morning if it was pretty.

Pretty was the dangerous one. I'd be at the monitor with a senior engineer behind me, contour plot up, colors clean, the whole thing looking like an answer. He never looked at the colors first. He'd ask where the load actually entered the part, and whether the fixture I'd modeled as rigid was rigid out in the shop, which it often wasn't.

That was 2009, straight out of school, right as CAD, CFD, and cheap virtual simulation ate the middle of the job. Running cases by hand, checking one assumption at a time, grinding through scenarios to find the one that broke: that had been the work, and it shrank to an afternoon of setup and a night of compute.

The job didn't get smaller. It moved up.

What was left was harder to see from outside. Define the constraint. Choose which cases are worth running, then read a clean output and know when it's lying to you. A mesh can be beautiful and meaningless, and the engineers who got good could sense the wrongness in a gorgeous converged result and go find the assumption that had walked away from the physics.

Those three had always been the job. You just couldn't see them, because when a case took a week, choosing it looked like part of the week. Take the week away and the choosing stands by itself. Nobody had measured it, so nobody had staffed it.

AI is running the same play on knowledge work, compressing the middle and handing back the constraint and the call. Which makes the tool's edges matter more than its average. In a [study of 758 consultants](https://pubsonline.informs.org/doi/10.1287/orsc.2025.21838), the same AI made people better on the tasks it fit and worse on one that sat just past the edge. The researchers named that boundary the jagged frontier. Simulation had one too, and output reads with the same confidence on both sides.

![The same tool made consultants better on tasks inside the jagged frontier and worse on one just outside it, with the boundary between them unmarked.](/img/writing/ai-jagged-frontier.svg)

My team's answer is to go measure where the edge is. We build task-based [evals](/work/agentic-evals/) and score each launch next to a no-context baseline, because the delta is the one number that survives a model update underneath us. When a score drops, somebody pulls the trace and walks to the first wrong decision, usually quieter and earlier than the step that produced the bad answer. That's the senior engineer asking about the fixture, run on a schedule.

Measurement is one half. The other won't fit in a dashboard: hours inside the system, beside the people using it. A constraint isn't a fact you look up. It's a judgment about which of several true things is actually binding, and you get there by sitting with somebody long enough to see which wall they hit twice and how one piece of their workflow keeps taxing another. Miss that and AI walks you to the wrong product in half the usual time.

So the hour lands on your calendar. Unclaimed.

Nobody decides, which is exactly why the default wins. The hour turns into volume: more drafts, more tickets, and a quarter later the team is just as busy and no better at the hard part. A default is still a choice, just one nobody had to defend.

Claiming it costs something. Sit an engineer beside a customer for an afternoon, with a problem nobody has the answer to yet. Make them name the constraint, own the call, be wrong in front of people who will remember it, and run it again. That slowness buys an engineer who can tell a good answer from a confident one.

I'm relearning it slowly at home. At 2 a.m. with an infant daughter nothing you do has a measurable output, and you show up anyway.

I don't know where the frontier sits for what we ship next quarter, and I expect it to move. So give AI real work, watch the delta, and hunt for the task where it comes apart. Then spend what comes back on the two things that never got cheap: naming the right constraint, and the time beside the people you build for.

The middle keeps getting cheaper. The mesh still won't tell you it's wrong.
