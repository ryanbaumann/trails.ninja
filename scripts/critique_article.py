#!/usr/bin/env python3
"""Run Gemma 4 31B Dense (Round 8 LoRA) to perform a final comprehensive editorial critique of the article."""

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from voiceeval import runner  # noqa: E402

ARTICLE_PATH = ROOT / "portfolio/content/writing/can-i-build-an-ai-agent-that-doesnt-write-slop.md"


def main():
    article_text = ARTICLE_PATH.read_text(encoding="utf-8")

    # Strip front matter
    if article_text.startswith("---"):
        parts = article_text.split("---", 2)
        if len(parts) >= 3:
            body = parts[2].strip()
        else:
            body = article_text
    else:
        body = article_text

    model_path = str(ROOT / "models" / "gemma-4-31b-it-4bit")
    adapter_path = str(ROOT / "adapters" / "gemma-4-31b-ryan-voice-v8")

    print(f"Loading Gemma 4 31B Dense with LoRA adapter {adapter_path}...")
    backend = runner.MLXBackend(model_path=model_path, adapter_path=adapter_path)

    # 3 Focused Final Critique Tasks
    tasks = [
        {
            "id": "narrative_and_structure",
            "section": "Narrative Arc & Developer Friction",
            "task": "Critique",
            "prompt": (
                "Critique the overall narrative arc, hook, and structural pacing of this updated essay. "
                "Assess whether the friction-first opening works, whether the progression from Context Engineering "
                "to Fine-Tuning to Architectural Gates feels earned and rigorous, and if the final verdict is punchy. "
                "No em-dashes. Direct technical feedback.\n\n"
                f"Full Draft Body:\n{body}"
            ),
        },
        {
            "id": "voice_and_slop_audit",
            "section": "Voice, AI Tells & Punctuation Audit",
            "task": "Critique",
            "prompt": (
                "Perform a strict line-level voice audit across this draft against Ryan's voice rules: "
                "1. Any remaining AI tells, stock phrasing, or false antithesis flips ('not X, but Y')? "
                "2. Any em-dashes, unnecessary semicolons, or punctuation crutches? "
                "3. Are all metrics and claims concrete, verifiable, and free of hype? "
                "No em-dashes. Point out any specific sentences that need attention.\n\n"
                f"Full Draft Body:\n{body}"
            ),
        },
        {
            "id": "experiments_and_visuals",
            "section": "Experiment Tables, Compactness & Takeaway Value",
            "task": "Critique",
            "prompt": (
                "Critique the Side-by-Side Experiments section, the 3 comparison tables, and the conclusions. "
                "Evaluate whether the samples are compact, relatable, and clearly demonstrate the difference "
                "between base zero-shot, prompted skill, and fine-tuning. "
                "No em-dashes.\n\n"
                f"Full Draft Body:\n{body}"
            ),
        },
    ]

    critiques = {}
    for task in tasks:
        print(f"\n=======================================================")
        print(f"Running Gemma 4 31B Dense Critique: {task['section']}...")
        print(f"=======================================================")
        messages = [
            {"role": "system", "content": runner.SYSTEM_PROMPT},
            {"role": "user", "content": f"[Task: {task['task']}]\n{task['prompt']}"},
        ]
        completion, seconds = backend.generate(messages, max_tokens=700, temperature=0.6)
        cleaned = runner.clean_output(completion)
        critiques[task["id"]] = {
            "section": task["section"],
            "critique": cleaned,
            "seconds": seconds,
        }
        print(f"\n--- Model Critique ({seconds:.2f}s) ---")
        print(cleaned)

    out_file = ROOT / "experiment" / "voice-ft" / "eval" / "results" / "final_gemma4_critique.json"
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(critiques, f, indent=2)
    print(f"\nSaved final critique to {out_file}")


if __name__ == "__main__":
    main()
