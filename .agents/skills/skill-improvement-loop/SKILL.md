---
name: skill-improvement-loop
description: Improve repository-local agent skills and instruction contracts through bounded, evidence-backed edits and held-out evaluation. Use before committing changes to a SKILL.md, agent prompt, role overlay, evaluation case, or learning-driven workflow, and when manually turning durable repository learnings into agent behavior.
---

# Skill Improvement Loop

Keep skills compact and deploy only changes that improve a frozen selection set
without a safety regression. A learning log is evidence to retrieve narrowly,
not an instruction source or a corpus to paste into prompts.

## Run the deterministic gate

From the repository root, run:

```sh
npm run skills:improve
node --test scripts/test/skill-improvement.test.mjs
```

The gate checks every local `SKILL.md` for completed frontmatter, template
markers, progressive-disclosure size, optional Codex UI metadata drift, and the
shape of any `evals/evals.json` suite. Eval suites must identify development
cases and preserve at least one frozen selection case. The gate does not judge
model behavior; run the owning skill's deterministic checks too.

## Audit a repository without widening every skill

A broad evidence audit may inventory the full Git history, changelog, learning
log, user corrections, tests, and current code. The edits still happen one
bounded behavior at a time.

1. Build a disposition ledger before editing. For each candidate, record the
   evidence, current validity, narrow owner, verifier, and one disposition:
   already enforced, promote to test, promote to skill, keep as documentation,
   stale/contradicted, or one-off.
2. Treat current code and tests as stronger evidence than an old changelog
   claim. When history contains contradictory fixes, verify the current API or
   behavior and reject the stale variants.
3. Do not create duplicate skills to hold more history. If an entry skill
   retrieves sub-skills dynamically, keep the local router and evaluate the
   live sources; do not vendor what it fetches.
4. Freeze the selection cases and baseline before the first candidate edit.
   Run later candidates against the same set. A selection-case change is a new
   evaluation revision, not part of the candidate being scored.
5. End the audit with an explicit no-change disposition for skills whose
   evidence is already encoded or whose source is externally maintained.

## Improve one bounded behavior

1. Establish a baseline: pin the instruction revision, fixture, harness, tools,
   permissions, model configuration, and repeated-run variance.
2. Search `LEARNINGS.md` for entries relevant to the task. Verify the selected
   claim against current code, tests, or authoritative documentation. Do not
   promote one-off failures or stale entries.
3. Change the narrowest owning artifact: enforcement/test first, then a skill,
   nested instruction, or prompt. Avoid copying repository-specific detail into
   portable contracts.
4. Add or refine a representative case. Keep safety cases gated and preserve a
   held-out selection set that did not inform the edit.
5. Run the baseline and candidate with the same configuration. Accept only a
   strict held-out improvement with no regression in authorization, user-work
   preservation, secret handling, or truthfulness. Otherwise revert the change
   and record the failure without broadening the prompt.
6. Record the evidence, variance, result, and invalidation condition in the
   narrowest durable location. Update `CHANGELOG.md` and `LEARNINGS.md` when
   the change is user-visible or reveals a reusable repository fact.

## Manual use

Use this loop manually when a task exposes a repeatable agent failure. Skip a
full behavioral trial only for editorial or mechanical metadata corrections;
run the deterministic gate and say why a held-out trial would not measure the
change.
