---
title: I Fine-Tuned a Model on My Own Writing. I Use the Untuned One.
summary: I trained a LoRA adapter on my own 12,058-word corpus to build a drafting and editing partner in my voice. The register transferred, but so did a critical failure mode: the model invented a 40% metric out of prompts containing no quantitative data. The reviewer I actually use every day is the 4-bit base model running locally on my laptop with a nine-sentence system prompt.
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
shareSummary: The fine-tune learned that my writing relies on hard numbers. Lacking grounded data, it simply invented them. Register transferred; judgment did not.
shareImageAlt: A social card setting a rented A100 that produced invented percentages against a laptop running a prompted base model whose edits shipped.
---

`./scripts/gemma-local.sh review portfolio/content/writing/fine-tuning-was-the-easy-part.md`

Thirty-five seconds later, the local model flagged that the draft opened on a detached architectural question instead of the Place Details billing shock that triggered the piece. It was right. I rewrote the hook, tightened the pacing, and shipped the revision.

At first, I assumed that editorial precision came from the LoRA adapter I had tuned on my writing corpus. But inspecting the local script revealed a surprise: `local_gemma.py` was calling `mlx_lm.load()` without an adapter path. It was running a quantized 4-bit base model on Apple Silicon Metal, steered entirely by a nine-sentence system prompt. The actual fine-tuned adapter was sitting idle in cloud storage, where my evaluation traces showed it repeatedly hallucinating metrics.

Both paths aimed for the same outcome: a drafting and critique partner that provides stylistic leverage without replacing human editorial judgment. Comparing the two revealed where fine-tuning adds leverage, where it introduces dangerous failure modes, and why a prompted local base model remains my daily driver.

## What the laptop actually caught

I run the 14.3 GB quantized base model (`mlx-community/gemma-4-26b-a4b-it-4bit`) locally on Apple Silicon Metal. Each full-article review pass takes roughly 35 seconds, spinning up the fans just as the critique finishes.

In an early review pass, my draft on builder platforms opened with this observation:

> The best model will change. So will the agent wrapped around it. A builder platform cannot anchor its strategy to either one.

It was accurate, but generic. Following the local model's critique on opening friction, the passage became:

> When a developer asks a coding agent to build with your platform, that session becomes part of your activation funnel.

That concrete reframing grounded the entire thesis in developer experience.

Yet the model's critique also highlighted a recurring risk of automated editing: regression to the mean. In a draft on developer experience, a specific attribution of leadership:

> I helped lead distribution strategy across major UI frameworks and AI agent platforms alongside our product, engineering, UX, and technical writing teams.

was rewritten by the model into passive collective voice:

> Our product, engineering, UX, and technical writing teams treated product, distribution, and measurement as one system.

The revision smoothed the cadence, but stripped the exact practitioner role from the sentence. An automated editor optimized for stylistic averages will flatten individual agency if left unsupervised. Both revisions shipped only after human review verified the claims.

## The three drafts: base, subagents, and local voice

Evaluating these layers in isolation clarified the publishing workflow. Producing technical content is neither a single-shot prompt nor an autonomous loop; it is a three-stage editorial pipeline where each stage catches distinct error classes.

Here is the progression on a single technical passage:

1. **The raw base draft:**
   > A builder platform needs to consider how AI agents interact with its APIs and SDKs to maintain adoption metrics. Fine-tuning models on developer documentation enables deeper platform alignment and consistency.

   *What failed:* Passive corporate framing ("maintain adoption metrics"), abstract buzzwords ("deeper platform alignment"), and an ungrounded claim about documentation fine-tuning lacking an empirical trace.

2. **Multi-agent review lanes:**
   A specialized checker runs three parallel evaluation lanes:
   - *Copy and Claims:* Flags the unsupported documentation claim and requests a concrete billing trace or API failure.
   - *Links and Metadata:* Validates canonical URLs, API references, and asset paths.
   - *Deterministic Quality Gates:* Enforces strict rules against em-dashes, promotional adjectives, and banned phrasing.

   The passage reframes around verified developer friction:
   > Our team treated developer journeys and AI agent sessions as one activation path. When agents hit undocumented rate limits on Place Details, adoption stalled.

3. **Local Gemma 4 copy edit (Ryan's voice):**
   The local model runs with nine sentences of targeted voice guidance. It strips corporate passive phrasing ("Our team treated..."), eliminates observational filler, and lands on direct practitioner action:
   > When an agent hits an undocumented rate limit on Place Details, that friction shows up in your activation funnel before a human ever files a ticket.

The base model drafts structural options. The subagent lanes verify truth, references, and deterministic syntax rules. The local voice pass tightens rhythm and directness without fabricating claims.

## The 117-example dataset

The cloud fine-tuning experiment used standard infrastructure: `google/gemma-4-26b-a4b-it` (26B total parameters with 4B active), trained using PEFT LoRA on Vertex Managed Tuning with an A100 GPU (rank r=4, four epochs, learning rate multiplier 1.0, 4,096 context length).

The training dataset comprised 117 examples split across five distinct tasks: Draft (47), Edit (27), Critique (27), Headline (11), and out-of-distribution examples (5).

![A single bar of 117 training examples split by where each target came from: 47 real prose, 27 copies of one identical critique response, 27 synthetic round-trips, 11 from one headline template, 5 hand-written, and a zero-width slice for the Present task with none.](/img/writing/i-use-the-untuned-one-dataset.svg)

Inspecting the data revealed why the fine-tuned model behaved unpredictably:

- **Template repetition:** The 47 Draft examples came from genuine published prose. However, all 27 Critique targets repeated an identical three-bullet diagnostic preamble before quoting the source text. Over 23% of the dataset reinforced a single repetitive structure.
- **Synthetically damaged edits:** To generate training pairs for editing, a data generator used regex rules to corrupt clean sentences:

```python
c = c.replace("I ", "Our team ")
c = re.sub(r'\b(built|shipped|wrote|led)\b', 'leveraged resources to deliver', c)
c = c.replace(".", " - which represents a key milestone for our organization.")
```

The model simply learned to invert this artificial corruption rule. It did not learn nuanced editing; it learned to undo a synthetic script.
- **Truncation artifacts:** The critique generator truncated target rewrites at 300 characters, causing 27 examples to end mid-sentence with an ellipsis. The model was literally trained to trail off.
- **Data leakage in validation:** Splitting examples randomly across derived pairs rather than by source document caused 6 of 9 validation source documents to appear in the training split.
- **Filter mismatch:** A category for presentation outlines dropped to zero examples because of a string mismatch between the dataset loader and task filter (`"talks"` versus `"talk"`).

## It learned the shape of evidence without having evidence

When evaluated against held-out prompts containing no quantitative inputs, the fine-tuned model repeatedly hallucinated specific metrics: 40%, 20%, 15%, and 40% across three outputs, and a literal `[X]%` placeholder in a fourth.

In one test, given a 13-word prompt devoid of data, the model generated: *"We reduced the time-to-first-API-call by 40%,"* followed by three fabricated technical artifacts and a structured "The lesson:" conclusion. In another, it invented industry awards for an internal tool and fabricated an opening objection from an imaginary senior developer.

The math was simple. My published writing frequently anchors insights in real metrics (such as moving exact-match rates from "2 of 10 to 9 of 10"). The fine-tuning process did not teach the model how to ground claims in empirical evidence. It learned that sentences in my voice contain quantitative tokens, and filled those structural slots with plausible fiction.

Structural rigidity emerged as well:
- 8 of 20 outputs opened with a fabricated quote.
- 7 of 20 concluded with a literal "The lesson" label.
- Every generation leaked chat formatting scaffolds into the output.

Two edge cases failed catastrophically: one prompt triggered an infinite generation loop on the digit `1` until token exhaustion, while a zero-example presentation prompt emitted raw HTML boilerplate.

There is also a fundamental corpus scale limitation. Academic research demonstrating successful author-voice fine-tuning (such as the University of Michigan author-voice study) operates on 0.9M to 10.9M tokens per author. My published corpus was approximately 12,000 words (16k tokens), roughly two orders of magnitude smaller. When a corpus fits entirely within a model's working context window, fine-tuning introduces distribution distortion and hallucination risks that prompt steering avoids.

## Deterministic gates versus fine-tuned weights

Supervised fine-tuning without preference optimization (such as DPO, GRPO, or KTO) makes the training dataset the sole reward signal. If the dataset contains structural flaws, the weights internalize them.

Style constraints highlight this failure mode. In the training set, input prompts contained 204 em-dashes while target outputs contained zero. Despite this clean negative signal, the tuned model still produced em-dashes across 5 of 20 held-out outputs. Fine-tuning suppressed the token pattern imperfectly; a single deterministic regex linter eliminated what model weights failed to guarantee.

Mechanical rules belong in deterministic code, not in fine-tuning weights:
- *Deterministic Linters:* Fast regex scripts catch formatting violations, em-dashes, unverified claims, and repetitive boilerplate during local builds.
- *Prompted Base Models:* Local models evaluate tone, conversational rhythm, and opening friction.
- *Human Judgment:* The author verifies truth, technical attribution, and whether the insight is worth publishing.

![Mechanical checks for em-dashes, announcement phrasing, hype words, and repeated phrases stand as gates on the left; on the right, unweighted human judgments about truth, credit, and whether the piece should exist. The two never combine into one score.](/img/writing/i-use-the-untuned-one-gates.svg)

Attempting to collapse these distinct layers into a single weighted score creates an unstable composite metric that is easily gamed. Deterministic constraints function as binary gates; stylistic quality remains an unweighted human editorial decision.

## The practitioner playbook: prompt first, tune last

For practitioners building internal voice or editing assistants, reversing the standard development sequence saves significant engineering overhead:

1. **Build deterministic gates first:** Write regex validators and link checkers before compiling datasets. Deterministic checks take minutes to write and outlive model checkpoints.
2. **Steer the base model with system prompts:** A focused, nine-sentence system prompt loaded into a local base model (`mlx-community/gemma-4-26b-a4b-it-4bit`) provides immediate style steering. Running locally via `mlx-lm` on Apple Silicon takes under an hour to set up and costs nothing to operate:

```bash
uv run --python 3.12 --with mlx-lm --with huggingface-hub \
  python scripts/local_gemma.py review <path-to-post>
```

3. **Structure the review critique:** Have the model output four discrete sections: voice and cadence, a cliché and AI-tell scan, an evaluation of opening friction, and line-by-line rewrite suggestions.
4. **Tune only when prompt steering plateaus on verifiable tasks:** If you do fine-tune, generate baseline evaluation traces in the identical execution run, split validation data strictly at the document level, and run automated linters against model outputs before deploying.

If you use cloud infrastructure for fine-tuning (such as Vertex Managed Tuning on an A100 GPU), configure automated teardown (`ep.delete()`) immediately following evaluation to prevent ongoing endpoint hosting costs. For smaller classification or mask extraction tasks, cost-effective spot instances (like an L4 GPU on `g2-standard-4`) provide ample compute.

## Where to tune, and where to prompt

The practical boundary for fine-tuning is not model size, but whether task performance can be deterministically verified:

- **Where fine-tuning excels:** Bounded, machine-gradable tasks with objective correctness criteria. In our previous work on [Place Details field-mask generation](/writing/fine-tuning-was-the-easy-part/), fine-tuning moved exact-match extraction accuracy from 2 of 10 to 9 of 10. A strict validator immediately flags invalid fields or missing parameters, and every token saved directly reduces API costs.
- **Where fine-tuning fails:** Open-ended generative writing where hallucinated facts, quotes, or percentages can reach a reader without verification. A model that writes with polished fluency while fabricating quantitative evidence is far more dangerous than one that produces clumsy prose.
- **Where small corpora belong:** If your entire reference corpus fits comfortably within a standard context window, system prompting delivers reliable stylistic alignment without dataset corruption or weight rot.

Fine-tuned checkpoints inevitably decay as underlying base models update. Deterministic linters, clean evaluation datasets, and structured prompt pipelines survive model migrations intact.

The cloud LoRA adapter remains archived. For daily writing, the most dependable editing setup is a local 4-bit base model, nine sentences of clear guidance, and a human practitioner reviewing every suggested line.

If you have experimented with fine-tuning models on your own writing and established reliable guards against hallucinated metrics, I would love to hear what your evaluation pipeline checks. Let me know in the comments!
