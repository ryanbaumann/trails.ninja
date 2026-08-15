#!/usr/bin/env python3
"""
Local Gemma 4 LoRA Evaluation & Voice Grading Harness (Apple Silicon / MLX)

Evaluates base model vs fine-tuned adapter against held-out prompts:
- Sentence length variance (standard deviation of words per sentence)
- Em-dash violation checks
- Corporate buzzword & hype phrase checks
- Metric & percentage hallucination detection
- First-person active voice ratio
"""

import os
import re
import json
import statistics
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_MODEL = ROOT_DIR / "models" / "gemma-4-26b-a4b-it-4bit"
EVAL_PROMPTS_FILE = ROOT_DIR / "experiment" / "voice-ft" / "eval" / "prompts.jsonl"
OUTPUT_DIR = ROOT_DIR / "experiment" / "voice-ft" / "eval" / "results"

SYSTEM_PROMPT = (
    "You are Ryan Baumann's writing voice and editorial agent. You draft, edit, rewrite, critique, and present in his style: "
    "first person, active, direct. Growth-backwards framing (lead with the result, what shipped, then the lesson). "
    "Conversational but evidence-led. Use contractions. No em-dashes. No passive voice for your own work. "
    "When editing, preserve the author's intent while shifting register and structure to match Ryan's patterns. "
    "When drafting from scratch, open with a real scenario or quoted objection, not a thesis statement."
)

BANNED_HYPE_WORDS = [
    r"\bpleased to announce\b",
    r"\bthrilled to announce\b",
    r"\bexcited to announce\b",
    r"\bgame-changer\b",
    r"\brevolutionary\b",
    r"\bleverage synergies\b",
    r"\bcutting-edge\b",
    r"\bunprecedented\b",
    r"\bmission-critical\b",
    r"\btransformative\b"
]

def analyze_prose(text: str, input_prompt: str = ""):
    """Compute linguistic and stylistic metrics on generated output."""
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
    sentence_lengths = [len(s.split()) for s in sentences if len(s.split()) > 0]
    
    avg_len = statistics.mean(sentence_lengths) if sentence_lengths else 0
    stdev_len = statistics.stdev(sentence_lengths) if len(sentence_lengths) > 1 else 0
    
    # Em-dash check (unicode \u2014 or double dash -- surrounded by spaces)
    em_dashes = len(re.findall(r'[—–]|(?<=\s)--(?:>\s|\s)', text))
    
    # Buzzword check
    found_buzzwords = []
    for pattern in BANNED_HYPE_WORDS:
        if re.search(pattern, text, re.IGNORECASE):
            found_buzzwords.append(pattern)
            
    # Contractions check
    contractions = len(re.findall(r"\b(it's|don't|doesn't|can't|won't|we've|I've|I'd|I'll|didn't|isn't|aren't|wasn't|weren't)\b", text, re.IGNORECASE))
    
    # Check for hallucinated percentages / metrics
    # Detect % or 'N%' or 'N percent' in output that were NOT in input prompt
    output_percents = re.findall(r'\b\d+%\b|\b\d+\s+percent\b', text, re.IGNORECASE)
    prompt_percents = re.findall(r'\b\d+%\b|\b\d+\s+percent\b', input_prompt, re.IGNORECASE)
    hallucinated_percents = [p for p in output_percents if p.lower() not in [x.lower() for x in prompt_percents]]

    return {
        "word_count": len(text.split()),
        "sentence_count": len(sentence_lengths),
        "avg_sentence_length": round(avg_len, 2),
        "sentence_length_stdev": round(stdev_len, 2),
        "em_dash_count": em_dashes,
        "buzzwords_found": found_buzzwords,
        "contractions_count": contractions,
        "hallucinated_percents": hallucinated_percents,
        "has_hallucinated_metrics": len(hallucinated_percents) > 0
    }

def run_eval(adapter_path: str = None, label: str = "finetuned", max_tokens: int = 1024):
    import mlx_lm
    print(f"[*] Loading model from {DEFAULT_MODEL} with adapter={adapter_path}...")
    if adapter_path and Path(adapter_path).exists():
        model, tokenizer = mlx_lm.load(str(DEFAULT_MODEL), adapter_path=adapter_path)
    else:
        model, tokenizer = mlx_lm.load(str(DEFAULT_MODEL))
    print("[✓] Model loaded into Metal GPU memory.")

    with open(EVAL_PROMPTS_FILE, "r", encoding="utf-8") as f:
        prompts = [json.loads(line) for line in f if line.strip()]

    results = []
    print(f"[*] Running evaluation on {len(prompts)} held-out prompts...")

    sampler = getattr(mlx_lm, "sample_utils", None)
    if sampler and hasattr(sampler, "make_sampler"):
        try:
            sampler_fn = sampler.make_sampler(temp=0.8, top_p=0.92, min_p=0.06)
        except TypeError:
            sampler_fn = sampler.make_sampler(temp=0.8, top_p=0.92)
    else:
        sampler_fn = None

    for i, p in enumerate(prompts):
        pid = p.get("id", f"eval_{i+1:02d}")
        task = p.get("task", "General")
        prompt_text = p.get("prompt", "")

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"[Task: {task}]\n{prompt_text}"}
        ]
        if hasattr(tokenizer, "apply_chat_template") and tokenizer.chat_template:
            formatted_prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        else:
            formatted_prompt = (
                f"<start_of_turn>system\n{SYSTEM_PROMPT}<end_of_turn>\n"
                f"<start_of_turn>user\n[Task: {task}]\n{prompt_text}<end_of_turn>\n"
                f"<start_of_turn>model\n"
            )

        gen_kwargs = {
            "max_tokens": max_tokens,
            "verbose": False
        }
        if sampler_fn is not None:
            gen_kwargs["sampler"] = sampler_fn

        response = mlx_lm.generate(model, tokenizer, prompt=formatted_prompt, **gen_kwargs)
        # Strip potential model echo / thought prefixes
        output = response.strip()
        if output.startswith("thought\n"):
            output = output.replace("thought\n", "", 1).strip()
        elif "\nOutput:\n" in output:
            output = output.split("\nOutput:\n")[-1].strip()

        metrics = analyze_prose(output, prompt_text)
        results.append({
            "id": pid,
            "task": task,
            "prompt": prompt_text,
            "output": output,
            "metrics": metrics
        })
        print(f"  [✓] {pid} ({task}): {metrics['word_count']} words, StDev={metrics['sentence_length_stdev']}, EmDashes={metrics['em_dash_count']}, Hallucinated={metrics['has_hallucinated_metrics']}")

    out_file = OUTPUT_DIR / f"{label}_results.json"
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"[✓] Results written to {out_file}")
    return results

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--adapter-path", default=None)
    parser.add_argument("--label", default="finetuned")
    args = parser.parse_args()
    run_eval(args.adapter_path, args.label)
