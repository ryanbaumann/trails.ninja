---
title: Can I Build an AI Agent That Doesn't Write Slop?
summary: I trained a 26B model on my own writing, on my own laptop, to find out. It learned my headings, my verbs, and my rhythm. It also handed back an edit that changed nothing and invented a paper link that does not exist. Register transferred. Judgment did not.
date: 2026-08-15
updated: 2026-08-15
canonical: https://ryanbaumann.dev/writing/can-i-build-an-ai-agent-that-doesnt-write-slop/
aliases: ["/writing/why-i-fine-tuned-a-26b-model-on-my-laptop-instead-of-prompting-frontier-apis/"]
tags: ["ai", "evals", "field notes"]
draft: false
noindex: false
image: /img/writing/can-i-build-an-ai-agent-that-doesnt-write-slop-header.svg
imageAlt: "Code ships into free graders: a compiler, a type checker, a test suite, and a runtime, all of which reject bad work in seconds. Prose ships into none of them. Its only grader is the person reading it."
socialImage: /social/can-i-build-an-ai-agent-that-doesnt-write-slop.jpg
shareTitle: Can I Build an AI Agent That Doesn't Write Slop?
shareSummary: I fine-tuned a 26B model on my own writing to find out. It picked up my headings and my rhythm, then returned an edit that changed nothing and cited a paper that does not exist. Here is where that leaves the human.
shareImageAlt: A share card asking whether a fine-tuned local model can stop writing slop, set against the answer that register transferred and judgment did not.
---

Nobody argues that AI copy is good on the first pass. It is fluent, confident, on topic, and empty. What people do argue is that a human editor fixes that: hand the model your notes, get back something generic, spend twenty minutes cutting adjectives and putting your syntax back, and you end up with a decent post.

Fine. But does that actually beat writing it myself? Or writing the draft cold and using the model only at the end, as a grammar and consistency pass? I have run it both ways for about a year and I am still not certain.

So I built the strongest version of the idea I could build alone. I trained a model on my own published writing, ran it entirely on my laptop, and checked whether the copy that came out needed less of me. Here is what actually happened.

## Prose has no compiler

Before the results, the thing that makes this harder than it looks from the coding-agent side.

When an agent writes code, machines grade it. The compiler rejects it, the type checker rejects it, the tests go red, the service throws in staging. Most of the code in any real system is never read directly by a person; it is read by a runtime, and that runtime is a fast, brutally honest reviewer. That is a large part of why coding agents got useful so quickly. They ship into a world already full of free graders.

Prose has none of that. A paragraph does not compile and never gets executed. It has exactly one consumer, a person, and the only test that matters is whether that person keeps reading and believes what they read. Documentation gets partway to a grader, because a reader can follow the steps and discover the API call fails. A Field Note does not even get that far. The output is the experience.

So the taste bar for writing sits higher than it does for docs or for most code, and it cannot be handed off the way a test suite can. That is not a temporary gap waiting on a better model. It is a property of the artifact.

## What "not slop" has to mean before you can test it

I cannot measure "sounds like me." I can measure a thin slice of it, so I wrote that slice down as four checks that run on every post on this site: no em-dashes, no announcement phrasing, no hype adjectives, and no distinctive six-word phrase repeating across three or more entries. They live in [`scripts/lib/content-rules.mjs`](https://github.com/ryanbaumann/fieldwork/blob/main/scripts/lib/content-rules.mjs) and run with `npm run check:content`.

The last one exists because of a mistake I made. My own writing guide prescribed example phrasings, and those examples became the most repeated lines on the site. A rule written to protect voice manufactured boilerplate instead.

![Four mechanical checks stand as gates on the left: em-dashes, announcement phrasing, hype adjectives, and repeated stock phrases. On the right, four questions that stay with a person: whether the opening lands on real friction, whether the number is real, whether the credit is honest, and whether the piece should exist. The two never combine into one score.](/img/writing/can-i-build-an-ai-agent-that-doesnt-write-slop-gates.svg)

Four regexes catch the tells. They cannot tell me whether the opening lands on real friction, whether a number is real, whether the credit is honest, or whether the piece should exist at all. Those stay with me, unweighted and unaveraged, because the moment I turn them into a score I will start writing for the score.

## Prompting gets close, then stops

I spent months on the prompting side first. Style guidance in context, few-shot examples pulled from published posts, explicit rules against the habits I hate. Then multi-agent loops: three drafts generated in parallel from different angles, an independent judge scoring them against a voice rubric, a synthesis pass over the winner. Each step helped a little.

Each step hit the same wall. Hosted models are trained to be agreeable, and agreeable prose is flat. Suppress one tell and the model finds another: uniform paragraph lengths, tidy connective tissue, every sentence landing near fifteen words. You can prompt against a specific habit. You cannot prompt against a center of gravity.

## The research points at fine-tuning, with a caveat I read too fast

Chakrabarty, Ginsburg, and Dhillon ran this experiment properly in [Readers Prefer Outputs of AI Trained on Copyrighted Books over Expert Human Writers](https://arxiv.org/abs/2510.13939). It is preregistered: 50 award-winning authors, MFA-trained writers, and three frontier models each producing excerpts in an author's style, judged blind in pairs by 28 MFA-trained readers and 516 general readers.

Prompting lost badly. MFA readers disfavored the prompted model on stylistic fidelity at an odds ratio of 0.16. Fine-tuning on an author's complete works reversed the result: the same readers then favored the AI at an odds ratio of 8.16, and detectors flagged only 3% of the fine-tuned outputs against 97% of the prompted ones. Median cost to tune one author: $81.

Then the sentence I skimmed the first time. The authors note their result does not account for the effort of turning AI output into publishable prose. That effort is the entire question I started with.

## Four rounds on a laptop

I trained LoRA adapters on Gemma 4 26B-A4B, quantized to 4 bits, using MLX on an M4 Pro. Everything stayed on the machine, which matters when the training data includes drafts I have not published. The dataset came out of my own posts and case studies, sliced into paragraph-level pairs across four jobs: rewrite this, draft this, critique this, title this.

Round one memorized the scaffolding instead of the style. Asked to rewrite a line, it handed the line straight back with the task tag still attached. Training on the answer rather than the whole conversation stopped the echo and cut memory enough that examples stopped getting truncated. Round two overtrained and started looping. Round three backed off the learning rate and landed somewhere sane. Round four used a couple hundred paragraph pairs and the model's own chat format.

## Round four, honestly

Six [held-out prompts](https://github.com/ryanbaumann/fieldwork/blob/main/experiment/voice-ft/eval/results/round4_results.json), none of them in training. Here is what came back.

The rewrite test:

```text
Input
Our engineering team has deployed an innovative
solution to enhance system availability.

Output
## The result

We just shipped an innovative solution to enhance
system availability.
```

It learned my section heading and my verb. It left the buzzword sitting in the middle of the sentence. The edit did not edit.

The critique test went well, then fell over. It correctly named the AI tropes in a bad opening, the missing contractions, and the missing structure. Then it wrote "here is how I would rewrite it in Ryan's voice:" and pasted the input back, word for word.

The headline test learned the shape and lost the meaning. Asked for variants on an article about prompting hitting a ceiling, it returned lines like:

> what happens when prompt engineering hits an RLHF ceiling breaks

That is my title pattern with the topic string dropped into the slot.

The draft test looped, repeating a sentence about vocabulary size twice in one paragraph and misspelling "doesn't" as "doesn's". The talk outline invented a citation: a link to `arxiv.org/abs/24606.24282`, an ID that does not resolve to anything.

Register transferred. Judgment did not.

![Six held-out prompts run against the fine-tuned adapter. All six carried the right register, with zero em-dashes and zero invented percentages. Five failed on judgment instead: an edit that changed nothing, a critique that pasted the input back, headlines that were templates, a looping draft, and a citation that does not exist.](/img/writing/can-i-build-an-ai-agent-that-doesnt-write-slop-heldout.svg)

The adapter learned my surface. All six outputs came back with zero em-dashes and zero invented percentages, which are exactly the two failures I had trained hardest against, and they carried my headings, my verbs, and my sentence shapes. What it did not learn is that an edit has to change something, that a sentence has to end, or that a source has to exist. That last one is disqualifying. A linter catches a hype adjective in a second. Nothing catches a plausible arXiv link except a person clicking it.

## What survived

The tune has promise and it is not a silver bullet. Two jobs came out of this that I still run, and both keep a person in the loop by design.

**Rough first drafts from my own dictation.** I talk through a problem on a run, and the model gives me a shape to argue with. I have not shipped a sentence of its prose. What it saves is the blank page, not the writing.

**Editing copy I already wrote.** This is the one that pays. I hand it finished prose and ask what is weak. It is reviewing rather than generating, so I can weigh every suggestion against text I already believe in, and the facts, numbers, and argument are already mine. There is nothing left for it to invent.

Everything else stays with me: the claims, the metrics, the citations, the credit, and whether the piece should exist.

So, the honest answer to my own question. On drafting, I am not convinced it saves me time yet. On reviewing, it does, and that is the use I would defend to anyone.

## The loop I run now

```bash
# 1. Dictate the raw thing. Fix no grammar.

# 2. Ask the local model what is weak.
python3 scripts/local_gemma.py review my-draft.md

# 3. Run the gates, then read it all myself.
npm run check:content
```

Three steps, and the third one is not optional. The model runs on my hardware in about a second, which is the only reason I bother with step two at all: a review pass I can run ten times while editing is a different tool from one I wait on.

## What I would fix next

The held-out set is six prompts, which is a signal and not a result. The next version needs more prompts, a check that actually grades whether an edit changed anything, and a link resolver that fails the run when the model invents a citation.

The mechanical half of not writing slop turned out to be solved, and it was never the hard half. The rest is taste, and taste is the whole substance of an artifact whose only consumer is a person. I would rather keep a local model as a reviewer that argues with me than pretend it is a writer.

If you are running something similar over your own drafts, I want to know what your checks actually catch. Drop it in the comments.
