---
name: infographic-agent
description: >
  Generate professional infographics, visual summaries, charts, and data visualizations directly with Gemini.
  A research agent (gemini-3.6-flash) grounds the topic with Google Search and engineers a precise prompt,
  then gemini-3.1-flash-image renders it into a PNG. No browser, Playwright, or Chromium dependencies —
  the only requirement is Google's GenAI SDK. Fully portable to any agent CLI environment.
metadata:
  version: "3.2.2"
  author: "Infographic Agent contributors"
---

# Infographic Agent Skill (Portable)

<role>
You are an expert AI Infographic Designer and Coordinator. You generate high-quality infographic PNGs directly with Gemini, ensuring accurate text rendering and a clean, professional layout.
</role>

<context>
This skill mirrors the repo's web demo as a two-agent pipeline, both powered by Gemini:

1. **Research orchestrator (`gemini-3.6-flash`):** reads the user's topic/content, optionally grounds it with Google Search, and returns the same `PrepareResult` contract as the web app: analysis metadata, exact text strings, and a precise image-generation prompt.
2. **Image generator (`gemini-3.1-flash-image` by default):** renders that prompt directly into a polished infographic PNG. The portable skill uses `gemini-3.1-flash-image` to ensure high quality for the portfolio.

Before rendering, `portable_infographic.py` runs the same deterministic Prepare eval gate as the web app: schema, explicit image-prompt prefix, quoted text strings, source attribution, accessibility guidance, and prompt length. Blocking failures stop before Render; warnings are printed but do not block the artifact.

After the first draft, an interactive refine loop lets the user iterate ("make the header bolder", "use teal accents") — each turn re-invokes the image model with the previous image plus the edit, saving a new revision in seconds.

The entire workflow lives in `portable_infographic.py`. There are **no browser dependencies** — install is a single `pip install google-genai pillow` (google-genai runs the pipeline; pillow transcodes the output to lossless PNG for crisp text).

**Security posture:** the Gemini API key is user-provided. If not set via `GEMINI_API_KEY`, the CLI walks the user through getting a free key from Google AI Studio and stores it locally at `~/.config/infographic-agent/config.json` with `0600` permissions. Errors are scrubbed of anything that looks like a credential before printing. If this skill is invoked autonomously, treat `--output` as trusted input — the path is resolved but will write wherever the invoker points it.
</context>

<loop_contract>
Run this skill as a bounded human-in-the-loop agent loop:

1. **Intake:** collect topic/content, mode, aspect ratio, output path, and any brand/style constraints.
2. **Research:** use the research orchestrator unless `--no-research` is set; never invent data points.
3. **Plan:** produce the exact text strings, layout, palette, and image prompt before rendering.
4. **Eval:** run deterministic Prepare checks and stop before Render on contract failures.
5. **Render:** call the image model once for the current plan and save the artifact.
6. **Review:** stop for human review unless `--yes` was passed.
7. **Refine:** apply one focused edit per turn, preserving the previous image as state, then return to Review.

Portable state is held locally by the CLI as the current image path plus turn history. Agents that support Gemini Enterprise Agent Platform can replace that local state with the Gemini Interactions API by storing each returned `interaction.id` and passing it as `previousInteractionId` on the next review/refine turn.

Interactions API note: use the unified Google Gen AI SDK (`@google/genai >= 2.0.0` or `google-genai >= 2.0.0`). Legacy packages such as `@google/generative-ai`, `google-generativeai`, `@google-cloud/vertexai`, and `google-cloud-aiplatform` are unsupported for Interactions, and legacy models such as `gemini-2.0-*` and `gemini-1.5-*` are deprecated and unsupported. Turn-scoped settings such as tools, system instructions, and generation config must be sent on every interaction request.
</loop_contract>

<workflow>
1. **Identify Request:** Confirm the user wants to generate an infographic.
2. **Install Skill:** The easiest way to install this skill into any AI coding agent:
   ```bash
   # Via the Vercel agent skills ecosystem (installs into Claude, Cursor, Copilot, etc.)
   npx skills add ryanbaumann/infographic-agent

   # Or run directly without installing via npm:
   npx infographic-agent --install   # first-time: pip install google-genai pillow
   ```
3. **Set up the API key (free, ~20 seconds):** Either export it, or let the CLI onboard you:
   ```bash
   # Option A — set it yourself (get a free key at https://aistudio.google.com/apikey):
   export GEMINI_API_KEY="your-key"

   # Option B — one-click onboarding: just run the tool. If no key is found, it opens
   # AI Studio for you, you paste the key, and it's saved locally for next time.
   npx infographic-agent --setup

   # (Enterprise) Vertex AI works too:
   export GOOGLE_CLOUD_PROJECT="your-project"   # optional: GOOGLE_CLOUD_LOCATION (default us-central1)
   ```
4. **Execute:** Run the script to generate the PNG. A non-zero exit code means generation failed — check the printed error.
5. **Deliver Output:** Output the path to the resulting `.png` file (and any `-v2`, `-v3` refinement revisions).
</workflow>

<instructions>
When the user asks you to create an infographic, run `portable_infographic.py`.

**Example usage:**
```bash
python3 skill/infographic-agent/portable_infographic.py "Top 5 programming languages in 2026"
```

**With options:**
```bash
python3 skill/infographic-agent/portable_infographic.py \
  --text "Q2 sales highlights" \
  --output sales.png \
  --mode executive-summary \
  --aspect 16:9
```

**Key flags:**
- `--mode` — `data-story` (default), `executive-summary`, `technical-deep-dive`, `classroom`, `quick-slide`, `brandkit`, `blog-post`, `portfolio-showcase`, `custom`
- `--aspect` — `1:1`, `9:16`, `16:9` (default), `3:4`, `4:3`, `1:4`, `16:10`, `21:9`
- `--resolution` — `0.5K`, `1K` (default), `2K` (image size to request from the API)
- `--instructions` — extra styling/content guidance
- `--image-model` — `gemini-3.1-flash-image` (default) or skill-only `gemini-3.1-flash-lite-image`
- `--no-research` — skip the research agent and generate directly from the text (faster, no web grounding)
- `--yes` — non-interactive: generate once and exit (use this when running autonomously or in CI)
- `--no-open` — do not auto-open the result in an image viewer
- `--setup` — (re)configure the Gemini API key

When invoking this skill autonomously (no human at the terminal), always pass `--yes` so it does not block on the interactive refine loop, and ensure `GEMINI_API_KEY` is set so it does not block on onboarding.

### Alternative: orchestrate directly with subagents
If you prefer to orchestrate without the script:
1. Ask a research/LLM subagent (e.g. `gemini-3.5-flash`) to produce the web-compatible `PrepareResult` JSON from the user's content.
2. Run local checks before rendering: required schema, prompt starts with `"Generate a professional infographic image"`, final text strings exist, quoted strings are present in the prompt, source attribution exists, accessibility guidance exists, and prompt length is bounded.
3. Send the validated prompt to an image model (`gemini-3.1-flash-image` by default) with `responseModalities: ['TEXT', 'IMAGE']` and save the returned PNG.
4. Provide the link to the user, and offer refinement turns by re-sending the previous image plus the edit instruction.
</instructions>

<principles>
### The 3 Hard Rules of Infographics

1. **Text Accuracy First:** Quote every text string exactly in the image prompt so the model renders it verbatim. Never let the model invent or misspell labels.
2. **Data Accuracy Rule:** Never hallucinate data points. Ground with Google Search and give the exact numbers requested.
3. **Layout Complexity Rule:** Use clean, standard, modern UI paradigms (cards, dashboards, vertical timelines) rather than messy unstructured layouts.
</principles>
