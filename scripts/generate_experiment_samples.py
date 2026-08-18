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
        "id": "task_1_product_announcement",
        "name": "Task 1: Product Announcement",
        "task": "Edit",
        "prompt": (
            'Rewrite this corporate announcement in Ryan\'s active, direct builder voice. '
            'Keep every metric intact (62% reduction, 840ms to 310ms, $48,000 annualized spend, 14 services). '
            'Strip all hype words ("thrilled to announce", "innovative", "cutting-edge", "world-class", emojis). '
            'No em-dashes.\n\n'
            'Source:\n'
            '"We are thrilled to announce that our platform engineering team has deployed an innovative, '
            'cutting-edge caching layer to deliver world-class reliability across our entire fleet. '
            'P99 latency was reduced by 62% (from 840ms down to 310ms) and annualized infrastructure spend '
            'was reduced by $48,000 across 14 services."'
        ),
    },
    {
        "id": "task_2_voice_memo",
        "name": "Task 2: Voice Memo to Outline",
        "task": "Draft",
        "prompt": (
            'Turn this voice memo dictation into a clean technical opening for a blog post. '
            'Keep the numbers exact (2:00 PM, 2 seconds, 90 lines, 30 alarms to 2, 2 downstream consumers). '
            'No invented statistics or external studies. No em-dashes. Open with the problem directly.\n\n'
            'Voice memo:\n'
            '"So yeah basically I was looking at why the queue was backing up every afternoon at 2pm '
            'and it turned out the workers were polling postgres every 2 seconds instead of using listen/notify, '
            'so we changed 90 lines of code and alarms dropped from 30 a week to 2, but the tricky part was '
            'making sure the two downstream consumers were idempotent before switching it over."'
        ),
    },
    {
        "id": "task_3_editorial_critique",
        "name": "Task 3: Editorial Critique and Review",
        "task": "Critique",
        "prompt": (
            'Critique this draft paragraph against Ryan\'s writing rules. '
            'Point out the em-dash, the banned cliché phrases, the credit overreach, and the false antithesis flip. '
            'Give specific, constructive feedback as a technical peer.\n\n'
            'Draft:\n'
            '"It is not about the tooling, it is about the culture. '
            'I single-handedly overhauled the authentication architecture in six weeks — which was mission-critical — '
            'and the results speak for themselves. Adoption doubled because developers finally had a default that worked."'
        ),
    },
]


def main():
    model_path = str(ROOT / "models" / "gemma-4-31b-it-4bit")
    adapter_path = str(ROOT / "adapters" / "gemma-4-31b-ryan-voice-v8")

    if not Path(adapter_path).exists():
        print(f"Error: Adapter path {adapter_path} does not exist yet.", file=sys.stderr)
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
        completion, seconds = backend.generate(messages, max_tokens=600, temperature=0.7)
        cleaned = runner.clean_output(completion)
        results[task_info["id"]] = {
            "name": task_info["name"],
            "task": task_info["task"],
            "prompt": task_info["prompt"],
            "output": cleaned,
            "seconds": seconds,
        }
        print(f"--- Output ({seconds:.2f}s) ---")
        print(cleaned)

    output_path = ROOT / "experiment" / "voice-ft" / "eval" / "results" / "round8_dense_experiment_samples.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nWrote results to {output_path}")


if __name__ == "__main__":
    main()
