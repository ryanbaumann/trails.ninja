#!/usr/bin/env python3
"""Run Gemma 4 31B Dense (Round 8 LoRA) to critique and suggest edits for the blog post."""

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
    
    # Critique Tasks
    tasks = [
        {
            "id": "overall_critique",
            "section": "Full Article Narrative & Structure",
            "task": "Critique",
            "prompt": (
                "Critique this draft essay against Ryan's writing standards. "
                "Evaluate: 1. Opening hook and problem framing (does it lead with real developer friction?). "
                "2. Honesty of claims, numbers, and credit. "
                "3. AI tells, hype words, or stock antithesis flips ('not X, but Y'). "
                "4. Em-dashes or punctuation crutches. "
                "5. Practical utility and takeaway value for the reader.\n\n"
                f"Draft excerpt:\n{body[:3000]}"
            )
        },
        {
            "id": "intro_step1_critique",
            "section": "Opening & Step 1 (Context Engineering)",
            "task": "Critique",
            "prompt": (
                "Critique the opening and Step 1 of this draft. Point out any weak phrasing, "
                "vagueness, or areas where the voice could be sharper and more direct.\n\n"
                "Draft text:\n"
                "We all know raw AI copy is bland and predictable: cheerful, generic, and full of buzzwords. "
                "But can an AI assistant still serve as a drafter and copy editor where I can hand over messy notes, "
                "get back a polished draft, and actually ship something good? I wanted to take my best stab at the problem; "
                "here's what I tried and learned.\n\n"
                "The goal: a fast, private editing agent that understands my cadence, respects my numbers, and critiques my structure, "
                "while leaving me firmly in charge of narrative, tone, and judgment. I don't want an AI to write for me; "
                "I want a rubber duck that can keep up with my rambling thoughts and help me get them onto the page before the inspiration fades.\n\n"
                "## Step 1: How far can we push context engineering?\n\n"
                "I started where everyone starts: system prompts and skills containing personal voice context guidelines. "
                "I wrote detailed skills and AGENTS.md rules forbidding em-dashes, stripping hype, adding few-shot examples of my own writing, "
                "enforcing active voice, and demanding first-person voice.\n\n"
                "Agents with this context followed the 'never do this' negative constraints reasonably well: they stopped using announcement clichés "
                "and stripped out obvious marketing filler. But as the rule list grew, the output suffered a different failure mode: "
                "it was just stiff, dry, and repetitive.\n\n"
                "Some models are worse than others. I found Claude Opus 5 to be overly self-referential. GPT 5.6 Sol was good at technical syntax "
                "but felt robotic. Gemini 3.7 Flash was solid in comparison, but still fell back on stock AI turns like 'it's not X, it's Y!'. "
                "None of them felt like me, even for targeted copy-editing suggestions on an existing draft."
            )
        },
        {
            "id": "learnings_critique",
            "section": "Learnings & Recommendations",
            "task": "Critique",
            "prompt": (
                "Critique the Learnings and Recommendations section. Does it provide concrete takeaways? "
                "Are there any redundant points or cliché phrasing? How can it be tightened?\n\n"
                "Draft text:\n"
                "## Learnings & Recommendations\n\n"
                "Fine-tuning open models locally helped me build intuition about where model weights help, where context engineering is enough, "
                "and where you just need a human to do the hard editing work.\n\n"
                "### Fine-Tuning helped for:\n\n"
                "1. **Cadence and phrasing**: The fine-tuned model absorbed natural sentence variety, colon pivots, and concise phrasing directly into its weights. "
                "It didn't need a thirty-line prompt telling it to avoid corporate cheerleading.\n"
                "2. **Number preservation**: In specific edit tasks, the fine-tuned model achieved 100% fact retention across our held-out test cases, never dropping latencies or dollar figures.\n"
                "3. **Better conversational critique**: When reviewing drafts, it offered feedback that felt like a technical peer rather than a pedantic style guide.\n\n"
                "### Fine-Tuning didn't work well for:\n\n"
                "1. **Editorial judgment**: A fine-tuned model cannot tell you if an opening lands on real developer friction or merely states a plausible premise. "
                "It cannot verify whether an engineering metric was measured accurately, or whether credit attributed to a team is genuine.\n"
                "2. **Citation hallucinations**: Style transfers cleanly; facts do not. When asked for supporting evidence, the model still attempted to generate plausible-sounding academic citations that failed offline arithmetic checks.\n"
                "3. **Maintenance overhead**: Curation, loss masking, and LoRA tuning require real effort. If your voice or focus shifts, you have to rebuild the dataset and retrain.\n\n"
                "### What I'd recommend\n\n"
                "If your goal is reliable editing assistance as you write, building a fine-tuned model might not be the most practical path. "
                "A modular pipeline of specific agentic checkers often delivers better results, faster, and with less friction:\n\n"
                "- **A mechanical style linter**: Fast, deterministic regex checks for em-dashes, hype adjectives, and passive stock phrases.\n"
                "- **A structural flow checker**: A prompted model tasked exclusively with identifying weak openings, rambling paragraphs, and missing transitions.\n"
                "- **A factual and citation validator**: An offline validator that verifies links, checks arithmetic formats on arXiv IDs, and flags unsourced metrics."
            )
        },
        {
            "id": "verdict_edit_suggestion",
            "section": "Verdict / Ending Rewrite Suggestion",
            "task": "Edit",
            "prompt": (
                "Rewrite this concluding section to maximize punchiness, directness, and builder voice. "
                "Remove any weak phrases or conversational filler while keeping the authentic conclusion.\n\n"
                "Draft text:\n"
                "## So what's the verdict?\n\n"
                "Is a locally fine-tuned AI ready to replace human editing? Not even close 😆. Human judgment remains the gold standard, and that is not going anywhere anytime soon.\n\n"
                "I learned a massive amount about local model fine-tuning, QLoRA, loss masking, and dataset curation. But the real craft of writing (deciding what matters, verifying the evidence, and earning the reader's attention) stays entirely with the author. As it should.\n\n"
                "If you are experimenting with local fine-tuning or building automated checks for your own writing, I'd love to hear what workflows are working for you. Let me know in the comments!"
            )
        }
    ]
    
    results = []
    for item in tasks:
        print(f"\n{'='*60}\nRunning task: {item['section']}...")
        messages = [
            {"role": "system", "content": runner.SYSTEM_PROMPT},
            {"role": "user", "content": f"[Task: {item['task']}]\n{item['prompt']}"},
        ]
        completion, seconds = backend.generate(messages, max_tokens=600, temperature=0.3)
        cleaned = runner.clean_output(completion)
        print(f"Generated in {seconds:.1f}s:\n{cleaned}\n")
        results.append({
            "id": item["id"],
            "section": item["section"],
            "task": item["task"],
            "prompt": item["prompt"],
            "output": cleaned,
            "seconds": seconds
        })
        
    out_file = ROOT / "experiment/voice-ft/eval/results/article_critique_gemma31b.json"
    out_file.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\nSaved critique results to {out_file}")

if __name__ == "__main__":
    main()
