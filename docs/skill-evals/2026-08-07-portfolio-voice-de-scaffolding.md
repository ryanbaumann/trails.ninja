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
- Evaluated candidate `portfolio-writing` SHA-256:
  `62c8af74a44a62daa1bb13af688eb8916d4ab4320b41846a937c798b721f7634`.
- Post-trial citation-corrected `portfolio-writing` SHA-256:
  `56bed57023fc8a0c18c362b447c16de70b8ea98b86808cb0d48ee0e9add2ce9e`.
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
- Repetitions: one paired trial. This is not enough to estimate variance or
  validate the candidate as a behavioral improvement.

After the paired trial, one stale writing-skill example was updated from the
previous Agent Session closing to the current sentence that makes the same
present-to-earlier-era move. No rule changed. This was treated as an editorial
reference correction under the manual exception, so it did not receive a
separate behavioral trial; the hash above records the corrected file.

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

## Decision and safety status

Treat the candidate direction as provisional. One blinded evaluator preferred
it 4/4 to 2/4, but the selection prompt repeated the development case's format
stack, the full responses were not retained, and no repeated-run variance was
recorded. `PR-S1` remained unchanged but was not rerun, so this record does not
support a no-safety-regression claim. Deterministic skill validation and unit
tests still apply, but they do not close those behavioral gaps.

Invalidation condition: rerun this comparison if the voice rules, selection
prompt, scoring expectations, or runtime model/profile changes materially.

Before treating the skill revision as validated, replace or supplement `PR-S2`
with a materially different selection case, run repeated baseline and candidate
attempts under the same configuration, retain the full anonymous responses and
grader judgments, and replay `PR-S1` as the safety gate.

## Retained response excerpts

### Baseline

> Not ready for publication. The piece has real evidence, but its structure
> still reads like an audit report rather than Ryan thinking through one
> failure.
>
> Keep the failed callback, but pivot immediately from the scene to the thesis
> and consequence. Build one causal thread from callback through trace,
> diagnosis, repair, and verifier result. Define the terms where they first
> matter. Make the null JSON earn its space or cut it. Keep only table rows and
> checklist items that advance the diagnosis, and treat the outside benchmarks
> as context rather than proof.
>
> Move “The next version starts with the verifier” into the body if it carries
> the thesis, then replace the ending with an invitation to compare verification
> approaches.

### Candidate

> Blocker: the structure turns a strong lived failure into an audit memo.
>
> Make the failed OAuth callback the narrative spine. Show the request, where
> the session or trace broke, what evidence changed the diagnosis, what Ryan
> repaired, and what the next real attempt proved.
>
> Replace the claim table with narrative tied to that attempt. Define the terms
> inline and cut the glossary. Keep the null JSON only if it is the decisive
> artifact. Compress the checklist into the actions the story supports. Cut the
> benchmark survey unless one benchmark materially changed the diagnosis.
>
> Replace “The next version starts with the verifier.” It is a polished dramatic
> sign-off, not an earned conclusion. End with the bounded lesson and what
> remains uncertain.
>
> The piece should leave readers remembering one failed callback and the
> evidence that repaired it, not six documentation formats.

## Blind grader response

> Response A: 2/4. It identified the stacked formats as a publication-level
> voice issue and used the failed callback as the causal thread. It still let
> the table, checklist, and benchmark detour survive, and it repositioned the
> canned line instead of rejecting it.
>
> Response B: 4/4. It framed the format stack as a blocker, made the callback
> the narrative spine, cut the redundant structures and outside material, and
> rejected the polished sign-off.
>
> Verdict: B is a strict improvement. No truthfulness, authorization, or safety
> regression was identified in the two review responses.

The final sentence grades only the two editorial responses. It is not a replay
of the separate `PR-S1` safety case.
