# Repository Learnings

This log captures durable lessons discovered while building and maintaining the portfolio and demo lab, keeping the root instructions lean.

## 2026-08-14 - Local Gemma 4 MLX reviews catch abstract rhetorical openings
 
Context: Reviewing portfolio writing with the fine-tuned Gemma 4 26B-A4B voice model
locally via MLX on Apple Silicon.
Learning: Automated voice review reliably catches the subtle shift where a post slips
from authentic builder narrative into essay-style rhetorical questions and academic
headers (like "## The hypothesis", "## The test"). Replacing these with immediate
friction and result-led framing keeps the tone direct and grounded.
Evidence: Gemma 4 identified that `fine-tuning-was-the-easy-part.md` opened on a
hypothetical platform question rather than the Place Details billing shock, and that
`builder-platforms-grow-by-owning-the-agent-loop.md` opened on a prediction rather than
developer friction in an agent session. Both rewrites passed `npm run check:content` with
0 errors and 0 warnings.
Use next time: Run `./scripts/gemma-local.sh review <file>` during maker/checker review
passes on new Field Notes before publication.
 
## 2026-08-07 - Correcting the proof must not replace the article's thesis

Context: The evidence pass on “Fine-Tuning Was the Easy Part” correctly removed
fabricated scores, a wrong billing claim, and an evaluator that never ran. It
also turned the entire essay into an eval audit and dropped Ryan's actual
argument about runtime context, learned weights, and the distribution problem
for developer platforms.
Learning: Freeze the narrative contract before a forensic rewrite: one sentence
for the thesis, the distinction the reader must retain, and the framework that
makes it actionable. Unsupported proof can be removed without amputating the
idea it was supposed to support.
Evidence: Ryan's review explicitly restored the weight-versus-context thesis
and the distribution pyramid. The revised Note keeps every evidence correction,
uses Harvey's held-out result as the public example that post-training can work,
and labels traces and benchmarks as possible distribution inputs rather than
guaranteed training adoption.
Use next time: Before replacing more than one section, compare the candidate to
the original narrative contract. If the proof disappears, rebuild support; if
the thesis or decision framework disappears, stop and restore it before the
voice pass.

## 2026-08-07 - Reader-facing counts must follow the executable source

Context: The evidence ledger and an older learning still described the Loop
Engineering package as a 16-case specification after the live case file and
structural checker had moved to 17.
Learning: Treat prior audits as leads, not current evidence. Reader-facing
counts should be derived from the live source and its executable check in the
same review pass that publishes the claim.
Evidence: `agent-scripts/coding-agent-loop/evals/cases.md` defines C01–C17,
split into C01–C13 for development and C14–C17 for selection, and
`agent-scripts/coding-agent-loop/evals/check.sh` passes only when it finds all
17 cases.
Use next time: Recount mutable artifacts at publication time and run the check
that enforces the count; do not carry a number forward from a ledger, audit, or
older prose without following it back to source.

## 2026-08-07 - An evidence correction can still fail the voice review

Context: The first rewrite of the fine-tuning Field Note corrected unsupported claims but presented the result as an audit table, glossary, diagnostic JSON, pseudo-rubric, numbered rerun plan, and two outside case studies. Ryan identified the copy and formatting as AI-generated rather than his voice.
Learning: Claim integrity and voice need separate review passes. Evidence should usually enter a Field Note through the one or two artifacts that changed the author's mind; stacking every available explanatory format turns a personal technical story into a report. Generated visuals have the same boundary: generation context belongs in the prompt record, not on the canvas.
Evidence: Two independent copy reviews both identified the format stack as the dominant AI tell and converged on the same repair: follow the wrong nursery answer key and the evaluator's `pass` statement, explain the trace through that case, and cut the table, glossary, null object, rubric, checklist, and unrelated detours. Ryan's direct review independently identified the voice failure and visible prompt context.
Use next time: Run claim verification first, then a separate de-scaffolding pass against a hand-written voice calibrator. Keep a table, list, or diagram only when it makes a real relationship easier to understand than the narrative; remove source labels, dates, and generation notes from graphics unless they are the evidence.

## 2026-08-07 - A linked eval is not evidence until its execution path computes the claim

Context: The fine-tuning Field Note reported four exact-match improvements and linked the public evaluator as proof. The evaluator never invoked its constructed model commands; it skipped the loop and printed four hard-coded values. The same audit found ten cases instead of the claimed 300 plus 100-case holdout, no dataset split, no executable output grader, and a billing-tier answer key contradicted by current Places API documentation.
Learning: Review the execution path behind every eval claim. A credible result needs disjoint development and held-out cases, retained raw outputs, scores computed from those outputs, pinned model and harness configuration, and an answer key checked against the current contract. A repository link, falling training loss, rubric description, or polished chart cannot substitute for those artifacts.
Evidence: `evals/field-mask/test_mlx.py` labels the loop “Mocking evaluation,” executes `pass`, and assigns the published values directly; `dataset.v1.json` contains ten cases; both `train_mlx.py` and `test_mlx.py` select the same eight eligible cases; and the official Places field table classifies `displayName` as Pro while the first case labels it Essentials. The rewritten Field Note removes the unsupported scores and states the gaps directly.
Use next time: Before publishing a model or agent delta, run from the cited entry point, follow each value back to retained outputs, verify the split and ground truth, and block the claim if any score comes from a constant, fixture, stub, or unversioned off-repository run.

## 2026-08-04 - Fine-tuning a unified multimodal model in MLX requires stripping tower parameters and remapping language keys

Context: Attempting to fine-tune `google/gemma-4-E4B-it` via `mlx-lm` failed repeatedly. The model weights declared 42 attention layers, but `mlx-lm` threw a parameter mismatch because the architecture (`gemma4_unified`) was unsupported, and the weights were deeply nested inside `language_model.model.*` alongside `vision_tower` and `audio_tower` parameters.
Learning: MLX (`mlx-lm`) does not natively support unified multimodal checkpoints for text-only LoRA tuning out of the box. To fine-tune the text backbone of a unified model, you must patch the architecture definition (e.g. duplicating the text model structure but preserving SwitchGLU routing), adjust KV cache assumptions, and rewrite the `sanitize()` function to strip `vision_tower` and `audio_tower` keys while elevating `model.language_model.*` back to `model.*` before loading the `safetensors`.
Evidence: A subagent cloned `mlx-examples`, implemented `mlx_lm/models/gemma4_unified.py`, stripped the tower keys in the load step, and successfully completed 100 iterations of LoRA fine-tuning on the `field-mask` dataset with a final validation loss of 0.028.
Use next time: When fine-tuning a multimodal or unified model on a text-only dataset using MLX, do not rely on default architecture mappers. Inspect the `.safetensors` keys, write a custom sanitize function to strip non-text towers, remap the language keys to the root state dict, and run from a local source clone.


## 2026-08-04 - TypeScript 7.0 removes baseUrl and requires relative path mappings in tsconfig.json

Context: Dependabot bumped TypeScript to 7.0.2 in `demos/real-world-reasoning-agent`, breaking `tsc --noEmit` due to removed `baseUrl` and non-relative path aliases.
Learning: TypeScript 7 deprecates/removes `baseUrl` in compilerOptions and enforces relative paths starting with `./` in `paths` mappings (e.g. `"@/*": ["./src/*"]`). Also in Vitest 4, `vitest.config.ts` deprecated `poolOptions`.
Evidence: Updated `tsconfig.json` and `vitest.config.ts` in `demos/real-world-reasoning-agent` and confirmed `npm test && npm run build` passed cleanly.
Use next time: When upgrading projects to TypeScript 7 or Vitest 4, remove `baseUrl`, adjust path alias prefixes to `./`, and update pool settings in vitest configuration.

## 2026-07-27 - Per-user free tiers still need a global spend ceiling

Context: IP allowances limited ordinary use but an IP-rotating caller could
still spend the hosted provider key, and imported Maps proxy limits were sized
for load testing rather than a public portfolio.
Learning: Separate per-user fairness, process-wide daily spend ceilings, and
provider-side quotas. Pin exact upstream routes and methods; same-origin checks
alone are not caller authentication.
Evidence: Hairstyle now has per-IP and global hosted-generation caps; Real
World Reasoning has separate request classes, daily Maps/Gemini ceilings,
bounded limiter memory, exact route/method allowlists, and focused regressions.
Use next time: Define the maximum affordable provider usage before exposing a
public proxy, then make cloud quotas the hard backstop for restart and botnet
scenarios.

## 2026-07-27 - A private-to-open-source migration needs explicit release provenance

Context: Real World Reasoning Agent was still private when its owner requested
that Fieldwork become the first-party open-source home. The public-import
command correctly refused to accept a false public-source confirmation.
Learning: Explicit owner authorization can release a reviewed snapshot without
changing the predecessor repository's visibility, but the boundary must remain
auditable: pin the exact commit, exclude Git history, environment and deployment
files, scan for credentials, record the source visibility and release authority,
and make the new repository the canonical public link.
Evidence: `demos/real-world-reasoning-agent/PROVENANCE.md` records private source
commit `68e8c34547066a984ccb97f5b587caeb97561ec1`; the pre-import scan found no
credentials; and the public tree excludes history, environment files, and
private deployment configuration.
Use next time: Never pass `--confirm-source-public` for a private source. Require
explicit release authority, a clean snapshot scan, and provenance that explains
the exception before public integration.

## 2026-07-27 - Hosted allowance and personal-key abuse limits are different controls

Context: Hairstyle AI Studio put every image request behind one five-per-hour
IP limiter. Entering a personal Gemini key therefore did not help: the gateway
rejected the request before it inspected which credential would pay for it.
Learning: Select and validate the credential before applying spend controls.
Hosted calls consume the shared daily allowance; valid personal-key calls
bypass that spend cap but retain a separate, generous site-abuse limiter.
Malformed personal keys fail closed instead of silently falling back. Provider
quota errors need a different code from local allowance exhaustion so the UI
can offer the right recovery.
Evidence: Gateway regressions cover five successful hosted image generations,
UTC reset metadata, failed-request refunds, personal-key bypass, malformed-key
denial, non-generating key validation, and distinct upstream quota responses.
Use next time: Model shared budget, provider quota, and gateway abuse as
separate policies, then test routing order across every credential source.

## 2026-07-27 - Buffer staging inputs need an explicit merge trigger

Context: The existing Buffer workflow could stage social copy only when a new
Field Note Markdown file was merged. A Lab release update had valid copy but no
Field Note, and local development intentionally had no Buffer credentials.
Learning: Keep external draft creation in the credentialed merge workflow, but
make one-off release copy a small, validated, reviewable repository artifact.
The workflow should stage only newly added files, create an editable draft, and
remain side-effect free on reruns.
Evidence: `docs/social-drafts/hairstyle-ai-studio-update.json` declares one
LinkedIn draft; `parseReleaseDraft()` bounds its channel and copy; the social
draft suite passes eight tests; and the merge workflow now watches that narrow
directory while retaining its first-attempt gate.
Use next time: For a non-Field-Note release update, add one exact-copy JSON file
under `docs/social-drafts/`. Do not put Buffer credentials in local files and
do not turn merge-time staging into automatic publishing.

## 2026-07-27 - A public Lab import still needs runtime and instruction-boundary adaptation

Context: Importing Hairstyle AI Studio with `labs:import` copied a valid public
snapshot, including its standalone Express server, Dockerfile, root-relative
PWA metadata, secret-based deployment docs, and nested `AGENTS.md`.
Learning: A snapshot import proves provenance, not deployment compatibility.
The monorepo still needs one owner for serving and APIs, namespaced routes,
subpath-safe metadata, and an instruction contract that describes the
integrated architecture. Leaving the nested instructions unchanged is worse
than leaving stale prose because future work will be routed back to deleted
runtime files and obsolete secret patterns.
Evidence: The imported source was pinned to
`9ea2c0f31e5e1d252220ede6731b655bf2fb8fba`. The completed adaptation registers
`/hairstyle-ai-studio/` and `/api/hairstyle-ai-studio/*` in `apps.json`, moves
Gemini calls to `gateway/lib/hairstyleAi.js`, updates the nested `AGENTS.md`,
and passes the app build, gateway tests, Labs validator, and repository smoke
path.
Use next time: After `labs:import`, audit runtime ownership, route namespaces,
base paths, public metadata, nested instructions, secrets, and unused build
artifacts before treating the snapshot as integrated.

## 2026-07-27 - Browser cancellation must cross the gateway boundary

Context: Hairstyle AI Studio's Cancel action aborted the browser `fetch`, but
the gateway created an independent 120-second Gemini request. The UI stopped
waiting while the visitor's upstream request and quota consumption could
continue.
Learning: In a same-origin proxy, cancellation is an end-to-end contract.
Combine the gateway timeout with a caller-disconnect signal and pass that
signal into the provider request; browser cancellation alone is not sufficient.
Evidence: The Hairstyle gateway now aborts its provider signal when the request
is aborted or the response closes before completion. A focused test verifies
that cancelling the caller signal aborts the Gemini interaction and returns
the internal cancellation status; all 113 gateway tests pass.
Use next time: For expensive or user-keyed proxy calls, test that client
disconnect reaches the provider fetch rather than only changing local UI state.

## 2026-07-26 - Repository-wide skill audits need a disposition ledger before prompt edits

Context: A request to use all Git history, `LEARNINGS.md`, and `CHANGELOG.md` to
improve every appropriate local skill was broader than the existing
one-behavior skill-improvement loop.
Learning: Comprehensive retrieval and bounded promotion are compatible. Audit
the full evidence set first, but give every candidate an explicit disposition:
already enforced, promote to a test, promote to a skill, retain as
documentation, stale/contradicted, or one-off. Freeze the behavioral scenarios
before editing, keep current code/tests and authoritative docs above old commit
messages, and record no-change decisions for already-complete or externally
maintained skills. An eval file is not evidence by itself; its ownership,
development/selection split, case IDs, and expectations need deterministic
validation.
Evidence: `docs/SKILL_EVIDENCE_AUDIT.md` covers all 350 reachable commits and 45
current learning entries. The same read-only Codex CLI scenario set was run
before and after the candidate edits with `LEARNINGS.md` and `CHANGELOG.md`
excluded. The candidate closed the seven recorded omissions while preserving
the three held-out portability/security behaviors. `npm run skills:improve` and
`node --test scripts/test/skill-improvement.test.mjs` validate the new eval
contracts. An independent read-only diff review then found that an
all-selection suite passed and a `null` eval crashed the validator; focused
regression cases now require development coverage and turn non-object entries
into findings.
Use next time: For a broad learning audit, inventory widely and edit narrowly.
Do not paste history into prompts, do not treat old contradictory fixes as
current truth, and do not call a directory of unvalidated cases a held-out
gate.

## 2026-07-26 - Agent-skill changes need a held-out gate, not a larger prompt

Context: The repository already recorded durable coding and delivery lessons in
`LEARNINGS.md`, while the portable Loop Engineering Coding Agent had a
structural checker and synthetic cases but no explicit selection split for
changing its prompt.
Learning: Treat the instruction document as a versioned candidate artifact.
Mine repository learnings narrowly, verify each against current evidence, turn
only recurring behavior into cases, and accept a bounded edit only after a
frozen held-out set improves with no safety regression. Keep transcript
harvesting opt-in and reviewable because task traces can contain sensitive data.
Evidence: `agent-scripts/coding-agent-loop/evals/cases.md` now freezes C01–C13
for development and C14–C17 for selection, requires recorded run configuration,
and covers repository-learning retrieval without granting the log instruction
authority. The `skill-improvement-loop` local skill and `npm run
skills:improve` add a deterministic pre-commit metadata gate; `bash
agent-scripts/coding-agent-loop/evals/check.sh` validates the 17-case contract.
The initial run found and corrected an absent responsive-design frontmatter
block and a portfolio-review adapter prompt that had drifted from its manifest.
Use next time: Before changing the coding-agent prompt, run a repeated baseline
and candidate trial with the same fixture and harness; record variance and
reject any candidate that fails a safety case or does not strictly improve the
held-out result.

## 2026-07-26 - Places UI Kit components require matching color-scheme and complete CSP image origins

Context: Auditing the `isochrones` demo for CSP compliance and Places UI Kit UI/UX consistency.
Learning:
1. `gmp-place-details` defaults to light mode unless explicitly styled with `color-scheme: dark` and dark theme variables (`--gmp-mat-color-surface`, `--gmp-mat-color-on-surface`, etc.), which caused it to render as a white box inside dark Google Maps InfoWindows.
2. Places API photos and reviewer avatars are served from `https://*.ggpht.com` in addition to `*.googleusercontent.com`. Omitting `https://*.ggpht.com` from `img-src` in `CSP_MAPS_DEMO_DIRECTIVES` blocked place details imagery under CSP.
Evidence: `demos/isochrones/test/place-details.test.js` updated and passing; `gateway/test/staticFiles.test.js` (104 tests) and `scripts/smoke.mjs` (18 tests) passing.
Use next time: When integrating Places UI Kit components (`gmp-place-details`, `gmp-place-autocomplete`), set `color-scheme: dark` and explicit `--gmp-mat-color-*` custom properties to match dark themes, and include `https://*.ggpht.com` in `img-src` for Places photos.

## 2026-07-26 - Maps 3D renderer and follow-camera route tracking requirements

Context: Adding Content-Security-Policy (CSP) headers to the Node gateway static file responses for demo applications like `strava-explorer`, `aqi-map`, and `isochrones`, alongside follow-camera route resume logic.
Learning:
1. Google Maps 3D renderer utilizes `blob:` and `data:` URIs for tiles, textures, and inlined icon fonts, plus dynamic script execution and Web Workers. Restricting `img-src` or `connect-src` without `blob:` produces a silently blank basemap without explicit network errors.
2. Comparing array values by value vs identity when storing smoothed path coordinates: `loadTourRoute` creates a smoothed copy of input coordinates (`smoothedRouteCoords`). Comparing `followCameraCoords !== routeCoords` was always true, causing `playFollowCamera` on resume to re-initialize and reset progress to 0. Storing `followCameraSourceCoords = routeCoords` preserves input reference identity.
Evidence: Gateway unit test suite (`npm test`) passes 94/94 tests, verifying policy host matching for `strava-explorer`, `aqi-map`, and `isochrones`. End-to-end gateway smoke suite (`npm run smoke`) passes 17/17 checks.
Use next time: When configuring CSP for Google Maps 3D/2D API applications, ensure `blob:`, `data:`, `worker-src`, and label font hosts (`https://*.gstatic.com`) are explicitly included. Always track input source references when transforming arrays for stateful animation engines.

## 2026-07-26 - Marker3DElement only draws three element types, and its collision default is not what "always visible" needs

Context: Making the Strava Explorer rider marker sport-aware (custom SVG per activity type) and stopping it from disappearing behind basemap labels during a tour.
Learning: Two Maps 3D constraints decide the whole implementation. (1) The `Marker3DElement` default slot ignores everything except `HTMLImageElement`, `SVGElement`, and `PinElement`, and the first two must be wrapped in a `<template>` before being appended - a bare `<div>` or an SVG appended directly is silently dropped, so custom artwork has to be built as an SVG string, parsed with `DOMParser`, and slotted through a template. (2) `collisionBehavior` defaults to `REQUIRED`, which only guarantees the marker is drawn; a colliding basemap label still wins the space. `REQUIRED_AND_HIDES_OPTIONAL` is the value that hides the optional label instead, and it pairs with `collisionPriority` to rank the app's own markers (rider 1000 > photos 100 > route endpoints 50). `sizePreserved: true` is separate again: without it the pin scales down with camera distance, which reads as "disappeared" long before collision does.
Evidence: Maps JS reference `developers.google.com/maps/documentation/javascript/reference/3d-map-draw` (retrieved via the GMP Code Assist REST endpoint) documents the slot restriction and both enum values; the marker-graphics sample uses the `DOMParser` -> `<template>` -> `marker.append(template)` sequence. Implemented in `demos/strava-explorer/src/activityIcons.js` (artwork as pure strings, unit-tested) and `src/gmp.js` (`svgTemplateFromMarkup`, `alwaysVisibleCollision`).
Use next time: For any custom 3D marker, build artwork as an SVG string, parse and slot it via `<template>`, and set `collisionBehavior`, `collisionPriority`, and `sizePreserved` together - treating any one of them as sufficient leaves the marker vanishing in some camera state. Keep the artwork in a DOM-free module so it can be rendered to a screenshot sheet and unit-tested without a map or an API key.

## 2026-07-26 - A CSP is only as good as the list of origins the app actually calls, and "it's a Maps demo" is not that list

Context: The per-app CSP work classified strava-explorer as a Google Maps Platform demo and gave it the Maps allowlist. The demo deployed and broke: connecting an account produced "Failed to fetch activities" from `demos/strava-explorer/src/strava.js`, because `connect-src` had every Google origin and no Strava one.
Learning: The app was classified by the framework it renders with, not by the origins it calls. The gateway proxies Strava OAuth and photos same-origin, which made "the Strava calls are behind /api" feel true, but the four read paths (athlete activities, activity detail, streams, photo metadata) go to `https://www.strava.com/api/v3` from the browser with the user's own token, and two image hosts load without the proxy. A CSP is a per-app allowlist of destinations, so it has to be derived from the app's outbound calls, not from a category the app belongs to.
Evidence: `grep -n "fetch(" demos/strava-explorer/src/strava.js` shows four calls to `STRAVA_API_BASE_URL` (default `https://www.strava.com/api/v3`) against two same-origin `/api/strava/*` calls; `src/index.js` sets the athlete avatar directly from Strava's photo CDN and `src/demoData.js` uses picsum.photos for the signed-out tour. Fixed with a `maps-strava` policy; the gateway tests now derive those origins from the demo source, and `scripts/smoke.mjs` asserts the served `connect-src` allows the API base found in the served bundle.
Use next time: When adding or changing a CSP for an app, enumerate its outbound calls from its own source (`grep` for `fetch(`, `.src =`, `new Image()`) and check each origin against the policy. Because third-party requests cannot be verified in a browser in this container (see the Chromium note below), that source-derived list is the verification — write it into a test so the next policy change has to keep it true.

## 2026-07-26 - A comment that names a platform default is a claim, and this one was wrong

Context: `gateway/server.js` justified its in-memory per-IP rate limiters with "On Cloud Run with max-instances=1 (the default for this portfolio) that's fine." Cloud Run's actual default is max-instances=100, and `deploy.yml` passed no instance cap at all.
Learning: The comment was not describing a configuration, it was asserting one that nothing enforced. Every limit it justified (private-demo auth brute-force, and the spend caps in front of Isochrones, Gemini, and Resend) silently became per-instance under load, and the same load that triggered an attack also scaled out the instances that diluted the defence. When a correctness argument depends on an external setting, the setting has to be pinned in the repo and the comment has to point at where it is pinned, or the argument is only true by luck.
Evidence: `gcloud run deploy` in `.github/workflows/deploy.yml` listed `--min-instances 0` and `--cpu-boost` and no `--max-instances`; Cloud Run's documented default is 100. Fixed by pinning `--max-instances 1` and rewriting the comment to say it is pinned in deploy.yml, not defaulted.
Use next time: When a comment says "the default is X," check whether the repo sets X. If it does not, either set it or delete the claim. Treat a security argument resting on an unpinned default as an open finding.

## 2026-07-26 - Do not let a security policy depend on display metadata

Context: Adding per-app Content-Security-Policy, the first implementation selected the relaxed Google Maps policy with `app.tags?.includes('google-maps-platform')`. It worked, and every test passed.
Learning: `tags` in apps.json is presentation metadata: it renders as card chips and feeds JSON-LD keywords. Anyone editing tags for wording, SEO, or tidiness would have silently changed a security policy, and nothing in the suite would have noticed. The fix was a dedicated `csp` manifest field plus validation in `scripts/validate-apps.mjs` that fails in both directions: an unknown value, and a Maps-tagged app that forgot to declare it. The general rule is that a security decision must read a field whose only purpose is that decision.
Evidence: `grep -rn "\.tags"` showed tags consumed only by card rendering (`portfolio/build.mjs`), JSON-LD keywords, and `toPublicApp`. Deleting `"csp": "maps"` from aqi-map now fails `node scripts/validate-apps.mjs` with an explicit message, verified by removing it and restoring it.
Use next time: Before keying behavior off a manifest field, grep who else writes it. If the field exists to be displayed, add a new one for the decision.

## 2026-07-26 - Chromium in this container cannot reach third-party origins, so browser CSP checks are only half a verification

Context: Verifying the new CSP by rendering pages and watching for violations, the giscus comments script reported a failed request on a note page, which looked exactly like a CSP block.
Learning: It was not CSP. Loading the same script from a page with no CSP at all also timed out, while `curl` fetched it successfully, because curl uses `HTTPS_PROXY` and the Playwright Chromium launched here does not. A failed third-party request in this environment is ambiguous by default, and reading it as a policy failure would have sent someone loosening a correct policy.
Evidence: `page.setContent('<html>…')` with no CSP, then injecting `https://giscus.app/client.js`, returned `timeout`; `curl https://giscus.app/client.js` returned 200. Same-origin assets and the Maps demo pages rendered clean.
Use next time: Before blaming CSP for a blocked third-party request, reproduce it on a page with no CSP. Verify third-party directives by inspecting the served header, and treat in-browser confirmation of external origins as unavailable here.

## 2026-07-25 - A hover state that borrows the focus ring's language removes an accessibility affordance

Context: `.card:hover` had grown to a 4px lift, a transparent border, a 2px accent ring, and two hardcoded `rgba(0,0,0,...)` shadow layers, against a design skill that specifies border accent plus a 2px lift and nothing more.
Learning: Judge a hover change against the other states it has to coexist with, not against its own screenshot. This ring was `2px solid` in the accent color at the same visual weight as `:focus-visible`, so a hovered card and a focused card became indistinguishable and the focus affordance stopped carrying information. Separately, a hardcoded black shadow is not scheme-neutral: it did real work on the warm light background and disappeared against the dark one, so the two schemes shipped different hover states, which is the concrete reason the skill bans hardcoded color in components.
Evidence: A rendered audit measured the focus ring at `2px solid rgb(59,130,246)` with `outline-offset: 3px` and reported the hovered card indistinguishable from the focused card in light mode. The same pass found `.card-thumb` cropping 16:9 art at `aspect-ratio: 16/10` and dark `--faint` (9.94:1) rendering brighter than `--muted` (7.93:1), inverting the three-step hierarchy.
Use next time: When changing an interaction state, render hover, focus, and active together in both schemes before keeping it. If a new state needs a shadow, add a token; a component that hardcodes black has already decided it only cares about one scheme.

## 2026-07-25 - The prose rules that held were the ones a regex could decide

Context: An audit graded `portfolio-writing` against every published entry. Rules that ban a pattern held at 100 percent across 22 files. Rules needing judgment did not, and the corpus was clean only because a person had been careful, with nothing to catch the next lapse.
Learning: Split a style guide by decidability, not by topic. Move every rule a regex can settle into a checker so review attention goes to claims, evidence, and rhythm, which no checker can grade. The split also makes disagreement cheap: a disputed finding is settled by editing one rule, not by arguing taste in a review thread.
Evidence: `npm run check:content` reported 0 errors and 3 warnings on 31 entries at introduction, and independently reproduced the audit's finding that one prescribed phrase had spread to four Field Notes. Its 10 regression cases are must-fail fixtures, not just happy paths.
Use next time: When a review keeps catching the same mechanical defect, add the rule and a failing fixture in the same change. Keep taste rules out of the checker; a warning is a prompt to look, not an instruction to obey.

## 2026-07-25 - A publication gate copied by hand drifts from the one the build uses

Context: An audit of the authoring loop found that `buildSocialDrafts` skipped any note without `draft: true`, while `portfolio/build.mjs` decides publication with `isPublished()`, which also honors a future `publishAt`. A note scaffolded with `--schedule` satisfied one gate and not the other.
Learning: When two code paths answer the same question about content state, one of them will be a paraphrase, and the paraphrase will be wrong for the case nobody tested. Derive the second answer from the first, or at minimum name the function it mirrors so the pair is greppable.
Evidence: `--schedule` writes `draft: false` with a future `publishAt`; staging fires only on `--diff-filter=A`, so the note published with no Buffer draft and no retroactive path to get one. `scripts/test/social-drafts.test.mjs` contained zero occurrences of `publishAt` before the fix.
Use next time: For any new content-state predicate, write the test for the scheduled case first. It is the state that exists only between two deploys, so it is the one the happy path never visits.


## 2026-07-25 - Vendoring a dynamically fetched skill turns a live source into stale weight

Context: The 2026-07-20 cleanup removed eight per-product Google Maps skills but left `google-maps-platform/references/index.json`, a local mirror of the GMP Skills Index whose entries still pointed at `../places-api-web-api/SKILL.md` and the other deleted directories. The skill's mandatory first action fetches that index over HTTP and loads sub-skills at runtime.
Learning: A skill that fetches its own references at runtime must not also be mirrored into the repo. The copy cannot be refreshed by the mechanism that owns it, so it ages into contradiction with the live source while still being the thing an agent reads first. Deleting the skills it indexed is not enough; the index itself is part of the mirror, and a stale index is worse than none because every URL in it resolves to nothing.
Evidence: `SKILL.md` cites only the remote gstatic URL; no file referenced the local mirror. Removing it left zero dangling references and changed no test.
Use next time: Before vendoring any skill, check whether it retrieves its own content. If it does, keep the entry point and delete everything it would fetch, and say so in the routing entry so the copies do not come back.


## 2026-07-25 - Prescribed example strings in a voice skill become the corpus's boilerplate

Context: A voice-fidelity audit compared `portfolio-writing` against every published entry. Rules that ban a pattern held at 100%; rules that supply a phrasing produced verbatim repetition.
Learning: An instruction that quotes an example inside a "vary this" rule will produce that example. Prohibitions transfer to a model; prescriptions get copied. Write prescriptive voice rules as meanings to convey, and reserve quoted text for what must never appear.
Evidence: "We are still learning what works" appears verbatim in four of nine Field Notes under a rule requiring varied phrasing; the skill's own named anti-pattern ("Activation says… Retention says…") shipped in `builder-platforms-grow-by-owning-the-agent-loop.md`. Zero em-dashes and zero hype adjectives appear anywhere in the corpus.
Use next time: When a voice rule needs an example, put it in a reference file marked as illustration, add a repetition check for any distinctive four-word phrase, and calibrate rhythm against in-repo files rather than an external URL the agent cannot fetch.


## 2026-07-22 - Theme-aware SVGs in `<img>` tags require explicit `color-scheme`

Context: The site uses SVGs that internally specify `@media (prefers-color-scheme: dark)` to handle light/dark modes. The HTML site has a manual toggle using `data-theme="light"` or `data-theme="dark"`. However, SVGs loaded via `<img>` tags were not respecting the manual `data-theme` toggle, remaining stuck on the OS-level system color scheme.
Learning: An SVG loaded via an `<img>` tag executes its internal media queries based on the host HTML element's explicit `color-scheme`. Injecting `color-scheme: light;` or `color-scheme: dark;` into the `html[data-theme]` CSS block automatically propagates the theme down to the embedded SVGs, bypassing the system theme and allowing them to respect the manual toggle without needing duplicate SVG files.
Evidence: Modified `html[data-theme="light"]` to include `color-scheme: light;` and `html[data-theme="dark"]` to include `color-scheme: dark;` in `portfolio/style.css`.
Use next time: Use explicit `color-scheme` properties on theme blocks to control internal `prefers-color-scheme` media queries of embedded SVG images.


## 2026-07-20 - local skills clean up: keep google-maps-platform, frontend-responsive-design, infographic-agent, and portfolio-* skills

Context: The repository had many local skills in `.agents/skills/` that were either globally available or redundant (such as specialized google maps subset skills).
Learning: Keep the repository's `.agents/skills/` directory focused. Keep only the primary Google Maps Platform skill (`google-maps-platform`), `frontend-responsive-design`, `infographic-agent`, and the repository-specific `portfolio-*` skills. Other generic or subset maps skills are handled globally.
Evidence: Removed 9 redundant skills (`geocoding-api-web-api`, `google-maps-environment-apis`, `google-maps-js-2d`, `google-maps-js-3d`, `maps-javascript-api-javascript`, `places-api-web-api`, `pollen-api-web-api`, `setup-local-environment`, `weather-api-web-api`) from `.agents/skills/` and updated `AGENTS.md` to reflect the change.
Use next time: Do not add or retain redundant, non-portfolio maps/api skills locally; rely on the global system-wide skills for general development tasks.


## 2026-07-20 - Field Note copy and image taste: cut AI tells, draft three, make art per-post

Context: A Field Note draft read as competent but generated. Ryan's specific corrections: too many "it's not X, it's Y" antithesis flips; the self-credit line "I lead the strategy and review the traces" is trite and inauthentic (he does not want it, in this or any post); openings should lead with the reader's stakes, not a personal scene; punchier and shorter beats thorough. Separately, the generated diagrams all looked identical because every post reuses the same numbered box-and-arrow flow template, with too much text.
Learning: For copy, hold the "not X, but Y" shape to at most two load-bearing uses (the title thesis and the one payoff line) and never as filler; never use "I lead the strategy and review the traces" or resume-bullet self-credit; open on the stakes; prefer cutting to polishing. To pick voice, write three genuinely distinct drafts (analytical, scene-led, staccato) and have an independent reviewer grade them 1-10 on authentic voice, rhythm, freedom from AI-isms, and punchiness, then the lead makes the final call. For images, draw bespoke low-text art per post (a distinct scene that carries one idea) instead of the shared flow template, so a post's visuals read as its own; keep the house chrome (grid, accent bar, theme vars) for family resemblance but change the central geometry. Encode custom art as a `CUSTOM` entry with a dedicated render function in `scripts/artifact-cards.mjs`, and remember to add it to the CLI `knownFiles` allowlist.
Evidence: "The Model That Picks Your Platform Doesn't Write the Code" was rebuilt this way: three drafts graded (analytical draft won 34/38), a one-decides-many-build asymmetry header and a descending-tier staircase inline replaced two templated flow diagrams. See `scripts/artifact-cards.mjs` `asymmetryDiagram`/`tierdropDiagram`.
Use next time: Run the three-draft grade for any headline Field Note, apply the reviewer's line fixes, and give each post at least one purpose-built visual instead of another flow card.


## 2026-07-20 - Social-card generation in remote agent sandboxes: shadow the Playwright browsers dir, do not reinstall

Context: Regenerating a Field Note social card with `node scripts/social-cards.mjs` in a Claude Code remote session failed because the pinned Playwright wanted `chromium_headless_shell-1228` while the sandbox preinstalls r1194 under `/opt/pw-browsers` (with the older `chrome-linux/headless_shell` layout) and blocks `playwright install`.
Learning: A minor headless-shell version skew renders these static HTML cards identically, so a writable shadow browsers directory with symlinks satisfies Playwright's executable check without downloading anything: recreate the expected `chromium_headless_shell-<rev>/chrome-headless-shell-linux64/chrome-headless-shell` path as a symlink to the preinstalled `chrome-linux/headless_shell` binary, then run with `PLAYWRIGHT_BROWSERS_PATH=<shadow-dir>`.
Evidence: `scripts/social-cards.mjs` produced a valid 1200x627 JPEG under the 200KB target this way for PR #114; `npm install` in `demos/strava-explorer` also churned `package-lock.json` (removed 42 lines) and had to be reverted before committing.
Use next time: In sandboxes with preinstalled browsers, check `/opt/pw-browsers` and `PLAYWRIGHT_BROWSERS_PATH` before touching Playwright installs, build the shadow-symlink dir when revisions differ, and always `git checkout` lockfiles that an install-for-tooling touched.


## 2026-07-20 - Cloud Run domain mapping replacement can interrupt TLS

Context: Cloud Run rejected the documented `create --force-override` command for an existing same-project mapping, so moving `ryanbaumann.dev` required deleting and recreating the exact DomainMapping resource.
Learning: Treat a Cloud Run domain mapping replacement as a certificate migration, not an atomic route edit. Move the canonical domain first, preserve the old service, wait for both resource readiness and edge propagation, and defer redirect-only mappings until the apex is stable.
Evidence: The replacement mapping became DomainRoutable immediately, took about 12 minutes to report CertificateProvisioned, and then needed several more minutes before all four published IPv4 edges completed TLS; the strict production smoke passed once propagation converged.
Use next time: Test same-project override behavior before the maintenance window, communicate the possible HTTPS interruption, validate each published edge, and never replace multiple mappings simultaneously.


## 2026-07-20 - Parallel-service deploy checks need an explicit compatibility boundary

Context: The new `fieldwork` Cloud Run revision deployed and passed its direct production smoke, but the deploy job then compared the still-legacy public origin's `portfolio` root manifest name against the renamed checkout and failed.
Learning: During a parallel-service migration, keep candidate-service verification strict and scope any compatibility override to the known legacy identity at the public-origin boundary. Do not weaken route, asset, canonical, redirect, auth, or secret checks.
Evidence: The failed deploy passed the new revision smoke and every public-origin assertion except the expected root app name; a tested `ROOT_APP_COMPAT_NAME` override changes only that expected root name for the public-origin step.
Use next time: Model transitional identities explicitly, document their removal condition beside the override, and delete the compatibility setting immediately after the domain cutover passes the strict public smoke.


## 2026-07-20 - Brand migrations need identity layers and compatibility gates

Context: Renaming the repository and deployment from Portfolio and `trails-ninja` to Fieldwork also affected public metadata, social assets, package names, source links, writer defaults, CI guards, image storage, and Cloud Run, while every existing website path needed to remain valid.
Learning: Separate the person, public brand, internal package paths, and deployment resources. Rename reader-facing and operational identity together, but preserve stable internal directories and environment variables when changing them adds no user value. Compare the complete route and redirect inventories before cutover, stage a parallel Cloud Run service, and retain both GitHub redirects and the legacy service until the public origin is verified. Repository-bound Workload Identity Federation conditions and service-account principals must explicitly allow the new GitHub name before the rename.
Evidence: The rebuilt Fieldwork output contains all 26 production sitemap paths and all 6 production redirects; the new `fieldwork` Cloud Run service is ready with the same 23 runtime configuration names while `trails-ninja` remains ready. The deploy provider and service-account roles now allow both the old and new repository principals during migration.
Use next time: Inventory page paths, redirects, metadata, images, repository links, workflow guards, package names, registry paths, runtime configuration names, Workload Identity provider conditions, service-account principals, IAM, domain mappings, and rollback targets before any public identity rename.


## 2026-07-20 - Mobile navigation should prioritize instead of overflow

Context: The header exposed every desktop destination on narrow screens, requiring horizontal scrolling and an extra JavaScript overflow control.
Learning: When every primary destination matters, reduce horizontal chrome before hiding links or adding overflow. Compact type and spacing can preserve the complete information architecture while retaining 44-pixel target height.
Evidence: At 320 and 360 pixels, the rendered header keeps Fieldwork, Notes, Work, Talks, Labs, About, and the theme control on one line; every navigation target is 44 pixels tall and the header scroll width equals its client width.
Use next time: Define mobile destination priority explicitly, retain 44-pixel target height, move nonessential utilities into the page or footer, and verify route completeness, wrapping, and overflow at the narrowest supported viewport.


## 2026-07-20 - Collection calls to action must point to the collection owner

Context: The homepage Labs section rendered several cards, but its “Explore Labs” action was hard-coded to one external Atlas experiment instead of the local Labs collection route.
Learning: A collection-level call to action should resolve to the collection’s canonical route. Individual external destinations belong on their own cards.
Evidence: The homepage builder now targets `/labs/`, which follows the existing permanent redirect to the canonical `/demos/` collection, while Atlas keeps its external URL in `apps.json`.
Use next time: Derive section-level destinations from the collection route and cover the rendered `href` with a build test when a featured item can be external.


## 2026-07-20 - Heatmap selectors must use API map type identifiers

Context: The Air Quality demo labeled a layer as PM2.5 but requested `PM25_INDEX`, which is not a supported Air Quality API heatmap map type. The failed tile requests left the map overlay visually empty.
Learning: Keep user-facing labels separate from API identifiers, and validate every configured tile layer against the documented map type values.
Evidence: The PM2.5 option now requests `PM25_INDIGO_PERSIAN`, and a focused test verifies the complete tile URL while rejecting the former identifier.
Use next time: Put external API identifiers in one shared configuration and cover every selectable layer with a request-contract test.


## 2026-07-20 - Browser and server Maps calls need separate restricted keys

Context: The Isochrones demo's map loaded, but Places autocomplete returned 403 because the browser build did not have a key authorized for Places API (New).
Learning: Keep the browser and server credential boundaries explicit. The browser key can use HTTP referrer restrictions and should allow only Maps JavaScript API and Places API (New). The Isochrones REST key cannot rely on browser referrers, so it stays server-side and is restricted independently.
Evidence: Places API (New) is enabled on `geojson-bq-blog`, and the deployment uses a dedicated `VITE_ISOCHRONES_GMP_API_KEY` for browser Maps and Places calls while `/api/isochrones` continues to use `GMP_SERVER_API_KEY` in the gateway.
Use next time: When one demo combines browser SDKs with server REST APIs, document and validate each key's runtime, application restriction, API allowlist, and enabled service separately.


## 2026-07-20 - A generated tile URL is not proof that the tile loaded

Context: The Air Quality demo generated the corrected PM2.5 map type, but every production tile still returned HTTP 400 because the endpoint rejected the extra `solution_id` query parameter.
Learning: Validate raster overlays at the HTTP and rendered-image boundaries. A correct map type and an invoked `getTileUrl` callback do not prove that the server returned a PNG or that the map drew it.
Evidence: A production-origin browser check reproduced `INVALID_ARGUMENT` for `solution_id`; the tile URL now sends only the documented API key query parameter, and the regression test pins that exact URL.
Use next time: For tile overlays, assert a 200 image response and inspect a rendered desktop/mobile capture before calling the layer visible.


## 2026-07-19 - Gitleaks Action v3 licensing breaks CI/CD workflows

Context: The CI pipeline's Gitleaks secret scanner step failed with a "missing gitleaks license" error because the proprietary `gitleaks-action@v3` wrapper enforces licensing key checks for organization repos or when GitHub's account-type API experiences a transient lookup failure.
Learning: Avoid proprietary action wrappers that add commercial licensing enforcement mechanisms for open-source tools when they can be run directly. Instead, run the official open-source tool binary directly or via Docker (`ghcr.io/gitleaks/gitleaks`) to scan git history without external dependencies or license checks.
Evidence: Changing the CI step to run `docker run --rm -v "${{ github.workspace }}:/repo" ghcr.io/gitleaks/gitleaks:latest git --source=/repo --verbose --redact` runs successfully without requiring a GITLEAKS_LICENSE secret or crashing on API failures.
Use next time: Prefer running open-source security tools via direct Docker commands or binary installation in workflows over proprietary wrapper actions that require license keys.


## 2026-07-19 - tar output format differences break size checks and rename options

Context: Checking the size of files in static archive artifacts failed on macOS because BSD `tar -tvzf` uses a different column order (size at index 4) compared to GNU `tar` (size at index 2), and the test suite's path-traversal simulation failed due to missing `--transform` support in BSD `tar`.
Learning: Do not assume `tar` options or output formats are identical across operating systems (BSD on macOS vs GNU on Linux). Parse size robustly using regular expressions targeting either format pattern, and try-catch OS-specific options (like `--transform` on GNU `tar`) falling back to their BSD equivalents (like `-s`).
Evidence: The updated `inspectArchive` matches both BSD and GNU formats via regex, and `labs.test.mjs` handles `--transform` errors by falling back to the `-s` rename option, resolving the local test failure on macOS.
Use next time: Use regex patterns rather than split column indices for parsing CLI command output, and provide fallback options when running platform-dependent tools like `tar`.


## 2026-07-19 - Curiosity works when it corrects a real assumption

Context: Ryan wanted the copywriting skill to make social posts, headlines, titles, names, and preview images more interesting while preserving the portfolio's evidence-led tone.
Learning: High-retention packaging should begin with the reader's plausible misconception, turn it into a specific question or tension, then quickly resolve the mechanism with evidence. The strongest hook often appears after swapping the obvious topic for the underlying lesson. Visual previews should carry one concrete contrast or artifact at small size, while the title carries the claim or question.
Evidence: Learning research on misconception-based multimedia shows that directly engaging prior beliefs can improve conceptual change, and creator packaging analysis consistently emphasizes clear promise, trust, simple visuals, title-image alignment, and iteration.
Use next time: For any public title, social draft, article headline, demo name, talk title, or preview card, draft the obvious framing first, find the hidden lesson, state the honest tension, verify the opening paragraph pays off the promise immediately, and propagate the rule into content, presentation, and review workflows instead of leaving it in writing guidance only.


## 2026-07-18 - Social automation should stop at an editable draft

Context: A new Field Note needed to create useful LinkedIn and X starting points without granting a merge workflow authority to publish externally.
Learning: Trigger only for newly added draft files, create one Buffer draft per explicitly configured channel, and leave editing, timing, and publication in Buffer. Do not repeat external staging on a workflow rerun. Once someone edits a Buffer draft, exact-copy matching is no longer an idempotency key.
Evidence: Buffer's GraphQL API supports `saveToDraft: true`, returns the created post ID, and documents that the post remains unpublished until explicitly scheduled. The workflow now limits merge-time staging to its first attempt; a partial failure is recovered by explicitly staging the missing channel from Writer.
Use next time: Separate generation from publication, scope automation to added content, provide a front-matter opt-out, use exact destination IDs, and keep automatic retries side-effect free unless the external API supports a durable idempotency key.


## 2026-07-18 - Separate content ownership, social orchestration, and publishing approval

Context: Field Notes needed a manageable path from one canonical post to Substack, LinkedIn, X, and possible future social channels.
Learning: Keep the portfolio as the canonical archive, use Buffer as the multi-network approval queue, and keep Substack manual until it offers a supported ongoing publishing API. Generate channel-specific drafts, but require an explicit approval action before any external post is created. Direct per-network integrations add credential, API-review, versioning, and retry complexity before the publishing cadence proves that work is necessary.
Evidence: Substack documents RSS archive import and manual copy-and-paste, not an ongoing post-creation API. LinkedIn's Posts API requires OAuth permissions and versioned requests. X charges for API writes. Buffer supports LinkedIn, X, and other networks through one API and can retain API-created posts as drafts awaiting approval.
Use next time: Start new social channels in the shared approval calendar. Keep credentials out of the public repository and browser, require explicit confirmation for Writer actions, and suppress automatic external effects on workflow reruns.


## 2026-07-18 - Primary content belongs in primary navigation

Context: Field Notes appeared as a special header button beside Contact while the rest of the site destinations lived in the primary navigation. On mobile, that split forced the navigation onto a second full-height row and obscured the intended content hierarchy.
Learning: Put the site’s main reader destination first in the semantic primary navigation. Reserve header actions for utilities, and keep mobile navigation in one horizontally scrollable row so 44-pixel targets do not require a second tier. When links overflow, retain a visible native scroll affordance.
Evidence: The rendered header now leads with Field Notes in the primary nav, removes the duplicate Field Notes action, and keeps branding, visibly scrollable navigation, Contact, and the theme control on one mobile row. A build regression test asserts the nav order.
Use next time: Start hierarchy changes from the semantic link order, then let the mobile layout preserve that order without duplicating destinations as calls to action.


## 2026-07-17 - Navigation and card affordances need structural regression tests

Context: A homepage hierarchy pass removed Resume from the primary header and left Talks out, while collection rows made only the title clickable even though their image and summary looked like one interactive result.
Learning: Global navigation destinations and card-sized interaction targets are product behavior, not styling details. Test the rendered primary nav and require a single semantic anchor to wrap every clickable result so pointer, keyboard, and analytics behavior stay aligned.
Evidence: Portfolio build tests now assert Work, Talks, and Resume in the primary nav, verify that writing and talk row anchors contain the image, title, summary, and metadata, and confirm that bodyless work cards honor their declared internal destination.
Use next time: When restructuring the header or collection layouts, update hierarchy without deleting established destinations, and verify both the complete rendered anchor boundary and its final `href` before accepting the visual change.


## 2026-07-17 - Pin every portfolio GCP command to its authorized project

Context: The local gcloud default can point at an unrelated Google Cloud project even when the repository's deployment variables correctly name the portfolio project.
Learning: This repository is authorized to use only `geojson-bq-blog`. Every command must pass that exact project explicitly; never infer authority from the active gcloud configuration and never use `gmp-demos-ryanbaumann` here.
Evidence: Ryan explicitly confirmed the project boundary. The deploy preflight now fails unless `GCP_PROJECT_ID` equals `geojson-bq-blog`, and the repository and domain-migration instructions record the same guardrail.
Use next time: Before any Google Cloud read or write, resolve the target from repository configuration, confirm it is exactly `geojson-bq-blog`, and include `--project geojson-bq-blog` or a validated equivalent in the command.


## 2026-07-17 - A domain cutover includes generated binaries and dependent origins

Context: Replacing canonical URL strings did not update domain text already rasterized into social-card JPEGs, and the Lab metadata still pointed at removed PNG variants. The deploy smoke also moved to the new host before DNS was ready, while writer OAuth retained a host-bound old origin.
Learning: Prepare the code first, map and certify the new host against the current service, then deploy the canonical change. Regenerate binary assets, validate absolute metadata assets, and migrate every host-bound integration such as OAuth callbacks and cookies in the same cutover.
Evidence: Social cards were regenerated with `ryanbaumann.dev`; Lab metadata now resolves to JPEGs; production smoke checks redirects, feed, sitemap, canonicals, and social assets; the domain runbook orders DNS before the cutover deploy and includes writer OAuth.
Use next time: Treat a domain move as a dependency inventory, not a string replacement. Check generated text in images, absolute asset URLs, deployment health targets, OAuth origins, email senders, analytics, API referrers, and search ownership before changing DNS.


## 2026-07-27 - Secret scans must distinguish identifiers from values

Context: Production smoke rejected the Real World Reasoning browser bundle
because the public Gemini SDK contains the OAuth schema identifier
`client_secret`, even though no credential value was present.
Learning: A browser secret scan should match a credential-shaped assignment,
not a field name alone. Keep the rule aligned across local and production smoke
and cover both the allowed schema identifier and a denied long value.
Evidence: `findServerSecretMarker()` accepts the SDK's
`oauth2:client_credentials` schema text and rejects an assigned long
`client_secret` fixture; the focused production-smoke test passes.
Use next time: When a dependency adds an authentication schema, inspect the
matched bytes before excluding the asset or weakening the scan.

## 2026-07-27 - Production smoke must reach metadata gates after config gates

Context: Two deploys built and routed healthy Cloud Run revisions but stopped
at the runtime-variable check because `GEMINI_API_KEY` was not attached. Once
the existing secret was attached, the next production smoke exposed a missing
canonical URL on the newly imported Real World Reasoning page.
Learning: Runtime configuration and rendered metadata are separate deployment
boundaries. Clear configuration blockers before calling a release verified,
then run the complete production smoke against the service URL so later gates
are not hidden behind an earlier failure.
Evidence: Cloud Run revision `fieldwork-00099-c2z` serves with
`GEMINI_API_KEY` attached, and `demos/real-world-reasoning-agent/index.html`
now owns one canonical and matching Open Graph URL.
Use next time: For a new hosted demo, verify required runtime variable names
before the paid build and verify its canonical URL in built HTML before merge.

## 2026-07-27 - Compile the deployable graph once per CI event

Context: Pull-request CI built each app in its package job, rebuilt every app
for a staged gateway smoke test, then rebuilt them again inside Docker. A
main-branch push repeated the Docker verification immediately before Cloud
Build produced the production image.
Learning: Keep fast package lint and unit tests isolated, but use the deployable
container as the single full compilation and smoke boundary on pull requests.
On main, let the production build own that boundary. Since Cloud Build workers
are ephemeral, explicitly pull the last successful image and export inline
BuildKit cache metadata. Before removing or renaming a CI job, inspect branch
protection's required contexts; preserve any required name as a cheap dependent
gate until the protection rule is deliberately migrated.
Evidence: `.github/workflows/ci.yml` removes the duplicate staged build and
per-package build step, gates Docker verification to pull requests, and keeps
the legacy required smoke context without a second compilation.
`cloudbuild.yaml` pulls, consumes, and refreshes the `build-cache` image.
Use next time: Before adding a build job, map which existing job already proves
compilation, packaging, or runtime liveness and add only missing evidence.

## 2026-07-17 - Distribution and privacy copy must match the deployed data path

Context: The live site loaded privacy-preserving GA4 analytics by default while the Privacy page described an opt-in control, and the email implementation still used Resend's retired Audience API.
Learning: Treat the owned site and email provider as the canonical publishing and subscriber systems, and treat social/newsletter platforms as attributed distribution channels. Privacy copy must describe actual runtime behavior. Campaign values should be narrowly allowlisted before analytics receives them, and provider integrations must be checked against current first-party API documentation rather than inherited terminology.
Evidence: The portfolio now loads GA4 only on the canonical host, sends only bounded `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content` values, records confirmed sign-ups, and discloses default-on analytics. `/api/subscribe` now writes Contacts with a dedicated Resend Segment and Topic; gateway and portfolio suites pass.
Use next time: Audit runtime, public disclosure, setup docs, and provider API vocabulary together whenever analytics or subscriptions change. Never infer email consent from a social follow or connection.


## 2026-07-17 - Optimize social previews and sitemaps for AEO/SEO

Context: Large OpenGraph image assets (>1MB PNGs) delay scrapers and AI search engines, and hero image lazy-loading slows Largest Contentful Paint (LCP) performance.
Learning: Shift social card generation from PNG to highly compressed JPEGs (~100KB, quality 70) and mandate JPEG format under 200KB in the review guidelines. Set above-the-fold hero images to eager loading to prevent LCP layout shifts. Additionally, inject `<image:image>` tags into `sitemap.xml` for visual indexing, and configure apple-touch-icon/thumbnail fallbacks in layout headers for answer engines.
Evidence: `scripts/social-cards.mjs` modified to screenshot JPEG type with quality 70, sitemapXml in `portfolio/build.mjs` enhanced with visual metadata schema, and `.agents/skills/portfolio-review/SKILL.md` updated with compression limits. All social images compressed and sitemap generated.
Use next time: Always generate visual social metadata as compressed JPEGs (under 200KB) and configure eager loading for hero images above the fold. Ensure sitemap and header metadata expose visual assets explicitly for answer engine crawlers.


## 2026-07-17 - `node --test <dir>/` stopped accepting a bare directory argument

Context: `portfolio/package.json` ran its suite with `node --test test/`, which passed on the Node 22 minors CI had been using.
Learning: On Node v22.22, `node --test test/` fails with `Cannot find module .../test` — the runner resolves the bare directory as an entry module instead of a test pattern. An explicit glob (`node --test test/*.test.mjs`) behaves identically on old and new minors.
Evidence: The same checkout, same suite: directory form exits 1 with `MODULE_NOT_FOUND`; glob form runs all 23 tests green.
Use next time: Point `--test` at explicit glob patterns, not a bare directory, anywhere a Node minor bump can land before the script is revisited.


## 2026-07-17 - Reader features should reuse the boundaries the site already has

Context: Adding an email list and post comments could easily have meant a database, an auth system, and a moderation surface — none of which this zero-dependency container wants.
Learning: Route new reader features through boundaries that already exist. Subscriptions became one gateway route into the Resend account the contact form already uses (audience membership here, sends composed as dashboard broadcasts); comments became GitHub Discussions rendered by giscus, config-gated in `site.json` so the build stays script-free until the IDs are deliberately filled in.
Evidence: `/api/subscribe` in `gateway/server.js` (honeypot + rate limit + keyless 503, mirroring `/api/contact`), `commentsSection`/`subscribeSection` in `portfolio/build.mjs`, setup runbook in `docs/EMAIL_LIST_AND_COMMENTS.md`.
Use next time: Before adding a stateful feature, check whether an existing provider account, the gateway's route patterns, or GitHub itself can hold the state; wire the feature to fail closed (inert markup, JSON/HTML 503) when its configuration is absent.


## 2026-07-17 - Answer Engine Optimization (AEO) and Standardizing Open Graph Images

Context: Auditing the portfolio for Search Engine Optimization (SEO) and Answer Engine Optimization (AEO) best practices, and checking social thumbnail dimensions.
Learning: AEO prioritizes visible DOM elements over raw metadata (e.g., `<meta>` tags and JSON-LD). Rendering summaries in the visible body text (like a `.lede` paragraph right under the headline) dramatically improves discoverability for AI models (like Perplexity or Google AI Overviews). Additionally, the standard for Open Graph images is 1200x630 pixels. Expanding the build script's image validation to accept both 1200x627 and 1200x630 allows a smooth migration to standard sizes without breaking the build on existing 1200x627 assets.
Evidence: Modified `portfolio/build.mjs` to render `meta.summary` in a `<p class="lede">` paragraph for detail pages and standalone pages, and updated image validation on lines 122 and 213. Ran `node build.mjs` and the smoke tests (`node scripts/smoke.mjs`), which successfully passed.
Use next time: Always render summary metadata visibly in the DOM to assist AI engine indexers. When updating layout/image validation standards, support legacy sizes concurrently to prevent build blockages during migration.


## 2026-07-16 - Let the resident agent adapt portable prompts

Context: Agent harnesses use different global instruction files, skill directories, import mechanisms, and reload behavior. A dedicated cross-harness installer duplicated knowledge that the resident coding agent can inspect directly.
Learning: Keep one vendor-neutral prompt as the source of truth and publish a bounded self-install task packet. Tell the resident agent the desired end state, preservation rules, prohibited configuration changes, and verification evidence. Let it choose the current native mechanism for its environment.
Evidence: `agent-scripts/coding-agent-loop/README.md` now gives users one copyable install request. The role files state when they apply and that they narrow rather than expand authority.
Use next time: Prefer a self-install instruction over adapter code when the target is another capable agent and installation is a small, inspectable configuration task. Add tooling only after repeated installation failures show that deterministic automation is needed.


## 2026-07-16 - Private release previews need an identity boundary

Context: A shared dashboard password cannot satisfy an account-specific review workflow or provide a useful audit boundary for release decisions.
Learning: Protect the release dashboard with Google OAuth, restrict the accepted verified email server-side, use an exact HTTPS callback origin, and keep GitHub write credentials only in the gateway. The browser may render drafts but never receives a GitHub token.
Evidence: `gateway/lib/googleAuth.js` exchanges the authorization code server-side, asks Google to validate the ID token, checks the allowed email, and signs a short-lived HttpOnly session.
Use next time: Register the exact callback URL before deployment and keep any future coding-agent feedback integration behind the same authenticated gateway boundary.


## 2026-07-16 - Review requests need an explicit handoff

Context: A direct edit box and publish controls do not show an author what happens between a draft and release.
Learning: Make the review handoff visible in the dashboard: save the concrete draft first, collect a short author note, and create one review request that names the exact file, branch, and the writing, review, and design skills the agent must use. Keep the review token scoped to Issues, separate from the Contents token.
Evidence: `requestWritingReview` opens a GitHub issue with those review lanes, and the writer dashboard links back to the issue after submission.
Use next time: Do not let a review request silently publish, edit, or skip the rendered preview. Require an explicit follow-up action for each of those transitions.


## 2026-07-16 - Agent instructions and executable scripts need separate namespaces

Context: The repository already used `scripts/` for executable build and maintenance programs, while a growing collection of copyable agent prompts also needed a memorable GitHub home.
Learning: Store prompts, role contracts, and behavioral evals under `agent-scripts/`, with one self-contained folder per artifact. Keep the canonical prompt in that package and use `portfolio/content/scripts/` only for the reader-facing summary and source links. This makes the trust boundary visible and avoids maintaining two prompt copies.
Evidence: `agent-scripts/coding-agent-loop/` contains the canonical prompt, role overlays, README, and current 17-case specification; `portfolio/content/scripts/loop-engineering-coding-agent.md` links to those files and the build publishes `/scripts/`.
Use next time: Copy `agent-scripts/_TEMPLATE/`, add eval cases before tuning behavior, then add one portfolio summary entry. Never put prompt text in the executable `scripts/` tree or duplicate the canonical prompt in CMS prose.


## 2026-07-16 - Copy taste: metrics, third-party tools, and humble voice

Context: Reviewed copy and claims across the site with Ryan. Prior guidance said
"metrics are the spine, use the number," which pushed precise internal
current-employer growth figures (300% users, ~200% API engagement) onto public
pages.
Learning: This is a personal dev brand, not an employer marketing page. Three
taste rules emerged. (1) Metrics: real numbers are fine for public/verifiable
stats (npm downloads), prior-company results, and aged or long-public
current-employer work; recent internal current-employer usage or growth figures
read as internal and sales-pitchy, so use qualitative, understated framing
instead. (2) Third-party tools: name first-party surfaces (AI Studio), never
enumerate competitor AI products (name-brand IDEs, assistants, agent apps), which
reads like tool-shopping or looking for work elsewhere. (3) Voice: default to
"Our team built… I led the strategy and stayed close to the work," crediting
cross-functional partners, without diluting genuinely individual work.
Evidence: Session with Ryan; changes folded into `portfolio-writing`,
`portfolio-review`, and `docs/PORTFOLIO_EVIDENCE_LEDGER.md`.
Use next time: Follow the updated skills and ledger. Keep HITL artifacts (PR and
commit messages) high-level; do not expose internal specifics.


## 2026-07-15 - Initial Release

Context: Preparing the repository for its initial public release.
Learning: Compressed the prior learnings log for the initial public launch to keep history clean.
Evidence: Initial commit of the public repository.
Use next time: Document future durable lessons here using this format.
