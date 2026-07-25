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

I started in mechanical engineering in 2009, straight out of school, right as cheap virtual simulation landed alongside CAD and CFD and the tools ate the middle of the job. Running cases by hand, checking one assumption at a time, grinding through scenarios to find the one that broke: that had been the work, and it shrank to an afternoon of setup and a night of compute.

The job didn't get smaller. It moved up.

What was left was harder to see from outside. Define the constraint. Choose which cases are worth running, then read a clean output and know when it's lying to you. A mesh can be beautiful and meaningless, and the engineers who got good could take a converged result, sense the wrongness in it, and hunt down the assumption that had quietly walked away from the physics.

Those three had always been the job. You just couldn't see them, because when a case took a week, choosing it looked like part of the week. Take the week away and the choosing stands there by itself. Nobody had measured it, so nobody had staffed it.

AI is running the same play on knowledge work: it compresses the middle and hands back the constraint and the call.

Which makes the tool's edges matter more than its average. In a [study of 758 consultants](https://pubsonline.informs.org/doi/10.1287/orsc.2025.21838), the same AI made people better on the tasks it fit and worse on one that sat just past it. The researchers named that boundary the jagged frontier. Simulation had one too. Output reads with the same confidence on both sides, so the answer will never tell you which side you're on.

![The same tool made consultants better on tasks inside the jagged frontier and worse on one just outside it, with the boundary between them unmarked.](/img/writing/ai-jagged-frontier.svg)

My team goes and measures where the edge is. We build task-based [evals](/work/agentic-evals/) for our AI context products, score each launch next to a no-context baseline, and trust the delta, because it's the one number that survives a model update underneath us. When a score drops, somebody pulls the trace and walks forward to the first wrong decision, which is rarely the step that produced the bad answer and usually the earlier, quieter moment the agent settled on what it was confident about.

Measurement is one half. The other is the half most teams underspend, and it won't fit in a dashboard: hours inside the system, beside the people using it. A constraint isn't a fact you look up. It's a judgment about which of several true things is actually binding, and you get there by sitting with somebody long enough to see which wall they hit twice, what they're really optimizing for underneath the request, and how one piece of their workflow keeps taxing another. Miss that and AI will walk you to the wrong product in half the usual time.

So the hour lands on your calendar. Unclaimed.

Nobody decides, which is exactly why the default wins. It costs nothing to choose: no argument in a planning review, no line on a roadmap. The hour turns into volume, and a quarter later the team is every bit as busy and no better at the hard part.

Claiming it costs something. Sit an engineer down beside a customer for an afternoon. Give them a problem nobody has answered yet. Make them name the constraint, own the call, be wrong in front of people, and run it again. The first few rounds go slower than handing the same problem to a model, and that slowness is the price of an engineer who can tell a good answer from a confident one. There's no overnight run for it.

I'm relearning the same thing slowly at home. At 2 a.m. with an infant daughter nothing you do has a measurable output, and you show up anyway.

I don't know where the frontier sits for what we ship next, and I expect it to move. The mechanism is the part I'd bet on, having watched it run once. So give AI real work, watch the delta, and hunt for the task where it comes apart. Then spend what comes back on the two things that never got cheap: naming the right constraint, and the time beside the people you're building for.

The middle keeps getting cheaper. The mesh still won't tell you it's wrong.
