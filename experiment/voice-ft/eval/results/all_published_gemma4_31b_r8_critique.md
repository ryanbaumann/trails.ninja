# Gemma 4 31B Dense (Round 8 LoRA) Editorial Review of Published Articles

- **Model**: `models/gemma-4-31b-it-4bit`
- **Adapter**: `adapters/gemma-4-31b-ryan-voice-v8`
- **Total Articles Reviewed**: 6
- **Total Duration**: 1298.9s

## builder-platforms-grow-by-owning-the-agent-loop
**Path**: `portfolio/content/writing/builder-platforms-grow-by-owning-the-agent-loop.md`

### Voice, AI Tells & Punctuation Audit (83.39s)
### Voice Audit Results

**Overall Grade:** B+
The structure is strong, the technical thesis is sound, and the framing is developer-centric. However, it still carries some "corporate essay" residue: passive phrasing, hedging, and a few banned punctuation marks. It reads like a high-quality whitepaper, not a field engineer sharing a working system.

#### 1. Hard Violations (Immediate Fixes)
*   **Em-dashes:** None found. (Pass)
*   **Semicolons:** Found one in the second paragraph ("...blame the model: they experience..."). While a colon, it functions as a pivot. Replace with a period for more punch.
*   **Banned Buzzwords:** 
    *   "Developer journey" (Found in third image caption). Delete immediately.
    *   "Empower/Solution": None found. (Pass)
*   **Passive Voice (Own Work):** 
    *   "A builder platform can't anchor its developer experience to either one" $\rightarrow$ "Don't anchor developer experience to either one."
    *   "A passing eval only says the path can work" $\rightarrow$ "A passing eval only proves the path can work."

#### 2. Structural & Tone Friction
*   **False Antithesis:** "The model is not the strategy" is a strong headline, but the section opens with a textbook definition ("A coding agent is a model plus a harness"). This is an AI tell. Cut the definition; start with the friction.
*   **The "Hedge":** "A builder platform needs to own the feedback loop..." $\rightarrow$ "Own the feedback loop." Remove the permission; give the order.
*   **Missing "Shipped" Artifact:** The section "Distribution makes the learning compound" is where the real authority lives, but it's buried near the end. The opening should reference the Google Maps Platform work immediately to establish credibility before the theory.

#### 3. Line-Level Corrections

| Original Line | Fix / Action | Why |
| :--- | :--- | :--- |
| "When a developer asks a coding agent..." | "A developer asks a coding agent to build with your platform. That session is the product." | Too wordy. Make it an immediate observation. |
| "The best model will change, and so will the agent harness wrapped around it." | "Models and harnesses evolve weekly." | Avoid "will change"—state it as a present reality. |
| "Our team runs this loop across Google Maps Platform..." | **Move this to the top.** | Open with the artifact, then explain the loop. |
| "A critical developer journey passes through..." | "A critical task passes through..." | "Journey" is a corporate buzzword. |
| "Start small and let the loop compound." | "Start with ten tasks. Let the loop compound." | More direct. |
| "If you're building developer platforms... join the conversation below." | Delete entire closing sentence. | Generic LinkedIn CTA. End on the technical instruction. |

#### 4. Final Verdict
The draft is 80% there. To make it "Ryan," it needs to stop explaining what a platform *should* do and start explaining what you *did* at Google Maps Platform to solve these specific failures. Replace the theoretical framework with a field report.

### Narrative Arc, Hook & Pacing (45.74s)
### Critique

**1. Hook: Fail**
The opening is an abstract thesis. "When a developer asks a coding agent..." is a general observation about developer experience, not a concrete moment of friction. It frames the problem as a theoretical risk rather than a specific failure mode.

**2. Pacing: Fail**
The structure is a traditional thesis-first essay, not growth-backwards. It spends the first half of the piece explaining the philosophy of harnesses and evals before mentioning what was actually done. The real result—running this loop across Google Maps Platform using portable agent skills—doesn't appear until the "Distribution" section near the end. The lesson is buried under the theory.

**3. Ending: Pass**
The closing is clean. It avoids a "mission accomplished" declaration and asks the reader to share their own loop structures. It opens the discussion rather than closing the case.

**Direct Fixes:**
- **Move the "Distribution" section to the top.** Open with: "Our team runs an eval loop across Google Maps Platform using portable agent skills and a task-based eval suite."
- **Replace the intro** with a specific developer failure: "A developer asks an agent to integrate your API, but it uses a deprecated endpoint and writes code that crashes on boot. They don't blame the model; they blame your platform."
- **Connect the technical details** (RLVR, deterministic checks) directly to the results found in the Google Maps project, rather than presenting them as general textbook knowledge.

### Concrete Line-Level Rewrites (80.58s)
This opening is too abstract. It frames the problem as a theory rather than a friction point developers actually hit. The middle sections use passive constructions that obscure the platform's role.

Here are the specific line-level rewrites to sharpen the voice and enforce the growth-backwards framing.

### The Opening
**Original:** When a developer asks a coding agent to build with your platform, that session becomes part of how they experience your product. If the agent chooses the wrong API, misses an authentication step, or writes code that fails to compile, the developer doesn't blame the model: they experience that failure as your platform, and they leave.
**Rewrite:** "I can't get this API to work," is rarely what a developer says when a coding agent hallucinates a parameter or misses an auth step. They just experience a broken platform and leave. When an agent writes code for your product, the agent's mistakes are your product failures.

### The Strategy
**Original:** A builder platform can't anchor its developer experience to either one. It needs to own the feedback loop that keeps core developer tasks working as models and agents move around it.
**Rewrite:** Don't anchor your developer experience to a single model or harness. Own the feedback loop instead. That ensures core tasks stay functional even as the underlying models shift.

### The Loop Definition
**Original:** Evals test the context. Distribution puts the tested path in more hands, while outcome signals show where it still falls short. After review, some failures become new tasks and some successes become better examples.
**Rewrite:** Use evals to test your context. Use distribution to put working paths into more hands, and use outcome signals to find where they break. Turn those failures into new tasks and the successes into better examples.

### The Technical Mechanism
**Original:** Pretraining gives a model broad capability. Post-training turns that capability toward a job through human demonstrations and preferences or through rewards.
**Rewrite:** Pretraining gives the model raw capability. Post-training turns that capability into a job using human demonstrations, preferences, or rewards.

### The Eval Guardrails
**Original:** Keep a meaningful slice of tasks and answers out of the context and tuning loop. Otherwise the system can learn the test instead of the job.
**Rewrite:** Hold out a representative slice of tasks and answers from your training loop. If you don't, the system learns to pass the test instead of doing the job.

### The Measurement
**Original:** A builder platform needs a first-party measurement path, either through a surface it owns or a partner harness with clear permission and privacy boundaries. The point is to govern what gets measured and shared, not to replace every coding agent.
**Rewrite:** Build a first-party measurement path, whether through your own surface or a partner harness with strict privacy boundaries. Your goal is to govern the data, not to replace every coding agent.

### The Closing Proof
**Original:** Our team runs this loop across Google Maps Platform using portable agent skills and a task-based eval suite. When a new model ships, we run the evals, review the failure traces with product and engineering, and update the context.
**Rewrite:** We run this loop across Google Maps Platform using portable agent skills and a task-based eval suite. The workflow is simple: a new model ships, we run the evals, review failure traces with product and engineering, and update the context.

## can-i-build-an-ai-agent-that-doesnt-write-slop
**Path**: `portfolio/content/writing/can-i-build-an-ai-agent-that-doesnt-write-slop.md`

### Voice, AI Tells & Punctuation Audit (114.18s)
### Voice Audit Report

**Overall Grade:** B+
The structure is excellent: it opens with a real problem, anchors the claims in a public artifact (the GitHub repo), and concludes with a concrete architectural lesson. The technical density is correct. However, there are lingering "AI-isms" and punctuation violations that undermine the authority of the voice.

#### 1. Mechanical Violations
*   **Em-Dashes:** Found zero. (Pass)
*   **Semicolons:** Found one in the alt-text of the final image. While acceptable in alt-text, it creeps into the formal structure.
*   **Passive Voice (Own Work):**
    *   *"I decided to test whether fine-tuning... could teach an open-weight model my own editorial style."* $\rightarrow$ Wordy.
    *   *"I built the training setup around four components:"* $\rightarrow$ Active. (Pass)
    *   *"The input is a passive, corporate status report..."* $\rightarrow$ Descriptive. (Pass)
*   **Banned Buzzwords:**
    *   *"Collaborator"* (Borderline, but acceptable in context).
    *   *"Journey"* / *"Empower"* / *"Solution"*: None found. (Pass)

#### 2. AI Tells & Rhetorical Friction
*   **False Antithesis Flip:** The author explicitly mentions this in Task 3, but the essay itself still uses a few subtle "Not X, but Y" structures:
    *   *"Fine-tuning fixes the sound and cadence of writing, but only a human fixes the thinking."* $\rightarrow$ This is a classic AI closure. It sounds like a LinkedIn summary rather than a builder's conclusion.
*   **Trivial Self-Credit:**
    *   *"I ran the entire training and evaluation workflow locally on my M4 Pro MacBook... giving me privacy and fast iterations... with zero API costs."* $\rightarrow$ Slightly over-explaining the benefit. Cut the "zero API costs" fluff; the reader already knows local means free.

#### 3. Line-Level Corrections

**Section: Step 1**
*   *Original:* "Some models struggled more than others."
*   *Critique:* Filler sentence. Delete it and go straight to the evidence.
*   *Fix:* "Claude Opus 5 leaned heavily into self-referential commentary."

**Section: Step 2**
*   *Original:* "I decided to test whether fine-tuning (using QLoRA on Apple Silicon) could teach an open-weight model my own editorial style."
*   *Critique:* "I decided to test whether" is a tentative opening.
*   *Fix:* "I used QLoRA on Apple Silicon to see if fine-tuning could teach an open-weight model my editorial style."

**Section: Side-by-Side Experiments (Task 2)**
*   *Original:* "The base model added textbook filler ('caused severe queue backups', 'dramatically dropped')."
*   *Critique:* Good, but can be tighter.
*   *Fix:* "The base model added textbook filler like 'caused severe queue backups' and 'dramatically dropped'."

**Section: What I learned**
*   *Original:* "Fine-tuning open models locally helped me build intuition about where model weights help, where context engineering is enough, and where you need human editorial judgment."
*   *Critique:* Generic summary opening.
*   *Fix:* "Local fine-tuning showed me exactly where weights beat context and where human judgment is the only reliable gate."

**Section: The verdict**
*   *Original:* "Fine-tuning fixes the sound and cadence of writing, but only a human fixes the thinking."
*   *Critique:* Pure AI sentimentality.
*   *Fix:* "Fine-tuning handles the cadence. I still handle the thinking."

#### 4. Summary of Required Changes
1. **Remove the "Not X, but Y" closure.**
2. **Delete "Some models struggled more than others"** (and similar transitional filler).
3. **Tighten "I decided to test whether"** into direct action.
4. **Scan alt-text for semicolons** to ensure 100% mechanical purity.

### Narrative Arc, Hook & Pacing (67.84s)
Here is the critique of the article based on Ryan Baumann's editorial standards.

### 1. Hook: Fail
The opening is a thesis statement: *"Raw AI copy is predictable: cheerful, generic, and full of buzzwords."* This is an abstract claim, not a moment of friction. It opens on a general truth rather than a specific developer problem or a quoted objection. To fix this, open with the exact frustration of seeing a "delighted to share" draft or a specific prompt failure that led to the project.

### 2. Pacing: Pass (with a caveat on friction)
The structure follows the required growth-backwards path:
- **Result**: The side-by-side comparisons show immediate proof of the working system.
- **Shipped**: The detailed breakdown of the QLoRA setup on Apple Silicon and the 48-item eval suite explains what was built.
- **Lesson**: The "What I learned" section correctly pivots from the excitement of fine-tuning to the practical reality that a modular pipeline is the superior architecture.

The evidence is strong and the technical details (mask prompt loss, slice paragraphs) provide genuine utility.

### 3. Ending: Pass
The article avoids a "mission accomplished" proclamation. It ends with a practical admission that human judgment is indispensable and closes with a direct, open-ended question to the community: *"tell me what workflows are working for you in the comments."* This shifts the authority from the author to the reader.

### Additional Editorial Notes
- **Punctuation**: The author successfully avoided em-dashes throughout the body.
- **Voice**: The tone is direct, first-person, and evidence-led. The use of "I" anchors the technical experiments in personal experience.
- **Clarity**: The side-by-side tables are the strongest part of the piece; they turn a subjective discussion about "voice" into an objective comparison of token economy and information hierarchy.

### Concrete Line-Level Rewrites (131.55s)
Here are the line-level rewrites. I focused on removing passive constructions, eliminating "AI-isms" (like "demonstrated significant quantitative improvements"), and enforcing the growth-backwards framing.

### Section 1: Opening & Context Engineering
*   **Original:** "I wanted a private editing agent that matches my cadence, preserves exact benchmark numbers, and challenges weak structure while leaving narrative judgment to me."
*   **Rewrite:** "I needed an editor that matched my cadence, kept benchmark numbers exact, and challenged weak structure without overstepping on narrative judgment."

*   **Original:** "I started with context engineering: system prompts and skill files containing personal voice guidelines."
*   **Rewrite:** "I started with context engineering: system prompts and skill files built on my own voice guidelines."

*   **Original:** "Agents with this context followed negative constraints reliably: they stopped using announcement clichés and stripped out obvious marketing filler."
*   **Rewrite:** "The agent followed negative constraints well. It stopped using announcement clichés and stripped out obvious marketing filler."

*   **Original:** "Claude Opus 5 leaned heavily into self-referential commentary. GPT 5.6 Sol handled technical syntax cleanly but felt robotic."
*   **Rewrite:** "Claude Opus 5 kept adding self-referential commentary. GPT 5.6 Sol handled technical syntax cleanly but sounded like a robot."

### Section 2: Fine-Tuning & Technical Setup
*   **Original:** "I decided to test whether fine-tuning (using QLoRA on Apple Silicon) could teach an open-weight model my own editorial style."
*   **Rewrite:** "I used QLoRA on Apple Silicon to see if I could teach an open-weight model my editorial style."

*   **Original:** "I ran the entire training and evaluation workflow locally on my M4 Pro MacBook (48 GB unified memory). Keeping it local gave me privacy and fast iterations on training, with zero API costs."
*   **Rewrite:** "I ran the full training and evaluation workflow on my M4 Pro MacBook (48 GB unified memory). Running locally kept my data private, iterations fast, and API costs at zero."

*   **Original:** "I built the training setup around four components:"
*   **Rewrite:** "The setup had four parts:"

*   **Original:** "Getting fine-tuning to work reliably on my Macbook M4 Pro took two key adjustments to prevent memory exhaustion:"
*   **Rewrite:** "I made two adjustments to prevent memory exhaustion on the M4 Pro:"

### Section 3: Results & Evals
*   **Original:** "Across the 48-item held-out evaluation suite, the fine-tuned Gemma 4 31B Dense adapter demonstrated significant quantitative improvements over baseline prompting:"
*   **Rewrite:** "The fine-tuned Gemma 4 31B Dense adapter beat baseline prompting across the 48-item test suite:"

*   **Original:** "I compared three approaches on live writing tasks to see the actual impact."
*   **Rewrite:** "I ran three pipelines on live writing tasks to compare the results."

### Section 4: Task Analysis
*   **Original:** "The base frontier model defaulted to passive bureaucratic constructs and added unevidenced claims ('improved resource efficiency')."
*   **Rewrite:** "The base model defaulted to bureaucratic phrasing and added claims it couldn't back ('improved resource efficiency')."

*   **Original:** "The base model added textbook filler ('caused severe queue backups', 'dramatically dropped')."
*   **Rewrite:** "The base model added textbook filler like 'caused severe queue backups' and 'dramatically dropped'."

*   **Original:** "The base model gave conversational praise without diagnosing any issues."
*   **Rewrite:** "The base model gave empty praise and ignored the actual problems."

### Section 5: Conclusion & Takeaways
*   **Original:** "Fine-tuning open models locally helped me build intuition about where model weights help, where context engineering is enough, and where you need human editorial judgment."
*   **Rewrite:** "Training locally taught me where model weights help, where context engineering suffices, and where only a human can make the call."

*   **Original:** "A modular pipeline of deterministic regex linters, a focused structural prompt, and offline link/citation checkers outperforms a single fine-tuned model for everyday writing workflows:"
*   **Rewrite:** "A modular pipeline beats a single fine-tuned model: use deterministic regex linters, focused structural prompts, and offline citation checkers."

*   **Original:** "Separating these concerns into small, atomic checks is easier to debug, simpler to maintain, and avoids the overhead of managing local fine-tuning

## devex-is-a-growth-discipline
**Path**: `portfolio/content/writing/devex-is-a-growth-discipline.md`

### Voice, AI Tells & Punctuation Audit (83.1s)
### Voice Audit

**General Verdict:** The structure is strong and opens with the result. However, it occasionally slips into "corporate manifesto" tone with abstract nouns and missing contractions. It avoids the worst AI tropes, but needs more grit to sound like a practitioner leading in public.

#### 1. Grammar & Syntax Violations
*   **Em-dashes:** None found. (Pass)
*   **Semicolons:** None found. (Pass)
*   **Passive Voice:** "Documentation requests feel like progress" (Active). "The right path also needs to appear" (Active). The draft avoids claiming its own work in the passive. (Pass)
*   **Banned Words:**
    *   "Developer journey" (Not present, but "path" is used frequently; acceptable).
    *   "Empower" (None).
    *   "Solution" (None).

#### 2. Rhetorical & Tone Red Flags
*   **False Antithesis:** "treating DevX as a growth discipline, not a documentation queue." This is a classic Ryan framing; it stays because it defines the thesis through a concrete contrast.
*   **AI Tells:** "This is the discipline" and "Join the discussion below" are generic closing signals. They lack the punch of a personal takeaway.
*   **Abstracts:** "Developer friction shows up everywhere" is a bit vague. It needs to start with the artifact, not the concept.

#### 3. Line-Level Corrections

**Section: Own the friction**
*   *Current:* "Developer friction shows up everywhere: failed first runs, abandoned evaluations, support tickets, GitHub issues, field conversations, and user research."
*   *Critique:* Starts with an abstract noun ("friction").
*   *Fix:* "Friction shows up in failed first runs, abandoned evals, and GitHub issues."

**Section: Ship the fix where builders work**
*   *Current:* "A great experience has no impact if builders never encounter it."
*   *Critique:* Generic opening.
*   *Fix:* "The best experience doesn't matter if a builder never sees it."

**Section: Measure and own outcomes**
*   *Current:* "Traditional feedback loops are slow. Interviews, support themes, and developer surveys remain essential, but they rarely translate into immediate product decisions."
*   *Critique:* Sounds like a textbook. Needs a contraction and more directness.
*   *Fix:* "Traditional feedback loops are too slow. Interviews and surveys are essential, but they rarely drive immediate product decisions."

**Section: Conclusion**
*   *Current:* "This is the discipline: stop counting output as progress by default."
*   *Critique:* Too formal.
*   *Fix:* "The lesson is simple: stop counting output as progress."

#### 4. Structural Opportunities
The second paragraph ("Documentation requests feel like progress...") is a thesis statement. To align with the "Ryan Voice," move the concrete examples (docs, code samples, tutorials) to the front of the paragraph to anchor the claim in reality before stating the lesson.

### Narrative Arc, Hook & Pacing (37.14s)
### Critique

**Hook: Fail**
The opening is a thesis statement. "We more than doubled our unique active users..." is a strong result, but it lacks the necessary friction or tension to anchor the piece. It starts with the victory instead of the problem that made the victory necessary. It opens like a corporate case study rather than a practitioner's field note.

**Pacing: Pass**
The structure follows the required Growth-backwards sequence:
1. **Result:** Doubled active users and increased API engagement.
2. **Shipped:** Code Assist, MCP client integration, and Agent skills.
3. **Lesson:** Treat DevX as a growth discipline with a tight feedback loop (evals -> telemetry -> research).

**Ending: Pass**
The closing avoids the "mission accomplished" trope. It asks a concrete question about tracking and distribution, turning the post into an opening for peer exchange.

**General Notes**
The prose is clean, but it lacks the "dirt" of real work. It describes the system well but ignores the specific friction that sparked the change. The second paragraph attempts to explain the philosophy of docs vs. product, but it stays abstract. Name the specific failure or the specific blocker that drove the team toward agent skills.

### Concrete Line-Level Rewrites (64.8s)
This draft is strong on technical substance, but some of the framing is too abstract. I've tightened the prose to remove passive constructions and replaced vague nouns with concrete actions.

Here are the line-level rewrites:

**1. The Hook**
*   **Original:** "Documentation requests feel like progress, but they are often a symptom of friction that hasn't been solved in the product yet."
*   **Rewrite:** "Documentation requests look like progress, but they usually mask friction that belongs in the product."

**2. Defining the Discipline**
*   **Original:** "The real job is to identify the friction that stalls a builder, fix it directly in the developer experience, place the better path where people already work, and measure the behavioral shift."
*   **Rewrite:** "The job is simple: find the friction stalling a builder, fix it in the experience, place the solution where they already work, and measure the shift in behavior."

**3. Signal Aggregation**
*   **Original:** "Our Voice of Developer program groups repeated friction from Discord, Stack Stack Overflow, GitHub issues, support, field work, and dogfood sessions into ranked product opportunities."
*   **Rewrite:** "Our [Voice of Developer program](/work/voice-of-developer/) aggregates friction from Discord, Stack Overflow, GitHub, and field work into ranked product opportunities."

**4. Agent Design**
*   **Original:** "When builders work through coding agents instead of reading every platform layer themselves, DevX has to design for the person making the decision and the agent acting inside the task."
*   **Rewrite:** "When builders use coding agents, we design for two people: the human making the decision and the agent executing the task."

**5. Distribution Strategy**
*   **Original:** "Documentation is only one distribution surface, not the whole strategy."
*   **Rewrite:** "Documentation is one distribution surface, not the entire strategy."

**6. Workflow Integration**
*   **Original:** "Instead of relying on documentation alone, we distribute executable product behavior directly into developer workflows."
*   **Rewrite:** "We don't rely on documentation alone; we bake executable behavior directly into developer workflows."

**7. The Feedback Loop**
*   **Original:** "Interviews, support themes, and developer surveys remain essential, but they rarely translate into immediate product decisions."
*   **Rewrite:** "Interviews and surveys are essential, but they rarely drive immediate product decisions."

**8. The Closing Thesis**
*   **Original:** "This is the discipline: stop counting output as progress by default."
*   **Rewrite:** "That is the discipline: stop treating output as progress."

## fine-tuning-was-the-easy-part
**Path**: `portfolio/content/writing/fine-tuning-was-the-easy-part.md`

### Voice, AI Tells & Punctuation Audit (99.9s)
### Voice Audit: Fieldwork Post

**Overall Grade:** Strong. The structure follows the growth-backwards pattern (result $\rightarrow$ evidence $\rightarrow$ lesson), and the author's voice is grounded in concrete artifacts. However, there are structural leaks and forbidden punctuation that need immediate correction.

#### 1. Mechanical Violations
*   **Em-dashes:** Found four.
    *   *"...exact-match field masks, including all eight training cases and one of the two held out."* (Wait, no em-dash there, but check the next one)
    *   *"...on a prompt-injection request, it over-fetches four fields."* (No em-dash)
    *   *"...the lesson is clear: whether you're teaching a model an author's voice or an API's field mask, grounded examples work."* (Colon is fine, but watch the rhythmic flip)
    *   **Critical:** *"A developer platform doesn't have one narrow job; it has hundreds of core developer tasks across dozens of APIs, and its developers run models and agents the platform will never touch."* $\rightarrow$ Unnecessary semicolon.
    *   **Critical:** *"Docs reach humans; SDKs reach applications; skills and an MCP service reach the agent harness; but only open traces and benchmarks reach the model weights."* $\rightarrow$ Semicolon overload.

#### 2. Tone & Vocabulary Check
*   **Banned Words:**
    *   *"Tuning an adapter per journey..."* $\rightarrow$ **'Journey'** is a corporate buzzword. Replace with 'task', 'workflow', or 'use case'.
*   **AI Tropes / False Antithesis:**
    *   *"The model stops relying on performative AI tropes and starts picking up the actual rhythm..."* $\rightarrow$ This is a 'not X, but Y' flip. It sounds like a LinkedIn AI manifesto. Tighten to direct observation.
*   **Passive Voice:**
    *   *"The field-mask run is one rung on that ladder."* $\rightarrow$ Stating a fact, but lacks punch.
    *   *"How are you handling it?"* $\rightarrow$ Generic closing question.

#### 3. Line-Level Corrections

**Section: Tuning one adapter is the easy part**
*   *"I split the ten cases into eight for training and two held out that the optimizer never saw, and graded exact match:"*
    *   **Fix:** *"I split ten cases into eight for training and two held out. I graded on exact match:"* (Break the long sentence for more impact).

**Section: What I learned**
*   *"The model stops relying on performative AI tropes and starts picking up the actual rhythm and constraints of the author."*
    *   **Fix:** *"The model adopts the author's actual rhythm and constraints."* (Cut the fluff).

**Section: The hard part is distribution**
*   *"A developer platform doesn't have one narrow job; it has hundreds of core developer tasks across dozens of APIs, and its developers run models and agents the platform will never touch."*
    *   **Fix:** *"A developer platform has hundreds of core tasks across dozens of APIs. Its developers run models and agents the platform will never touch."* (Remove semicolon, split into two direct statements).

*   *"Docs reach humans; SDKs reach applications; skills and an MCP service reach the agent harness; but only open traces and benchmarks reach the model weights."*
    *   **Fix:** *"Docs reach humans. SDKs reach applications. Skills and MCP services reach the agent harness. Only open traces and benchmarks reach the model weights."* (Staccato delivery = more authority).

*   *"Tuning an adapter per journey and hoping everyone loads it doesn't scale."*
    *   **Fix:** *"Tuning an adapter per task and hoping everyone loads it doesn't scale."*

#### 4. Summary of Required Changes
1.  **Purge all semicolons.** Replace with periods.
2.  **Delete 'journey'.**
3.  **Kill the 'not X, but Y' framing** in the UMich paragraph.
4.  **Tighten the closing question.** Instead of *"How are you handling it?"*, use something more practitioner-led: *"Post your traces or benchmark links in the comments."*

### Narrative Arc, Hook & Pacing (49.9s)
The piece opens strong and anchors the technical argument in real money, but the structural pacing drifts into a generic thesis before snapping back to the core thesis.

### 1. Hook
**Pass.** The opening avoids a thesis statement. It names a specific technical failure (over-fetching Places API fields) and ties it immediately to a concrete pain point (billing tiers). It establishes immediate stakes.

### 2. Pacing
**Partial Pass.** The arc follows the Growth-backwards framework, but the middle section wavers:
*   **Result:** The first three paragraphs clearly state the problem, the proposed solution (tuning), and the immediate result (10 cases, 9 correct).
*   **Shipped:** The "Tuning one adapter" section details the implementation and the exact-match grade. This is strong.
*   **Lesson:** The "What I learned" section is where the pacing slows. It pivots to external citations (Harvey, UMich) that feel like a traditional essay. It moves away from the shipped artifact to prove a general point. The lesson is clearer when tied to the adapter run, not when it becomes a literature review.

### 3. Ending
**Pass.** The closing avoids a "mic drop" or a claim that the problem is solved. It acknowledges the limitations (10 cases is small) and ends with a specific, practitioner-focused CTA: comparing traces and benchmarks.

### Direct Fixes
*   **Trim the citations:** Cut the UMich study. It's an interesting fact but irrelevant to a developer fixing an API over-fetch. It obscures the technical lesson.
*   **Tighten the pivot:** Connect the "What I learned" section directly back to the field-mask results before discussing broader platform distribution.
*   **Audit punctuation:** The piece avoids em-dashes, maintaining the required directness.

### Concrete Line-Level Rewrites (104.56s)
Here are the line-level edits to sharpen the voice, remove passive constructions, and eliminate wordiness.

### Section 1: The Hook & Thesis

**Original:** Base models make this mistake because their weights are a stale snapshot of the internet. Runtime context like skills, MCP, and llms.txt helps, but for high-volume, cost-sensitive API calls, fine-tuning the model weights on a narrow job beats a much larger base model for a fraction of the inference cost.
**Rewrite:** Base models over-fetch because their weights are a stale snapshot of the internet. Skills, MCP, and llms.txt add useful context, but fine-tuning a small model on a narrow job beats a large base model at a fraction of the inference cost.

### Section 2: Tuning one adapter is the easy part

**Original:** I split the ten cases into eight for training and two held out that the optimizer never saw, and graded exact match: I count a case only when the model returns exactly the fields the request needs, with no extra billable field.
**Rewrite:** I split ten cases into eight for training and two held out. I graded on exact match: the model earns a point only when it returns the required fields with no extra billable noise.

**Original:** The tuned adapter jumped from 2 of 10 to 9 of 10 exact-match masks, including all eight training cases and one of the two held out.
**Rewrite:** The tuned adapter jumped from 2 of 10 to 9 of 10 exact matches, including all eight training cases and one held out.

**Original:** Base E4B under-fetches by returning the first field and dropping the rest; on a prompt-injection request, it over-fetches four fields. The tuned model returns the minimal correct mask and an empty list for the injection; its one held-out miss dropped `places.servesWine` from a request about dogs and wine.
**Rewrite:** Base E4B under-fetches by returning only the first field. On prompt-injection requests, it over-fetches four fields. The tuned model returns the minimal correct mask and an empty list for injections; its single held-out error dropped `places.servesWine` from a request about dogs and wine.

### Section 3: What I learned

**Original:** Tuning the weights works when you have a narrow job and a gradeable output.
**Rewrite:** Tuning works when the job is narrow and the output is gradeable.

**Original:** Held-out performance moved, and the tool-use behavior moved with it.
**Rewrite:** As held-out scores improved, tool-use behavior stabilized.

**Original:** Ten cases, with two held out, is just an early signal; the next version needs a larger held-out set and an answer key checked against live billing tiers.
**Rewrite:** Ten cases is early signal. The next version needs a larger held-out set and an answer key mapped to live billing tiers.

### Section 4: The hard part is distribution

**Original:** My adapter fixes one job on one deployment, but it doesn't help the base model another developer downloads tomorrow or the hosted model another team calls.
**Rewrite:** My adapter fixes one job on one deployment. It doesn't help the developer who downloads the base model tomorrow or the team calling a hosted API.

**Original:** A developer platform doesn't have one narrow job; it has hundreds of core developer tasks across dozens of APIs, and its developers run models and agents the platform will never touch. Tuning an adapter per journey and hoping everyone loads it doesn't scale.
**Rewrite:** A developer platform manages hundreds of tasks across dozens of APIs. Its users run models and agents the platform will never touch, so tuning individual adapters doesn't scale.

**Original:** Docs reach humans; SDKs reach applications; skills and an MCP service reach the agent harness; but only open traces and benchmarks reach the model weights.
**Rewrite:** Docs reach humans, SDKs reach apps, and MCP services reach the agent harness. Only open traces and benchmarks reach the model weights.

**Original:** Each rung down that ladder trades control for reach. Context and tools give me the most direct control and carry current facts into a session, though the agent has to load them; an owned adapter bakes stable behavior into weights for the surfaces I run, but still reaches only my deployment.
**Rewrite:** Each rung down that ladder trades control for reach. Context and tools provide the most direct control, but the agent must load them at runtime. An owned adapter bakes behavior into the weights, but only reaches my own deployment.

**Original:** Call it share of gradient: whether the next generation of models gets shaped

## loop-engineering-coding-agent
**Path**: `portfolio/content/writing/loop-engineering-coding-agent.md`

### Voice, AI Tells & Punctuation Audit (65.18s)
The core structure is strong, but the voice needs more friction. It currently reads like a polished manual rather than a field report.

### Line-Level Audit

**1. Mechanical Violations**
*   **Em-dashes:** None found. Pass.
*   **Semicolons:** "A goal evaluator knows if a test suite passed or if Largest Contentful Paint dropped below 1.8 seconds; it cannot tell you if the agent introduced heavy architectural bloat to get there." -> **Violation.** Unnecessary semicolon. Split into two sentences.
*   **Passive Voice:** "The final repository state is part of the grade" is static. "I grade a technically correct patch as a failure" is active. No direct self-work passive violations. Pass.
*   **Buzzwords:** "empower", "journey", "solution" are absent. Pass.

**2. AI Tells & Rhetorical Fluff**
*   **False Antithesis:** "The failure is usually authority, not intelligence" -> **Violation.** This is a classic AI hook. It frames the argument as a paradox rather than a technical observation.
*   **Vague Transitions:** "Autonomous feedback loops are powerful, but they have a blind spot" -> **Violation.** Generic opening. Cut directly to the friction: the difference between a passing test and a bloated architecture.

**3. Voice & Framing**
*   **Opening:** The first paragraph is a thesis statement. It should open with the friction: a specific failure case where an agent burned through tokens or ruined a repo.
*   **Self-Credit:** "I built the [Loop Engineering prompt package]" is acceptable because it links directly to a functional artifact.

### Required Fixes

**Section: The opening**
*   *Current:* "The fastest way to break a clean codebase is to give an autonomous coding agent an open-red goal and let it loop."
*   *Fix:* Open with a specific failure. "I watched a coding agent write 300 lines of boilerplate to fix a one-line CSS bug because it had no exit condition."

**Section: The failure is usually authority, not intelligence**
*   *Current:* "The failure is usually authority, not intelligence"
*   *Fix:* Change header to "Defining the boundary." Remove the "not X, but Y" framing.

**Section: Retaining judgment in autonomous loops**
*   *Current:* "Autonomous feedback loops are powerful, but they have a blind spot: evaluators only measure deterministic targets."
*   *Fix:* "A passing test suite doesn't mean the code is good. Evaluators check deterministic targets, but they ignore architectural bloat."

**Section: Run the contract**
*   *Current:* "What the contract does is eliminate the common behavioral failures before they compound."
*   *Fix:* "The contract stops behavioral failures before they compound." (Tighten the phrasing).

### Narrative Arc, Hook & Pacing (39.27s)
The writing is clean, but it opens like a textbook. It needs more friction.

**1. Hook: Needs more friction**
The opening is a thesis: "The fastest way to break a clean codebase is..." It names the problem but doesn't show it. Open with a specific failure mode or a quoted objection from a developer who refuses to use agents because they "hallucinate 300 lines of boilerplate." Start with the mess, not the rule.

**2. Pacing: Needs tighter Growth-backwards framing**
The structure is close, but the "Result" is buried.
*   **Current:** Thesis -> General failure -> The tool.
*   **Required:** The working prototype/library -> What it does (the contract) -> Why it was needed (the friction).

The [Loop Engineering prompt package](https://github.com/ryanbaumann/fieldwork/tree/main/agent-scripts/coding-agent-loop) is the result. Name it in the first paragraph, explain what it ships (the primitives and test cases), and then use the "failure is authority" section to explain the lesson learned.

**3. Ending: Strong**
The CTA is correct. It asks for specific traces and failure modes, turning the post into a discussion rather than a victory lap.

**General Notes:**
*   **Punctuation:** You avoided em-dashes. Good.
*   **Voice:** The tone is direct. Keep the "I grade a technically correct patch as a failure" line; that is high-signal evidence.

### Concrete Line-Level Rewrites (80.98s)
This draft is strong on technical detail but drifts into "essay mode" in the middle. The biggest issues are the passive phrasing in the rules section and a few slow openings.

Here are the line-level rewrites to bring this into Ryan's voice:

**1. The Hook**
*   **Original:** The fastest way to break a clean codebase is to give an autonomous coding agent an open-ended goal and let it loop.
*   **Rewrite:** Give an autonomous coding agent an open-ended goal and a loop, and it will break your codebase.

**2. The Mechanism**
*   **Original:** Left without strict stopping criteria, an agent does what models do when they hit friction: it writes 300 lines of boilerplate to bypass a one-line bug...
*   **Rewrite:** Without strict stopping criteria, agents hit friction and overreact: they write 300 lines of boilerplate to bypass a one-line bug...

**3. The Thesis**
*   **Original:** I built the [Loop Engineering prompt package](...) to turn those hard boundaries into a vendor-neutral operating contract.
*   **Rewrite:** I built the [Loop Engineering prompt package](...) to turn those boundaries into a vendor-neutral operating contract.

**4. The Grading Logic**
*   **Original:** I grade a technically correct patch as a failure if it modifies the working tree during a diagnosis task.
*   **Rewrite:** A technically correct patch still fails if the agent modifies the working tree during a diagnosis task.

**5. The Technical Blind Spot**
*   **Original:** Autonomous feedback loops are powerful, but they have a blind spot: evaluators only measure deterministic targets.
*   **Rewrite:** Feedback loops have a blind spot: evaluators only measure deterministic targets.

**6. The Metric Comparison**
*   **Original:** A goal evaluator knows if a test suite passed or if Largest Contentful Paint dropped below 1.8 seconds; it cannot tell you if the agent introduced heavy architectural bloat to get there.
*   **Rewrite:** An evaluator knows if a test suite passed or if Largest Contentful Paint dropped below 1.8 seconds, but it cannot see when an agent introduces architectural bloat to get there.

**7. Rule 1**
*   **Original:** Pick the smallest loop primitive. Default to a single agentic turn. Escalate to iterative goal loops, interval polling, or parallel worktree exploration only when the task requires it.
*   **Rewrite:** Pick the smallest loop primitive. Start with one agentic turn. Escalate to iterative goal loops, interval polling, or parallel worktree exploration only when necessary.

**8. Rule 2**
*   **Original:** Separate the author from the verifier. I make sure the subagent that drafts code is never the sole judge of its correctness.
*   **Rewrite:** Separate the author from the verifier. Never let the subagent that drafts the code judge its own correctness.

**9. Rule 3**
*   **Original:** If a command fails three times with unchanged output, or if an iteration fails to move a measurable metric, the loop stops and returns control to the human.
*   **Rewrite:** Stop the loop and return control to the human if a command fails three times with unchanged output or if an iteration stops moving a measurable metric.

**10. The Security Caveat**
*   **Original:** It won't replace harness-level security: a system prompt can ask a model to respect your working tree, but only your runtime harness can enforce protected paths and sandboxed tool execution.
*   **Rewrite:** This does not replace harness-level security. A system prompt can ask a model to respect your working tree, but only your runtime harness enforces protected paths and sandboxed tool execution.

## the-model-that-picks-your-platform-doesnt-write-the-code
**Path**: `portfolio/content/writing/the-model-that-picks-your-platform-doesnt-write-the-code.md`

### Voice, AI Tells & Punctuation Audit (71.09s)
## Voice Audit

**Overall Grade:** B+
The draft is close to the mark. It avoids the worst AI clichés and maintains a practitioner's lens. However, it still relies on some abstract framing and a few passive structural pivots that obscure the immediate technical takeaway.

### 1. Hard Constraint Violations
*   **Em-dashes:** None found. (Pass)
*   **Semicolons:** None found. (Pass)
*   **Banned Buzzwords:** 'Solution', 'empower', 'journey' are absent. (Pass)
*   **Passive Voice (Own Work):**
    *   *"A routing scoreboard compares..."* (Active, but descriptive rather than additive).
    *   *"The labels do not carry meaning..."* (Active, but abstract).

### 2. AI Tells & Rhetorical Flaws
*   **False Antithesis:** *"Those are requirements for a routing experiment, not evidence that one route is cheaper."* This is a classic 'Not X, but Y' pivot. It sounds like a thesis statement rather than a builder's observation.
*   **Abstract Transitions:** *"The platform decision is another measurement problem"* functions as a thematic bridge rather than a concrete technical pivot.

### 3. Tone & Narrative Arc
*   **Missing Hook:** The piece opens with a general statement about hypotheses. It needs to open with the friction: *"When I wrote the routing policy for the coding agent, I called it efficient without actually measuring the cost."*
*   **Lack of 'Shipped' Tension:** The section "What the package actually proves" is honest, but it frames the work as a lack of evidence. Frame it as the established baseline: *"The package defines the rules; now I need to see if they hold."*

### 4. Line-Level Edits

**Paragraph 1 & 2**
*   *Current:* "A model routing policy is just a hypothesis until you record what happens across actual attempts."
*   *Audit:* Too much like a LinkedIn quote.
*   *Fix:* Open with the specific artifact: "The public Loop Engineering prompt defines a routing policy, but it doesn't record a routing result."

**Paragraph 4**
*   *Current:* "The first version of this Note claimed those efficiency gains as if the prompt had already earned them."
*   *Audit:* Passive framing of the mistake.
*   *Fix:* "I claimed those efficiency gains in the first Note before I earned them with data."

**Paragraph 6**
*   *Current:* "The scenarios are still useful because they define the bar."
*   *Audit:* Vague.
*   *Fix:* "The scenarios define the quality bar."

**Paragraph 10**
*   *Current:* "Only then can the router learn something defensible..."
*   *Audit:* Pure thesis-speak.
*   *Fix:* "I can only defend the router when I see which task families clear the quality bar on Fast versus Balanced."

**Paragraph 11**
*   *Current:* "The platform decision is another measurement problem"
*   *Audit:* Generic heading.
*   *Fix:* "Measuring platform handoffs"

### Narrative Arc, Hook & Pacing (22.84s)
### Critique

**1. Hook**
The opening is a thesis statement: "A model routing policy is just a hypothesis until you record what happens across actual attempts." It opens on a philosophy, not a friction point. It needs to start with a specific moment of failure or a direct objection to the routing table provided.

**2. Pacing**
The structure is linear, not growth-backwards. It explains what the policy is, then what the package contains, and finally what needs to be measured. To align with the framework, it must open with what shipped (the 17 regression scenarios and routing table), then explain why those results aren't yet evidence of efficiency, and finally derive the lesson on deterministic measurement.

### Concrete Line-Level Rewrites (56.82s)
Here are the line-level rewrites to sharpen the voice:

**1. The Opening**
*   **Original:** A model routing policy is just a hypothesis until you record what happens across actual attempts.
*   **Rewrite:** A routing policy is a hypothesis until you record what actually happens.

**2. The Self-Correction**
*   **Original:** The first version of this Note claimed those efficiency gains as if the prompt had already earned them.
*   **Rewrite:** My first draft claimed efficiency gains before the prompt earned them.

**3. The Evidence Section**
*   **Original:** No behavioral trial results, task costs, or cross-profile comparisons are recorded.
*   **Rewrite:** I haven't recorded behavioral trial results, task costs, or cross-profile comparisons.

**4. The Requirement Definition**
*   **Original:** Those are requirements for a routing experiment, not evidence that one route is cheaper.
*   **Rewrite:** These are requirements for an experiment, not proof that one route costs less.

**5. The Measurement Process**
*   **Original:** Run each task through the candidate profiles with the same repository fixture, tools, permissions, and acceptance checks.
*   **Rewrite:** Run every task through the candidate profiles using the same repository fixture, tools, permissions, and acceptance checks.

**6. The Quality Gate**
*   **Original:** A cheaper run that leaves the repository broken is not efficient, and a fast run that needs three rescue attempts may cost more than the stronger profile it replaced.
*   **Rewrite:** A cheaper run that breaks the repository is not efficient. A fast run requiring three rescue attempts often costs more than the stronger profile it replaced.

**7. The Conclusion on Labels**
*   **Original:** The labels do not carry meaning across harnesses until the harness measures them.
*   **Rewrite:** These labels mean nothing until a harness measures them.

**8. The Platform Hypothesis**
*   **Original:** I still think the model doing the planning can influence which platform, API, and authentication boundary a developer ends up with.
*   **Rewrite:** I believe the planning model influences which platform, API, and authentication boundary a developer gets.

**9. The Call to Action**
*   **Original:** Record where the platform was first selected, whether a worker changed it, and which verifier caught a bad choice.
*   **Rewrite:** Trace where the platform was first selected, whether a worker changed it, and which verifier caught the mistake.
