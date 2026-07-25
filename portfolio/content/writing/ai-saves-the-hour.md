---
title: AI Saves the Hour. Leaders Spend It.
summary: The hour AI gives back arrives on its own. Where it goes is a decision somebody makes, and most teams spend it on more of the same work without ever choosing to.
date: 2026-07-22
updated: 2026-07-25
canonical: https://ryanbaumann.dev/writing/ai-saves-the-hour/
image: /img/writing/ai-jagged-frontier.svg
imageAlt: Inside the jagged frontier the same AI tool made consultants faster and better; on a task just outside it, the same tool made them worse.
socialImage: /social/ai-saves-the-hour.jpg
shareTitle: Your Team Just Got an Hour Back
shareSummary: The savings are automatic. The reinvestment is a decision somebody has to make on purpose.
shareImageAlt: A social card showing one hour saved by AI branching toward more requested output or toward more capability.
tags: ["ai", "product", "field notes"]
draft: true
noindex: true
---

"We shipped it in a morning instead of a week."

I hear some version of that constantly now, and it's usually true. My team lives it. What almost nobody talks about is the rest of the week.

The savings show up on their own. Where they go doesn't.

Before you can spend a gain you have to be sure you got one, which turns out to be harder than it sounds. In a [preregistered study with 758 BCG consultants](https://www.hbs.edu/ris/Publication%20Files/dell-acqua-et-al-2026-navigating-the-jagged-technological-frontier_5c589c8c-fbb5-458f-b285-c944746cd717.pdf), the group using GPT-4 finished faster and produced better work across a set of tasks the model handled well. On a business problem sitting just outside that set, the same tool made them worse. The researchers call this the jagged technological frontier, which is a good name for the thing where a model is excellent at one task and confidently wrong about the one sitting right next to it.

The uncomfortable part isn't that the frontier exists. It's that you can't see the edge from inside the task.

Running Developer Experience Engineering for Google Maps Platform, the only answer my team has found that holds up is to go measure it. We build task-based [evals](/work/agentic-evals/) for our AI context products and score each launch against a no-context baseline, because the delta is the part that tells the truth: it says whether what we shipped actually made an agent better at building with us, or whether it just performed well in a room. A convincing demo says almost nothing about where the frontier moved. When a score drops, somebody opens the trace and reads for the first wrong decision.

That work is unglamorous and it is the bar. You don't get to skip it and still claim the hour.

Say you do it, and the hour is real. Now what?

The default requires no decision at all, which is exactly why it wins. The hour becomes more requested output. Ten more drafts, ten more tickets, the same work at higher volume, and a quarter later everyone is just as busy and no better.

![An hour saved by AI can become more requested output by default, or be reinvested in customers, harder problems, direct feedback, and judgment.](/img/writing/ai-saved-hour-spend.svg)

The other option costs something, which is the whole reason it needs a leader. Put somebody in front of a customer. Hand them the problem with no known answer. Let them make a call on incomplete information, own it, get told directly that it was wrong, and go again.

That's how judgment gets built and there's no compressed version of it. Automate every slow, hard, faintly unpleasant task and you'll produce more while developing nobody.

There's some evidence the two skills are one skill. A [lab study](https://www.nber.org/papers/w33662) found that people who led AI agents well also tended to lead human teams well, and the correlation was strong. What separated them was ordinary: they asked more questions and did more back-and-forth. Not a new management technique. The old one, pointed at a new kind of teammate.

I've been getting the slow version of this lesson at home. At 2 a.m. with a daughter there is no measurable output, unless diapers count. You repeat yourself, stay patient, fail at staying patient, and show up again the next night. Teams need some version of that: set the bar, push when it's needed, listen, and believe in somebody a little before the spreadsheet makes it obvious.

I learned the first half of this before I ever wrote software. In 2009 I finally [saw 400 watts on the computer](https://racewithryanbaumann.blogspot.com/2009/08/racing-has-nothing-to-do-with.html), 53 minutes of it, on the state time trial course in pouring rain, on my road bike, because I was sure the number was the thing worth chasing. Busche and Bean each put more than two minutes into me. They'd brought the right equipment for the course. I'd brought a statistic I was proud of.

The year I actually got faster was the year [Axel Merckx ran our Trek-Livestrong team](https://racewithryanbaumann.blogspot.com/2009/02/santa-rosa-camp-recap.html) with Belgian humor, real friendship, and the occasional verbal smackdown. He couldn't pedal the bike for us. What he could do was get a group of young bike racers to quit racing like a group of young bike racers.

So use AI. Give it real work, measure the delta, and go find out exactly where it falls on its face. Then ask the question no productivity number will answer for you: what did we do with the hour? Did somebody make a better call, did the customer get something better, did anyone on the team learn a thing that stays true after the model changes?

The model changes every few months. How we spend what it hands back is a decision we make over and over, and it's still ours.
