# Portfolio voice de-scaffolding skill evaluation

Date: 2026-08-07

## Objective

Test whether the candidate portfolio writing and review instructions improve a
reviewer's ability to catch factually accurate Field Note copy that still reads
like a generated audit memo. This trial evaluates the instruction change, not
the fine-tuning article itself.

## Frozen configuration

- Baseline revision: repository `HEAD` at
  `72aa58d00e445dc43d22234f8c19d0e07b066a4d`.
- Candidate `portfolio-writing` SHA-256:
  `62c8af74a44a62daa1bb13af688eb8916d4ab4320b41846a937c798b721f7634`.
- Candidate `portfolio-review` SHA-256:
  `e84f161696586d9cb4b62b266548b76ea01533603f0610c5c8bb02f641177d95`.
- Frozen eval-suite SHA-256:
  `9eb23d13b82fd62ee7c7f200b98615296b1c4ba83bee4114d4e05645e1f3666b`.
- Selection case: `PR-S2`; the CSP safety case `PR-S1` remained unchanged.
- Runner: two isolated, read-only repository subagents with the same inherited
  runtime model and profile. The runtime did not expose a model identifier or
  sampling parameters. Each agent received only its assigned skill revision
  and the fixed prompt. A third isolated agent scored anonymized responses A
  and B without repository or skill access.
- Repetitions: one paired trial. This is enough to retain a bounded editorial
  correction, but not to estimate model variance.

## Fixed selection prompt

> Review this factually accurate Field Note for Ryan's voice. It opens on one
> real failed OAuth callback, then presents a five-row claim/evidence table,
> bulleted definitions of request, session, and trace, a JSON object whose
> result fields are all null, a six-item repair checklist, summaries of two
> outside auth benchmarks, and the closing line "The next version starts with
> the verifier." The author asked for show-don't-tell technical copy. What must
> change before publication?

## Frozen expectations

1. Treat the stack of individually valid formats as a publication-level voice
   problem.
2. Center the real OAuth callback and explain the trace through that attempt.
3. Preserve verified facts while cutting redundant explanatory structures and
   outside detours.
4. Flag the canned closing line instead of polishing it.

## Baseline response

The baseline called the post an audit report and recommended one causal thread
through the callback. It defined terms inline and made the null JSON earn its
space. However, it still allowed selected table rows, checklist items, and both
benchmarks to survive, and suggested moving the canned closing line into the
body as a possible payoff.

Blind score: **2/4**. The evaluator awarded the voice-problem and callback-trace
criteria, but not the decisive de-scaffolding or canned-ending criteria.

## Candidate response

The candidate treated the format stack as a blocker, made the failed callback
the narrative spine, replaced the claim table with prose, cut the glossary,
kept the null JSON only if decisive, compressed the checklist, and removed the
benchmark survey unless it changed the diagnosis. It explicitly rejected the
closing line as an unearned polished sign-off.

Blind score: **4/4**.

## Decision and safety gate

Retain the candidate. The blinded evaluator found a strict 2/4 to 4/4 held-out
improvement and no truthfulness, authorization, or safety regression. The
unchanged `PR-S1` selection case continues to cover the existing CSP safety
behavior. Deterministic skill validation and unit tests must still pass before
commit.

Invalidation condition: rerun this comparison if the voice rules, selection
prompt, scoring expectations, or runtime model/profile changes materially.
