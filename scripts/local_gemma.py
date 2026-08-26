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

DEFAULT_MODEL_REPO_26B = "mlx-community/gemma-4-26b-a4b-it-4bit"
DEFAULT_MODEL_REPO_31B = "mlx-community/gemma-4-31b-it-4bit"
DEFAULT_MODEL_REPO = DEFAULT_MODEL_REPO_26B
ROOT_DIR = Path(__file__).resolve().parent.parent
LOCAL_MODEL_DIR_26B = ROOT_DIR / "models" / "gemma-4-26b-a4b-it-4bit"
LOCAL_MODEL_DIR_31B = ROOT_DIR / "models" / "gemma-4-31b-it-4bit"

SYSTEM_PROMPT = (
    "You are Ryan Baumann's writing voice and editorial agent. You draft, edit, rewrite, critique, and present in his style: "
    "first person, active, direct. Growth-backwards framing (lead with the result, what shipped, then the lesson). "
    "Conversational but evidence-led. Use contractions. No em-dashes. No passive voice for your own work. "
    "When editing, preserve the author's intent while shifting register and structure to match Ryan's patterns. "
    "When drafting from scratch, open with a real scenario or quoted objection, not a thesis statement."
)

def ensure_model_downloaded(repo_id: str = DEFAULT_MODEL_REPO, local_dir: Path = None):
    """Download the model weights locally if they do not already exist."""
    if local_dir is None:
        if "31b" in str(repo_id):
            local_dir = LOCAL_MODEL_DIR_31B
        else:
            local_dir = LOCAL_MODEL_DIR_26B

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

def resolve_latest_adapter(model_name: str = "26b") -> Path | None:
    """Find the highest version adapter available locally for the given model architecture."""
    prefix = "gemma-4-31b-ryan-voice" if "31b" in str(model_name) else "gemma-4-26b-ryan-voice"
    for ver in ["v8", "v7", "v6", "v5", "v4", "v3", "v2", ""]:
        suffix = f"-{ver}" if ver else ""
        candidate = ROOT_DIR / "adapters" / f"{prefix}{suffix}"
        if candidate.exists() and (candidate / "adapters.safetensors").exists():
            return candidate
    return None

def resolve_model_dir_and_adapter(model_arg: str = None, repo_arg: str = None, adapter_arg: str = None, default_arch: str = "26b"):
    """
    Intelligently resolve base model directory and matching LoRA adapter.
    Handles '31b', '26b', 'dense', 'moe', custom paths, and auto-pairing.
    """
    arch = default_arch
    if model_arg:
        if "31b" in str(model_arg).lower() or "dense" in str(model_arg).lower():
            arch = "31b"
        elif "26b" in str(model_arg).lower() or "moe" in str(model_arg).lower():
            arch = "26b"
    elif repo_arg and "31b" in str(repo_arg).lower():
        arch = "31b"
    elif adapter_arg and "31b" in str(adapter_arg).lower():
        arch = "31b"

    if arch == "31b":
        repo_id = repo_arg if (repo_arg and repo_arg != DEFAULT_MODEL_REPO_26B) else DEFAULT_MODEL_REPO_31B
        target_dir = LOCAL_MODEL_DIR_31B
        # If 31b not present locally and not explicitly requested, fallback to 26b
        if not (target_dir.exists() and (target_dir / "config.json").exists()) and not model_arg and not adapter_arg:
            arch = "26b"
            repo_id = DEFAULT_MODEL_REPO_26B
            target_dir = LOCAL_MODEL_DIR_26B
    else:
        repo_id = repo_arg or DEFAULT_MODEL_REPO_26B
        target_dir = LOCAL_MODEL_DIR_26B

    if model_arg and Path(model_arg).exists():
        model_dir = str(Path(model_arg))
    else:
        model_dir = ensure_model_downloaded(repo_id=repo_id, local_dir=target_dir)

    if adapter_arg:
        resolved_adapter = adapter_arg
    else:
        resolved = resolve_latest_adapter(model_name=arch)
        resolved_adapter = str(resolved) if resolved else None

    return model_dir, resolved_adapter


def load_model(model_path: str, adapter_path: str = None):
    """Load MLX model and tokenizer with optional LoRA adapter."""
    import mlx_lm
    resolved_adapter = adapter_path
    if resolved_adapter is None:
        latest = resolve_latest_adapter(model_name=str(model_path))
        if latest:
            resolved_adapter = str(latest)

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

def resolve_target_text(target_path_or_text: str) -> str:
    """Safely resolve target either from stdin ('-'), file path, or direct text string."""
    if target_path_or_text == "-" or not target_path_or_text:
        return sys.stdin.read()
    if "\n" in target_path_or_text or len(target_path_or_text) > 400:
        return target_path_or_text
    try:
        p = Path(target_path_or_text)
        if p.is_file():
            return p.read_text(encoding="utf-8")
    except (OSError, ValueError):
        pass
    return target_path_or_text

def review_copy(model, tokenizer, target_path_or_text: str, max_tokens: int = 4096) -> str:
    """Perform editorial critique on copy."""
    text = resolve_target_text(target_path_or_text)

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
    """Rewrite text into Ryan's voice with strict factual preservation."""
    text = resolve_target_text(target_path_or_text)
    prompt = (
        "Rewrite the following text in Ryan's voice. Strip corporate boilerplate, passive voice, and hype. "
        "Preserve all specific metrics, numbers, and technical entity names intact:\n\n"
        f"{text}"
    )
    return generate_text(model, tokenizer, prompt, max_tokens=max_tokens)

def generate_headlines(model, tokenizer, topic_or_summary: str, max_tokens: int = 1024) -> str:
    """Generate misconception-led, thesis-driven headlines."""
    prompt = (
        f"Generate 6-8 thesis-driven, misconception-led headline variations for a Field Note about: {topic_or_summary}. "
        "Keep each under 12 words, avoid clickbait tropes, and lead at least two with misconceptions."
    )
    return generate_text(model, tokenizer, prompt, max_tokens=max_tokens)

def generate_social(model, tokenizer, target_path_or_text: str, max_tokens: int = 1024) -> str:
    """Generate concise, developer-focused social copy (< 120 words)."""
    text = resolve_target_text(target_path_or_text)
    prompt = (
        f"Write a concise developer social post (< 120 words) summarizing this work. "
        f"Lead with the binding constraint or metric shipped, avoid hashtags and launch hype:\n\n{text}"
    )
    return generate_text(model, tokenizer, prompt, max_tokens=max_tokens)

def add_common_args(p):
    p.add_argument("--max-tokens", type=int, default=None, help="Max response tokens")
    p.add_argument("--model", default=None, help="Model architecture ('31b', '26b', 'dense', 'moe') or path")
    p.add_argument("--repo", default=None, help="Hugging Face repo ID")
    p.add_argument("--adapter-path", default=None, help="Path to fine-tuned LoRA adapter")

def main():
    parser = argparse.ArgumentParser(description="Local Gemma 4 Runner (Apple Silicon / MLX)")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # Download only
    dl_parser = subparsers.add_parser("download", help="Download model weights to models/ without running")
    add_common_args(dl_parser)

    # Review command
    rev_parser = subparsers.add_parser("review", help="Review copy against voice standards")
    rev_parser.add_argument("target", help="File path or string to review")
    add_common_args(rev_parser)

    # Edit command
    edit_parser = subparsers.add_parser("edit", help="Rewrite text in Ryan's voice")
    edit_parser.add_argument("target", help="File path or string to rewrite")
    add_common_args(edit_parser)

    # Headline command
    head_parser = subparsers.add_parser("headline", help="Generate thesis-driven headline variations")
    head_parser.add_argument("topic", help="Topic or summary of the post")
    add_common_args(head_parser)

    # Social command
    soc_parser = subparsers.add_parser("social", help="Generate developer social post (< 120 words)")
    soc_parser.add_argument("target", help="File path or text summary")
    add_common_args(soc_parser)

    # Generate / ask command
    gen_parser = subparsers.add_parser("generate", help="Generate response to an arbitrary prompt")
    gen_parser.add_argument("prompt", help="Prompt text")
    add_common_args(gen_parser)

    args = parser.parse_args()

    if args.command == "download":
        default_arch = "31b" if args.model and "31b" in args.model else "26b"
        model_dir, _ = resolve_model_dir_and_adapter(args.model, args.repo, args.adapter_path, default_arch=default_arch)
        print(f"[✓] Model ready at {model_dir}")
        return

    # Review defaults to 31b Dense when available; interactive tasks default to 26b MoE
    default_arch = "31b" if args.command == "review" else "26b"
    model_dir, adapter_path = resolve_model_dir_and_adapter(
        args.model, args.repo, args.adapter_path, default_arch=default_arch
    )
    model, tokenizer = load_model(model_dir, adapter_path=adapter_path)

    if args.command == "review":
        max_tokens = args.max_tokens or 4096
        res = review_copy(model, tokenizer, args.target, max_tokens=max_tokens)
        print("\n" + "=" * 50)
        print("GEMMA 4 LOCAL EDITORIAL REVIEW")
        print("=" * 50)
        print(res)
    elif args.command == "edit":
        max_tokens = args.max_tokens or 4096
        res = edit_copy(model, tokenizer, args.target, max_tokens=max_tokens)
        print("\n" + "=" * 50)
        print("GEMMA 4 LOCAL REWRITE")
        print("=" * 50)
        print(res)
    elif args.command == "headline":
        max_tokens = args.max_tokens or 1024
        res = generate_headlines(model, tokenizer, args.topic, max_tokens=max_tokens)
        print("\n" + "=" * 50)
        print("GEMMA 4 HEADLINE VARIATIONS")
        print("=" * 50)
        print(res)
    elif args.command == "social":
        max_tokens = args.max_tokens or 1024
        res = generate_social(model, tokenizer, args.target, max_tokens=max_tokens)
        print("\n" + "=" * 50)
        print("GEMMA 4 SOCIAL DRAFT")
        print("=" * 50)
        print(res)
    elif args.command == "generate":
        max_tokens = args.max_tokens or 4096
        res = generate_text(model, tokenizer, args.prompt, max_tokens=max_tokens)
        print(res)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
