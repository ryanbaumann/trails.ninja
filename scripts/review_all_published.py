#!/usr/bin/env python3
"""Run Gemma 4 31B Dense (Round 8 LoRA) to perform deep editorial critiques on all published articles."""

import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from voiceeval import runner  # noqa: E402

PUBLISHED_ARTICLES = [
    "portfolio/content/writing/builder-platforms-grow-by-owning-the-agent-loop.md",
    "portfolio/content/writing/can-i-build-an-ai-agent-that-doesnt-write-slop.md",
    "portfolio/content/writing/devex-is-a-growth-discipline.md",
    "portfolio/content/writing/fine-tuning-was-the-easy-part.md",
    "portfolio/content/writing/loop-engineering-coding-agent.md",
    "portfolio/content/writing/the-model-that-picks-your-platform-doesnt-write-the-code.md",
]


def extract_body(text: str) -> str:
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            return parts[2].strip()
    return text.strip()


def main():
    model_path = str(ROOT / "models" / "gemma-4-31b-it-4bit")
    adapter_path = str(ROOT / "adapters" / "gemma-4-31b-ryan-voice-v8")

    print(f"Loading Gemma 4 31B Dense with LoRA adapter {adapter_path} into Apple Silicon Metal...")
    backend = runner.MLXBackend(model_path=model_path, adapter_path=adapter_path)

    all_reviews = {}
    total_start = time.time()

    for idx, rel_path in enumerate(PUBLISHED_ARTICLES, 1):
        full_path = ROOT / rel_path
        article_slug = full_path.stem
        print(f"\n================================================================================")
        print(f"[{idx}/{len(PUBLISHED_ARTICLES)}] REVIEWING: {rel_path}")
        print(f"================================================================================")

        raw_text = full_path.read_text(encoding="utf-8")
        body = extract_body(raw_text)

        tasks = [
            {
                "id": "voice_and_slop_audit",
                "label": "Voice, AI Tells & Punctuation Audit",
                "task": "Critique",
                "prompt": (
                    "Perform a strict line-level voice audit of this published article against Ryan Baumann's voice standards:\n"
                    "1. Scan for any em-dashes, unnecessary semicolons, passive voice for own work, or buzzwords (e.g. 'journey', 'empower', 'solution').\n"
                    "2. Check for stock AI tells, false antithesis flips ('not X, but Y'), or trite self-credit lines.\n"
                    "3. Verify that tone is an active first-person leader-practitioner learning in public with concrete developer artifacts.\n"
                    "4. Point out any specific sentences that need tightening or tone correction.\n"
                    "No em-dashes. Direct technical feedback.\n\n"
                    f"--- FULL ARTICLE BODY ---\n{body}"
                ),
            },
            {
                "id": "narrative_and_structure",
                "label": "Narrative Arc, Hook & Pacing",
                "task": "Critique",
                "prompt": (
                    "Critique the narrative arc, hook, and structural pacing of this published article:\n"
                    "1. Hook: Does the opening lead with real developer friction or a quoted objection rather than an abstract thesis?\n"
                    "2. Pacing: Does the progression follow Growth-backwards framing (Result -> Shipped -> Lesson)?\n"
                    "3. Ending: Does it end on a community-focused discussion CTA rather than a dramatic proclamation or declare the problem solved?\n"
                    "No em-dashes. Direct technical feedback.\n\n"
                    f"--- FULL ARTICLE BODY ---\n{body}"
                ),
            },
            {
                "id": "line_level_edits",
                "label": "Concrete Line-Level Rewrites",
                "task": "Edit",
                "prompt": (
                    "Provide specific line-level rewrites for the weakest, wordiest, or least direct sentences in this article.\n"
                    "Preserve all technical facts, metrics, and API entity names intact while tightening active first-person phrasing.\n"
                    "No em-dashes.\n\n"
                    f"--- FULL ARTICLE BODY ---\n{body}"
                ),
            },
        ]

        article_result = {
            "path": rel_path,
            "slug": article_slug,
            "critiques": {},
        }

        for task in tasks:
            print(f"\n--- Running Critique: {task['label']} ---")
            messages = [
                {"role": "system", "content": runner.SYSTEM_PROMPT},
                {"role": "user", "content": f"[Task: {task['task']}]\n{task['prompt']}"},
            ]
            completion, seconds = backend.generate(messages, max_tokens=1000, temperature=0.6)
            cleaned = runner.clean_output(completion)
            article_result["critiques"][task["id"]] = {
                "label": task["label"],
                "critique": cleaned,
                "seconds": seconds,
            }
            print(f"Completed in {seconds:.2f}s:\n{cleaned}\n")

        all_reviews[article_slug] = article_result

    # Save outputs
    out_json = ROOT / "experiment" / "voice-ft" / "eval" / "results" / "all_published_gemma4_31b_r8_critique.json"
    out_json.parent.mkdir(parents=True, exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(all_reviews, f, indent=2)

    # Generate Markdown Summary
    out_md = ROOT / "experiment" / "voice-ft" / "eval" / "results" / "all_published_gemma4_31b_r8_critique.md"
    md_lines = [
        "# Gemma 4 31B Dense (Round 8 LoRA) Editorial Review of Published Articles",
        "",
        f"- **Model**: `models/gemma-4-31b-it-4bit`",
        f"- **Adapter**: `adapters/gemma-4-31b-ryan-voice-v8`",
        f"- **Total Articles Reviewed**: {len(PUBLISHED_ARTICLES)}",
        f"- **Total Duration**: {time.time() - total_start:.1f}s",
        "",
    ]

    for slug, res in all_reviews.items():
        md_lines.append(f"## {slug}")
        md_lines.append(f"**Path**: `{res['path']}`\n")
        for tid, tdata in res["critiques"].items():
            md_lines.append(f"### {tdata['label']} ({tdata['seconds']}s)")
            md_lines.append(tdata["critique"])
            md_lines.append("")

    out_md.write_text("\n".join(md_lines), encoding="utf-8")
    print(f"\n[✓] All reviews complete in {time.time() - total_start:.1f}s!")
    print(f"[✓] Saved JSON results: {out_json}")
    print(f"[✓] Saved Markdown report: {out_md}")


if __name__ == "__main__":
    main()
