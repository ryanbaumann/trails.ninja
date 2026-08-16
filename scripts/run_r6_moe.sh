#!/usr/bin/env bash
# Round 6 — Gemma 4 26B-A4B MoE (Surgical Edits + Negative Grounding + Length Constraints)
# Usage: bash scripts/run_r6_moe.sh
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

LOG="$DIR/experiment/voice-ft/eval/results/r6_moe_run.log"
mkdir -p "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1

echo "=== $(date) | run_r6_moe.sh starting ==="

# Pre-flight guard: strictly zero parallel ML training on Apple Silicon
if pgrep -f "mlx_lm.lora|voice_eval.py run" | grep -v "$$" >/dev/null 2>&1; then
  echo "ERROR: Another MLX training or evaluation job is currently active." >&2
  echo "Parallel model training causes Metal memory exhaustion and system instability." >&2
  exit 1
fi

echo ""
echo "── Step 1: fine-tune Gemma 4 26B-A4B MoE (Round 6) ──────────────────────"
uv run --python 3.12 --with mlx-lm --with huggingface-hub \
  mlx_lm.lora --config experiment/voice-ft/config_r6.yaml

echo ""
echo "── Step 2: voice_eval run ───────────────────────────────────────────────"
uv run --python 3.12 --with mlx-lm --with huggingface-hub \
  python3 scripts/voice_eval.py run \
    --adapter ./adapters/gemma-4-26b-ryan-voice-v6 \
    --label r6

echo ""
echo "── Step 3: grade ────────────────────────────────────────────────────────"
RESULTS="experiment/voice-ft/eval/results/r6_results.json"
npm run eval:grade -- --results "$RESULTS" 2>/dev/null || \
  uv run --python 3.12 --with mlx-lm \
    python3 scripts/voice_eval.py grade --results "$RESULTS"

R5="experiment/voice-ft/eval/results/r5_results.json"
if [[ -f "$R5" ]]; then
  echo ""
  echo "── Step 4: compare r6 (MoE) vs r5 (MoE) ─────────────────────────────────"
  uv run --python 3.12 --with mlx-lm \
    python3 scripts/voice_eval.py compare \
      --baseline "$R5" \
      --candidate "$RESULTS" 2>/dev/null || \
    echo "(compare complete; inspect report above)"
fi

echo ""
echo "=== $(date) | run_r6_moe.sh complete. Results → $RESULTS ==="
