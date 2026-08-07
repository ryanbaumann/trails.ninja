# Fieldwork Evidence Ledger

Last reviewed: 2026-07-16

Use this ledger before publishing a material claim or adding a product artifact.
The approved copy is the widest claim currently supported. Team work must credit
the team. Public product evidence does not, by itself, prove Ryan's role or an
internal business result.

Metrics are a taste decision, not just a public-vs-internal one. Real numbers are
fine for public, verifiable stats (npm downloads), prior-company results, and
current-employer figures that are a couple of years old or publicly launched for
at least several months. Recent internal current-employer usage or growth figures
(Google Maps Platform unique active users, API engagement) read as internal and
sales-pitchy: use qualitative, understated framing and do not publish precise
percentages. Name first-party surfaces (AI Studio); do not enumerate third-party
or competitor tools.

Statuses:

- `public-source`: supported by a public URL.
- `approved-internal`: approved by Ryan, but not publicly verifiable.
- `observable`: demonstrated by the public site, app, or repository.
- `qualify`: publish only the narrower approved copy below.
- `remove`: omit until evidence supports it.

## Claims

| Claim | Status | Approved copy | Source | Retrieved | Notes |
|---|---|---|---|---|---|
| Developer Experience organization size | `approved-internal` | Led a 20+ person organization. | Approved strategy | 2026-07-13 | Describe the disciplines without implying every person reports directly to Ryan. |
| OSS unique active-user growth | `approved-internal` | Between early 2025 and 2026, our open-source ecosystem more than doubled its unique active users. | Approved strategy | 2026-07-16 | Recent internal current-employer metric: use qualitative, understated framing ("more than doubled," "significant growth"). Do not publish the precise percentage. Keep the period and team attribution; do not assign the increase to one integration. |
| OSS API-engagement growth | `approved-internal` | Over the same period, API engagement for our open-source client libraries grew strongly. | Approved strategy | 2026-07-16 | Recent internal current-employer metric: use qualitative framing ("strong growth"). Do not publish the precise percentage. Keep separate from unique active users. |
| `@vis.gl/react-google-maps` weekly downloads | `public-source` | `1M+ weekly downloads` on durable surfaces. | [npm downloads API](https://api.npmjs.org/downloads/point/last-week/%40vis.gl%2Freact-google-maps) | 2026-07-15 | API returned 1,444,054 downloads for 2026-07-08 through 2026-07-14. Verify again before using a newer dated value. |
| Google Maps Platform reach | `public-source` | Google Maps Platform powers more than 10 million websites and apps. | [Google Maps Platform](https://mapsplatform.google.com/resources/blog/build-smarter-and-faster-new-ai-products-and-tools-from-google-maps-platform/) | 2026-07-13 | Platform scale, not a Ryan-attributed outcome. |
| Code Assist product | `public-source` | Our team shipped Code Assist, a hosted remote MCP service that retrieves official Google Maps Platform documentation and samples for AI coding agents. | [Documentation](https://developers.google.com/maps/ai/code-assist), [launch post](https://mapsplatform.google.com/resources/blog/announcing-code-assist-toolkit-bring-google-maps-platform-expertise-to-your-ai-coding-assistant/) | 2026-07-16 | `Google-hosted` is publicly accurate but prefer plain `hosted` in prose to avoid over-branding. Prefer "Our team shipped… I led the strategy"; `I led the team` is separately `approved-internal`. |
| Code Assist reduces hallucinations | `qualify` | Agents retrieve current official documentation instead of relying only on training-data memory. | [Code Assist documentation](https://developers.google.com/maps/ai/code-assist) | 2026-07-13 | Do not say `far fewer hallucinations` without a publishable eval delta. |
| Agent Skills product and installation | `public-source` | Google Maps Platform Agent Skills are portable workflow modules installed from the public repository with one command. | [GitHub](https://github.com/googlemaps/agent-skills), [documentation](https://developers.google.com/maps/ai/agent-skills) | 2026-07-16 | Do not enumerate individual third-party clients: say installs "in AI Studio and other compatible agent environments." Prefer "Our team launched" / "I led the strategy" framing; `I led the launch` is `approved-internal`. |
| Skills use eval release gates | `approved-internal` | We use evals as a release gate for agent skills. | Approved strategy | 2026-07-13 | Do not publish internal traces, tasks, or dashboards. |
| Agentic eval suite | `approved-internal` | My team and I built task-based evals and benchmark launches against a no-context baseline. | Approved strategy | 2026-07-13 | Avoid the absolute `every launch` unless its exact scope is approved. |
| Client-library and AI distribution | `qualify` | I helped lead distribution strategy across major UI frameworks and agent environments, including AI Studio, working with teams across product, engineering, UX, DevX, DRE, technical writing, and field engineering. | Approved strategy | 2026-07-16 | Name first-party surfaces (AI Studio); do not enumerate third-party or competitor agent products. Say "compatible agent environments," not a name-brand list. Do not say `default connectors` or attach an unverified growth share to one partner. |
| Agent-influenced adoption funnel | `approved-internal` | We measure skill installs and tool calls as adoption signals. | Approved strategy | 2026-07-13 | Do not expose internal dashboards or conversion data. |
| AI-driven Voice of Developer | `approved-internal` | I created and lead a program that turns developer signals into evidence-backed roadmap priorities. | Ryan approval required for implementation | 2026-07-13 | Keep support tickets, customer data, rankings, and roadmap outputs private. Qualify `five-plus products`, `ten times the size`, and affordability absolutes unless separately approved. |
| Geo Architecture Center | `public-source` | The Google Maps Platform Architecture Center publishes reference architectures, design patterns, guidance, and best practices. | [Architecture Center](https://developers.google.com/maps/architecture) | 2026-07-13 | Ryan's founder/principal-author role is `approved-internal`. Count the live catalog before publishing `40+`. Do not claim it resolves thousands of support threads. |
| Intelligent Product Essentials and GE Appliances | `public-source` | Google Cloud launched Intelligent Product Essentials with customers including GE Appliances. | [Google Cloud launch post](https://cloud.google.com/blog/products/data-analytics/introducing-intelligent-products-essentials-for-manufacturers) | 2026-07-13 | Ryan's leadership, nine-month delivery, `first manufacturing industry solution`, and `$10M+ launch pipeline` are `approved-internal`. Credit the team and partners. |
| Mapbox team and company scale | `approved-internal` | I grew Mapbox customer engineering from 1 to 15 as the company crossed $100M ARR. | Ryan approval required for implementation | 2026-07-13 | Add a corporate source if one is found. |
| Mapbox Boundaries and Atlas | `public-source` | Boundaries and Atlas remain in Mapbox's product portfolio. | [Boundaries](https://www.mapbox.com/boundaries), [Atlas](https://www.mapbox.com/atlas) | 2026-07-13 | Founding-product role and first `$5M ARR` are `approved-internal`. Source a launch date before using `8+ years`. |
| `mapboxgl-jupyter` and `mapboxgl-powerbi` | `public-source` | I authored the public `mapboxgl-jupyter` and `mapboxgl-powerbi` libraries. | [Jupyter repository](https://github.com/mapbox/mapboxgl-jupyter), [Power BI repository](https://github.com/mapbox/mapboxgl-powerbi) | 2026-07-13 | Repository history supports authorship and observable behavior. Say `a durable acquisition channel`, not `the cheapest acquisition channel`. |
| Mapbox and Uber OSS integration | `approved-internal` | I led the partnership that integrated Mapbox with the deck.gl and kepler.gl ecosystem. | Ryan approval required for leadership; [deck.gl](https://github.com/visgl/deck.gl), [kepler.gl](https://github.com/keplergl/kepler.gl) support the public integration | 2026-07-15 | The repositories support the integration, not Ryan's role. Keep team/partnership attribution and do not claim default placement or exclusive causality. |
| Instabase revenue target | `approved-internal` | We exceeded the FY2020 revenue target. | Ryan approval required for implementation | 2026-07-13 | Team attribution required. Do not disclose a target value. |
| Caterpillar deployment and patents | `approved-internal` | Built a worksite productivity solution deployed across 50+ job sites and co-invented three US patents. | Ryan approval required for implementation | 2026-07-13 | Add public patent links and numbers when available. |
| Ryan’s Lab applications | `observable` | Ryan’s Lab combines same-origin reference apps with selected external experiments listed in `apps.json`. | [Public repository](https://github.com/ryanbaumann/fieldwork), live routes from `apps.json` | 2026-07-17 | Distinguish workspace-hosted apps from external destinations. Say `no secrets shipped to the browser`, not `zero secrets`. |
| Fieldwork architecture | `observable` | One Cloud Run container serves Fieldwork and workspace apps through a zero-dependency Node gateway; external Lab entries are outbound links. Fieldwork uses small inline scripts for theme and privacy-limited analytics. | [Public repository](https://github.com/ryanbaumann/fieldwork) | 2026-07-20 | Validate deployed network behavior when making runtime claims about OAuth, cold starts, quotas, or CI/CD. |
| Loop Engineering Coding Agent | `observable` | The package contains one vendor-neutral system prompt, four role overlays, a self-install task packet, a deterministic structural checker, and 16 specified regression scenarios. | [`agent-scripts/coding-agent-loop/`](../agent-scripts/coding-agent-loop/) | 2026-07-16 | The structural check passes. Behavioral trials are not recorded; do not claim a cross-model benchmark. |
| Field-mask fine-tuning experiment | `qualify` | The public repository contains ten synthetic field-mask cases across four categories and scaffolds for an MLX LoRA run. A learning-log entry records one 100-step E4B run reaching validation loss 0.028. | [`evals/field-mask/`](../evals/field-mask/), [`LEARNINGS.md`](../LEARNINGS.md) | 2026-08-07 | No public train/holdout split, retained model outputs, executable output grader, adapter, run log, or measured task scores exist. The four values in `test_mlx.py` are hard-coded mock results. Do not publish them as measurements. The first case's `displayName` ground truth also needs correction against the current Places field table before reuse. |
| Deprecated API usage in LLM completions | `public-source` | One ICSE study evaluated seven models on 28,125 prompts covering 145 API migrations in eight Python libraries; among plausible completions using the mapped APIs, deprecated usage ranged from 25% to 38%. | [Paper](https://arxiv.org/abs/2406.09834) | 2026-08-07 | Keep the denominator qualification. Do not describe the range as a share of all completions. |
| Harvey Legal Agent Benchmark and 9B GRPO result | `public-source` | LAB launched with more than 1,200 tasks across 24 practice areas and over 75,000 expert-written criteria. A later 40-step GRPO run on Qwen3.5-9B moved criterion pass rate from 42.5% to 63.0% on held-out test data; grep calls fell 67% and characters read per rollout rose more than 20% as the score increased. | [Benchmark](https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark), [post-training result](https://www.harvey.ai/blog/post-training-open-legal-agents-with-baseten-research) | 2026-08-07 | Do not attribute the 42.5% to 63.0% result to Harvey's separate 27B iSFT experiment. Describe the trace shift as observed alongside the score change, not proof that one component caused every behavior change. |
| Talks and videos | `public-source` | Talk titles, venues, dates, decks, and videos may be described as their public pages show. | Links in `portfolio/content/talks/` | 2026-07-13 | Treat `next million makers` and similar language as a talk thesis, not a measured outcome. |
| Writing entries | `public-source` | Titles and summaries may reflect the linked canonical posts. | Canonical links in `portfolio/content/writing/` | 2026-07-13 | Use `series`, not `weekly series`, unless the archive demonstrates weekly cadence. |
| Fifteen-plus years of experience | `observable` | 15+ years building platforms at Google, Mapbox, Instabase, and Caterpillar. | Public chronology on the About page | 2026-07-13 | Apply one consistent career-start definition. |

## Approved public asset candidates

For every reused asset, record its exact source URL, retrieval date, creator or
publisher, and any license or attribution requirement. Prefer a screenshot of
the actual public artifact over a decorative reconstruction.

| Priority | Story | Candidate evidence |
|---|---|---|
| 1 | Code Assist | Official launch-post or documentation image, public architecture diagram, or a frame from the official demo video. |
| 2 | Agent Skills | Public GitHub README install command, repository structure, official documentation, or a frame from the official video. |
| 3 | Agentic growth | A simple dated rendering of the npm API observation. Add partner logos or announcements only when their public source supports the adjacent claim. |
| 4 | Agentic evals | A public, sanitized eval output or public process diagram. If none exists, label any new process diagram as illustrative, not as an internal dashboard. |
| 5 | Geo Architecture Center | A crop of the public catalog and a representative public architecture diagram. |
| 6 | Mapbox work | Public Jupyter, Power BI, deck.gl, or kepler.gl project imagery with the original repository or post URL. |
| 7 | About | An approved portrait or honest public work artifact. Do not use a screenshot of the portfolio as Ryan's profile image. |
| 8 | Ryan’s Lab | Fresh desktop and mobile screenshots of the live applications, captured without exposing account data, tokens, or private activities. |

## Public image sources in use

| Asset | Public source | License / basis | Retrieved |
|---|---|---|---|
| `code-assist-docs.png` | [official Code Assist documentation](https://developers.google.com/maps/ai/code-assist) | CC BY 4.0 documentation capture | 2026-07-14 |
| `mapboxgl-jupyter.jpg` | [repository screenshot](https://raw.githubusercontent.com/mapbox/mapboxgl-jupyter/master/examples/screenshots/screenshot.png) | MIT-licensed repository asset | 2026-07-14 |
| `mapboxgl-powerbi.jpg` | [repository screenshot](https://raw.githubusercontent.com/mapbox/mapboxgl-powerbi/master/assets/mapbox-viz-screenshot-1-min.png) | MIT-licensed repository asset | 2026-07-14 |
| `kepler-mapbox.jpg` | [repository screenshot](https://raw.githubusercontent.com/keplergl/kepler.gl/master/screenshots/screenshot.png) | MIT-licensed repository asset; visible attribution preserved | 2026-07-14 |

## Excluded private artifacts

Do not place these in the repository, screenshots, generated social cards, or
model context:

- Internal usage, install, conversion, revenue, or partner dashboards.
- Customer records, support tickets, sales notes, private Discord content, or
  personally identifiable developer data.
- Private eval tasks, traces, prompts, failure examples, model outputs, or
  scorecards.
- Internal roadmaps, ranked product priorities, strategy decks, or launch
  review documents.
- Org charts, performance data, headcount plans, or names that reveal private
  reporting structures.
- Revenue targets, pipeline details, contract terms, or partner commitments.
- Private product screenshots, unreleased UI, credentials, keys, tokens,
  cookies, request headers, `.env` contents, or authenticated account data.

Public screenshots and diagrams are acceptable only when the public URL is
recorded and the asset does not imply endorsement beyond Ryan's documented
role.
