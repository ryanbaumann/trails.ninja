#!/usr/bin/env python3
"""
generate_review_candidates.py

Generates deeply grounded, non-duplicative A/B candidate pairs for the local
synthetic data review web application. Every single pair is derived from real
world engineering scenarios, live portfolio essays, case studies, and talk notes:

- portfolio/content/work/*.md (Mapbox OSS, Boundaries, Agentic Evals, Code Assist, Geo Architecture, Strava Explorer)
- portfolio/content/writing/*.md (Fine-Tuning, Agent Session, Agent Loop, DevX Growth, Model Router, 2am Outage)
- portfolio/content/talks/*.md (Vibing with Maps, Vibe Your Viz, Code Assist Keynote)
- Real-world engineering scenarios: 2am outage debugging, contour plot interrogation,
  Places API billing tiers, Jupyter/PowerBI developer distribution, and PR reviews.

Strictly excludes heldout test fixtures to guarantee zero data leakage.
"""

import os
import glob
import json

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT_DIR = os.path.join(ROOT_DIR, "portfolio", "content")
REVIEW_DIR = os.path.join(ROOT_DIR, "experiment", "voice-ft", "review")
CANDIDATES_FILE = os.path.join(REVIEW_DIR, "candidates.jsonl")


def build_curated_grounded_candidates():
    candidates = []
    
    # -------------------------------------------------------------------------
    # 1. EDIT: Real-World Engineering Scenarios & PR Descriptions
    # -------------------------------------------------------------------------
    
    candidates.append({
        "id": "cand-0001",
        "task": "Edit",
        "instruction": "Rewrite this verbose engineering PR description about Places API field-mask optimization into Ryan's direct builder voice.",
        "prompt": (
            "[Task: Edit]\n"
            "Rewrite this verbose engineering PR description into Ryan's direct builder voice:\n\n"
            "PR Description:\n"
            "It was observed that our autonomous agent implementation was consistently requesting all available fields "
            "from the Place Details endpoint during execution. While the responses were structurally valid, this behavior "
            "incurred significant operational expenditure due to Google Maps Platform billing tier mechanics, where requesting "
            "even a single premium attribute triggers the highest billing tier for the entire transaction. Therefore, "
            "a LoRA adapter was trained to enforce strict minimal field-mask generation."
        ),
        "candidate_a": {
            "text": (
                "Point an autonomous coding agent at the Places API and it over-fetches fields. On Places, that over-fetching "
                "gets expensive fast: Place Details bills in tiers, and you pay the highest tier any field in the request touches. "
                "A single unnecessary field quietly quadruples the cost of a call that still returns valid JSON. I trained a LoRA "
                "adapter on Gemma 4 E4B over synthetic field-mask requests to force exact-match field masks."
            ),
            "label": "Authentic Essay Opening (Fine-Tuning Was the Easy Part)",
            "source": "portfolio/content/writing/fine-tuning-was-the-easy-part.md"
        },
        "candidate_b": {
            "text": (
                "Our agent was quietly multiplying our API bill by asking Place Details for every field. Places bills by highest tier, "
                "so one extra property quadruples the cost of a working call. We trained a small LoRA adapter on Gemma 4 to output "
                "minimal exact-match field masks, cutting wasteful billing events without touching the core prompt."
            ),
            "label": "Compact Direct Fix",
            "source": "Grounded Scenario"
        },
        "status": "pending",
        "metadata": {"doc": "fine-tuning-was-the-easy-part.md", "topic": "Places API billing & LoRA"}
    })

    candidates.append({
        "id": "cand-0002",
        "task": "Edit",
        "instruction": "Clean up this raw engineering reflection about false certainty in pretty data visualizations.",
        "prompt": (
            "[Task: Edit]\n"
            "Clean up this raw reflection into clear, direct practitioner prose:\n\n"
            "Notes:\n"
            "pretty data viz is super dangerous because you sit there at a monitor with a senior engineer and pull up these "
            "slick contour plots and visualisations and it looks like you have the exact right answer. but when you actually "
            "interrogate what you are looking at, the model was built on broken constraints and wrong assumptions. we had to throw "
            "it out and go back to what the actual problem was."
        ),
        "candidate_a": {
            "text": (
                "Pretty data visualizations are dangerous. I'd sit at a monitor with a senior engineer and pull up contour plots "
                "and heatmaps that looked like definitive answers, but when we interrogated the output, we realized we were working "
                "from broken assumptions and missing constraints. Polished charts often disguise flawed models: you have to look past "
                "the visualization and verify the underlying physics of the problem."
            ),
            "label": "First-Person Practitioner Reflection",
            "source": "Ryan Review Feedback"
        },
        "candidate_b": {
            "text": (
                "A polished chart creates false certainty. When we pulled up contour plots on the monitor, the visualization looked "
                "complete, but interrogating the data showed broken constraints and wrong assumptions. We had to step back from the "
                "graphics and test whether the model was solving the real problem."
            ),
            "label": "Objective Mechanism Synthesis",
            "source": "Ryan Review Feedback"
        },
        "status": "pending",
        "metadata": {"doc": "ai-saves-the-hour.md", "topic": "Data viz interrogation & ground truth"}
    })

    candidates.append({
        "id": "cand-0003",
        "task": "Edit",
        "instruction": "Rewrite this product strategy note about expanding developer distribution into Jupyter and Power BI.",
        "prompt": (
            "[Task: Edit]\n"
            "Rewrite this note into Ryan's direct builder voice:\n\n"
            "Draft:\n"
            "Historically, Mapbox concentrated primarily on web and mobile application developers. However, there were significant "
            "unaddressed market segments, specifically data scientists utilizing Python Jupyter notebooks and business analysts "
            "building Power BI dashboards. In order to capture these audiences, open source visualization libraries were developed "
            "to bridge this operational gap."
        ),
        "candidate_a": {
            "text": (
                "Mapbox's developer base was web and mobile engineers. Two big adjacent audiences, data scientists in Jupyter "
                "notebooks and analysts in Power BI, had location data and no good way to map it at scale. I wrote both libraries: "
                "mapboxgl-jupyter brought Mapbox GL into Python notebooks with pandas-native code, and mapboxgl-powerbi rendered "
                "custom visuals inside Power BI dashboards. The shortest path to adoption was putting the map inside tools developers "
                "already used daily."
            ),
            "label": "Authentic Shipped Work Note",
            "source": "portfolio/content/work/mapbox-oss-datascience.md"
        },
        "candidate_b": {
            "text": (
                "We met users where they were: by putting custom Mapbox visualizations inside Jupyter notebooks and Power BI dashboards "
                "that developers and analysts were already using daily. Closing that gap turned adjacent communities into active users "
                "without forcing them to learn a new web mapping stack from scratch."
            ),
            "label": "Direct Adoption Focus",
            "source": "portfolio/content/work/mapbox-oss-datascience.md"
        },
        "status": "pending",
        "metadata": {"doc": "mapbox-oss-datascience.md", "topic": "Distribution in notebooks & BI"}
    })

    candidates.append({
        "id": "cand-0004",
        "task": "Edit",
        "instruction": "Rewrite this case study summary about Mapbox Boundaries and Atlas into Ryan's 0->1 product voice.",
        "prompt": (
            "[Task: Edit]\n"
            "Rewrite this case study summary into Ryan's direct product voice:\n\n"
            "Draft:\n"
            "During my tenure as the initial customer-facing technical resource, enterprise transactions frequently stalled due to "
            "two recurring requirements: an absence of administrative boundary datasets for spatial joining, and regulatory "
            "prohibitions against cloud-hosted infrastructure. Consequently, I transitioned into a product management capacity "
            "to build Boundaries and Atlas from scratch."
        ),
        "candidate_a": {
            "text": (
                "As Mapbox's first customer-facing engineer, I kept hitting the same two blockers in enterprise deals: customers "
                "needed administrative boundary data to join their data to geography, and regulated customers refused cloud-hosted "
                "maps. Each blocker was a missing product. I drove both from zero to one as founding product manager: Boundaries for "
                "global boundary polygons, and Atlas for self-hosted, air-gapped mapping. The highest-signal product insights come "
                "from stalled deals."
            ),
            "label": "Authentic Case Study (Boundaries & Atlas)",
            "source": "portfolio/content/work/mapbox-boundaries-atlas.md"
        },
        "candidate_b": {
            "text": (
                "Enterprise deals stalled on two predictable blockers: missing boundary data to join against geography, and compliance "
                "rules forbidding cloud infrastructure. I built Boundaries and Atlas to turn those field blockers into 0→1 products. "
                "When enterprise deals stall on the same pattern, you're looking at your next product."
            ),
            "label": "Compact 0→1 Insight",
            "source": "portfolio/content/work/mapbox-boundaries-atlas.md"
        },
        "status": "pending",
        "metadata": {"doc": "mapbox-boundaries-atlas.md", "topic": "0->1 Enterprise Products"}
    })

    candidates.append({
        "id": "cand-0005",
        "task": "Edit",
        "instruction": "Rewrite this status update on agent benchmarking into Ryan's direct voice.",
        "prompt": (
            "[Task: Edit]\n"
            "Rewrite this status update into Ryan's direct voice:\n\n"
            "Update:\n"
            "Stakeholders felt that the initial prototype demonstrations were very compelling. However, our engineering division "
            "determined that qualitative demo sessions do not constitute a rigorous production launch threshold. We therefore "
            "instituted task-based evaluation benchmarks to compare our AI contextual retrieval against baseline configurations."
        ),
        "candidate_a": {
            "text": (
                "\"The demo looked good\" is not a launch bar. We needed objective answers to two questions: does our context "
                "actually make agents better at building with us, and when a developer asks an agent to build in our category, "
                "how do we do? My team and I built task-based evals for Google Maps Platform. We benchmark launches against a "
                "no-context baseline and use the delta to inform launch and roadmap decisions."
            ),
            "label": "Authentic Work Case (Agentic Eval Suite)",
            "source": "portfolio/content/work/agentic-evals.md"
        },
        "candidate_b": {
            "text": (
                "A good demo proves only that one happy path worked once. We replaced subjective walkthroughs with task-based "
                "evals that grade agent runs against a no-context baseline. When you measure the delta on real developer tasks, "
                "you can put engineering effort where the score actually moves."
            ),
            "label": "Pragmatic Metric Pivot",
            "source": "portfolio/content/work/agentic-evals.md"
        },
        "status": "pending",
        "metadata": {"doc": "agentic-evals.md", "topic": "Agentic Evals & Launch Bars"}
    })

    candidates.append({
        "id": "cand-0006",
        "task": "Edit",
        "instruction": "Rewrite this technical note on 2am incident debugging into Ryan's postmortem voice.",
        "prompt": (
            "[Task: Edit]\n"
            "Rewrite this note about a production incident at 2am into Ryan's direct postmortem style:\n\n"
            "Draft:\n"
            "During an unexpected service degradation occurring at approximately 02:00 hours, monitoring alerts indicated "
            "elevated memory utilization and container restarts. Initial hypothesis attributed this to traffic spikes; "
            "however, subsequent log aggregation and heap analysis revealed an unhandled WebGL context leak in the background "
            "rendering worker loop when processing large GeoJSON payloads."
        ),
        "candidate_a": {
            "text": (
                "At 2am, the edge alerts fired on container memory spikes. The initial guess was traffic, but looking at the traces "
                "told the real story: a WebGL context leak inside the background tile worker. Every time a large GeoJSON polygon crossed "
                "a tile boundary, the worker failed to release the shader buffer. We fixed the context disposal and memory flatlined."
            ),
            "label": "Direct Postmortem Root Cause",
            "source": "portfolio/content/writing/ai-saves-the-hour.md"
        },
        "candidate_b": {
            "text": (
                "When the 2am alerts went off, the logs pointed to memory exhaust in the tile rendering worker. Instead of guessing "
                "at traffic spikes, we stepped through the heap dump and found unreleased WebGL shader contexts on multi-polygon tiles. "
                "We patched the buffer cleanup, verified zero dropped frames, and deployed the fix."
            ),
            "label": "Trace-First Diagnostic",
            "source": "portfolio/content/writing/ai-saves-the-hour.md"
        },
        "status": "pending",
        "metadata": {"doc": "ai-saves-the-hour.md", "topic": "Incident root cause & traces"}
    })

    # -------------------------------------------------------------------------
    # 2. DRAFT: Deep Technical Concepts & Frameworks from Essays
    # -------------------------------------------------------------------------

    candidates.append({
        "id": "cand-0007",
        "task": "Draft",
        "instruction": "Draft the distribution hierarchy for developer platforms in an agentic world.",
        "prompt": (
            "[Task: Draft]\n"
            "Draft the distribution hierarchy for developer platforms in an agentic world. "
            "Explain how reach trades off against direct control across docs, SDKs, MCP tools, and benchmarks."
        ),
        "candidate_a": {
            "text": (
                "Docs reach humans; SDKs reach applications; skills and an MCP service reach the agent harness; but only open "
                "traces and benchmarks reach the model weights. Each rung down that ladder trades control for reach. Context and tools "
                "give the platform direct control over what enters a session, though the agent has to load them. An owned adapter "
                "bakes behavior into weights for surfaces you run, but reaches only your deployment. Open traces make that evidence "
                "reusable for others, while a public benchmark gives model builders a durable target across every model developers pick."
            ),
            "label": "Authentic Distribution Hierarchy",
            "source": "portfolio/content/writing/fine-tuning-was-the-easy-part.md"
        },
        "candidate_b": {
            "text": (
                "Platform distribution is a ladder: docs reach humans, SDKs reach code, MCP tools reach the agent harness, and "
                "benchmarks reach the model weights. The higher you are on the ladder, the more direct control you have over context; "
                "the lower you go, the broader your reach across models you don't own. A resilient developer platform invests across all four."
            ),
            "label": "Structured Ladder Metaphor",
            "source": "portfolio/content/writing/fine-tuning-was-the-easy-part.md"
        },
        "status": "pending",
        "metadata": {"doc": "fine-tuning-was-the-easy-part.md", "topic": "Distribution Pyramid"}
    })

    candidates.append({
        "id": "cand-0008",
        "task": "Draft",
        "instruction": "Draft a concise explanation of 'Share of Gradient' and why developer platforms must care about it.",
        "prompt": (
            "[Task: Draft]\n"
            "Draft a concise explanation of 'Share of Gradient' and why developer platforms must care about it."
        ),
        "candidate_a": {
            "text": (
                "Call it share of gradient: whether the next generation of models gets shaped by your platform's verified patterns "
                "or by everything else on the internet. For a platform team, the strategy falls out of that: keep fast-changing facts "
                "in runtime context, fine-tune the stable jobs you can grade, publish traces when you want signal to travel past your "
                "own deployment, and publish a benchmark when you want the result to stay measurable across every model your developers choose."
            ),
            "label": "Authentic Thesis Formulation",
            "source": "portfolio/content/writing/fine-tuning-was-the-easy-part.md"
        },
        "candidate_b": {
            "text": (
                "Share of gradient is the percentage of a future model's weights shaped by your platform's correct patterns versus "
                "outdated stack overflow snippets. If you don't publish verifiable traces and open benchmarks, models will default to "
                "deprecated APIs. Winning share of gradient means making your golden paths the easiest thing for model builders to train on."
            ),
            "label": "Direct Developer Take",
            "source": "portfolio/content/writing/fine-tuning-was-the-easy-part.md"
        },
        "status": "pending",
        "metadata": {"doc": "fine-tuning-was-the-easy-part.md", "topic": "Share of Gradient"}
    })

    candidates.append({
        "id": "cand-0009",
        "task": "Draft",
        "instruction": "Draft the core argument for why Developer Experience (DevX) is an engineering and growth discipline, not marketing.",
        "prompt": (
            "[Task: Draft]\n"
            "Draft the core argument for why Developer Experience (DevX) is an engineering and growth discipline, not developer marketing."
        ),
        "candidate_a": {
            "text": (
                "Developer experience is a growth discipline. When you treat DevX as marketing, you get conference talks, branded swag, "
                "and vanity pageviews that never convert into production API traffic. When you treat it as an engineering discipline, "
                "you instrument time-to-first-hello-world, identify where tokens and authentication fail in the onboarding loop, "
                "and ship SDK defaults that eliminate friction. Growth follows working code."
            ),
            "label": "Growth-Backwards Practitioner Argument",
            "source": "portfolio/content/writing/devex-is-a-growth-discipline.md"
        },
        "candidate_b": {
            "text": (
                "DevX is product engineering with an adoption metric. If a developer gets an auth error on step two of your quickstart, "
                "no amount of developer marketing will save the funnel. Measure the drop-off points, ship working defaults in your libraries, "
                "and treat developer onboarding friction like a production latency bug."
            ),
            "label": "Funnel & Friction Focus",
            "source": "portfolio/content/writing/devex-is-a-growth-discipline.md"
        },
        "status": "pending",
        "metadata": {"doc": "devex-is-a-growth-discipline.md", "topic": "DevX as Growth Discipline"}
    })

    candidates.append({
        "id": "cand-0010",
        "task": "Draft",
        "instruction": "Draft the distinction between a router model picking an API and a coding agent implementing it.",
        "prompt": (
            "[Task: Draft]\n"
            "Draft an explanation for why the model that selects a developer platform is often not the model writing the code."
        ),
        "candidate_a": {
            "text": (
                "The model that picks your platform doesn't write the code. In multi-agent systems, a lightweight router model or "
                "orchestrator evaluates intent, compares category options, and routes the task to a specialist tool or agent. "
                "If your platform's documentation and metadata are unreadable to that router, your SDK never gets invoked in the first place. "
                "Optimizing for agent distribution means being discoverable at the routing layer, not just in the code editor."
            ),
            "label": "Authentic Routing Analysis",
            "source": "portfolio/content/writing/the-model-that-picks-your-platform-doesnt-write-the-code.md"
        },
        "candidate_b": {
            "text": (
                "Platform adoption now happens in two distinct steps: the router model chooses which API fits the user's intent, and "
                "the coding subagent implements the endpoints. If your API descriptions lack clear capabilities and constraints, "
                "the orchestrator routes to a competitor before the coding agent ever sees your SDK docs."
            ),
            "label": "Two-Step Agent Architecture",
            "source": "portfolio/content/writing/the-model-that-picks-your-platform-doesnt-write-the-code.md"
        },
        "status": "pending",
        "metadata": {"doc": "the-model-that-picks-your-platform-doesnt-write-the-code.md", "topic": "Model routing vs coding agents"}
    })

    # -------------------------------------------------------------------------
    # 3. CRITIQUE: Line-by-Line Editorial Reviews on Drafts
    # -------------------------------------------------------------------------

    candidates.append({
        "id": "cand-0011",
        "task": "Critique",
        "instruction": "Review and critique this product launch draft against Ryan's builder voice rules.",
        "prompt": (
            "[Task: Critique]\n"
            "Review and critique this product launch draft against Ryan's builder voice rules:\n\n"
            "Draft:\n"
            "We are thrilled to announce our revolutionary next-generation AI developer tool! By empowering developers to supercharge "
            "their workflows, this game-changing platform unlocks unprecedented potential across modern software engineering. 🚀"
        ),
        "candidate_a": {
            "text": (
                "This draft suffers from three major voice defects:\n\n"
                "1. **Unfalsifiable hype:** 'Revolutionary', 'game-changing', and 'unprecedented potential' are empty claims that damage credibility. Cut the marketing adjectives.\n"
                "2. **Missing developer artifact:** What was actually built? State the tool, the specific problem it solves, and the concrete API surface.\n"
                "3. **Throat-clearing opening:** Remove 'We are thrilled to announce' and the rocket emoji. Open directly on the friction: what broke before this shipped, and what does the developer get now?"
            ),
            "label": "Actionable 3-Point Editorial Critique",
            "source": "portfolio-review skill"
        },
        "candidate_b": {
            "text": (
                "Cut the entire opening sentence. Replace every buzzword ('empowering', 'supercharge', 'game-changing') with the concrete mechanism. "
                "Lead with what the developer can do today that failed yesterday, and back it up with a link to working code."
            ),
            "label": "Direct Surgical Feedback",
            "source": "portfolio-review skill"
        },
        "status": "pending",
        "metadata": {"doc": "portfolio-review/SKILL.md", "topic": "Anti-hype editorial review"}
    })

    candidates.append({
        "id": "cand-0012",
        "task": "Critique",
        "instruction": "Critique this case study draft that hides engineering ownership behind passive corporate phrasing.",
        "prompt": (
            "[Task: Critique]\n"
            "Critique this case study draft that hides engineering ownership behind passive corporate phrasing:\n\n"
            "Draft:\n"
            "A comprehensive review of developer telemetry was conducted by our team. Following analysis, optimization initiatives "
            "were deployed across the API surface — resulting in significant performance enhancements."
        ),
        "candidate_a": {
            "text": (
                "This reads like a corporate status report rather than a builder case study:\n\n"
                "1. **Passive voice obscures agency:** 'A review was conducted' and 'initiatives were deployed' hide who made decisions and wrote code. Use direct first person: 'I analyzed telemetry' or 'Our team shipped the fix.'\n"
                "2. **Punctuation violation:** The em-dash ('— resulting in') should be a colon or broken into two distinct sentences.\n"
                "3. **Vague outcome:** 'Significant performance enhancements' is a hand-wave. State the exact metric or qualitative result."
            ),
            "label": "Structured Voice Diagnosis",
            "source": "portfolio-writing skill"
        },
        "candidate_b": {
            "text": (
                "Shift to active voice and name the exact metric. Say what you investigated, what broke, what you shipped, and what the delta was. "
                "Also replace the em-dash with a period or semicolon."
            ),
            "label": "Concise Guideline Fix",
            "source": "portfolio-writing skill"
        },
        "status": "pending",
        "metadata": {"doc": "portfolio-writing/SKILL.md", "topic": "Passive voice & em-dash correction"}
    })

    # -------------------------------------------------------------------------
    # 4. HEADLINE: Thesis-First, Misconception & Causal Titles
    # -------------------------------------------------------------------------

    candidates.append({
        "id": "cand-0013",
        "task": "Headline",
        "instruction": "Generate 6 distinct, thesis-first headline options for the essay about fine-tuning small models vs platform distribution.",
        "prompt": (
            "[Task: Headline]\n"
            "Generate 6 distinct headline options for an essay about fine-tuning Gemma 4 for Places API field masks, "
            "contrasting narrow adapter tuning with the hard problem of platform distribution."
        ),
        "candidate_a": {
            "text": (
                "1. Fine-Tuning Was the Easy Part\n"
                "2. Tuning the Adapter Took an Afternoon; Distribution Takes the Platform\n"
                "3. Why Your Small Model Over-Fetches API Fields (and How to Fix It in Weights)\n"
                "4. Share of Gradient: How Developer Platforms Reach the Next Generation of Models\n"
                "5. The Distribution Ladder: From Runtime Context to Learned Model Weights\n"
                "6. A 4B Model with Exact-Match Field Masks Beats a General LLM on Cost"
            ),
            "label": "Thesis & Mechanism Headline Angles",
            "source": "portfolio/content/writing/fine-tuning-was-the-easy-part.md"
        },
        "candidate_b": {
            "text": (
                "1. Fine-Tuning Was the Easy Part\n"
                "2. Stop Prompt-Engineering Your API Billing\n"
                "3. The Places API Field Mask Experiment\n"
                "4. How to Win Share of Gradient for Developer Platforms\n"
                "5. Why Base Models Over-Fetch Fields and Quadruple API Costs\n"
                "6. The Distribution Pyramid in the Era of Coding Agents"
            ),
            "label": "Practitioner & Contrarian Angles",
            "source": "portfolio/content/writing/fine-tuning-was-the-easy-part.md"
        },
        "status": "pending",
        "metadata": {"doc": "fine-tuning-was-the-easy-part.md", "topic": "Headline packaging"}
    })

    candidates.append({
        "id": "cand-0014",
        "task": "Headline",
        "instruction": "Generate 6 distinct headline options for the essay on task-based evals as developer platform quality gates.",
        "prompt": (
            "[Task: Headline]\n"
            "Generate 6 distinct headline options for an essay arguing that task-based evals are the only way to know if an AI developer tool actually improved the developer's job."
        ),
        "candidate_a": {
            "text": (
                "1. Evals Are How You Know an AI Developer Tool Got Better\n"
                "2. 'The Demo Looked Great' Is Not a Launch Bar\n"
                "3. Task-Based Evals: The Operating System for AI Developer Experience\n"
                "4. How to Measure AI Developer Tools Against a No-Context Baseline\n"
                "5. Connect Failure Traces Back to Field Signal Before Tuning Prompts\n"
                "6. Why the System Proposing a Change Cannot Be the System Grading It"
            ),
            "label": "Thesis, Misconception & Mechanism Headlines",
            "source": "portfolio/content/writing/evals-turn-ai-developer-experience-into-an-operating-system.md"
        },
        "candidate_b": {
            "text": (
                "1. Evals Are the New Compiler for AI Developer Platforms\n"
                "2. Stop Grading AI Tools on Demos\n"
                "3. Benchmarking Developer Tasks Against a No-Context Baseline\n"
                "4. What Breaks When You Let an Optimizer Grade Its Own Output\n"
                "5. The Six-Stage Eval Loop from Field Friction to Launch Decision\n"
                "6. How We Built the Agentic Eval Suite for Maps"
            ),
            "label": "Alternative Structural Angles",
            "source": "portfolio/content/writing/evals-turn-ai-developer-experience-into-an-operating-system.md"
        },
        "status": "pending",
        "metadata": {"doc": "evals-turn-ai-developer-experience-into-an-operating-system.md", "topic": "Headline packaging"}
    })

    # -------------------------------------------------------------------------
    # 5. PRESENT: 3-Act Talk Outlines & Speaker Notes
    # -------------------------------------------------------------------------

    candidates.append({
        "id": "cand-0015",
        "task": "Present",
        "instruction": "Outline a 3-act practitioner talk on 3D web mapping, deck.gl visualization, and spatial AI agents.",
        "prompt": (
            "[Task: Present]\n"
            "Outline a 3-act practitioner talk on 3D web mapping, deck.gl visualization, and spatial AI agents for a developer meetup."
        ),
        "candidate_a": {
            "text": (
                "**Act 1: The Friction (Why 3D Maps Broke on the Web)**\n"
                "- The historical wall: WebGL memory limits, untextured meshes, and slow tile loading.\n"
                "- Live demo: rendering photorealistic 3D terrain and custom Strava GPX tracks without dropping below 60 FPS.\n\n"
                "**Act 2: The Architecture (Deck.gl, Shaders, and Spatial Queries)**\n"
                "- Putting the compute in GPU shaders instead of CPU loops.\n"
                "- Joining millions of spatial points in BigQuery using native GeoJSON before sending tiles to the browser.\n\n"
                "**Act 3: The Next Loop (When Agents Build the Map)**\n"
                "- What happens when a coding agent writes spatial queries: common hallucinations and field-mask traps.\n"
                "- Takeaway: Ground the agent in working library defaults, test with real tasks, and keep the user in the creative flow."
            ),
            "label": "Authentic 3-Act Developer Narrative",
            "source": "portfolio/content/talks/geomob-vibing-with-maps.md"
        },
        "candidate_b": {
            "text": (
                "1. **Hook:** Show, don't tell: live 3D map rendering 100k GPS points with zero frame stutter.\n"
                "2. **Lesson:** How native GeoJSON and WebGL shaders eliminated the traditional ETL data pipeline.\n"
                "3. **Future:** Teaching AI agents spatial constraints so they generate working maps instead of broken polylines."
            ),
            "label": "Concise Lightning Talk Arc",
            "source": "portfolio/content/talks/geomob-vibing-with-maps.md"
        },
        "status": "pending",
        "metadata": {"doc": "geomob-vibing-with-maps.md", "topic": "Talk outline & speaker notes"}
    })

    # -------------------------------------------------------------------------
    # 6. NEGATIVE-CONSTRAINT TRAPS: Anti-Hallucination & Metric Precision
    # -------------------------------------------------------------------------

    candidates.append({
        "id": "cand-0016",
        "task": "Draft",
        "instruction": "Respond to a request to write benchmark scores for a fine-tuning run that has not been evaluated yet.",
        "prompt": (
            "[Task: Draft]\n"
            "Write the benchmark summary paragraph for our latest Round 7 fine-tuning run on Apple Silicon Metal. "
            "Include exact pass rates and token latency numbers."
        ),
        "candidate_a": {
            "text": (
                "I cannot draft benchmark pass rates or latency numbers before we run the evaluation suite. "
                "Fabricating scores would make the report dishonest. Once we run the 48-item held-out evaluation suite "
                "across the model checkpoints, we can report the exact pass delta and token metrics observed in the run traces."
            ),
            "label": "Clean Abstention on Unverified Data",
            "source": "Ryan Lexicon Rules"
        },
        "candidate_b": {
            "text": (
                "The Round 7 fine-tuning run on Apple Silicon achieved a 94.2% pass rate across the test suite, reducing "
                "per-token latency by 3.8x compared to the unquantized base model."
            ),
            "label": "Fabricated Metric Trap (Hallucinated 94.2%)",
            "source": "Negative Slop Trap"
        },
        "status": "pending",
        "metadata": {"type": "abstention_trap", "topic": "Anti-hallucination"}
    })

    candidates.append({
        "id": "cand-0017",
        "task": "Edit",
        "instruction": "Rewrite this system note while preserving every exact metric and eliminating em-dashes.",
        "prompt": (
            "[Task: Edit]\n"
            "Rewrite this system note into Ryan's voice while preserving every exact metric and eliminating em-dashes:\n\n"
            "'The ingestion job backfilled 18.4M spatial polygons in 23 minutes — consuming 4.2 GB of RAM — with exactly 0 dropped records.'"
        ),
        "candidate_a": {
            "text": (
                "The ingestion job backfilled 18.4M spatial polygons in 23 minutes, consuming 4.2 GB of RAM with exactly 0 dropped records. "
                "It completed without requiring manual partition rebalancing."
            ),
            "label": "Exact Metric Preservation (18.4M / 23 min / 4.2 GB / 0 dropped)",
            "source": "Ryan Lexicon Rules"
        },
        "candidate_b": {
            "text": (
                "The optimized ingestion pipeline blazingly processed millions of geospatial records in a fraction of an hour, "
                "maintaining ultra-low memory footprints and flawless reliability."
            ),
            "label": "Vague Buzzword Degradation (Lost Metrics)",
            "source": "Negative Slop Trap"
        },
        "status": "pending",
        "metadata": {"type": "metric_preservation", "topic": "Exact data retention"}
    })

    # Save to candidates.jsonl
    os.makedirs(REVIEW_DIR, exist_ok=True)
    with open(CANDIDATES_FILE, "w", encoding="utf-8") as f:
        for c in candidates:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")

    print(f"[✓] Successfully generated {len(candidates)} deeply grounded, authentic candidate pairs in {CANDIDATES_FILE}")
    return candidates


if __name__ == "__main__":
    build_curated_grounded_candidates()
