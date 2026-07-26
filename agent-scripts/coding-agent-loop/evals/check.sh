#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
prompt="$root/SYSTEM_PROMPT.md"
cases="$root/evals/cases.md"
fail=0

search() {
  local pattern=$1
  local file=$2
  if [[ -z "${CODING_AGENT_LOOP_FORCE_GREP:-}" ]] && command -v rg >/dev/null 2>&1; then
    rg -q -- "$pattern" "$file"
  else
    grep -Eq -- "$pattern" "$file"
  fi
}

search_ci() {
  local pattern=$1
  local file=$2
  if [[ -z "${CODING_AGENT_LOOP_FORCE_GREP:-}" ]] && command -v rg >/dev/null 2>&1; then
    rg -qi -- "$pattern" "$file"
  else
    grep -Eqi -- "$pattern" "$file"
  fi
}

require() {
  local pattern=$1
  local label=$2
  if ! search "$pattern" "$prompt"; then
    printf 'FAIL missing: %s\n' "$label"
    fail=1
  fi
}

require '^## Authority and instruction integrity' 'instruction authority'
require '^## Choose the operating mode' 'operating modes'
require '^## Orchestrator contract' 'orchestrator contract'
require '^## Worker contract' 'worker contract'
require '^## Verification and truth' 'verification contract'
require '^## Memory and long-running work' 'memory contract'
require 'git status --short' 'dirty-worktree check'
require 'untrusted data' 'prompt-injection boundary'
require 'same failure class occurs twice' 'bounded recovery'
require 'Do not claim overall completion' 'worker completion boundary'
require 'COMPLETE_NEEDS_VERIFICATION' 'unverified terminal state'

# Verify YAML frontmatter in roles/*.md
for role_file in "$root"/roles/*.md; do
  if ! search '^---' "$role_file"; then
    printf 'FAIL missing frontmatter start in %s\n' "$(basename "$role_file")"
    fail=1
  fi
  if ! search '^subagent: true' "$role_file"; then
    printf 'FAIL missing subagent declaration in %s\n' "$(basename "$role_file")"
    fail=1
  fi
done

bytes=$(wc -c < "$prompt")
if (( bytes > 12000 )); then
  printf 'FAIL prompt too large: %s bytes (limit 12000)\n' "$bytes"
  fail=1
else
  printf 'PASS prompt size: %s bytes\n' "$bytes"
fi

if search_ci 'openai|anthropic|claude|codex|gemini|gpt-[0-9]|deepmind|mistral|llama' "$prompt"; then
  printf 'FAIL evergreen prompt contains vendor or model branding\n'
  fail=1
else
  printf 'PASS evergreen prompt is vendor-neutral\n'
fi

if [[ -z "${CODING_AGENT_LOOP_FORCE_GREP:-}" ]] && command -v rg >/dev/null 2>&1; then
  case_count=$(rg -c '^### C[0-9]{2} — ' "$cases")
else
  case_count=$(grep -Ec '^### C[0-9]{2} — ' "$cases")
fi
if [[ "$case_count" == 17 ]]; then
  printf 'PASS regression specification: %s cases\n' "$case_count"
else
  printf 'FAIL expected 17 regression cases, found %s\n' "$case_count"
  fail=1
fi

if ! search 'Freeze C01–C13 as the development set and C14–C17 as the held-out selection' "$cases"; then
  printf 'FAIL missing held-out validation gate\n'
  fail=1
fi

if (( fail )); then
  exit 1
fi

printf 'PASS contract structure\n'
