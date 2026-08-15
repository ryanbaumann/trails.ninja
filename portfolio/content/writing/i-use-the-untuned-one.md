---
title: I Fine-Tuned a Model on My Own Writing. I Use the Untuned One.
summary: I trained a LoRA adapter on my own 12,058-word corpus to get a drafting and editing partner in my voice. The register moved. So did the model's willingness to invent a 40% out of a prompt containing no numbers, in four of twenty held-out outputs. The reviewer I actually use every day is the base model on my laptop with nine sentences of system prompt.
date: 2026-08-15
updated: 2026-08-15
canonical: https://ryanbaumann.dev/writing/i-use-the-untuned-one/
tags: ["ai", "evals", "field notes"]
draft: true
noindex: true
stageSocial: false
image: /img/writing/i-use-the-untuned-one-header.svg
imageAlt: "Two paths side by side: a cloud tune on an A100 with 117 training examples that invented a percentage in four of twenty held-out outputs, and a laptop running the base model with no training examples whose edits shipped."
socialImage: /social/i-use-the-untuned-one.jpg
shareTitle: My Voice Model Invented a 40%, Four Times
shareSummary: The tune learned that a paragraph of mine contains a hard number. It had no way to get one, so it made one up. Register transferred; judgment didn't.
shareImageAlt: A social card setting a rented A100 that produced invented percentages against a laptop running a prompted base model whose edits shipped.
---

`./scripts/gemma-local.sh review portfolio/content/writing/fine-tuning-was-the-easy-part.md`

Thirty-five seconds later the laptop told me that post opened on a hypothetical platform question instead of the Place Details billing shock that made me write it. It was right. I rewrote the opening and logged the win in `LEARNINGS.md` as a review by "the fine-tuned Gemma 4 26B-A4B voice model." There is no fine-tuned model on that laptop. `local_gemma.py` calls `mlx_lm.load()` with no `adapter_path`: a 4-bit base checkout and nine sentences of system prompt. The adapter I actually trained was somewhere else entirely, on an A100 in us-central1, inventing percentages.

I can tell you what it invented, because I kept the twenty held-out outputs. I can't tell you what the tune bought, because `eval/results/base-model/` does not exist. I never generated the baseline, so there is no delta claim anywhere in this post. What I wanted from either path was the same thing: a drafting and critique partner that is stylistically useful and never an author.

## What the laptop actually caught

I keep the 14.3 GB model (`mlx-community/gemma-4-26b-a4b-it-4bit`) in a gitignored `models/` folder. It runs locally on Apple Silicon Metal, taking roughly 35 seconds per review pass. The fans spin up just as a review finishes.

In that same sweep, `builder-platforms-grow-by-owning-the-agent-loop.md` opened on:

> The best model will change. So will the agent wrapped around it. A builder platform cannot anchor its strategy to either one.

True, and airless. It now opens on:

> When a developer asks a coding agent to build with your platform, that session becomes part of your activation funnel.

That is the sentence that made me want to write the post in the first place.

The same pass cost me something. In `devex-is-a-growth-discipline.md`:

> I helped lead distribution strategy across major UI frameworks and AI agent platforms alongside our product, engineering, UX, and technical writing teams.

became:

> Our product, engineering, UX, and technical writing teams treated product, distribution, and measurement as one system.

Smoother, and it deleted the only sentence in the paragraph that said what I did. An editor tuned on your average will regress you toward it.

Both rewrites passed `check:content` at 0 errors and 0 warnings, and shipped in PR #212.

## The three drafts: base, subagents, and local voice

Seeing the layers fail independently made the real workflow obvious. Writing this site is not a single prompt or an autonomous loop: it is a three-stage editorial pipeline where each stage catches what the others cannot.

Here is the progression on a single passage:

1. **The raw base draft:**
   > A builder platform needs to consider how AI agents interact with its APIs and SDKs to maintain adoption metrics. Fine-tuning models on developer documentation enables deeper platform alignment and consistency.

   *What failed:* Stagnant passive framing, corporate jargon ("deeper platform alignment"), and an ungrounded claim about fine-tuning docs without an eval or artifact.

2. **Model + skills and subagents review:**
   The multi-agent checker runs three parallel lanes:
   - *Lane 1 (Copy & Claims):* Flags the vague assertion about docs tuning and asks for the real trace or billing consequence.
   - *Lane 2 (Links & Metadata):* Confirms canonical slugs and checks external API references.
   - *Lane 3 (Visuals & Gates):* Runs `check:content` regex rules, catching em-dashes and banned hype adjectives (`W-HYPE`).

   The passage reframes around concrete developer friction:
   > Our team treated developer journeys and AI agent sessions as one activation path. When agents hit undocumented rate limits on Place Details, adoption stalled.

3. **Local Gemma 4 copy edit (Ryan's voice):**
   `./scripts/gemma-local.sh review` runs locally on Metal with nine sentences of voice guidance. It strips the remaining passive attribution ("Our team treated..."), replaces observational `The [Noun] is [Adjective]` phrasing with direct action verbs, and lands on the lived lesson:
   > When an agent hits an undocumented rate limit on Place Details, that friction shows up in your activation funnel before a human ever files a ticket.

The base model produces options. The subagent lanes enforce truth, links, and CI gates. The local Gemma model tightens the rhythm without inventing the facts.

## Then there was the 117-example dataset

The cloud side is real work: `google/gemma-4-26b-a4b-it`, 26B total with 4B active, LoRA through PEFT, four epochs, rank r=4, LR multiplier 1.0, context 4,096, run on Vertex Managed Tuning, returning `JOB_STATE_SUCCEEDED`. The job succeeded. The file it was fed is where the story is.

The training data comes out of `scripts/generate-ft-dataset.py`, which I ran again today: 117 examples, 106 train and 11 validation, across Draft 47, Edit 27, Critique 27, Headline 11, out-of-distribution 5, and Present 0. The README says 129 and `summary.md` says something else again, so three documents disagree with each other and all three disagree with the script that writes the file.

![A single bar of 117 training examples split by where each target came from: 47 real prose, 27 copies of one identical critique response, 27 synthetic round-trips, 11 from one headline template, 5 hand-written, and a zero-width slice for the Present task with none.](/img/writing/i-use-the-untuned-one-dataset.svg)

The 47 Draft examples are real prose lifted out of the corpus, and they are the good half. Everything after them is manufactured. All 27 Critique examples share an identical three-bullet diagnostic critique preamble before quoting the source text, so 23% of the dataset is that feedback repeated. The 11 Headline examples come from one six-variant template with the title slotted in. Five out-of-domain examples are pastiche I wrote by hand, and one of them paraphrases my own published `ai-saves-the-hour.md` closely enough that recalling it is memorization, not generalization. And 27 targets end mid-sentence in an ellipsis, because the Critique target truncates its quoted rewrite at 300 characters. I trained the model to trail off. Present is 0 because of one character: the loader sets `content_type` to `"talks"` and the Present branch filters on `"talk"`.

The Edit examples needed bad writing, and I didn't have any, so the generator manufactures it. `corporatize()` takes a real paragraph of mine and damages it on the way in:

```python
c = c.replace("I ", "Our team ")
c = re.sub(r'\b(built|shipped|wrote|led)\b', 'leveraged resources to deliver', c)
c = c.replace(".", " — which represents a key milestone for our organization.")
```

The model learns to invert that exact function, and no human writes that way. My own grader bans that character everywhere except inside a fence, and `prosePassages()` in `scripts/lib/content-rules.mjs` skips fenced lines, which is the only reason the excerpt above survives CI.

Then the split: `random.seed(42)`, shuffle, slice 90/10 over derived examples rather than over source documents, so 6 of 9 validation source documents also appear in training. `evals/field-mask/` splits at the case level, 8 and 2, and I wrote that one earlier.

## It learned the shape of evidence without any way to have evidence

From prompts that supplied no numbers at all, it produced 40%, 20%, 15%, and 40% across three of the twenty outputs, and a literal `[X]%` placeholder in a fourth. It has a favorite fake number. `eval_04` is a thirteen-word prompt with nothing quantitative in it, and what came back was "We reduced the time-to-first-API-call by 40%," three invented artifacts, and a line beginning "The lesson:". `eval_10` invented industry recognition for a tool and manufactured a senior developer's objection to open on, which stings: opening on a quoted objection is a move I make.

There is no mystery in the mechanism, and it starts with what I handed it. My corpus is full of sentences like "2 of 10 to 9 of 10," so what transferred is that a paragraph of mine contains a hard number. It didn't learn to have evidence. It learned the shape a sentence makes when it has some, and then filled the shape.

The forms collapsed too. Seven of twenty close on a literal "The lesson" beat, eight of twenty open on a quoted objection, and Result, What Shipped, and The Lesson turn up as visible headers. `SKILL.md` already documents that failure at the prompt layer, and fine-tuning reproduced it in the weights.

Two hard failures the README never mentions. `eval_01` returned about a thousand characters of the digit `1`, no prose, the same key struck until the token budget ran out. `eval_18`, the Present task with zero training examples, emitted raw HTML and generic filler about hyperparameter optimization. All twenty leak the chat scaffold, which means nobody read the harness output closely, including me.

Credit where it's owed: 0 six-word shingles repeat across three or more outputs, so it passes the repo's own `W-STOCK-PHRASE` check, which the prompt-layer skill did not. `eval_19` and `eval_20` land close to register, and `eval_09` is a tight rewrite.

I owe the prior Field Note a scale correction. It cited the [UMich author-voice work](https://news.umich.edu/when-ai-learns-an-authors-voice-even-experts-prefer-it/) as evidence that style tuning works. That study used 0.9M to 10.9M tokens per author. My entire published corpus is about 12,058 words, roughly 16k tokens, somewhere between 50x and 680x smaller. The method wasn't wrong. I brought a corpus that fits in a context window.

## The grader I should have written first

No preference optimization ran. No DPO, no GRPO, no KTO, no ORPO: supervised fine-tuning only, and anything suggesting otherwise, including from me, is wrong. Which means the dataset was the reward function, and I built it last and checked it least.

The cleanest case is the em-dash. Training inputs carried 204 of them and training targets carried 0, about as clean a signal as you can hand a model. The README then claims the model "consistently uses colons, periods, and semicolons instead of em-dashes." Against its own retained outputs there are 6, across 5 of 20. That claim was false for as long as it took to run one grep, and running the grep was nobody's job.

What does exist ships on every commit: `content-rules.mjs` and `check-content.mjs`, with `W-EMDASH`, `W-ANNOUNCE`, and `W-HYPE` as errors and `W-STOCK-PHRASE`, a six-word shingle repeated across three or more Field Notes, as a warning. Live run this morning: 33 entries, 0 errors, 0 warnings. The header comment carries the whole design opinion. Taste stays with the review skill; the file catches only what a reviewer should never have to spend attention on.

![Mechanical checks for em-dashes, announcement phrasing, hype words, and repeated phrases stand as gates on the left; on the right, unweighted human judgments about truth, credit, and whether the piece should exist. The two never combine into one score.](/img/writing/i-use-the-untuned-one-gates.svg)

A weighted style score would have been the tempting build, and it silently encodes a taste weighting into a single number that gets Goodharted fast. One primary metric, everything else as gates. For prose the primary metric is a person deciding whether the piece is worth publishing.

The one preference experiment I did run graded instructions rather than weights: `docs/skill-evals/2026-08-07-portfolio-voice-de-scaffolding.md`. Two isolated read-only agents on a fixed prompt, a third scoring the anonymized A/B, files pinned by SHA-256, baseline 2 of 4 and candidate 4 of 4. It also writes down its own insufficiency: one paired trial, not enough to estimate variance, full responses not retained. That self-criticism is the bar, more than the score is.

Two caveats I won't hedge on. At n=20 an LLM judge is noise, since position bias shifts accuracy by more than 10 points and pairwise judging flips preference 35% of the time under distractors against 9% pointwise. And no published work uses deterministic prose metrics as reward components, so gating on regex and leaving taste to a person is an open direction, not a validated technique.

## Build it in the other order

Write the deterministic grader first and wire it into CI before you build a dataset, because a regex file will outlive every checkpoint you train, and mine would have caught the em-dash claim in about four minutes. Write the system prompt second, then run it against the three worst drafts you already have. `SYSTEM_PROMPT` is nine sentences at the top of `local_gemma.py`, so changing your voice means editing a string and saving the file rather than scheduling a job. Run it locally first: `mlx-community/gemma-4-26b-a4b-it-4bit`, about 14.3 GB down into a gitignored `models/`, `uv run --python 3.12 --with mlx-lm --with huggingface-hub`, and `./scripts/gemma-local.sh review <file>` hands back four things, because four things are what `review_copy()` asks for: voice and cadence, a cliché and AI-tell scan, whether the opening lands on real friction, and line-by-line rewrites. That whole path is about an hour, and most of the hour is the download finishing.

Only if that plateaus, tune. When you tune, generate the baseline outputs in the same execution path that generates the tuned run, because if they aren't one script one of them will not exist, and mine didn't. Split held-out data at the source document. Grep the outputs for the rules you claim you fixed before you write the summary claiming it.

Cloud side for completeness: Vertex Managed Tuning, eval served on `a2-ultragpu-1g` with one A100 80GB, spun up for the run and taken down with `undeploy_all()` and then `ep.delete()`, $0 ongoing. An endpoint bills for every minute it exists, so deleting it is part of the run, not cleanup afterward. The field-mask tune used `g2-standard-4` with an L4 on spot, which is the cheaper reference point.

## Where I'd tune, and where I wouldn't

The line I'd draw now isn't between a big model and a small one; it's between a job a grader can fail and a job a person reads line by line anyway.

Would tune: the field-mask job from [the last note](/writing/fine-tuning-was-the-easy-part/). Narrow, gradeable, one number carrying correctness and cost together, because on Place Details an over-fetch is a billing event. It moved 2 of 10 to 9 of 10 exact-match masks, and the grader can tell you you're wrong.

Wouldn't tune: any path where a model can emit a number, a citation, an award, or a quote and reach a reader with no human in between. A model that writes well and invents a 40% is more dangerous to me than one that writes badly.

Wouldn't at this corpus size either. If your whole body of work fits in a context window, put it in the prompt.

Where the tune still earns its keep is behind a person: generating drafting and critique options, most of which I throw away. Mechanical rules belong in CI, not in the loss function. And fine-tunes rot, because every base-model deprecation invalidates a checkpoint while the dataset generator and the grader survive it.

The adapter is still sitting in us-central1 with nothing deployed in front of it, and I'll retrain it when there's a `base-model/` directory to compare against and a split that holds source documents apart instead of shuffling their leftovers. Until then the honest setup is a laptop, nine sentences, and me reading every line it hands back.

If you've tuned a model on your own writing and found a way to stop it inventing the numbers, show me what your grader checks. Mine catches four things, and not one of them is "is this number real."
