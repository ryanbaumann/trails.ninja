---
title: AI Saves the Hour. Spend It on Judgment.
summary: Simulation moved mechanical engineering up to judgment in 2009. AI is doing the same thing now, and the hour it gives back belongs to defining the constraint and sitting in the system with your users.
date: 2026-07-22
updated: 2026-07-25
canonical: https://ryanbaumann.dev/writing/ai-saves-the-hour/
image: /img/writing/ai-judgment-shift.svg
imageAlt: Before the tool, most engineering time went to running the cases and a little to judgment; after the tool, the proportions invert.
socialImage: /social/ai-saves-the-hour.jpg
shareTitle: Simulation Already Did This to Engineering
shareSummary: CAD and CFD ate the middle of the job in 2009. What was left was judgment, and AI is running the same play.
shareImageAlt: A social card showing the mechanics of engineering work shrinking and judgment expanding to fill what the tool left behind.
tags: ["ai", "product", "field notes"]
draft: true
noindex: true
---

"We shipped it in a morning instead of a week."

I hear some version of that constantly now, and it's usually true. The savings show up on their own. Where they go doesn't.

I've watched this shift happen once already, from inside it. I came out of school into mechanical engineering in 2009, right as CAD, CFD, and cheap virtual simulation were changing the job day to day. Work that had *been* the job, running the cases by hand, checking assumptions one at a time, grinding through scenarios to see which one broke, collapsed into something you set up in an afternoon and ran overnight.

The work didn't disappear. It moved up.

What was left was harder and much less visible. Define the constraint correctly. Decide which scenarios actually matter. Read the output with enough intuition to catch the moment the simulation is confidently wrong, because a mesh can be beautiful and meaningless, and the engineers who got good were the ones who could look at a clean result, feel that something was off, and go find out why.

That's the same job now. AI compresses the middle and hands you back the constraint and the call.

Which is why knowing where the tool is unreliable stopped being optional. In a [study with 758 consultants](https://pubsonline.informs.org/doi/10.1287/orsc.2025.21838), the same AI helped on the tasks it suited and hurt on one sitting just outside them. The researchers named that boundary the jagged frontier. Simulation had its own version, and the lesson carries over intact: you can't see the edge from inside the task, so you have to go check.

![The same tool made consultants faster and better inside the frontier and worse on a task just outside it, and the boundary between them is unmarked.](/img/writing/ai-jagged-frontier.svg)

My team checks by measuring. We build task-based [evals](/work/agentic-evals/) and score each launch against a no-context baseline, because the delta is the part that tells the truth about whether we made an agent better at building with us. When a score drops, somebody opens the trace and reads for the first wrong decision.

The other half is where I think most teams underspend, and it's the part I care most about: time in the system with the people using it. A constraint is not something a model hands you. It comes from watching somebody hit the same wall for the third time, understanding what they're really optimizing for, and seeing how the pieces of their workflow push on each other. Get that wrong and AI will help you build the wrong thing faster than anyone has ever built the wrong thing.

So the hour comes back. Then what?

The default takes no decision at all, which is exactly why it usually wins. The hour becomes more requested output. Ten more drafts, ten more tickets, the same work at higher volume, and a quarter later everyone is just as busy and no better.

Spending it on purpose costs something. Put somebody in front of a user. Hand them the problem with no known answer. Let them set the constraint, make the call, be wrong where people can see it, and go again. That's how engineering judgment gets built, and there's still no compressed version of it.

I'm getting the slow version of the same lesson at home. At 2 a.m. with a daughter there's no measurable output, and you show up anyway, because showing up is the thing that builds the thing you actually want.

So use AI. Give it real work, measure the delta, go find out where it falls on its face. Then spend what it gives back on the two things it won't do for you: the judgment to set the right constraint, and the hours in the system with the people you're building for.

The tools will keep getting better at the middle. The ends are still ours.
