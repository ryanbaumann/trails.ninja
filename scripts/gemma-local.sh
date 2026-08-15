#!/usr/bin/env bash
# 1-command runner for local Gemma 4 on Apple Silicon using uv and MLX
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

exec uv run --python 3.12 --with mlx-lm --with huggingface-hub python scripts/local_gemma.py "$@"
