# Evaluation datasets

This directory holds two datasets:

1. **`missions.json`** — reranking ground truth for the deterministic reranker (`src/mission/rank.ts`), scored by `src/mission/evalScore.ts`. Documented below.
2. **`traces.json`** — agent-trace dataset for the independent, five-dimension journey evaluator (`src/ai/traceEval.ts`). See [Agent trace evaluation](#agent-trace-evaluation).

## Agent trace evaluation

`traces.json` scores whole journey turns on five deterministic, countable dimensions — **mission completion, tool order, grounding, surface ownership, and UI/final-response consistency** — so a prompt or tool change is judged by its per-dimension delta, not by eyeballing a few runs (see the Agent Quality Flywheel in `~/.claude/CLAUDE.md`).

- The grader (`src/ai/traceEval.ts`) is kept **separate from the optimizer** (the prompts/tool code it scores) — a self-grader learns to game the metric.
- The dataset mixes `golden.*` traces (pass all five) with `fail.*` traces that each violate exactly one dimension, so the evaluator's per-dimension sensitivity is itself tested (`src/ai/traceEval.test.ts`).
- Traces are generic and synthetic. Do not add Google Maps Content captured from live runs to model optimization, testing, or validation datasets. Live canaries are limited to integration health and attribution checks.

Commands:

```
npm run eval:trace     # assert the evaluator + dataset (deterministic, offline)
npm run eval:report    # print per-dimension counts + delta vs .eval/baseline.json
node_modules/.bin/vite-node scripts/eval-remote.ts --save-baseline   # set/refresh the baseline
```

`scripts/eval-remote.ts` gates the **paid remote AutoRater** behind an explicit human approval env var — `EVAL_REMOTE_APPROVED=1` — so a routine eval can never silently spend. Without approval it runs only the free local eval and reports deltas; it never fabricates remote scores. Baseline/last-run artifacts land in `.eval/` (git-ignored).

---

# Mission Candidate Reranking Evaluation

This section covers the baseline evaluation dataset and scoring harness for the **deterministic local reranking logic** (`src/mission/rank.ts`).

## What it measures

**Top-1 accuracy**: given a set of mission candidates with pre-scored factors (visibility, condition, activity, access, environment) and a set of user priorities (weights for each factor), does the reranker correctly predict which candidate should rank #1?

The reranker is deterministic — it computes a weighted score for each candidate using:

```
score = round((Σ factor[i] × priority[i]) / Σ priority[i] × 10) / 10
```

and ranks candidates by descending score (ties broken by input order).

## Dataset: `missions.json`

- **50 cases** covering diverse scenarios across six cities (SF, NYC, London, Tokyo, Paris, Sydney)
- Each case includes:
  - A natural-language `goal`
  - A `cityId`
  - User `priorities` (weights for the five factors)
  - 3–5 `candidates` with pre-scored `factors`
  - An `expectedWinnerId` — the candidate that should rank #1 given the priorities
- Cases are **internally consistent**: the `expectedWinnerId` is computed using the same weighted-score formula the reranker uses, so the baseline top-1 accuracy should be **100%**
- Coverage:
  - Varied dominant factors (visibility-first, condition-first, access-first, environment-first, activity-first)
  - Near-ties and clear winners
  - Equal-priority cases (average score wins)
  - Extreme single-factor dominance
  - 3, 4, and 5-candidate sets

## Scoring harness: `src/mission/evalScore.ts`

- `predictWinner(case)` — runs the real production reranker and returns the ID of the #1-ranked candidate
- `scoreCase(case)` — compares predicted winner to expected winner
- `evaluate(cases)` — computes top-1 accuracy and lists failures

## Running the evaluation

```bash
npx vitest run src/mission/evalScore.test.ts
```

The test asserts:

1. Dataset has 30–50 cases
2. Every case has 3–5 candidates, no duplicate IDs, and a valid `expectedWinnerId`
3. **Top-1 accuracy is 100%** (the dataset is self-consistent ground truth)

If the baseline test fails, the dataset's `expectedWinnerId` values are inconsistent with the reranker's logic and should be fixed.

## Baseline snapshot

**Current baseline (pre-optimization)**:

- Total cases: **50**
- Correct: **50**
- Top-1 accuracy: **1.0 (100%)**

This is the reference point for any future changes to the reranking logic.

## How to read the baseline

- **100% accuracy** means the dataset is a valid, self-consistent ground truth for the current deterministic reranker
- This is **not** an evaluation of the *quality* of the reranker's decisions (e.g., "does it match human judgment?") — it's a test that the implementation matches its own spec
- Future work could:
  - Add synthetic or independently licensed human-judgment cases and compare predicted rankings to those decisions
  - Run an **LLM-as-a-judge eval** to score ranking quality (e.g., "does this ranking make sense given the goal?")
  - Measure **ranking stability** when priorities are slightly perturbed

## Extending the decision-quality dataset

To move beyond the deterministic baseline without using Google Maps Content as evaluation data:

1. Create synthetic or independently licensed cases that include:
   - User goal
   - City
   - User priorities (slider state)
   - Candidates with scored factors
   - **User decision** (which candidate was approved)
2. Import cases into a clearly sourced decision-quality dataset
3. Compute **top-1 agreement**: does the reranker's #1 pick match the independent human decision?
4. Add a separate test suite for decision-quality evaluation
5. Use disagreements to debug the factor scoring logic (not just the reranker math)

For **model-driven or prompt-driven components** (e.g., if factor scoring becomes LLM-based), apply the **Agent Quality Flywheel** (see global agent config `~/.claude/CLAUDE.md`) to eval-driven iteration.

## Reference

This eval baselines the **local reranking** logic only — it does NOT evaluate:

- The **factor scoring** logic (visibility/condition/activity/access/environment are assumed pre-computed and correct)
- The **candidate generation** (Places search, map area selection)
- The **end-to-end mission flow** (user interaction, decision approval, artifact creation)

Those are orthogonal surfaces for future eval expansion.
