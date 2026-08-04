# Own Your Intelligence: Series Brief

**Status:** raw material + research + structure. Input for draft writer. Nothing here is written prose — it's organized ore.

**Provenance:** four stream-of-consciousness dumps (voice → TTS → cleanup), plus web research conducted 2026-08-03. Raw phrasings preserved in blockquotes throughout. Where TTS garbled something, it's flagged `[TTS?]`.

**Prior posts this builds on:** context engineering with skills; owning your evals. This is act three.

---

## 1. Candidate thesis statements

Pick one, kill the rest.

**A. The distribution ladder (recommended):**
> Docs distribute DX to humans. SDKs distribute it to apps. Skills and MCP distribute it to harnesses. Traces are the only thing that distributes it to weights.

**B. The invariant:**
> The trace corpus is the invariant. Frontier models consume it as benchmark pressure and context; open models consume it as weights. One asset, two distribution paths. You're not predicting who wins — you're selling the thing both sides need either way.

**C. The inversion (strongest single line):**
> The further your traces travel, the less you control them and the longer they last.

**D. The warning:**
> You can deprecate an API. You cannot deprecate a training corpus.

---

## 2. The raw dump, organized

### 2.1 Situation / opening

> "So problem is situation. So on the new [TTS? — model names garbled as "flip and wave"] models that are performing as good as Frontier for, in a lot of cases, the fraction of the cost or all of the IP ownership that you get and control you get over owning your own intelligence, which I like. Fireworks is the marketing model of their own intelligence."

> "The question for development platforms is, what is the intelligence layer that you should own, but also how do you distribute that really good, awesome developer experience into open weight models and frontier models and harnesses everywhere?"

That second sentence is the whole series in one question. It belongs high in post #1.

> "Previously, I talked about context engineering with skills and [owning] your evals. In the next phase of this is to actually take all of those evals and set an objective function..."

### 2.2 The objective function idea

> "...an objective function that you define in multiple different dimensions like cost effectiveness and — woah. Um, like, cost effectiveness and like, performance and, like, how modern it is, how safe and secure, following your terms of service, etcetera, across maybe your top ten solution journeys. And then you have an agent hill climb on performing better on those different dimensions. And you actually do that at scale."

> "And then you also have humans doing that, and you can also have those traces in your own agents that you develop and deploy through your own documentation site or through your own first party developer experience portal."

**Critique to fold in:** a scalar blend of cost + perf + recency + ToS-compliance silently encodes a business weighting into one number, and agents Goodhart it fast. Sharper version: **one primary metric (task success), everything else as gates.** Cost ceiling, security pass/fail, no-deprecated-API check. That's how verifiers actually get built.

**Better placement for the "how modern is it" dimension:** it doesn't belong in the objective function at all. It belongs **in the schema** — stamp every trace with API version + validity window so downstream curators filter by recency. Concrete spec contribution instead of a vibe. (See §4.3 on why this matters more than it looks.)

### 2.3 From evals to weights

> "But then, what you wanna do is you wanna take those golden traces that are performing the best on those objective functions, and you actually want to start fine tuning models with them. You wanna have both pretraining and post-training of models. But that information is available to you. You can [improve] it by supervised fine tuning and reinforcement learning with human feedback on your own developer models, but you can't distribute that to, say, DeepSeek [and] Qwen Coder and Gemma 4."

> "How do you do that? Well, you can publish all of those golden traces, at least a portion of them. And that can be then used. And, obviously, the more centralized, organized, and standard format all this is in, the better."

> "So we should look up what formats exist in open source as part of this blog post in this research."

Research answer in §5.

**Critique:** drop pretraining as an active lever. You have no seat at that table beyond "your docs are in Common Crawl." Keeping it dilutes the specificity of everything else. Pretraining shows up later as a *consequence* (bake-in, §4.3), not a strategy.

### 2.4 The full size range

> "The overall objective here is to make all models, all intelligence distilled into whatever size is appropriate for the application, whether it's like a small on-device model for a single image clipping task all the way up to... or maybe just like a quick 'validate that this place exists' or 'my camera is looking at a business that's identifiable and I can navigate to' or 'I'm at the right entrance point.' You know, if you're thinking about AR, VR, and mobility applications, all the way up to the coding models that you're using or the scientific discovery — which, again, I think those are unlikely you're gonna be fine tuning a huge amount, but you want those models to be using your golden traces of multiturn agent evals that are performing well on these performance, cost efficiency, security, etcetera, end-to-end solution benchmarks."

**Cut to one sentence in post #1.** This is its own post later in the series. But note the instinct buried in it is correct and worth surfacing explicitly: *you fine-tune the small end yourself, you influence the big end through publication.* Two different mechanisms, not one continuum.

### 2.5 The closing hypothesis and sequencing question

> "So I think the next frontier of owning your own intelligence and distributing it into models everywhere, and we should be testing this probably starting small with what are the at-scale specific CUJs that developers need to do cost effectively with your platform. Focus on those CUJs first and then go up to the big coding CUJs afterwards. At least this is my hypothesis. What do you think? Let me know in the comments."

**Resolution to the sequencing question:** it's not small-CUJs-then-big-CUJs on one track. It's two tracks running in parallel with different mechanisms — narrow CUJs you *fine-tune* (you own the weights, no distribution problem), coding CUJs you *benchmark* (labs don't read your docs, they climb benchmarks).

### 2.6 Market signals

> "Harvey just announced, like, a labs function where they're gonna do supervised fine tuning on specific legal data and use cases and publish some of those, make it really easy for legal companies to bring their own data and fine tune models on top of it."

Verified. Details in §6.1.

> "[TTS?] Claude from NP Hardin just started a European local privacy-centric, developer-centric... you know, like, bring your own open weight, fine tuned model. Specific task."

**UNRESOLVED.** Searched the European sovereign / privacy-first / BYO-open-weight space; no match found for that name. Need the actual company before building a paragraph on it. See §10.

### 2.7 Why distillation, not just cost

> "I think that's the direction we need to go here because the fundamental problem is intelligence — general intelligence is expensive, and it will be for a while to run here. And you have all these other dimensions of security and privacy and cost and latency that are not going to solve themselves, but they will if you distill a model down into a smaller size or you fine tune a smaller one for your use case. So I think that's gonna be how we hit production for the next phase of growth here in AI."

**Fix before publishing:** "general intelligence is expensive and will be for a while" is a bet against the cost curve and could age badly inside a year. You don't need it. Durable version:

> Cost falls. Latency floors, data residency, and determinism don't fall with it. Those are the reasons to distill, and they survive whatever happens to per-token pricing.

### 2.8 The both-ways bet

> "There's gonna be increased agentic workflows with the frontier models, and that's gonna be big battles for that. But the developer space will be [different]. And I think the strategy actually suits both. I think you're gonna win with the frontier models and with open models as they battle out, because they'll be using your continually improving, objectively measured and reinforcement-learned appropriate first party interfaces — and from your agent distribution through your skills and context and everything and your evals."

> "You're gonna be improving on their pretraining and post-training, but you're also gonna allow your developer team to bring their own model and use that same level of distilled intelligence for the tasks that your platform is really good at, out of the integrations from your platform that you're really good at."

As written this reads as hedging ("we win either way"). Tighten to thesis B: the corpus is the invariant, two distribution paths, no prediction required.

### 2.9 Partner and integration traces

> "That can be part of the next phase of partnerships here as well, as you need those eval traces for all the different partners that you are connected with — like the cloud platforms, like GCP and AWS; like the database platforms, like Snowflake and BigQuery; like the communications platforms like Twilio; and Stripe for payments and Adyen for payments. So this could be the next phase, and I'm excited to see where to go."

**This is the most original idea in the entire dump.** Single-vendor traces are commodity — anyone can synthesize them from public docs. **Integration traces are scarce because only the party sitting at the seam can produce them.** GMP×BigQuery, GMP×Twilio, GMP×Stripe. That's a moat argument and it's the one thing here not downstream of Harvey. Own post.

### 2.10 The four beneficiaries

> "If you own that layer, you're not gonna open source all of it, but a good chunk of it. You have your own first party agents and features in your product, in your platform that you're powering. Your ability to run a feature or capability with a cheaper, faster, more performant, more privacy-centric model offers you lots of opportunity to compete with a better product, with better margins, with better user experience, better latency. But also with more security [and] pricing — all your non-tangibles are huge as well."

> "So this is a benefit for you for your own AI features in your application. There's a benefit for running things at scale, [and] the benefit for doing things on the edge. It's a benefit for all users using any model as long as you can get the distribution of a high-performing context and get other companies and models or partners to use it as part of their pretraining and post-training — in particular, post-training."

> "And finally, it's [a moat?] if you get into pre-training. Because these weights get baked into models on the frontier side for quite a long time."

Structured in §4.

### 2.11 Format and demo direction

> "I also wanna weave in a couple of, like, a basic example that I did. Obviously it's gonna be based on Google Maps Platform, but it should be really basic. It should be nothing work-based. It should have some basic proof that supervised fine tuning and reinforcement learning on a base model — probably use Gemini for it, obviously, or Gemma 4 would be ideal — to show that I can, you know, still, before and after, right? And I should open with that and then the conundrum. Then I should have a whole series on this basically."

Demo spec in §7. Series structure in §9.

---

## 3. The conundrum (the hook)

The pivot after the demo table:

> I can do this for myself in a weekend. I cannot do it for every developer on my platform, and I cannot ship weights into DeepSeek. So what's the distribution mechanism?

Three mechanisms, ascending leverage, descending control:

1. **You fine-tune.** Small, narrow CUJs — place validation, entrypoint disambiguation, on-device work. You own the weights. No distribution problem to solve.
2. **You publish into corpora people actually train on.** Your traces are a rounding error unless they land in piles labs already reach for (see §5).
3. **You get your CUJs into a benchmark labs optimize against.** The real lever. This is AEO extended one layer down — from share-of-voice in agent engines to **share-of-gradient in model training.** Labs don't read your docs. They climb benchmarks.

---

## 4. The ladder (business case)

The four beneficiaries from §2.10 aren't parallel — they trade control against durability.

| Tier | Control | Time to impact | Lifespan | What you capture |
|---|---|---|---|---|
| Your own first-party features | Total | Weeks | Until you retrain | Margin, latency, privacy posture |
| Developers bringing their own model | High | Months | Until your API changes | Ecosystem lock-in |
| Open-weight post-training | None | Quarters | Model generation | Share-of-gradient |
| Frontier pretraining | Zero | Years | Very long | Default correctness, everywhere |

Control decreases going down. Durability increases. **That inversion is the thesis.**

### 4.1 Publish / withhold / never

Readers will ask where the line is on "not all of it, but a good chunk." Give them three buckets:

- **Publish** — traces over your public API surface. This is marketing. You want it in every corpus on earth.
- **Withhold** — anything encoding customer data, or your internal routing and cost-optimization logic. That's what makes first-party features better than what a developer can rebuild from the public corpus.
- **Never publish** — your held-out eval. Publishing converts a gate into a training set and you lose the ability to measure.

Maps cleanly onto the tier-1-vs-tier-3 split: **you open the surface, you keep the optimization.**

### 4.2 You cannot publish your eval and keep it

Operational consequence worth its own section. Publishing golden traces burns them as an eval set. The architecture has to be explicit and stated up front:

- **Private held-out eval** → gates launches.
- **Public trace corpus** → teaches models.

Same artifact shape, different lifecycle, and mixing them contaminates both. (Note: leakage is a known failure mode — training on data adjacent to your benchmark improves scores while real-world reliability stays flat.)

### 4.3 The bake-in cuts both ways

The sharpest unwritten point in the series. Raw framing was pure upside — weights persist, so you win for years. But:

**You can deprecate an API. You cannot deprecate a training corpus.**

Every wrong param, legacy field name, or pattern you publish and later sunset gets baked in and keeps coming back out of models for years after you killed it. This isn't hypothetical — models still confidently emit legacy Places and Directions params long after those surfaces retired. It's the daily tax on your team already. Publishing at scale means you're now *choosing* to add to it.

Discipline that falls out:
- Publish only what you'll support for five years.
- Stamp every trace with API version + validity window.
- Recency belongs in the schema, not the objective function.

### 4.4 Fine-tunes rot

Every deprecation, new SKU, changed field mask invalidates a checkpoint. Harvey doesn't feel this hard — legal doctrine moves slowly. A platform with a versioned API surface feels it every quarter.

Conclusion: **the durable artifact isn't the checkpoint, it's the trace-generation pipeline** that can re-mint a corpus on every API change. Nobody else writing about this has platform-side scar tissue. This is the differentiated paragraph.

### 4.5 Honesty check on margins

The first-party economics are real, but there's an uncounted term: you're trading inference COGS for MLOps headcount, retraining cadence, and eval maintenance. At platform scale it pencils out easily. For most readers it won't. One sentence acknowledging break-even keeps the piece from reading vendor-brained and costs nothing, because your own case clears the bar by an order of magnitude.

---

## 5. Format landscape (the research he asked for)

Three layers. Conflating them is the mistake most people make.

### 5.1 Capture — OpenTelemetry GenAI semantic conventions

- Standardizes span names, attribute keys, and metrics so an LLM call looks the same regardless of emitter. Covers LLM client calls, agent orchestration, MCP tool calling, content capture, and quality evaluation — six layers.
- **Coding agents now emit these natively** — Claude Code, Codex, GitHub Copilot. Strong signal it's the de facto capture format.
- Maturity caveat: still Development status as of v1.41; most `gen_ai.*` attributes carry Development stability badges, so names can change without a major version bump. There was a repo split in June 2026 (`semantic-conventions-genai`). **Pin the version, isolate convention strings behind a thin mapping layer, don't treat exact attribute strings as a frozen contract.**
- MCP tracing layer exists and matters directly for the GMP MCP server.

### 5.2 Interlingua — Agent Data Protocol (ADP)

This is the one to build toward. CMU / Ohio State / collaborators.

- A lightweight representation language acting as an "interlingua" between heterogeneous agent datasets and downstream training pipelines. Covers API/tool use, browsing, coding, software engineering, general agentic workflows.
- Implemented as **Pydantic schemas.** Every trajectory is a `Trajectory` object: `id`, `content` (alternating sequence of actions and observations), `details`.
- Five primitives: **Actions** = API action, code action, message action. **Observations** = text observation, web observation.
- Three-stage pipeline: Raw → Standardized (ADP) → SFT (renders into target agent framework's chat template), plus automated quality assurance validation.
- Collapses integration effort from O(datasets × harnesses) to O(datasets + harnesses).
- Released **ADP Dataset V1**: 1.3M trajectories unified from 13 existing datasets. Reported ~20pp average gains over base models across coding, browsing, tool use, research benchmarks — e.g. SWE-Bench 7B from 0.4% → 20.2%, AgentBench-OS 3.5% → 27.1%. Cross-task transfer observed: diverse ADP data beats single-domain training.
- Links: `github.com/neulab/agent-data-protocol` · `arxiv.org/abs/2510.24702` · `agentdataprotocol.com` (conversion demo) · HF collection `neulab/agent-data-collection`

### 5.3 Tokenizer-facing — ShareGPT / ChatML JSONL

Lowest common denominator. Whatever you publish, someone will render it to this.

- AgentTrove (`open-thoughts/AgentTrove`): 1.7M agentic traces, exports to clean ShareGPT-style JSONL for SFT.
- Nous Hermes Agent saves trajectories in ShareGPT-compatible JSONL specifically for training data, debugging artifacts, and RL datasets. Note their detail on normalizing tool-stat schemas to keep HF/Arrow loading consistent — practical gotcha worth a line.
- NVIDIA Open-SWE-Traces → standardized message dicts + ChatML-style text is a documented worked example of the conversion.

### 5.4 The pipeline recommendation

> **Capture in OTel GenAI → normalize to ADP → render to the target chat template.**

Concrete, checkable, shippable. This is what makes it a Ryan post rather than a think piece.

### 5.5 Adjacent / worth a mention

- Agent-trajectory SFT precedents: ToolACE (synthetic function-calling SFT, deliberate format diversity across JSON/YAML/XML/Markdown over a 26k-API pool), ToolACE-R, ToolMind, AgentOhana (unified JSON dict format carrying `user query`, `model name`, `score` — designed to enable DPO / pairwise preference construction), CodeAct (collapse heterogeneous tool calls into Python).
- `opentraces.ai` — CLI for crowdsourcing coding-agent session traces as structured JSONL on HF Hub, training-first schema, content-hash dedup, privacy filters. Direct precedent for a trace commons.
- Prefer **execution-based scoring** over judges wherever possible (WebArena programmatic validation, SWE-bench containerized tests) — lower variance, CI-friendly. And **track cost-to-success** (tokens, retries, tool calls), because agents can pass by brute force and still be unusable. That second point is your cost dimension, already validated as standard practice.

---

## 6. Proof points

### 6.1 Harvey — the anchor case

They ran the entire stack in a different vertical, in the right order:

1. **Open benchmark first.** Legal Agent Benchmark (LAB), announced May 6 2026: 1,200+ agent tasks across 24 legal practice areas, graded against 75,000+ expert-written rubric criteria. Deliberately launched *without* a leaderboard pending community normalization standards. Explicitly intended to evolve toward datasets usable "not only for evaluation but for improving models through fine-tuning and training."
2. **Labs pay attention.** Acknowledged contributors include Anthropic, OpenAI, Nvidia, Google DeepMind, Mistral, LangChain, Fireworks, Snorkel, Mercor, Stanford LIFTLab. **This is "get your CUJs into a benchmark labs optimize against," working, in public.**
3. **Then the weights.** June 18 2026: building its own legal foundation model series alongside third-party models. Two stated goals — frontier-level intelligence across product surfaces at lower cost with stronger security posture, and foundations for firms to build and own specialized models on their own data.
4. **Partners:** Baseten, Fireworks AI, Applied Compute, Trajectory Labs, Nvidia. Early research showed post-trained open-weight models approaching frontier performance on legal tasks.
5. **Open by default:** committed to open-sourcing data, models, and research "as much as possible."
6. **Competitive trigger:** frontier labs pushing into the vertical — Claude for Legal, OpenAI hiring Ironclad's founder for legal. Thomson Reuters also announced a legal foundation-model strategy off its own datasets.

Benchmark → data → weights. Use as the anchor case, not a passing mention. The GMP version of this argument is identical with the nouns swapped.

### 6.2 Open-weight landscape (for the opening paragraph)

Whichever models you meant by "flip and wave," current state as of Aug 2026:

- **Kimi K3** (Moonshot, launched July 16 2026): 2.8T MoE, 1M context. #1 on Arena.ai Frontend Code Arena — first open model to lead frontend coding, ahead of Claude Fable 5. 93.4% SWE-bench Verified on Vals AI's independent harness. Open weights ~July 27.
- **GLM-5.2** (Zhipu / Z.ai, June 13 2026): 744B MoE / 40B active, MIT, 1M context. Top open model on Artificial Analysis Intelligence Index. List $1.40/$4.40, provider median closer to $0.55/$1.85 *because open weights let third parties compete on hosting* — good micro-point about what "owning" actually buys.
- **DeepSeek V4:** leads raw SWE-bench Verified among downloadable weights (80.6% Pro-Max, vendor-reported), MIT. V4 Flash at $0.14/$0.28 with 1M context — the price floor.
- **Qwen3-Coder-Next:** 80B total / 3B active, Apache 2.0, runs local in ~45-46GB. 70.6% Verified. The efficiency play, and the most relevant reference point for your "distill to appropriate size" argument.
- Frontier comparison: GPT-5.6 Sol 96.2%, Fable 5 95.0%. So top open trails frontier by ~15pp on Verified but at roughly a tenth of output price.
- Useful framing quote to paraphrase: *the interesting fight in coding models is no longer open vs. closed, it's open vs. open.*

**Caveat to state in the post:** most of these are vendor-reported numbers on benchmarks the vendors optimize for. That's precisely the argument for owning your own eval — which is the callback to your previous post.

### 6.3 Fireworks

> "Fireworks is the marketing model of their own intelligence."

They're also a named Harvey partner and a named LAB contributor. Same play, from the infrastructure side. Worth one line noting the pattern: infra vendors are actively marketing "own your intelligence" *and* supplying the labs function to make it real.

---

## 7. The demo: field masks

The right proof, and small enough to actually ship.

**Task:** fine-tune Gemma 4 to emit correct field masks for Places / Routes requests.

**Why this task and not something bigger:**

- Base models reliably get it wrong — they regress to legacy Places / Directions params. So the "before" column is genuinely bad, which makes the table worth looking at.
- **Programmatically verifiable, no judge:** schema-valid → live 200 → returned fields match requested mask.
- **Over-requesting fields moves you to a higher billing SKU.** So a correct field mask is simultaneously a correctness metric *and* a cost metric. One grader proves two axes of the objective function in a single number. This is the money shot: "cost-effectiveness as a training signal" demonstrated concretely rather than asserted.
- It's a real developer pain point, so the demo doubles as a useful artifact.

**RL reward (RLVR, no LLM judge):**
```
+1  if HTTP 200 AND requested mask == required field set
-λ  per over-fetched billable field
 0  if schema-invalid or non-200
```

**Scope:** 300–500 synthetic tasks. LoRA. Single consumer GPU (24GB class handles it; QLoRA tooling is Unsloth / Axolotl / TRL). Weekend project, which is the point.

**Non-work framing:** run it off the backyard project — "find nurseries near me, return only the fields I need." Personal, public APIs only, nothing internal.

**Open the post with this table, above the fold:**

| | Gemma 4 base | +SFT | +RL |
|---|---|---|---|
| Schema-valid % | | | |
| HTTP 200 % | | | |
| Exact mask match % | | | |
| Mean billable SKU tier | | | |
| Tokens per successful call | | | |
| Cost per successful call | | | |

Then the conundrum (§3). Then the ladder (§4).

---

## 8. Things to cut or compress

- The full AR/VR/mobility → scientific discovery size range (§2.4): one sentence, then a forward-reference to a later post.
- Pretraining as an active strategy (§2.3): cut. Reappears in §4.3 as a consequence.
- "General intelligence is expensive and will be for a while" (§2.7): replace with the latency/residency/determinism framing.
- The partner list (§2.9): don't bury it as a trailing list. Promote to its own post.

---

## 9. Series structure

1. **The field-mask demo + the conundrum.** Table above the fold. Harvey as proof the sequence works. The ladder as the business case. Ends on: what's the distribution mechanism?
2. **Evals that gate vs. evals that teach.** Objective functions, verifiers, primary-metric-plus-gates, why you can't publish your eval and keep it, execution-based scoring over judges, cost-to-success as a first-class metric.
3. **Formats.** OTel GenAI → ADP → chat template. The version-stamping / validity-window argument. Why "you cannot deprecate a training corpus" changes what you're willing to publish.
4. **Distribution.** Fine-tune vs. publish vs. benchmark — the 2×2. Share-of-gradient as the successor to AEO. Control-vs-durability inversion.
5. **Integration traces as the scarce asset.** GMP×BigQuery, ×Snowflake, ×Twilio, ×Stripe, ×Adyen. Only the party at the seam can produce them. Partnership implications.

---

## 10. Open items

- **Unresolved reference:** the European privacy-first / BYO-open-weight company, heard as "Claude from NP Hardin." Searched the EU sovereign-AI space without a match. Need the real name before it goes in.
- Confirm which models "flip and wave" was — Kimi K3 and GLM-5.2 is the likely pair given the cost/parity framing, but the opening paragraph shouldn't guess.
- Check whether ADP has shipped a v2 or changed schema since the March 2026 arXiv revision before citing the primitives.
- Decide whether the demo runs on Gemma 4 (better story: open weights, self-hostable, matches the thesis) or Gemini (easier tooling, weaker story). Gemma is the right call if the tuning path is workable.
- Verify current GMP field-mask → SKU tier mapping before publishing any cost numbers.
