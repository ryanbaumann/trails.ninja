#!/usr/bin/env python3
"""
Local Gemma 4 Runner (Apple Silicon / MLX)

1-command local runner for Gemma 4 26B-A4B (4-bit MLX):
- Auto-downloads model weights into gitignored models/ directory if missing
- Generates locally with Metal GPU acceleration on Apple Silicon (M-series)
- Supports review, critique, rewrite, draft, and interactive subagent tasks
"""

import sys
import os
import argparse
from pathlib import Path

DEFAULT_MODEL_REPO = "mlx-community/gemma-4-26b-a4b-it-4bit"
ROOT_DIR = Path(__file__).resolve().parent.parent
LOCAL_MODEL_DIR = ROOT_DIR / "models" / "gemma-4-26b-a4b-it-4bit"

SYSTEM_PROMPT = (
    "You are Ryan Baumann's writing voice and editorial agent. You draft, edit, rewrite, critique, and present in his style: "
    "first person, active, direct. Growth-backwards framing (lead with the result, what shipped, then the lesson). "
    "Conversational but evidence-led. Use contractions. No em-dashes. No passive voice for your own work. "
    "When editing, preserve the author's intent while shifting register and structure to match Ryan's patterns. "
    "When drafting from scratch, open with a real scenario or quoted objection, not a thesis statement."
)

def ensure_model_downloaded(repo_id: str = DEFAULT_MODEL_REPO, local_dir: Path = LOCAL_MODEL_DIR):
    """Download the model weights locally if they do not already exist."""
    if local_dir.exists() and (local_dir / "config.json").exists():
        return str(local_dir)

    print(f"[*] Local model not found at {local_dir}")
    print(f"[*] Downloading '{repo_id}' to {local_dir} (Gitignored)...")
    local_dir.mkdir(parents=True, exist_ok=True)

    from huggingface_hub import snapshot_download
    snapshot_download(
        repo_id=repo_id,
        local_dir=str(local_dir),
        local_dir_use_symlinks=False,
        resume_download=True
    )
    print(f"[✓] Download complete: {local_dir}")
    return str(local_dir)

DEFAULT_ADAPTER_DIR = ROOT_DIR / "adapters" / "gemma-4-26b-ryan-voice"


def load_model(model_path: str, adapter_path: str = None):
    """Load MLX model and tokenizer with optional LoRA adapter."""
    import mlx_lm
    resolved_adapter = adapter_path
    if resolved_adapter is None and DEFAULT_ADAPTER_DIR.exists() and (DEFAULT_ADAPTER_DIR / "adapters.safetensors").exists():
        resolved_adapter = str(DEFAULT_ADAPTER_DIR)

    if resolved_adapter and Path(resolved_adapter).exists():
        print(f"[*] Loading model from {model_path} with adapter {resolved_adapter} into Apple Silicon Metal memory...")
        model, tokenizer = mlx_lm.load(model_path, adapter_path=str(resolved_adapter))
    else:
        print(f"[*] Loading base model from {model_path} into Apple Silicon Metal memory...")
        model, tokenizer = mlx_lm.load(model_path)
    print("[✓] Model loaded successfully.")
    return model, tokenizer

def generate_text(model, tokenizer, prompt: str, max_tokens: int = 4096, temp: float = 0.7) -> str:
    """Generate response using MLX."""
    import mlx_lm
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt}
    ]
    if hasattr(tokenizer, "apply_chat_template") and tokenizer.chat_template:
        formatted_prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    else:
        formatted_prompt = f"<start_of_turn>system\n{SYSTEM_PROMPT}<end_of_turn>\n<start_of_turn>user\n{prompt}<end_of_turn>\n<start_of_turn>model\n"

    sampler = getattr(mlx_lm, "sample_utils", None)
    if sampler and hasattr(sampler, "make_sampler"):
        sampler_fn = sampler.make_sampler(temp)
    else:
        sampler_fn = None

    generate_kwargs = {
        "max_tokens": max_tokens,
        "verbose": False
    }
    if sampler_fn is not None:
        generate_kwargs["sampler"] = sampler_fn

    response = mlx_lm.generate(
        model,
        tokenizer,
        prompt=formatted_prompt,
        **generate_kwargs
    )
    return response.strip()

def review_copy(model, tokenizer, target_path_or_text: str, max_tokens: int = 4096) -> str:
    """Perform editorial critique on copy."""
    text = target_path_or_text
    p = Path(target_path_or_text)
    if p.exists() and p.is_file():
        text = p.read_text(encoding="utf-8")

    prompt = (
        "Perform a thorough editorial review and critique of this copy against Ryan Baumann's voice standards.\n\n"
        "Assess:\n"
        "1. Voice & Cadence: Active first-person, direct, growth-backwards framing (Result -> Shipped -> Lesson).\n"
        "2. Cliché & AI-Tell Check: Scan for em-dashes, passive voice for own work, corporate buzzwords, and vague claims.\n"
        "3. Opening Hook: Does it land on real developer friction or a quoted objection?\n"
        "4. Concrete Line-by-Line Rewrites: Provide specific, tightened rewrites for the weakest sections.\n\n"
        f"--- COPY TO REVIEW ---\n{text}"
    )
    return generate_text(model, tokenizer, prompt, max_tokens=max_tokens)

def edit_copy(model, tokenizer, target_path_or_text: str, max_tokens: int = 4096) -> str:
    """Rewrite text into Ryan's voice."""
    text = target_path_or_text
    p = Path(target_path_or_text)
    if p.exists() and p.is_file():
        text = p.read_text(encoding="utf-8")
    prompt = f"Rewrite the following text in Ryan's voice, stripping corporate boilerplate, passive voice, and buzzwords:\n\n{text}"
    return generate_text(model, tokenizer, prompt, max_tokens=max_tokens)

def main():
    parser = argparse.ArgumentParser(description="Local Gemma 4 Runner (Apple Silicon / MLX)")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # Download only
    subparsers.add_parser("download", help="Download model weights to models/ without running")

    # Review command
    rev_parser = subparsers.add_parser("review", help="Review copy against voice standards")
    rev_parser.add_argument("target", help="File path or string to review")
    rev_parser.add_argument("--max-tokens", type=int, default=4096, help="Max response tokens")
    rev_parser.add_argument("--repo", default=DEFAULT_MODEL_REPO, help="Hugging Face repo ID")
    rev_parser.add_argument("--adapter-path", default=None, help="Path to fine-tuned LoRA adapter")

    # Edit command
    edit_parser = subparsers.add_parser("edit", help="Rewrite text in Ryan's voice")
    edit_parser.add_argument("target", help="File path or string to rewrite")
    edit_parser.add_argument("--max-tokens", type=int, default=4096, help="Max response tokens")
    edit_parser.add_argument("--repo", default=DEFAULT_MODEL_REPO, help="Hugging Face repo ID")
    edit_parser.add_argument("--adapter-path", default=None, help="Path to fine-tuned LoRA adapter")

    # Generate / ask command
    gen_parser = subparsers.add_parser("generate", help="Generate response to an arbitrary prompt")
    gen_parser.add_argument("prompt", help="Prompt text")
    gen_parser.add_argument("--max-tokens", type=int, default=4096, help="Max response tokens")
    gen_parser.add_argument("--repo", default=DEFAULT_MODEL_REPO, help="Hugging Face repo ID")
    gen_parser.add_argument("--adapter-path", default=None, help="Path to fine-tuned LoRA adapter")

    args = parser.parse_args()

    if args.command == "download":
        ensure_model_downloaded()
        return

    model_dir = ensure_model_downloaded(repo_id=getattr(args, "repo", DEFAULT_MODEL_REPO))
    adapter_path = getattr(args, "adapter_path", None)
    model, tokenizer = load_model(model_dir, adapter_path=adapter_path)

    if args.command == "review":
        res = review_copy(model, tokenizer, args.target)
        print("\n" + "=" * 50)
        print("GEMMA 4 LOCAL EDITORIAL REVIEW")
        print("=" * 50)
        print(res)
    elif args.command == "edit":
        res = edit_copy(model, tokenizer, args.target)
        print("\n" + "=" * 50)
        print("GEMMA 4 LOCAL REWRITE")
        print("=" * 50)
        print(res)
    elif args.command == "generate":
        res = generate_text(model, tokenizer, args.prompt, max_tokens=args.max_tokens)
        print(res)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
