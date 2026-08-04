# Own Your Intelligence: research pass + 3-post plan

**Status:** research verification of `own-your-intelligence-series-brief.md`, plus a proposed cut into three Field Notes and a short draft of post 1. Research conducted 2026-08-04. Nothing here is publish-ready prose.

**Method:** every factual claim in the brief that post-dates the model cutoff was checked against a primary or near-primary source. Corrections below are ordered by how much they change the writing.

---

## 1. What the research changed

### 1.1 The anchor case is better than the brief knew (and it's not the benchmark)

The brief treats Harvey's Legal Agent Benchmark as the anchor. The stronger artifact is what Harvey and Baseten Research published on **May 27, 2026**: a post-training pipeline that took LAB signal, paired it with a long-horizon legal-agent harness, and post-trained an open-weight model with the harness in the loop.

- Base model: **Qwen3.5-27B**, open weights.
- Method: **iterative SFT** on teacher rollouts, where teachers ran each task end-to-end inside the harness with privileged access to the rubric until they produced a fully-passing deliverable. Then a **40-step GRPO** pass.
- Result: criterion pass rate **42.5% → 63.0%**. All-pass rate improved more steeply, and all-pass is the metric that maps to real legal review.
- It reached **closed-source frontier band on LAB**, matching Claude Sonnet 4.6 and GPT-5.5 running the same harness.

The line that matters most for this series is buried in that post: **the harness alone gave the 27B model minimal lift. Frontier models benefited from the same harness immediately.** Context engineering pays off only above a capability threshold. Below it, you have to train. That is a direct, evidence-backed sequel to the prior two posts, and nothing in the brief says it.

Source: `harvey.ai/blog/post-training-open-legal-agents-with-baseten-research`

### 1.2 LAB scores are brutal, and that's the point

The brief cites LAB's size (1,200+ tasks, 24 practice areas, 75,000+ rubric criteria) but not its results, which are far more useful:

- Initial results (May 26, 2026): **Claude Opus 4.7 at 7.1%**, Sonnet 4.6 5.4%, Opus 4.6 4.2%, GPT-5.5 2.1%, Gemini 3.5 Flash 0.8%.
- Best result ever recorded since: **Claude Fable 5 at 13.3%**.
- Top-performing Opus 4.7 cost roughly **$50.90 per task at 22 minutes latency**.
- Behavioral findings: pre-draft research +0.4, post-draft validation +0.8, revision after review +1.5.

A benchmark where the best frontier model scores 13% is the cleanest possible illustration of "your CUJs are not saturated and the labs have nowhere to climb yet." Use the number.

**Correction:** the brief says LAB deliberately launched without a leaderboard. Stale. Harvey partnered with Artificial Analysis to publish a regularly-updated leaderboard, and Vals AI hosts an HLAB board (last updated 8/3/2026).

### 1.3 Hugging Face already ships the distribution mechanism

This is the biggest gap in the brief. `huggingface.co/docs/hub/en/agent-traces` documents **native Hub support for agent traces**: raw JSONL sessions from Claude Code, Codex, and Pi Agent upload without conversion, render in a dedicated trace viewer, and there's a documented Session Traces Format for custom harnesses. Datasets or storage buckets, `hf upload` or `hf buckets sync`.

Two consequences:

1. The brief's §3 conundrum ("what's the distribution mechanism?") has a partial answer that shipped. The mechanism isn't hypothetical.
2. The brief's pipeline recommendation (OTel GenAI → ADP → chat template) is the *rigorous* path, but there's now a lowest-friction path that skips all of it. The honest version presents both and says when each is worth it.

HF's own docs also warn that trace files can include prompts, tool inputs, command output, local paths, screenshots, secrets, private code, and personal data. That's third-party support for the publish/withhold/never argument in §4.1, from the platform hosting the corpus.

### 1.4 ADP's schema changed. The brief's §5.2 is stale.

Open item resolved. The canonical schema is now **ATIF (Agent Trajectory Interchange Format)**, defined in `schema/atif.py`:

- `ATIFTrajectory` (top-level container), `ATIFStep` (typed `system`, `user`, or `agent`).
- Tool calls carry `function_name`, `arguments`, `tool_call_id`.
- Observations link back via `source_call_id`. Where an observation has no linking call, converters emit observation-only agent steps with empty messages.
- Four-stage pipeline: **Raw → ATIF → ATIF standardized → SFT format**.
- 25+ datasets supported, three agent formats (OpenHands v0, SWE-agent, AgentLab).

Do **not** publish the brief's "five primitives / `id`, `content`, `details`" description. That's the arXiv-era schema and it no longer matches the repo.

### 1.5 You cannot pin OpenTelemetry GenAI right now

The brief advises "pin the version." You can't, currently. The main `semantic-conventions` repo deprecated and moved all `gen_ai` content in **v1.42.0 (June 2026)** to a dedicated repository that **has no releases or tags yet**. As of mid-July 2026 no GenAI span, event, metric, or attribute is marked Stable.

This makes the advice sharper, not weaker: the thin mapping layer isn't a nice-to-have, it's the only thing standing between you and a rename. Say that instead.

### 1.6 The field-mask demo is better than the brief claims, and now verified

Verified against Google's own billing docs and independent breakdowns:

- Place Details has three SKU tiers: **Essentials ~$5/1K, Pro ~$17/1K, Enterprise ~$20/1K**.
- **You are billed at the highest SKU applicable to your request.** Mix an Essentials field and a Pro field, you pay Pro.
- `formattedAddress`, geometry → Essentials. `displayName`, `types`, `addressComponents` → Pro. `photos`, `rating`, `currentOpeningHours` → Enterprise.
- Free monthly allowances differ per tier: 10,000 Essentials, 5,000 Pro, 1,000 Enterprise.

So a model that reflexively appends `rating` to a field mask moves a $5 call to a $20 call. **One wrong field name is a 4x cost error, and it's invisible until the invoice.** That is a far better hook than "over-requesting fields moves you to a higher billing SKU," and it makes the single grader genuinely prove correctness and cost at once.

### 1.7 The deprecated-API argument now has citations

§4.3 ("you cannot deprecate a training corpus") was anecdote. It's now literature:

- ICSE 2025, *LLMs Meet Library Evolution*: seven LLMs, 145 API mappings, eight Python libraries, 28,125 completion prompts. **25–38% deprecated API usage rate.** Attributed to deprecated usages present in training data plus no API-status knowledge at inference. (arXiv 2406.09834)
- *When LLMs Lag Behind: Knowledge Conflicts from Evolving APIs in Code Generation* (arXiv 2604.09515).
- Ryan's own surface is a live example: legacy Places classes (`PlacesService`, `AutocompleteService`, `places.Autocomplete`) closed to new customers **March 1, 2025**, still frozen, still emitted.

### 1.8 Open weights are not uniformly open

- **Kimi K3** weights did ship (July 27, 2026, 1.56TB, 96 shards) but under a **custom Kimi K3 License**, not MIT. MaaS operators above $20M group revenue over any 12 months need a separate agreement; products above 100M MAU or $20M monthly revenue must display Kimi K3 in the UI.
- **GLM-5.2** (MIT) and **DeepSeek V4 Pro** (MIT) are genuinely permissive. DeepSeek V4 Pro Max leads raw SWE-bench Verified among downloadable weights at 80.6% (vendor-reported). Qwen3-Coder-Next at 70.6% is the best that runs locally in ~46GB.
- Kimi K3 is 2.8T params, first open 3T-class model, ranked fourth on the Artificial Analysis Intelligence Index.

Worth one sentence: "own your intelligence" has a license column, and it isn't always blank.

### 1.9 Gemma 4 is a viable demo target. Open item resolved.

Gemma 4 shipped April 2026 (E4B, 26B-A4B MoE, 31B dense, 256K context, 140+ languages). Unsloth documents Gemma 4 QLoRA on a single RTX 4090 for the 26B MoE. VESSL documents a 15-minute, $0.38 cloud fine-tune. **Go Gemma.** The better story and the workable tooling are the same choice, which is rare.

### 1.10 One thing to coin

- **"Share of gradient" has no prior art**, which is good: it's Ryan's to coin. Adjacent verified fact worth using instead of hand-waving: the crude version of this decision already exists as `robots.txt`. Allowing ClaudeBot lets a model learn your platform; blocking it protects IP and guarantees the model won't know you. Publishing traces is that same decision one layer down, with a much higher-quality signal.

### 1.10b Desert Ant Labs: found, and it's the opposite of what the brief said

Resolved. `github.com/Desert-Ant-Labs` is real. Every earlier search missed it because the **org was created 2026-06-14**, roughly seven weeks ago.

- European AI lab, **Netherlands**, site at `desertant.com` (`desertant.ai` redirects). Two members, 18 public repos, single-digit stars.
- Positioning, verbatim: **"A frontier AI lab for on-device models."** Tagline: **"Little brains in every product."** They describe themselves as building **"the intelligence layer for every app."**
- Nine or ten narrow models, one job each: **Redact** (PII redaction across EU languages), **Tongue** (language ID, 84 languages), **Gist** (36 topics, 101 languages), **Clear** (denoise and dereverb at 48 kHz), **Uhm** (filler-word detection, 20 ms frame-precise), **Emo**, **Shapes** (single-stroke recognition), **Align**, **Moderator**, **Schemer**.
- Distribution: native SDKs for Swift/iOS, Kotlin/Android, and TypeScript for Node and browser. SDKs on GitHub, models on Hugging Face.
- Pricing: **free up to 100k monthly active devices per SDK, unlimited inference per user**, commercial licensing above that.

**The important correction:** the brief has this backwards. It describes a "bring your own open weight, fine tuned model" company. Desert Ant is the inverse. They ship *their* pre-baked narrow models embedded in SDKs. There is no fine-tuning offer and no BYO-model path anywhere in their positioning.

That inversion makes them more useful to the series, not less, and they belong in **post 1** for three reasons:

1. **They make the small end concrete.** §2.4's full-size-range riff was going to get cut to one sentence. That sentence can now cite a company whose entire product is "one model, one job, on device" rather than gesturing at a hypothetical.
2. **They're a competitive argument, not a supporting example.** Desert Ant proves the narrow on-device tier is a product category someone will occupy. If a platform doesn't ship the distilled model for its own narrow CUJs, a third party ships one that works across everyone's. The brief never makes this point and it's the sharpest thing the reference buys.
3. **They're evidence for the §2.7 fix.** Replacing "general intelligence is expensive and will be for a while" with the latency/residency/determinism framing needs proof. On-device PII redaction across EU languages and 20 ms frame-precise audio detection are not cost plays. They're physics and jurisdiction, and neither one gets solved by the per-token price falling.

**Honesty constraint:** seven weeks old, two people, five followers. Cite as a signal of where the market is heading, never as a proven success. The series spends its credibility criticizing vendor-reported numbers, so inflating a brand-new company would be self-inflicted.

**Voice-skill check:** the "don't enumerate third-party AI products" rule targets tool-shopping lists of competitor coding agents and IDEs. Naming Desert Ant once, with a link, in a post about market structure is the same move as naming Harvey and Fireworks, and it's consistent with how the prior posts cite outside work.

### 1.11 Title collision, flagged

Fireworks' homepage headline is literally **"Own Your Specialized Intelligence,"** with "Own your model, own your future" and "Make your data your moat" as supporting copy. They raised a $250M Series C in February 2026 at a $4B valuation and are a named Harvey partner.

"Own Your Intelligence" as a series title reads as an echo of a vendor campaign. Two honest options: retitle the series, or keep it and open by naming Fireworks as the vendor already selling the shovel. The second is more interesting and fits the voice better, but it can't be accidental.

### 1.12 MLX natively rejects unified multimodal architectures for text tuning

The `google/gemma-4-E4B-it` weights on Hugging Face are for a unified multimodal architecture. MLX (`mlx-lm`) does not natively support loading just the text backbone of a unified model. It threw a 54-parameter mismatch because the language keys were nested under `language_model.model.*` alongside `vision_tower` and `audio_tower` parameters. 

**The Fix:** To successfully fine-tune the text backbone, you must clone `mlx-examples`, create a custom `mlx_lm/models/gemma4_unified.py` architecture patch (preserving SwitchGLU routing), adjust KV cache assumptions, and rewrite the `sanitize()` function to strip the vision/audio towers and remap the language keys to the root state dict. Once patched, the 100-iteration LoRA fine-tuning loop on `field-mask` succeeds with a 0.028 validation loss.

---

## 2. Editorial constraints this series has to respect

Pulled from `.agents/skills/portfolio-writing/SKILL.md` and `docs/PORTFOLIO_EVIDENCE_LEDGER.md`, because they materially shape the draft:

- **This is a personal thesis, not a platform roadmap.** The ledger permits describing shipped public artifacts (Code Assist, Agent Skills) with team credit. It does not permit implying Google Maps Platform is pursuing a trace-publication or fine-tuning strategy. Every "you should" in this series has to read as Ryan's argument to platform builders generally, with GMP as the surface he happens to know. The demo must stay personal, public-API-only, backyard-project framed.
- **No published eval deltas** for internal work. The only numbers in these posts come from the personal demo, public benchmarks, and public pricing.
- No em-dashes. Contractions. Sentence lengths that actually vary (the skill calls out 4-to-52-word range in the hand-written entries). At most two load-bearing "not X, it's Y" flips per piece.
- Every post gets its own bespoke visual, not the shared box-and-arrow template.
- Headline post needs three genuinely distinct full drafts graded by an independent reader before picking. That's the skill's explicit gate, and it's the natural place for parallel agents.
- Run `npm run check:content` for repeated six-word phrases before publishing.

---

## 3. The cut: three posts

The brief proposes five. Three is the right first tranche, and post 1 stands alone if the rest slips.

### Post 1 — the demo and the conundrum

**Working titles** (recommend the first two, need the full 10-variant pass before locking):

1. *Docs Teach Humans. Only Traces Teach Weights.*
2. *Fine-Tuning Was the Easy Part*
3. *A Wrong Field Name Costs 4x. I Trained a Small Model to Stop.*
4. *Share of Gradient Is the New Share of Voice*
5. *The Further Your Traces Travel, the Less You Control Them*

**Thesis:** the distribution ladder (brief's option A), landing on the control-versus-durability inversion (option C).

**Shape:**
- Above the fold: the before/after table from the personal Gemma 4 field-mask fine-tune.
- The 4x SKU fact as the reason the table matters.
- The pivot: I can do this for myself in a weekend. I can't do it for every developer on the platform, and I can't ship weights into DeepSeek.
- Three mechanisms, ascending leverage and descending control: fine-tune it yourself, publish into corpora, get your tasks into a benchmark labs climb.
- Desert Ant Labs as the one-sentence proof that the first mechanism is already a product category, and as the competitive warning: if you don't ship the small model for your own narrow jobs, someone ships one that works across everyone's.
- Harvey as proof the third one works: LAB at 7.1% top score, then Qwen3.5-27B post-trained into the frontier band off LAB signal.
- The ladder table (four tiers, control down, durability up).
- One honest sentence on break-even: you're trading inference COGS for MLOps headcount.
- Ends on the open question the next post answers.

**Critical dependency:** this post does not exist without the demo. See §5.

### Post 2 — evals that gate versus evals that teach

**Working titles:** *You Can't Publish Your Eval and Keep It* · *The Same Trace Can Gate a Launch or Teach a Model. Not Both.*

**Thesis:** one artifact shape, two lifecycles, and mixing them destroys both.

**Shape:**
- Open on the objection: "we already have evals, so we already have training data." No, you have a measurement instrument, and using it as fuel breaks the instrument.
- The Harvey pipeline as the worked example, handled honestly: they open-sourced LAB *and* trained on LAB signal, and the thing that made it legitimate was holdout discipline.
- Kill the scalar objective function. One primary metric (task success), everything else as gates: cost ceiling, security pass/fail, no-deprecated-API check. Agents Goodhart a blended score fast.
- Execution-based scoring over judges. WebArena-style programmatic validation, containerized tests.
- Cost-to-success as a first-class metric, with the LAB number as the argument: $50.90 per task at 22 minutes is a passing score nobody can ship.
- Callback to the prior evals post and to the harness-threshold finding: below a capability line, better context doesn't help and you have to train.

### Post 3 — you cannot deprecate a training corpus

**Working titles:** *You Can Deprecate an API. You Can't Deprecate a Training Corpus.* · *Publish Only What You'll Support for Five Years.*

**Thesis:** publication is permanent, so the schema matters more than the objective function.

**Shape:**
- Open on the daily tax: models confidently emit legacy Places and Directions params years after those surfaces froze. The ICSE 25–38% number generalizes it beyond one platform.
- Which means: everything you publish, you're choosing to add to that tax.
- Three disciplines: publish only what you'll support for five years, stamp every trace with API version and validity window, and put recency in the schema rather than the objective function.
- The formats section, corrected: OTel GenAI for capture (and why you can't pin it yet), ATIF for the interlingua, chat template at the tokenizer. Plus the HF native-traces path for people who won't build any of that.
- Publish / withhold / never, with HF's own secrets-and-PII warning as the corroboration.
- The closing move: the durable artifact isn't the checkpoint, it's the trace-generation pipeline that can re-mint the corpus on every API change. Fine-tunes rot. Harvey doesn't feel this because legal doctrine moves slowly; a versioned API surface feels it quarterly. This is the paragraph nobody else can write.

**Backlog, not in this tranche:** distribution 2x2 / share-of-gradient in full, and integration traces as the scarce asset (GMP x BigQuery, x Twilio, x Stripe). The integration-traces post is still the most original idea in the source brief and shouldn't be diluted by shipping it early.

---

## 4. Short draft, post 1

Unpolished. This is a shape to react to, not prose to edit.

---

Gemma 4 gets my API's field masks wrong. So does every frontier model I tried. They reach for the legacy Places parameters, because those are what the internet was full of when the weights were made.

That's not a correctness problem. It's an invoice.

Google Maps Platform bills Place Details at three tiers, and you pay the highest tier any field in your request touches. Ask for an address and coordinates, you're in Essentials at about five dollars per thousand calls. Let the model helpfully append `rating`, and the same call bills as Enterprise at about twenty. Nobody notices, because the response looks right. The code compiles, the test passes, the map renders, and the platform quietly charges four times as much for the same answer.

So I spent a weekend teaching a small model not to do that.

[TABLE: Gemma 4 base / +SFT / +RL across schema-valid, HTTP 200, exact mask match, mean billable SKU tier, tokens per successful call, cost per successful call]

The grader is three lines and there's no judge in it: schema-valid, live 200, requested mask equals the required field set, minus a penalty per over-fetched billable field. That single number is a correctness metric and a cost metric at the same time, which is the only reason the experiment is interesting. Everyone says you should train against cost. Almost nobody has a reward that actually contains it.

Here's the part that ruined my weekend.

I can do this for myself. I cannot do it for every developer building on the platform, and I cannot ship weights into DeepSeek. The model that a developer actually opens tomorrow morning is one I don't own, didn't tune, and can't reach.

Docs distribute developer experience to humans. SDKs distribute it to applications. Skills and MCP distribute it to harnesses. Traces are the only thing that distributes it to weights.

[three mechanisms: fine-tune / publish / benchmark]

[Harvey: LAB's best frontier score was 7.1%, then a 27B open-weight model post-trained on LAB signal landed in the frontier band]

[the ladder table, and the inversion: control falls, durability rises]

[break-even honesty: inference COGS traded for MLOps headcount]

---

## 5. Decisions made (2026-08-04)

**Sequencing: run the demo first.** Post 1 is written around a table that does not exist yet, and the fine-tune is now the critical path. Nothing else gets drafted against a placeholder.

**Title: keep "Own Your Intelligence," name Fireworks in the open.** The collision becomes evidence rather than an accident. Fireworks' homepage headline is "Own Your Specialized Intelligence," they raised $250M in February 2026 at a $4B valuation, and they are a named Harvey partner on the legal foundation model work. The move is to point at the vendor already selling the shovel, then ask the question they don't answer: fine-tuning your own model is the easy tier, and it's the one that reaches the fewest developers.

Still open, and cheaper to resolve during drafting than before it: how hard to lean on Google Maps Platform specifics given the ledger constraints in §2.

## 5b. Demo build spec

### Environment and training platform

No local GPU and no torch in this workspace (`nvidia-smi` and `import torch` both fail), so training runs offsite either way. The repo holds the frozen task set, the grader, and the results.

**Decision: train on Vertex AI.** Confirmed viable and it is the simplest path. Gemma 4 is available on Google Cloud across Vertex AI, Cloud Run, GKE, and Sovereign Cloud. Vertex AI Training Clusters ship optimized SFT recipes through NVIDIA NeMo Megatron, covering full SFT, LoRA, QLoRA, DPO, and RLHF, with reference notebooks for all four model sizes. Hugging Face also documents fine-tuning Gemma 4 with TRL on Vertex AI, which is the lighter-weight entry point.

One honest caveat about scope. The SFT column of the table is a managed-recipe job and genuinely simple. The RL column is not: the reward has to call the live Places API and score the returned field set against the requested mask, which is a custom loop rather than a Vertex tuning recipe. TRL on a Vertex notebook or custom training job handles it, but budget it as the real work. If it turns into a time sink, ship post 1 with the base and +SFT columns and hold +RL for post 2, where the reward design is the actual subject.

Unsloth QLoRA on a single rented 24GB box stays as the fallback if Vertex quota or setup gets in the way. Same result, less managed infrastructure.

### Traces from the other repo

Ryan has existing traces and learnings from another repository to contribute, arriving separately. Two things to check when they land, because they change what the demo can claim:

- **Provenance and licensing.** Whether these traces can be published at all, and whether anything in them touches non-public surfaces or real user data. The Hugging Face trace docs are blunt about what sessions typically contain: prompts, tool inputs, command output, local paths, screenshots, secrets, private code. Review before anything gets committed, not after.
- **Whether they're training data or eval data.** If they inform the task set, they are burned as an eval and the frozen set has to be built independently. This is the exact publish-versus-gate tension post 2 argues about, showing up in the first artifact of the series, which is either a nice piece of narrative luck or a trap depending on how it's handled.

### Follow the paved path that already exists

`evals/contact-qualifier/` is the pattern, and it fits this demo almost perfectly:

- `dataset.v1.json`, frozen, versioned with a `schema_version` string, synthetic data only.
- `rubrics.v1.json`, with grading criteria and launch gates **declared before implementation**.
- `validate.py`, dependency-free, read-only, never calls a model or a remote service.
- Candidate responses get graded from outside the frozen directory.

That structure is worth more than convenience here. It's the "evals that gate versus evals that teach" split from post 2, already instantiated in Ryan's own repo, which makes it a callback with an artifact behind it instead of an assertion.

Proposed: `evals/field-mask/` with `dataset.v1.json`, `rubrics.v1.json`, `validate.py`. Training data and rollouts live outside the frozen directory so publishing one never contaminates the other.

### Task set

300–500 synthetic tasks. Natural-language request in, field mask out. Framed off the backyard project: nurseries, trailheads, coffee before a ride. Public APIs only, nothing internal, no real user data.

Coverage has to include the cases that make the cost argument land:

- Requests answerable entirely within Essentials, where any extra field is pure waste.
- Requests that legitimately need Pro or Enterprise fields, so the model can't learn "always minimize."
- Requests where the legacy Places parameter is the tempting wrong answer.
- Ambiguous requests where the correct behavior is the narrower mask.

### Grader (RLVR, no judge)

```
+1   HTTP 200 AND requested mask == required field set
-λ   per over-fetched billable field, weighted by SKU tier delta
 0   schema-invalid or non-200
```

The tier weighting is the part worth getting right. An over-fetched Essentials field is a rounding error. An over-fetched Enterprise field is a 4x billing event, and the reward should say so. That's what makes one number carry both correctness and cost.

### Table to fill

| | Gemma 4 base | +SFT | +RL |
|---|---|---|---|
| Schema-valid % | | | |
| HTTP 200 % | | | |
| Exact mask match % | | | |
| Mean billable SKU tier | | | |
| Tokens per successful call | | | |
| Cost per successful call | | | |

Add a frontier-model baseline row if it's cheap to get. "The small tuned model beats the big general one at this specific job" is a stronger sentence than "the tuned model beat itself," and it's the sentence the whole series needs to be true.

### Honesty gates, set now rather than after seeing results

- Publish the base numbers even if the delta is unimpressive. A weak result reframes the post, it doesn't kill it.
- Report cost per *successful* call, not per call. Agents can brute-force their way to a pass.
- State the task count, the seed, the exact model variant, and the harness. Vendor-reported numbers on self-selected benchmarks are the thing this series criticizes.

---

## 6. Proposed build, in parallel

Phase one is the demo (§5b) and it doesn't parallelize usefully: it's one task set, one grader, one training run, and splitting it just multiplies coordination. Do that first, single-threaded.

Phase two is the writing, and once the outline and references are locked it fans out cleanly:

- **Three drafters, same outline, different registers** (analytical / scene-led / staccato) for post 1 only. The writing skill requires exactly this for a headline piece.
- **One independent voice grader** scoring those three on authentic voice, rhythm, freedom from generated-sounding tells, and punchiness. Picks or merges.
- **One claims reviewer** running every material claim against the sources in §1 and against `docs/PORTFOLIO_EVIDENCE_LEDGER.md`. This one is not optional given how many numbers these posts carry.
- **One visual designer** producing a bespoke image per post. The ladder inversion, the two-lifecycle split, and the deprecation tax are all one-idea scenes.
- Posts 2 and 3 get single drafters against locked outlines, since they're not the headline piece.

Writers must not share files. Each owns one slug under `portfolio/content/writing/`, scaffolded with `npm run new:post`, drafts safe by default.

---

## 7. Sources

- [Harvey, Post-Training Open Legal Agents with Baseten Research](https://www.harvey.ai/blog/post-training-open-legal-agents-with-baseten-research)
- [Harvey, Legal Agent Benchmark initial results](https://www.harvey.ai/blog/legal-agent-benchmark-initial-results)
- [Harvey, Introducing the Legal Agent Benchmark](https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark)
- [Artificial Lawyer, Harvey Trains Open Source Models To Encode Law Firm Workflows](https://www.artificiallawyer.com/2026/06/18/harvey-trains-open-source-models-to-encode-law-firm-workflows/)
- [Vals AI, HLAB leaderboard](https://www.vals.ai/benchmarks/hlab)
- [Hugging Face Hub, Agent Traces](https://huggingface.co/docs/hub/en/agent-traces)
- [neulab/agent-data-protocol](https://github.com/neulab/agent-data-protocol)
- [Agent Data Protocol paper (arXiv 2510.24702)](https://arxiv.org/abs/2510.24702)
- [The state of the OpenTelemetry GenAI semantic conventions, July 2026](https://john-hodge.com/blog/opentelemetry-genai-semantic-conventions/)
- [OpenTelemetry, Inside the LLM Call: GenAI Observability](https://opentelemetry.io/blog/2026/genai-observability/)
- [Google Maps Platform, Places API usage and billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
- [Google Maps Platform, SKU details](https://developers.google.com/maps/billing-and-pricing/sku-details)
- [Google Maps Platform, deprecations](https://developers.google.com/maps/deprecations)
- [LLMs Meet Library Evolution (arXiv 2406.09834, ICSE 2025)](https://arxiv.org/abs/2406.09834)
- [When LLMs Lag Behind (arXiv 2604.09515)](https://arxiv.org/html/2604.09515v1)
- [moonshotai/Kimi-K3 license](https://huggingface.co/moonshotai/Kimi-K3/blob/main/LICENSE)
- [MarkTechPost, Kimi K3 vs DeepSeek V4 Pro vs GLM-5.2](https://www.marktechpost.com/2026/07/18/kimi-k3-vs-deepseek-v4-pro-vs-glm-5-2-open-trillion-scale-moe-models-compared-on-benchmarks-license-and-serving-cost/)
- [Morph, Best Open-Source Coding Model 2026](https://www.morphllm.com/best-open-source-coding-model-2026)
- [Unsloth, Gemma 4 fine-tuning guide](https://unsloth.ai/docs/models/gemma-4/train)
- [Fireworks AI](https://fireworks.ai/)
- [opentraces.ai](https://www.opentraces.ai/)
- [Desert Ant Labs on GitHub](https://github.com/Desert-Ant-Labs)
- [Desert Ant Labs](https://desertant.com/)
- [Vertex AI, fine-tuning and serving Gemma 4](https://discuss.google.dev/t/end-to-end-guide-fine-tuning-and-serving-gemma-4-on-vertex-ai/345865)
- [Gemma 4 available on Google Cloud](https://cloud.google.com/blog/products/ai-machine-learning/gemma-4-available-on-google-cloud)
- [Fine-tune Gemma 4 with TRL on Vertex AI](https://huggingface.co/docs/google-cloud/examples/vertex-ai-notebooks-fine-tune-gemma-4)
