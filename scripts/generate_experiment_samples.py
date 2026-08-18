#!/usr/bin/env python3
"""Generate actual outputs from the fine-tuned Gemma 4 31B Dense model for the 3 article experiment tasks."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from voiceeval import runner  # noqa: E402

TASKS = [
    {
        "id": "task_1",
        "name": "Task 1: Status Report to Builder Voice",
        "task": "Edit",
        "prompt": (
            "Rewrite this status report in Ryan's active builder voice. Keep it very short (max 2 sentences, under 250 characters). "
            "Keep exact numbers (62%, 840ms to 310ms, 14 services). No em-dashes.\n\n"
            'Source: "Leadership was provided to deploy a caching layer to improve fleet reliability. '
            'P99 latency was reduced by 62% (from 840ms to 310ms) across 14 services."'
        ),
    },
    {
        "id": "task_2",
        "name": "Task 2: Voice Memo to Post-Mortem",
        "task": "Draft",
        "prompt": (
            "Turn this voice memo into a short post-mortem opening. Keep it very short (max 2 sentences, under 250 characters). "
            "Keep numbers exact (2pm, 2 seconds, 90 lines, 30 to 2). No em-dashes. Do not invent stats.\n\n"
            'Voice memo: "Our queue was backing up at 2pm because workers polled Postgres every 2 seconds instead of using push notifications. '
            'We changed 90 lines to listen/notify and weekly alarms dropped from 30 to 2."'
        ),
    },
    {
        "id": "task_3",
        "name": "Task 3: Editorial Critique",
        "task": "Critique",
        "prompt": (
            "Give brief editorial feedback on this draft opening. Keep it very short (max 2 sentences, under 250 characters). "
            "Flag the consensus tell and false antithesis flip. No em-dashes.\n\n"
            'Draft opening: "We all know raw AI copy is bland. I don\'t want an AI to write for me; I want a rubber duck to help me draft."'
        ),
    },
]


def main():
    model_path = str(ROOT / "models" / "gemma-4-31b-it-4bit")
    adapter_path = str(ROOT / "adapters" / "gemma-4-31b-ryan-voice-v8")

    if not Path(adapter_path).exists():
        print(f"Error: Adapter path {adapter_path} does not exist.", file=sys.stderr)
        sys.exit(1)

    print(f"Loading MLX backend with model {model_path} and adapter {adapter_path}...")
    backend = runner.MLXBackend(model_path=model_path, adapter_path=adapter_path)

    results = {}
    for task_info in TASKS:
        print(f"\nGenerating for {task_info['name']}...")
        messages = [
            {"role": "system", "content": runner.SYSTEM_PROMPT},
            {"role": "user", "content": f"[Task: {task_info['task']}]\n{task_info['prompt']}"},
        ]
        completion, seconds = backend.generate(messages, max_tokens=120, temperature=0.7)
        cleaned = runner.clean_output(completion)
        results[task_info["id"]] = {
            "name": task_info["name"],
            "task": task_info["task"],
            "output": cleaned,
            "seconds": seconds,
            "char_count": len(cleaned),
        }
        print(f"--- Output ({seconds:.2f}s, {len(cleaned)} chars) ---")
        print(cleaned)

    output_path = ROOT / "experiment" / "voice-ft" / "eval" / "results" / "round8_dense_compact_samples.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nWrote results to {output_path}")


if __name__ == "__main__":
    main()
