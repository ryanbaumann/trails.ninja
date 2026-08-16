#!/usr/bin/env bash
# Round 5 — Gemma 4 31B dense end-to-end runner.
# Usage: bash scripts/run_r5_dense.sh
# Expects: uv on PATH, Apple Silicon M-series, ~48 GB unified memory.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

LOG="$DIR/experiment/voice-ft/eval/results/r5_dense_run.log"
mkdir -p "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1

echo "=== $(date) | run_r5_dense.sh starting ==="

# Pre-flight guard: strictly zero parallel ML training on Apple Silicon
if pgrep -f "mlx_lm.lora|voice_eval.py run" | grep -v "$$" >/dev/null 2>&1; then
  echo "ERROR: Another MLX training or evaluation job is currently active." >&2
  echo "Parallel model training causes Metal memory exhaustion and system instability." >&2
  exit 1
fi

# ── 1. Regenerate training data (Present bug is fixed in the generator) ──────
echo ""
echo "── Step 1: generate dataset ─────────────────────────────────────────────"
uv run --python 3.12 --with mlx-lm --with huggingface-hub \
  python3 scripts/generate-ft-dataset.py

# Remove val files so mlx-lm finds no val_dataset (val_dataset=None).
# mlx-lm trainer.py:285 has `it == 1 or it % steps_per_eval == 0` — the it==1
# branch is unconditional and runs a full eval pass before any training.
# On a 31B model one val batch takes 68 minutes. No valid.jsonl = no eval loop.
# The held-out 48-item suite runs separately via voice_eval.py after training.
rm -f experiment/voice-ft/training/valid.jsonl experiment/voice-ft/training/validation.jsonl
echo "── val files removed: training will skip mid-run eval ───────────────────"

# ── 2. Fine-tune Gemma 4 31B 4bit (downloads model on first run ~17-18 GB) ───
echo ""
echo "── Step 2: mlx_lm.lora — Gemma 4 31B 4bit, 200 iters, cosine decay ─────"
uv run --python 3.12 --with mlx-lm --with huggingface-hub \
  mlx_lm.lora --config experiment/voice-ft/config_r5_dense.yaml

# ── 3. Run the held-out eval suite ───────────────────────────────────────────
echo ""
echo "── Step 3: voice_eval run ───────────────────────────────────────────────"
uv run --python 3.12 --with mlx-lm --with huggingface-hub \
  python3 scripts/voice_eval.py run \
    --adapter ./adapters/gemma-4-31b-ryan-voice-v6 \
    --label round6_dense

# ── 4. Grade results ─────────────────────────────────────────────────────────
echo ""
echo "── Step 4: grade ────────────────────────────────────────────────────────"
RESULTS="experiment/voice-ft/eval/results/round6_dense.json"
npm run eval:grade -- --results "$RESULTS" 2>/dev/null || \
  uv run --python 3.12 --with mlx-lm \
    python3 scripts/voice_eval.py grade --results "$RESULTS"

# ── 5. Compare with MoE baseline if round 6 results exist ────────────────────
R6_MOE="experiment/voice-ft/eval/results/round6_dynamic.json"
if [[ -f "$R6_MOE" ]]; then
  echo ""
  echo "── Step 5: compare round6_dense vs round6_dynamic (MoE) ────────────────"
  uv run --python 3.12 --with mlx-lm \
    python3 scripts/voice_eval.py compare \
      --baseline "$R6_MOE" \
      --candidate "$RESULTS" 2>/dev/null || \
    echo "(compare subcommand completed or check scorecards directly)"
fi

echo ""
echo "=== $(date) | run_r5_dense.sh complete. Results → $RESULTS ==="
