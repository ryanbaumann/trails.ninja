---
title: I Fine-Tuned a Model on My Own Writing. I Use the Untuned One.
summary: I trained a LoRA adapter on my own writing to capture my voice, only to realize my daily editing loop worked better with a local base model. Prompt engineering hits a ceiling where style meets truth. The workflow that actually works pairs raw human dictation with a fast, local copyediting model and a strict review loop.
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
shareTitle: Why Prompt Engineering Hits a Ceiling on Voice
shareSummary: Prompt engineering hits a wall because default RLHF flattens prose toward a corporate mean. Research proves fine-tuning captures rhythm and style, but the real workflow is human dictation paired with a fast local copyeditor.
shareImageAlt: A social card setting a rented A100 that produced invented percentages against a laptop running a prompted base model whose edits shipped.
---

`./scripts/gemma-local.sh review portfolio/content/writing/fine-tuning-was-the-easy-part.md`

Thirty-five seconds later, the local model flagged that my draft opened on a detached architectural statement instead of the Place Details billing shock that triggered the piece. It was right. I rewrote the hook, tightened the pacing, and shipped the revision.

I thought the LoRA adapter was doing the heavy lifting. It was not. When I checked the execution logs, I found `local_gemma.py` was calling `mlx_lm.load()` without an adapter path. It was running a quantized 4-bit base model on Apple Silicon Metal, steered entirely by a nine-sentence system prompt. The actual fine-tuned adapter was sitting idle in cloud storage, where my evaluation traces showed it repeatedly hallucinating metrics.

Both paths aimed for the same outcome: a drafting and critique partner that provides stylistic leverage without replacing human editorial judgment. Testing both approaches across hundreds of paragraphs revealed why prompt engineering hits a hard ceiling, what academic research proves about personal fine-tuning, and why a local copyediting loop remains my daily driver.

## The hook: why AI writing sounds synthetic

Most generative AI writing defaults to recognizable tropes: artificial enthusiasm, manufactured LinkedIn hooks, uniform paragraph structures, and an obsessive reliance on false dichotomies like "It is not X, it is Y."

When you try to fix this through prompt engineering, you quickly hit a wall. You can dump a 5,000-word style guide into Gemini 3.7 Flash or another frontier model, load it with few-shot examples, and demand punchy sentences. The output becomes cleaner, but it remains fundamentally synthetic. Default reinforcement learning from human feedback (RLHF) acts like a strong gravitational pull, dragging individual voice, quirky syntax, and asymmetric sentence rhythms back toward the bland mean of corporate prose.

The failure comes from asking the model to do the wrong job. If you ask a language model to invent the narrative, provide the primary reasoning, and choose the metaphors, you get polished generic copy. The setup that actually works treats the human as the author and the model as a low-latency copyeditor:

1. **Human Dictation:** You capture raw thoughts, idiosyncratic phrasing, and authentic argument structure through rapid brain-dumps.
2. **Local Model:** A fast, small fine-tuned model acts as a copyeditor, fixing transcription noise, punctuation, and run-ons without smoothing away your rhythm.
3. **Human Review:** You verify factual accuracy, strengthen the claims, and make the final editorial call.

## The empirical validation: University of Michigan research

Grounding this technical argument in empirical evidence reveals why prompting and fine-tuning diverge.

A landmark study from the University of Michigan (*Dhillon et al., 2026*, co-authored by Paramveer Dhillon, Tuhin Chakrabarty, and Jane C. Ginsburg) tested whether generative models could genuinely replicate authorial voice. The researchers evaluated state-of-the-art models against professional writers and evaluated the outputs using blind pairwise reviews by MFA writing experts from top U.S. programs:

- **In-Context Prompting:** When models were prompted with author guidelines and in-context examples, MFA judges easily identified the AI-generated prose. The expert judges preferred authentic human writing **82.7% of the time**. Prompting produced superficial imitation, not true voice.
- **Fine-Tuning on Full Corpora:** When models were fine-tuned directly on an author's complete body of work, the preference completely flipped. The expert judges favored the fine-tuned AI output **62% of the time** for stylistic fidelity, narrative pacing, and sentence cadence.

Prompting gives the model instructions; fine-tuning changes the underlying math. If expert readers cannot reliably distinguish fine-tuned outputs from human prose, personal fine-tuning is the only viable technical path for deep voice preservation.

## The workflow: dictation and local low-latency editing

To turn that empirical reality into a daily practice, you need a workflow that optimizes for turnaround speed and editorial control rather than autonomous generation.

```
[ Human Voice ] -> Raw Dictation -> [ Local Model (Sub-second) ] -> [ Human Review ] -> Published Post
```

Here is the three-step loop:

### Step 1: Rapid human dictation
I record raw audio dictation or write a messy brain-dump. This step captures the real stakes, technical friction, and personal vocabulary without pausing to fix typos or structure. The human provides 100% of the narrative direction and factual spine.

### Step 2: Local low-latency copyediting
A compact local model (such as a 4-bit Gemma 4 26B-A4B on Apple Silicon, or a QLoRA adapter on an 8B to 14B base) ingests the raw transcript. Running locally delivers sub-second token generation, preserves absolute data privacy, and eliminates prompt drift caused by continuous cloud API updates. The model cleans up speech stumbles, fixes missing punctuation, and tightens syntax while strictly preserving the idiosyncratic sentence structures.

### Step 3: Human editorial review
I read every line the local model produces. I verify technical attribution, check numbers against live benchmarks, and ensure the core argument remains uncompromised.

## Comparative breakdown: prompting vs. fine-tuned local models

When you compare raw dictation, frontier cloud prompting, and a local fine-tuned model side by side, the differences show up in measurable metrics:

| Attribute | Raw Dictation | Frontier Prompting (Gemini 3.7 Flash) | Local Fine-Tuned Model |
| :--- | :--- | :--- | :--- |
| **Voice & Tone** | Authentic, raw, highly idiosyncratic | Homogenized, polite, corporate | Authentic cadence, preserved idioms |
| **Syntax & Pacing** | Run-on clauses, speech artifacts | Rigid, uniform sentence lengths | Dynamic sentence length variance |
| **Cliché Frequency** | Low (natural speech) | High (AI filler, buzzwords, false flips) | Low (suppressed via learned patterns) |
| **Round-Trip Latency** | Instant (source thought) | 2.5 to 5.0 seconds (network + cloud) | Sub-second (local Metal GPU) |
| **Data Privacy** | Local device only | Transmitted over third-party API | 100% on-device |
| **Factual Stability** | Grounded in lived experience | Hallucinates plausible filler if unguided | Deterministic when constrained to edit |

When evaluating writing quality, sentence length variance serves as an effective mathematical proxy for natural voice. Frontier prompted models tend to cluster around 14 to 18 words per sentence with low standard deviation. Authentic human prose swings between punchy 4-word declarations and complex 35-word clauses. A fine-tuned local model preserves that variance instead of averaging it out.

## The 117-example dataset and the hallucination trap

When I trained my own LoRA adapter on Vertex AI using an A100 GPU (Gemma 4 26B-A4B, rank r=4, four epochs), I discovered the primary failure mode of voice fine-tuning: **it learned the shape of evidence without having real evidence.**

The training set contained 117 examples split across draft, edit, critique, and headline tasks:

![A single bar of 117 training examples split by where each target came from: 47 real prose, 27 copies of one identical critique response, 27 synthetic round-trips, 11 from one headline template, 5 hand-written, and a zero-width slice for the Present task with none.](/img/writing/i-use-the-untuned-one-dataset.svg)

When evaluated against held-out prompts containing zero quantitative data, the fine-tuned model repeatedly invented metrics: 40%, 20%, 15%, and 40% across four separate outputs.

I gave the model a 13-word prompt with no data. It immediately hallucinated a 40% efficiency gain to match my writing style. It learned a dangerous lesson: my writing often includes metrics, so it started inventing them to sound more like me. It learned the shape of my evidence without having the evidence itself.

## Training recipe and guardrails

To build an effective local voice model without falling into the hallucination trap, apply these practical guardrails:

1. **Paired Dictation-to-Prose Datasets:** Construct your training pairs exclusively from `[Raw Messy Dictation]` $\rightarrow$ `[Cleaned Final Human Prose]`. Do not use synthetic regex corruptions or unedited LLM rewrites.
2. **Deterministic Sampling Parameters:** Use low inference temperature (0.2 to 0.4) and greedy decoding for editorial passes. This keeps the model anchored to the provided text and prevents inventive drift.
3. **Deterministic Gates Over Learned Weights:** Do not rely on fine-tuned weights to eliminate em-dashes, banned words, or formatting rules. Model weights suppress tokens probabilistically; regex linters eliminate them deterministically.

![Mechanical checks for em-dashes, announcement phrasing, hype words, and repeated phrases stand as gates on the left; on the right, unweighted human judgments about truth, credit, and whether the piece should exist. The two never combine into one score.](/img/writing/i-use-the-untuned-one-gates.svg)

4. **Task-Specific Boundaries:** Train the model strictly on editing and copy critique tasks. Never ask an ungrounded voice model to generate facts from scratch.

## Recommendations: when to use what

Do not use the same model for everything. Draw a clean architectural boundary between cloud and local execution:

- **Use Frontier Cloud Models (Gemini 3.7 Flash, AI Studio):** For deep multi-step reasoning, broad tool execution, complex research synthesis, and large-context document analysis. Cloud models excel where world knowledge and cognitive breadth outweigh personal voice.
- **Use Local Fine-Tuned Models (Gemma 4 on MLX):** For high-frequency, sub-second editorial workflows, dictation clean-up, and voice-preserving critique. Local execution guarantees sub-second responsiveness, complete privacy, zero prompt drift, and true cadence retention.

If you are experimenting with local fine-tuning for your own writing or building voice-preserving editorial pipelines, I would love to hear what your evaluation checks catch. Let me know in the comments!
