---
name: portfolio-writing
description: How Ryan writes. Use whenever drafting or editing prose or copy for this site, including work case studies, blog posts, social posts, article headlines, page copy, talk titles and abstracts, naming, social preview copy, and link summaries.
---

# How Ryan writes

## Voice

- **First person, active, direct.** "I built the eval suite," not "an eval suite was developed."
- **Outcome first, with one deliberate exception.** Lead with the result in summaries, `shareSummary`, `## What shipped`, and the opening paragraph of a post. Work-entry `## The goal` sections are the exception: they open on the problem, often a belief worth refusing, and never on a metric. See `portfolio/content/work/agentic-evals.md` and `work/geo-architecture-center.md`.
- **Metrics are the spine, chosen with taste.** Lead with numbers, but pick ones that are safe for a public post from Ryan's personal brand. Safe to state with the real number: public, verifiable stats (npm download counts for the open-source libraries, published platform scale); metrics from prior companies (Mapbox, Instabase, Caterpillar, Google Cloud); and current-employer figures that are either a couple of years old or tied to something publicly launched for at least several months. If a safe claim has a number, use it.
- **Be careful with recent internal current-employer metrics.** Recent Google Maps Platform usage and growth figures (unique active users, API engagement) are both internal and sales-pitchy. Do not publish precise percentages for them: use qualitative, understated framing instead ("significant growth," "more than doubled," "grew substantially"). When a metric is recent, internal, and about the current platform, prefer to understate or omit it. When unsure, understate.
- **Growth-backwards framing.** Every work story starts from the adoption, revenue, or reach goal it served, then shows what shipped, then what the durable lesson is. Not "here's a thing I made."
- **Leader-practitioner, always.** Pair every strategy claim with the concrete artifact: the trace reviewed, the eval written, the app shipped. Convey that Ryan sets direction and stays in the work. Do not reuse a fixed sentence to say it.
- **Pacing and flow over staccato fragments.** Combine short, punchy sentence fragments into flowing, complete sentences. Use semicolons to link closely related ideas rather than breaking them into separate, abrupt sentences.
- **Conversational flow and transitions.** Add conversational transitions to guide the reader through the thought process (e.g., "Naturally while learning about...", "So, I explored how...", "That got me to thinking -"). Break up dense paragraphs by introducing conclusions or new sections with a rhetorical question (e.g., "What does this mean?", "Can we fix that...?").
- **Specificity and contextual grounding.** Replace vague pronouns and general terms with specific tool/technology names (e.g., "the Places API", "Gemma 4 series"). Clarify abstract concepts so the real-world consequence is obvious (e.g., expanding on "token bloat").
- **End on engagement.** Replace stark, dramatic sign-offs with a community-focused Call to Action that encourages discussion (e.g., "I'd love to hear how you're handling... Let me know in the comments!").
- **No em-dashes.** Use a period, a semicolon, or a colon instead. An em-dash is fine only when truly unavoidable.
- **Never overstate. Credit the team.** Most work here shipped with teams across product, engineering, UX, DevX, DRE, technical writing, and field engineering. Credit by era and authorship rather than by a single default. Pre-Google and solo-authored work is plainly "I" (`work/mapbox-oss-datascience.md`: "I wrote both libraries."). Current-employer shipped product names the team as builder and Ryan as the person who set direction and stayed close to the work, phrased fresh each time. Personal artifacts built outside work are "I" even when current. Every claim needs a real artifact or verifiable number behind it. When unsure, understate. Do not dilute genuinely individual work: an authored library or a 0→1 product role is yours to state plainly.
- **A humble experimenter, not a finished authority.** Ryan does not have it figured out, and neither does anyone else. Frame current systems as loops still being learned, and let endings invite the reader to keep working rather than declare the method solved. Past lessons can be stated plainly; it is the present and the future that stay humble. Write the humility fresh every time. "We are still learning what works" has already shipped in four Field Notes and must not appear in a fifth.
- **Generalize third-party tools; name first-party surfaces.** Name Ryan's own and first-party surfaces (AI Studio, the open-source libraries). Do not enumerate specific third-party or competitor AI agent products such as name-brand IDEs, assistants, or agent apps. Say that the work runs in AI Studio and other compatible agent environments, wording it differently each time rather than pasting that phrase. This keeps the site a builder's portfolio, not a product catalog, and avoids reading like tool-shopping or looking for work elsewhere.
- **A dev brand, not a product pitch.** Fieldwork is Ryan's developer notebook, not an employer's marketing page. Describe shipped work and link public artifacts, but do not adopt a product-marketing tone or over-brand every noun. Prefer "hosted MCP service" to "Google-hosted MCP service" when the brand is not the point. Keep legitimate public links; cut salesy product-name enumerations and internal product framings.
- **Cut, don't polish.** If a piece of content is not differentiated, cut it. Don't spend time making weak content sound better.
- **Write technical posts as a conversation with evidence.** Move between plain-language explanation, a concrete artifact, and what the artifact proves. Use first and second person where natural. Define jargon at the point of use, then keep moving.
- **Code must earn its space.** Introduce each sample with the problem it answers and follow it with the behavior or tradeoff the reader should notice. Prefer the smallest runnable or representative excerpt. Do not stack code blocks without connective prose, and do not add code merely to make a post look technical.
- **Every phrasing in this skill is a meaning, not a string.** Quoted text here shows what to convey, never what to paste. The phrases this skill once supplied became the most repeated lines in the corpus, which is the opposite of voice. Before publishing, check that no distinctive phrase of six or more words already appears in another entry; `npm run check:content` reports these.

## Moves Ryan actually makes

These recur across the strongest entries and are what the prohibitions above cannot produce on their own.

- **Open on a quoted objection.** Put the wrong belief in quotation marks, then refuse it. `work/agentic-evals.md`: "The demo looked good" is not a launch bar.
- **Define by negative space.** Say what a thing answers, then what it does not. `work/agent-skills.md`: "Grounded retrieval tells an agent what's true. It doesn't teach an agent how to work."
- **Use the colon as the pivot the em-dash used to be.** A claim, a colon, then its unpacking. `pages/about.md`: "The loop is simple: find a problem that repeats, build the smallest useful artifact, test whether it helps, and publish what others can reuse."
- **Anchor evidence in a vantage point, not only an artifact.** `work/mapbox-boundaries-atlas.md`: "As Mapbox's first customer-facing engineer, I kept hitting the same two blockers."
- **Close by connecting the present to an earlier era.** `writing/the-next-platform-interface-is-an-agent-session.md`: "Agent interfaces change the mechanics, but not the operating lesson."
- **Refuse the flattering reading.** `work/mapbox-oss-datascience.md`: "real libraries that closed real workflow gaps, not conference demos."
- **Use contractions where the register is conversational.** don't, doesn't, what's, I've. Prose with no contractions and every negation expanded reads generated.
- **Preferred vocabulary:** friction, artifact, trace, surface, shipped, delta, bar, field, durable. Use "loop" deliberately and never as the only metaphor in a piece. **Avoid:** solution, enable, empower, and "journey" outside the compound "developer journey."


## Social, titles, headlines, and naming

Use this framework for any social post, article headline, demo name, section title, talk title, social card copy, or link preview. The goal is honest curiosity that earns attention and improves recall while still sounding like Ryan. For examples, read `references/social-packaging-examples.md` when drafting or reviewing public-facing packaging.

### The retention loop

1. **Name the misconception or false certainty first.** Start from the thing a smart builder likely believes, assumes, or overlooks.
2. **Turn it into a question or tension.** Make the reader want the explanation, but point to a real answer the piece immediately pays off.
3. **Resolve with a causal mechanism.** Explain the tradeoff, sequence, or before/after path. Use cause-and-effect language so the lesson sticks.
4. **Swap the surface topic for the hidden lesson.** Draft the obvious framing first, then lead with the more interesting underlying mechanism. Let the announcement, artifact, or launch support that lesson.
5. **Make the reader do one small mental move.** Ask them to compare, predict, diagnose, or notice a contradiction before the explanation lands.

### Packaging rules

- **One idea per package.** A title, preview image, or social post should be readable in one glance and summarize one promise.
- **Concrete stakes beat abstraction.** Prefer a visible consequence, artifact, or tradeoff over a category label.
- **Title and image do different jobs.** Let the title carry the question or claim. Let the image show the artifact, contrast, scale, before/after, or human consequence.
- **Make the visual obvious at small size.** Use high contrast, one focal point, minimal text, and a clear before/after, tradeoff, or focal contrast. Avoid fake shock, exaggerated faces, cluttered diagrams, and meme language.
- **Earn the click immediately.** The first paragraph must answer the promise made by the title or social card. If the piece cannot pay off the hook honestly, weaken the hook or cut the piece.
- **Iterate before polishing.** Draft at least 10 title/social-card/social-post variants for important pieces, then keep the one with the clearest misconception, strongest artifact, and most honest stakes.
- **Grade the voice, don't trust the first draft.** For a headline Field Note, write three genuinely distinct full drafts (for example analytical, scene-led, and staccato), then have an independent reviewer grade them on authentic voice, rhythm, freedom from AI-isms, and punchiness before the lead picks and finalizes. Competent-but-generated is the failure mode; catch it with a second reader, not a self-check.
- **Give each post its own visual.** Draw bespoke, low-text art per post (one distinct scene that carries one idea) rather than reusing the shared box-and-arrow flow template for every piece; keep the house chrome for family resemblance but change the central geometry so a post's images read as its own.

### Ryan-specific guardrails

- Adapt high-retention patterns to Ryan’s builder voice: plainspoken, evidence-led, humble, and useful to practitioners.
- Never imitate a named creator, meme format, shocked expression, giveaway framing, or manufactured drama.
- Never use curiosity that withholds a basic fact the reader needs. Curiosity should expose a useful gap in understanding, not trick the reader.
- Keep promises bounded by evidence. If the title says “changed,” “worked,” “failed,” or “grew,” the body needs a public artifact, metric, or clearly framed experience behind it.
- Prefer durable learning over cleverness. A good headline makes the reader remember the mechanism, not just click the link.

## Structure for work entries

Three sections, in order, each 1–2 short paragraphs:

1. `## The goal`: the business/growth problem, stated plainly.
2. `## What shipped`: what was actually built or led, with links to real artifacts.
3. `## What I learned`: the durable lesson, stated plainly.

## Structure for blog posts

- A title that states the thesis, not the topic ("Developer experience is a growth engine," not "Thoughts on DevX").
- First paragraph: conversational and relatable. Start with a real-world scenario or project context before diving into the tech.
- Evidence from real work: link the artifact every time. Be specific about tools and APIs.
- End with an engaging Call to Action (CTA) that invites community discussion or comments.

## Review gate

Before calling public prose ready, run the `portfolio-review` skill. Inventory every material claim, verify it against `docs/PORTFOLIO_EVIDENCE_LEDGER.md` or a primary source, check attribution and causality, then use an independent copy/claims reviewer. Unsupported copy is removed or qualified, never polished into plausibility.

## Syndicating a post to Substack

Posts live here first. This site owns the canonical URL and RSS feed. Substack
documents RSS archive import but does not document a reliable external
canonical control or write API. For ongoing syndication:

1. Publish and verify the Field Note here first.
2. Publish a short Substack excerpt or Note with a tracked link to the full post.
3. Do not mirror the full body unless a verified Substack setting can point its
   canonical URL back to this site.
4. Keep subscriber ownership and campaign naming aligned with
   `docs/SYNDICATION.md`.

## Things Ryan never writes

- Passive voice for his own work.
- "We're excited to announce…"
- Geospatial jargon when a plain word exists ("map data," not "geospatial information layers").
- Anything that reads like a resume bullet transplanted into prose.
- Em-dashes.
- Solo credit for team work.
- Cliché outdoor metaphors for hobbies (e.g., "chase trails"). Use specific, literal descriptions of the activity (e.g., "love the outdoors and pushing myself gravel riding and trail running").
- Precise recent internal current-employer usage or growth numbers (use qualitative framing; prior-company and public/verifiable metrics keep their real numbers).
- Enumerated lists of third-party or competitor AI tools ("AI Studio and other compatible agent environments," not a name-brand list).
- Employer product-marketing tone that reads like he is selling the platform or looking for work elsewhere.
- A claim that a current system, method, or playbook is finished or figured out. The voice is a practitioner learning in public.
- The stock self-credit line "I lead the strategy and review the traces" (or any close variant). It reads as trite and inauthentic. Credit the team and cite a real artifact instead.
- The "it's not X, it's Y" antithesis flip used as filler. Keep it to at most two load-bearing turns per piece (the title thesis and the single payoff line); more than that reads as an AI tell.
