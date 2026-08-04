#!/usr/bin/env python3
"""
Infographic Agent — portable skill (direct Gemini image generation)

Turns any topic, note, or file of text into a polished infographic PNG using the
exact same two-agent pipeline as the web demo:

  1. Research orchestrator  (gemini-3.5-flash) — grounds the topic with Google
     Search, then engineers a precise, text-accurate image-generation prompt.
  2. Image generator        (gemini-3.1-flash-lite-image) — renders the prompt
     directly into a PNG.

There are NO browser or Playwright dependencies. Install with:

    pip install google-genai pillow

(google-genai is required; pillow is used to transcode the model's output to
lossless PNG for crisp text — the script still runs without it, saving the
model's native format instead.)

Quick start:

    # First run walks you through getting a free key from Google AI Studio
    python3 portable_infographic.py "Top 5 programming languages in 2026"

    # ...or set it yourself and go
    export GEMINI_API_KEY="your-key"
    python3 portable_infographic.py "Q2 sales highlights" --output sales.png

After the first draft the CLI drops into an interactive refine loop so you can
iterate ("make the header bolder", "use teal accents") and watch each revision
update in seconds.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

genai = None
types = None


def ensure_genai() -> None:
    """Import the Gemini SDK only when an API call is about to run."""
    global genai, types
    if genai is not None and types is not None:
        return
    try:
        from google import genai as imported_genai
        from google.genai import types as imported_types
    except ImportError:
        sys.stderr.write(
            "[Error] The Google GenAI SDK is not installed.\n"
            "        Install it with:  pip install google-genai\n"
        )
        sys.exit(1)
    genai = imported_genai
    types = imported_types

# --------------------------------------------------------------------------- #
# Constants — keep the default model IDs in lockstep with the web demo (src/types.ts)
# --------------------------------------------------------------------------- #

ORCHESTRATOR_MODEL = "gemini-3.6-flash"          # research + prompt engineering
IMAGE_MODEL = "gemini-3.1-flash-image"           # direct infographic rendering
QUALITY_IMAGE_MODEL = "gemini-3.1-flash-image"   # skill-only quality option
SUPPORTED_IMAGE_MODELS = (IMAGE_MODEL, QUALITY_IMAGE_MODEL)
IMAGE_PROMPT_PREFIX = "Generate a professional infographic image"

AISTUDIO_KEY_URL = "https://aistudio.google.com/apikey"
CONFIG_DIR = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "infographic-agent"
CONFIG_PATH = CONFIG_DIR / "config.json"

# Soft limit: larger inputs still work but burn tokens and rarely fit one poster.
MAX_TEXT_CHARS = 20000

RETRYABLE = ("408", "429", "500", "502", "503", "504")

MODES = {
    "data-story": "Data-forward layout with charts, graphs, statistical callouts, trend lines, and percentage highlights.",
    "executive-summary": "Clean and minimal. Large headline numbers, 3-5 key takeaways, strategic insights, board-ready aesthetics.",
    "technical-deep-dive": "Dense and precise. Architecture diagrams, code snippets in monospace, system-flow arrows, technical terminology.",
    "classroom": "Friendly and illustrative. Numbered steps, visual analogies, approachable language, warm colors.",
    "quick-slide": "Single-slide format with minimal text, high visual impact, presentation-ready large typography.",
    "brandkit": "Premium brand identity board with clean presentation grids, logo cover mark, color swatches, typography specimens, UI mockups (browser chrome, phone crop, or terminal frame), and an art-directed atmospheric image against a charcoal or warm ivory canvas.",
    "blog-post": "Editorial thumbnail/hero layout. Combine a punchy bold tagline, large typography, a single dramatic atmospheric/campaign image, clean text strings, and generous negative space to capture user attention.",
    "portfolio-showcase": "Minimalist case-study layout. Emphasize a clean alignment grid, clear gutters, project milestones or key results, elegant font choices, and clean visual details like browser chrome or small footer labels.",
    "custom": "",
}

# Supported aspect ratios (extended with editorial layouts 16:10 and 21:9)
SUPPORTED_ASPECTS = {"1:1", "9:16", "16:9", "3:4", "4:3", "1:4", "16:10", "21:9"}


# --------------------------------------------------------------------------- #
# System prompts — mirrors the web demo's two agents (src/services/geminiService.ts)
# --------------------------------------------------------------------------- #

RESEARCH_SYSTEM_PROMPT = """<role>
You are an expert infographic architect and visual data designer. You transform
raw content into an optimized image-generation prompt that produces a
professional, text-accurate infographic.
</role>

<constitution>
1. NEVER fabricate data, statistics, or claims.
2. Every data point MUST come from the user's content or grounded Google Search results.
3. If information is missing, use Google Search to gather real data from credible sources.
4. Quote ALL text strings exactly as they should appear in the infographic.
</constitution>

<prompt_rules>
The "prompt" field you output is sent directly to an image-generation model. It must:
- Start with: "Generate a professional infographic image"
- Use positive framing only — describe what TO include, never negations.
- Give step-by-step spatial instructions: "At the top, place X. Below that, add Y..."
- Quote ALL text strings exactly, wrapped in quotation marks.
- Specify exact colors using #hex values and describe typography (weight, size, style).
- Include accessibility notes: minimum contrast 4.5:1 for normal text, 3:1 for large text.
- Stay under 800 words — dense and precise, not verbose.
- End with composition notes: spacing, alignment, professional polish.
</prompt_rules>

<visual_modes>
- data-story: Data-forward layout with charts, graphs, statistical callouts, trend lines, and percentage highlights.
- executive-summary: Clean and minimal. Large headline numbers, 3-5 key takeaways, strategic insights, board-ready aesthetics.
- technical-deep-dive: Dense and precise. Architecture diagrams, code snippets in monospace, system-flow arrows, technical terminology.
- classroom: Friendly and illustrative. Numbered steps, visual analogies, approachable language, warm colors.
- quick-slide: Single-slide format with minimal text, high visual impact, presentation-ready large typography.
- brandkit: Premium brand identity board with clean presentation grids, logo cover mark, color swatches, typography specimens, UI mockups (browser chrome, phone crop, or terminal frame), and an art-directed atmospheric image against a charcoal or warm ivory canvas.
- blog-post: Editorial thumbnail/hero layout. Combine a punchy bold tagline, large typography, a single dramatic atmospheric/campaign image, clean text strings, and generous negative space to capture user attention.
- portfolio-showcase: Minimalist case-study layout. Emphasize a clean alignment grid, clear gutters, project milestones or key results, elegant font choices, and clean visual details like browser chrome or small footer labels.
</visual_modes>

<output_format>
Respond with valid JSON only. No markdown fences. No extra text. Schema:
{
  "analysis": {
    "title": "string — compelling infographic title",
    "subtitle": "string — supporting subtitle",
    "sectionsCount": number,
    "dataPointsCount": number,
    "brandColors": ["#hex", "#hex", "..."],
    "sourceAttribution": "string — source credits"
  },
  "prompt": "string — the complete image-generation prompt following <prompt_rules>",
  "allTextStrings": ["every", "text", "string", "in", "the", "infographic"]
}
</output_format>"""

IMAGE_SYSTEM_PROMPT = """<role>
You are a professional infographic image generator. Render a high-quality
infographic from the provided prompt.
</role>
<constitution>
1. Render ALL quoted text exactly as written — spelling, capitalization, and punctuation must match perfectly.
2. Fill the entire canvas — use the full aspect ratio with no empty borders.
3. Never fabricate text that was not explicitly provided in the prompt.
</constitution>
<requirements>
- Legible, professional fonts; crisp, clearly readable text; consistent font families.
- Contrast: minimum 4.5:1 for normal text, 3:1 for large text.
- Clear visual hierarchy via size, weight, and spacing. Balanced composition with intentional whitespace.
- Padding & Gutters: Standard padding 5-8% on all edges, consistent spacing between sections (3-5%).
- Details: Include clean structural elements like thin rules, browser chrome borders, or small labels where appropriate.
- STRICTLY NO humans, random dudes, or people in the image. Keep it tech-focused and abstract.
- STRICTLY NO prompt instructions or meta-text rendered in the image itself.
</requirements>"""

REFINE_SYSTEM_PROMPT = """<role>
You are an infographic refinement specialist. You receive the current
infographic image and a user's edit request.
</role>
<constitution>
1. ONLY modify what the user explicitly requested — treat this as a diff-style edit.
2. Preserve all elements, text, colors, spacing, and styling not mentioned in the request.
3. Render ALL text with perfect fidelity unless the user specifically changes it.
4. Return the complete refined infographic with the same dimensions and aspect ratio.
</constitution>"""


# --------------------------------------------------------------------------- #
# Small utilities
# --------------------------------------------------------------------------- #

def info(msg: str) -> None:
    print(msg, flush=True)


def warn(msg: str) -> None:
    sys.stderr.write(f"[Warn] {msg}\n")


def error(msg: str) -> None:
    sys.stderr.write(f"[Error] {msg}\n")


def _scrub(message: str) -> str:
    """Never echo raw SDK errors verbatim: strip anything that looks like a credential."""
    return re.sub(
        r'((?:key=|x-goog-api-key[=:]\s*|Authorization[=:]\s*)"?)[^\s"&]+',
        r"\1[REDACTED]",
        str(message),
    )


def _is_transient(err: Exception) -> bool:
    return any(code in str(err) for code in RETRYABLE)


def _friendly_api_error(err: Exception) -> str:
    s = str(err)
    if "401" in s or "403" in s or "API_KEY_INVALID" in s or "PERMISSION_DENIED" in s:
        return (
            "Your Gemini API key is invalid or lacks permission.\n"
            f"        Get a fresh free key at {AISTUDIO_KEY_URL} and re-run with --setup."
        )
    if "429" in s or "RESOURCE_EXHAUSTED" in s:
        return "Rate limit / quota exceeded. Wait a moment and try again."
    return _scrub(s)


def _word_count(text: str) -> int:
    return len([w for w in text.strip().split() if w])


def _as_string_list(value) -> list:
    return [str(v).strip() for v in value if str(v).strip()] if isinstance(value, list) else []


def _quoted_in_prompt(prompt: str, text: str) -> bool:
    return f'"{text}"' in prompt


def evaluate_prepare_result(plan: dict) -> list:
    """Deterministic handoff checks matching the web app's Prepare eval gate."""
    analysis = plan.get("analysis") if isinstance(plan.get("analysis"), dict) else {}
    prompt = (plan.get("prompt") or "").strip()
    all_text = _as_string_list(plan.get("allTextStrings"))
    brand_colors = _as_string_list(analysis.get("brandColors"))

    schema_issues = []
    if not str(analysis.get("title") or "").strip():
        schema_issues.append("missing title")
    if not isinstance(analysis.get("subtitle"), str):
        schema_issues.append("missing subtitle")
    if not isinstance(analysis.get("sectionsCount"), (int, float)):
        schema_issues.append("missing sectionsCount")
    if not isinstance(analysis.get("dataPointsCount"), (int, float)):
        schema_issues.append("missing dataPointsCount")
    if not isinstance(analysis.get("brandColors"), list):
        schema_issues.append("missing brandColors")
    if not isinstance(analysis.get("sourceAttribution"), str):
        schema_issues.append("missing sourceAttribution")
    if not prompt:
        schema_issues.append("missing prompt")
    if not isinstance(plan.get("allTextStrings"), list):
        schema_issues.append("missing allTextStrings")

    invalid_colors = [c for c in brand_colors if not re.match(r"^#[0-9a-fA-F]{6}$", c)]
    if invalid_colors:
        schema_issues.append(f"invalid brand color {invalid_colors[0]}")

    missing_quoted = [text for text in all_text if not _quoted_in_prompt(prompt, text)]
    prompt_words = _word_count(prompt)

    return [
        {
            "id": "schema",
            "label": "Structured schema",
            "status": "pass" if not schema_issues else "fail",
            "detail": "Prepare output includes the required analysis fields, prompt, and text list."
            if not schema_issues else "; ".join(schema_issues),
        },
        {
            "id": "image-prompt",
            "label": "Explicit image prompt",
            "status": "pass" if prompt.startswith(IMAGE_PROMPT_PREFIX) else "fail",
            "detail": "Prompt starts with the required image-generation request."
            if prompt.startswith(IMAGE_PROMPT_PREFIX) else f'Prompt must start with "{IMAGE_PROMPT_PREFIX}".',
        },
        {
            "id": "text-fidelity",
            "label": "Text fidelity",
            "status": "fail" if not all_text else "pass" if not missing_quoted else "warn",
            "detail": "No final text strings were returned for the renderer."
            if not all_text else "All final text strings are quoted in the renderer prompt."
            if not missing_quoted else f"{len(missing_quoted)} text string(s) are not quoted exactly in the renderer prompt.",
        },
        {
            "id": "grounding",
            "label": "Grounding",
            "status": "pass" if str(analysis.get("sourceAttribution") or "").strip() else "warn",
            "detail": "Source attribution is present."
            if str(analysis.get("sourceAttribution") or "").strip() else "Source attribution is empty; generated facts may be harder to audit.",
        },
        {
            "id": "accessibility",
            "label": "Accessibility",
            "status": "pass" if re.search(r"\b(WCAG|contrast|accessib)", prompt, re.I) else "warn",
            "detail": "Prompt includes contrast or accessibility instructions."
            if re.search(r"\b(WCAG|contrast|accessib)", prompt, re.I) else "Prompt does not explicitly mention contrast or accessibility.",
        },
        {
            "id": "prompt-length",
            "label": "Prompt length",
            "status": "pass" if prompt_words <= 800 else "warn" if prompt_words <= 1200 else "fail",
            "detail": f"Prompt is {prompt_words} words, within the 800-word target."
            if prompt_words <= 800 else f"Prompt is {prompt_words} words; target is 800 words for renderer reliability."
            if prompt_words <= 1200 else f"Prompt is {prompt_words} words; shorten before rendering.",
        },
    ]


def validate_prepare_result(plan: dict) -> dict:
    checks = evaluate_prepare_result(plan)
    failures = [c for c in checks if c["status"] == "fail"]
    if failures:
        details = " ".join(f'{c["label"]}: {c["detail"]}' for c in failures)
        raise ValueError(f"Prepare result failed quality gates: {details}")
    plan["qualityChecks"] = checks
    return plan


def infer_title(content: str) -> str:
    for line in content.splitlines():
        cleaned = re.sub(r"^[#*\-\s]+", "", line).strip()
        if cleaned:
            return cleaned[:80]
    return "Infographic"


def normalize_prepare_plan(plan: dict, content: str, mode: str, extra: str) -> dict:
    """Accept the current web schema and repair older two-field plans when possible."""
    if not isinstance(plan, dict):
        plan = {}

    prompt = (plan.get("prompt") or "").strip()
    title = ""
    if isinstance(plan.get("analysis"), dict):
        title = str(plan["analysis"].get("title") or "").strip()
    title = title or str(plan.get("title") or "").strip() or infer_title(content)

    analysis = plan.get("analysis") if isinstance(plan.get("analysis"), dict) else {}
    normalized = {
        "analysis": {
            "title": title,
            "subtitle": str(analysis.get("subtitle") or MODES.get(mode, "") or "Visual summary").strip(),
            "sectionsCount": analysis.get("sectionsCount") if isinstance(analysis.get("sectionsCount"), (int, float)) else 3,
            "dataPointsCount": analysis.get("dataPointsCount") if isinstance(analysis.get("dataPointsCount"), (int, float)) else len(re.findall(r"\d+(?:\.\d+)?%?", content)),
            "brandColors": analysis.get("brandColors") if isinstance(analysis.get("brandColors"), list) else ["#4285F4", "#34A853", "#FBBC04"],
            "sourceAttribution": str(analysis.get("sourceAttribution") or "User-provided content").strip(),
        },
        "prompt": prompt,
        "allTextStrings": plan.get("allTextStrings") if isinstance(plan.get("allTextStrings"), list) else [title],
    }

    if extra and extra not in normalized["prompt"]:
        normalized["prompt"] = f'{normalized["prompt"]}\n\nAdditional instructions: {extra}'

    return normalized


def direct_prepare_plan(content: str, mode: str, extra: str) -> dict:
    """Build a renderer-ready PrepareResult without the research agent."""
    title = infer_title(content)
    mode_hint = MODES.get(mode, "")
    prompt = (
        f'Generate a professional infographic image. At the top, place "{title}" as the main title. '
        "Clearly and accurately visualize the provided content using a clean modern layout with strong visual hierarchy, "
        "legible typography, accessible color contrast (minimum 4.5:1), and polished spacing. "
        "Use #4285F4 as the primary color, #34A853 as the secondary color, and #FBBC04 as an accent. "
        "Render all quoted text exactly as written. "
        + (f"Style: {mode_hint}. " if mode_hint else "")
        + (f"Additional instructions: {extra}. " if extra else "")
        + f"Source content to summarize visually: {content}"
    )
    return validate_prepare_result({
        "analysis": {
            "title": title,
            "subtitle": mode_hint or "Visual summary",
            "sectionsCount": 3,
            "dataPointsCount": len(re.findall(r"\d+(?:\.\d+)?%?", content)),
            "brandColors": ["#4285F4", "#34A853", "#FBBC04"],
            "sourceAttribution": "User-provided content",
        },
        "prompt": prompt,
        "allTextStrings": [title],
    })


def print_prepare_eval(plan: dict) -> None:
    checks = plan.get("qualityChecks") or []
    if not checks:
        return
    passed = sum(1 for c in checks if c.get("status") == "pass")
    warnings = [c for c in checks if c.get("status") == "warn"]
    info(f"✅ Prepare evals: {passed}/{len(checks)} passed" + (f", {len(warnings)} warning(s)" if warnings else ""))
    for check in warnings:
        warn(f'{check["label"]}: {check["detail"]}')


# --------------------------------------------------------------------------- #
# API key onboarding — the "one-click, free from AI Studio" flow
# --------------------------------------------------------------------------- #

def _load_saved_key() -> str:
    try:
        if CONFIG_PATH.exists():
            data = json.loads(CONFIG_PATH.read_text())
            return (data.get("gemini_api_key") or "").strip()
    except Exception:
        pass
    return ""


def _save_key(key: str) -> None:
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        CONFIG_PATH.write_text(json.dumps({"gemini_api_key": key}, indent=2))
        # Lock the file down — it holds a secret.
        os.chmod(CONFIG_PATH, 0o600)
        info(f"✓ Saved your key to {CONFIG_PATH} (readable only by you).")
    except Exception as e:
        warn(f"Could not save key to {CONFIG_PATH}: {e}. It will work for this run only.")


def _try_open_url(url: str) -> bool:
    """Open a URL in the default browser. Returns True if a launcher was invoked."""
    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif os.name == "nt":
            os.startfile(url)  # type: ignore[attr-defined]
        else:
            subprocess.Popen(["xdg-open", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False


def interactive_setup() -> str:
    """Walk the user through getting a free Gemini API key and save it."""
    info(
        "\n──────────────────────────────────────────────────────────────\n"
        " Let's get you a FREE Gemini API key (takes ~20 seconds)\n"
        "──────────────────────────────────────────────────────────────\n"
        f" 1. Open  {AISTUDIO_KEY_URL}\n"
        " 2. Sign in with any Google account (free — no billing required)\n"
        ' 3. Click "Create API key", then copy it\n'
    )

    if sys.stdin.isatty():
        try:
            answer = input(" Open that page in your browser now? [Y/n] ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            answer = "n"
        if answer in ("", "y", "yes"):
            if _try_open_url(AISTUDIO_KEY_URL):
                info(" → Opened your browser.")
            else:
                info(f" → Could not auto-open a browser. Visit {AISTUDIO_KEY_URL} manually.")

    if not sys.stdin.isatty():
        error(
            "No Gemini API key found and no interactive terminal to prompt in.\n"
            f"        Set one with:  export GEMINI_API_KEY=\"your-key\"   (get it free at {AISTUDIO_KEY_URL})"
        )
        sys.exit(1)

    try:
        import getpass
        key = getpass.getpass(" Paste your API key here (hidden), then press Enter: ").strip()
    except (EOFError, KeyboardInterrupt):
        info("")
        sys.exit(1)

    if not key:
        error("No key entered. Re-run and paste your key, or set GEMINI_API_KEY.")
        sys.exit(1)

    _save_key(key)
    return key


def resolve_api_key(force_setup: bool = False) -> str:
    """Resolve the Gemini API key from env → saved config → interactive setup."""
    if force_setup:
        return interactive_setup()

    key = (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()
    if key:
        return key

    key = _load_saved_key()
    if key:
        return key

    # Vertex AI is still supported for enterprise users who prefer it.
    if os.environ.get("GOOGLE_CLOUD_PROJECT"):
        return ""  # signal: use Vertex path

    return interactive_setup()


def build_client(api_key: str) -> "genai.Client":
    ensure_genai()
    if api_key:
        return genai.Client(api_key=api_key)
    # Vertex AI fallback (GOOGLE_CLOUD_PROJECT is set).
    project = os.environ["GOOGLE_CLOUD_PROJECT"]
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
    if location == "global":
        location = "us-central1"
    return genai.Client(vertexai=True, project=project, location=location)


# --------------------------------------------------------------------------- #
# Agent 1 — research orchestrator (gemini-3.5-flash + Google Search grounding)
# --------------------------------------------------------------------------- #

def research_prompt(client, content: str, mode: str, aspect: str, extra: str) -> dict:
    """Ground the topic and engineer a precise image-generation prompt."""
    mode_hint = MODES.get(mode, "")
    user_prompt = "\n".join(
        p for p in [
            "<task>Analyze the content below and produce the JSON described in your instructions. "
            "Use Google Search to fill gaps or verify facts.</task>",
            f"<preferences>Mode: {mode}{(' — ' + mode_hint) if mode_hint else ''}",
            f"Aspect ratio: {aspect}",
            f"Additional instructions: {extra}" if extra else None,
            "</preferences>",
            "<content>",
            content,
            "</content>",
        ] if p is not None
    )

    config = types.GenerateContentConfig(
        system_instruction=RESEARCH_SYSTEM_PROMPT,
        temperature=0.7,
        tools=[types.Tool(google_search=types.GoogleSearch())],
        http_options=types.HttpOptions(timeout=180_000),
    )

    info("🔎 Researching and planning the infographic (gemini-3.5-flash)...")
    last_error = None
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=ORCHESTRATOR_MODEL, contents=user_prompt, config=config
            )
            plan = validate_prepare_result(normalize_prepare_plan(_parse_json(response.text or ""), content, mode, extra))
            title = plan["analysis"]["title"]
            if not plan["prompt"]:
                raise ValueError("research agent returned no prompt")
            if title:
                info(f'   ↳ "{title}"')
            print_prepare_eval(plan)
            return plan
        except Exception as e:  # noqa: BLE001
            last_error = e
            if _is_transient(e) and attempt < 2:
                wait = 2 ** (attempt + 1)
                warn(f"Transient API error, retrying in {wait}s...")
                time.sleep(wait)
            else:
                break

    # Research is a best-effort enhancement: fall back to a direct prompt so the
    # user still gets an image instead of a hard failure.
    warn(f"Research step failed ({_friendly_api_error(last_error)}). Falling back to a direct prompt.")
    plan = direct_prompt(content, mode, extra)
    print_prepare_eval(plan)
    return plan


def direct_prompt(content: str, mode: str, extra: str) -> dict:
    """Build an image prompt without the research agent (used by --no-research / fallback)."""
    plan = direct_prepare_plan(content, mode, extra)
    print_prepare_eval(plan)
    return plan


def _parse_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    return json.loads(cleaned)


# --------------------------------------------------------------------------- #
# Agent 2 — image generator (gemini-3.1-flash-lite-image)
# --------------------------------------------------------------------------- #

def _extract_image(response):
    """Return (image_bytes, mime_type) from a Gemini image response."""
    parts = (response.candidates[0].content.parts if response.candidates else None) or []
    for part in parts:
        inline = getattr(part, "inline_data", None)
        if inline and inline.data:
            return inline.data, (inline.mime_type or "image/png")
    raise RuntimeError("The model did not return an image. Try rephrasing your topic and generate again.")


def _normalize_to_png(data: bytes, mime: str):
    """Convert the model's output to lossless PNG so text stays crisp.

    The Gemini Developer API returns JPEG for gemini-3.1-flash-lite-image and
    does not allow forcing the output format, so we transcode here. Pillow keeps
    the install tiny; if it is somehow missing we fall back to the native bytes
    (with an honest extension) rather than hard-failing.
    """
    m = (mime or "").lower()
    if m in ("image/png", ""):
        return data, "image/png"
    try:
        import io
        from PIL import Image

        img = Image.open(io.BytesIO(data))
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue(), "image/png"
    except ImportError:
        warn("Pillow not installed — saving the model's native format. "
             "Run 'pip install pillow' for guaranteed lossless PNG output.")
        return data, m
    except Exception as e:  # noqa: BLE001 — never let transcoding lose the image
        warn(f"Could not transcode to PNG ({type(e).__name__}); saving native format.")
        return data, m


def _config_fields(config_type):
    """Return the declared fields across supported Pydantic SDK versions."""
    return getattr(config_type, "model_fields", None) or getattr(config_type, "__fields__", {})


def _image_config(aspect: str, resolution: str):
    """Request image size only when the installed SDK exposes that field."""
    fields = _config_fields(types.ImageConfig)
    kwargs = {"aspect_ratio": aspect}
    if "image_size" in fields:
        kwargs["image_size"] = resolution
    else:
        warn("Installed google-genai does not expose image_size; using the model's native resolution.")
    return types.ImageConfig(**kwargs)


def _thinking_config():
    """Use high thinking on current SDKs and dynamic thinking on older SDKs."""
    fields = _config_fields(types.ThinkingConfig)
    if "thinking_level" in fields:
        return types.ThinkingConfig(thinking_level="HIGH", include_thoughts=True)
    return types.ThinkingConfig(thinking_budget=-1, include_thoughts=True)


def generate_image(client, prompt: str, aspect: str, image_model: str, resolution: str):
    config = types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
        image_config=_image_config(aspect, resolution),
        thinking_config=_thinking_config(),
        http_options=types.HttpOptions(timeout=180_000),
    )
    info(f"🎨 Generating the infographic ({image_model}) at {resolution}...")
    return _call_image_model(
        client,
        contents=[f"{prompt}\n\n{IMAGE_SYSTEM_PROMPT}"],
        config=config,
        image_model=image_model,
    )


def refine_image(client, image_bytes: bytes, mime: str, instruction: str, aspect: str, image_model: str, resolution: str):
    config = types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
        image_config=_image_config(aspect, resolution),
        thinking_config=_thinking_config(),
        http_options=types.HttpOptions(timeout=180_000),
    )
    contents = [
        types.Part.from_bytes(data=image_bytes, mime_type=mime or "image/png"),
        types.Part.from_text(
            text=(
                "<current_image>The attached image is the current infographic.</current_image>\n"
                f"<refinement>{instruction}</refinement>\n\n{REFINE_SYSTEM_PROMPT}"
            )
        ),
    ]
    return _call_image_model(client, contents=contents, config=config, image_model=image_model)


def _call_image_model(client, contents, config, image_model: str):
    """Call the image model with retries; return (png_bytes, mime_type)."""
    last_error = None
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=image_model, contents=contents, config=config
            )
            data, mime = _extract_image(response)
            return _normalize_to_png(data, mime)
        except Exception as e:  # noqa: BLE001
            last_error = e
            if _is_transient(e) and attempt < 2:
                wait = 2 ** (attempt + 1)
                warn(f"Transient API error, retrying in {wait}s...")
                time.sleep(wait)
            else:
                break
    raise RuntimeError(_friendly_api_error(last_error))


# --------------------------------------------------------------------------- #
# Output handling
# --------------------------------------------------------------------------- #

_EXT_BY_MIME = {"image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/webp": ".webp"}
_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ""}


def save_image(image_bytes: bytes, mime: str, output_path: str) -> str:
    """Write the image, ensuring the extension matches the actual format."""
    correct_ext = _EXT_BY_MIME.get((mime or "").lower(), ".png")
    path = os.path.realpath(output_path)
    root, ext = os.path.splitext(path)
    # Swap a mismatched image extension (or none) for the true one; otherwise append.
    path = (root + correct_ext) if ext.lower() in _IMAGE_EXTS else (path + correct_ext)
    parent = os.path.dirname(path)
    if parent and not os.path.isdir(parent):
        error(f"Output directory does not exist: {parent}")
        sys.exit(1)
    with open(path, "wb") as f:
        f.write(image_bytes)
    return path


def open_output(path: str) -> None:
    if _try_open_url(path):
        info("   ↳ Opened in your default image viewer.")


# --------------------------------------------------------------------------- #
# Interactive refine loop — fast, iterative preview
# --------------------------------------------------------------------------- #

def refine_loop(client, image_bytes: bytes, mime: str, output_path: str, aspect: str, auto_open: bool, image_model: str, resolution: str) -> None:
    info(
        "\n💬 Refine it, or press Enter to finish.\n"
        '   e.g. "make the header bolder", "use teal accents", "add source citations"'
    )
    revision = 1
    base, _ = os.path.splitext(output_path)
    while True:
        try:
            instruction = input("\nRefine › ").strip()
        except (EOFError, KeyboardInterrupt):
            info("")
            break
        if not instruction or instruction.lower() in ("q", "quit", "exit", "done"):
            break
        try:
            image_bytes, mime = refine_image(client, image_bytes, mime, instruction, aspect, image_model, resolution)
        except Exception as e:  # noqa: BLE001
            error(_scrub(str(e)))
            continue
        revision += 1
        rev_path = save_image(image_bytes, mime, f"{base}-v{revision}")
        info(f"✓ Saved revision {revision}: {rev_path}")
        if auto_open:
            open_output(rev_path)


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="infographic-agent",
        description="Generate a professional infographic PNG directly with Gemini "
        "(research orchestrator + image model). No browser dependencies.",
    )
    parser.add_argument("topic", nargs="?", help="Topic or content to visualize")
    parser.add_argument("--text", help="Alternative to the positional topic argument")
    parser.add_argument("--output", "-o", default="infographic.png", help="Output PNG path (default: infographic.png)")
    parser.add_argument("--mode", "-m", default="data-story", choices=sorted(MODES.keys()),
                        help="Infographic style (default: data-story)")
    parser.add_argument("--aspect", "-a", default="16:9", choices=sorted(SUPPORTED_ASPECTS),
                        help="Aspect ratio (default: 16:9)")
    parser.add_argument("--resolution", "-r", default="1K", choices=["0.5K", "1K", "2K"],
                        help="Image resolution / size to request from the API (default: 1K)")
    parser.add_argument("--instructions", "-i", default="", help="Extra styling / content instructions")
    parser.add_argument("--image-model", default=IMAGE_MODEL, choices=SUPPORTED_IMAGE_MODELS,
                        help="Image model for the portable skill (default: gemini-3.1-flash-lite-image)")
    parser.add_argument("--no-research", action="store_true",
                        help="Skip the research agent and generate directly from your text")
    parser.add_argument("--no-open", action="store_true", help="Do not auto-open the result")
    parser.add_argument("--yes", "-y", action="store_true", help="Non-interactive: generate once and exit (no refine loop)")
    parser.add_argument("--setup", action="store_true", help="(Re)configure your Gemini API key and exit")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.setup:
        interactive_setup()
        info("\n✓ You're all set. Generate one with:\n"
             '    infographic-agent "Top 5 programming languages in 2026"')
        return

    content = (args.text or args.topic or "").strip()
    if not content:
        parser.print_help()
        sys.exit(1)

    if len(content) > MAX_TEXT_CHARS:
        warn(f"Input is {len(content)} chars (> {MAX_TEXT_CHARS}); large inputs rarely fit one poster and burn tokens.")

    api_key = resolve_api_key()
    try:
        client = build_client(api_key)
    except Exception as e:  # noqa: BLE001
        error(_scrub(str(e)))
        sys.exit(1)

    try:
        if args.no_research:
            plan = direct_prompt(content, args.mode, args.instructions)
        else:
            plan = research_prompt(client, content, args.mode, args.aspect, args.instructions)
        image_bytes, mime = generate_image(client, plan["prompt"], args.aspect, args.image_model, args.resolution)
    except Exception as e:  # noqa: BLE001
        error(_friendly_api_error(e))
        sys.exit(1)

    path = save_image(image_bytes, mime, args.output)
    info(f"\n✓ Saved infographic: {path}")

    auto_open = not args.no_open
    if auto_open:
        open_output(path)

    interactive = not args.yes and sys.stdin.isatty()
    if interactive:
        refine_loop(client, image_bytes, mime, path, args.aspect, auto_open, args.image_model, args.resolution)

    info("\nDone. 🎉")


if __name__ == "__main__":
    main()
