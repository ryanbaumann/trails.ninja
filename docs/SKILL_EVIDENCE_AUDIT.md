# Local skill evidence audit

Date: 2026-07-26

This audit reviewed the complete reachable Git history (350 commits), all 45
current `LEARNINGS.md` entries, the unreleased changelog, 46 commits that
touched `.agents/skills/`, the current local skills, and their owning code and
tests. History supplied candidates, not instructions. Current code, tests, and
authoritative documentation decided whether each candidate was still valid.

## Behavioral baseline and candidate

The frozen scenario set covered responsive map layout, interaction-state
distinction, scheduled publication, Places UI Kit theming/CSP, 3D marker
composition, repository-wide learning audits, dynamic-skill portability,
security metadata, browser/CSP diagnosis, and external-skill ownership.

- Harness: `codex exec --ephemeral --sandbox read-only --json`
- Sources: the same six named `SKILL.md` files; `LEARNINGS.md` and
  `CHANGELOG.md` were explicitly excluded from the evaluator
- Baseline revision: `c42c6f8`
- Candidate: working-tree skill revisions from this audit
- Tool configuration: identical invocations, read-only filesystem access
- Model configuration: the Codex CLI default was held constant but the CLI did
  not surface its model identifier
- Variance: one baseline and one candidate run; repeat variance was not
  measured, so the deterministic cases remain the durable regression gate

The candidate closed every explicit baseline omission:

- D1 distinguished hover from keyboard focus in joint state review.
- D2 added `svh`/`dvh`, safe areas, 44px hit areas, panel scrolling, and
  gesture boundaries.
- D3 required reuse or pinned parity with the canonical publication predicate.
- D4 named the Places UI Kit theme boundary and source-derived CSP checks.
- D5 named the supported 3D marker slot and collision/size/occlusion controls.
- D6 supported a comprehensive evidence inventory without broad prompt growth.
- H3 added the no-CSP control and direct-GET comparison before policy changes.

The held-out portability and safety behaviors H1, H2, and H4 remained intact:
do not vendor dynamically fetched Maps sub-skills, do not derive CSP from
display metadata, and do not put repository operations into a portable
external skill without an evaluation.

An independent read-only diff review found two deterministic-gate defects after
the candidate pass: all-selection suites were accepted, and a `null` eval entry
threw instead of returning a finding. Both received regression tests; the gate
now requires development and selection coverage and rejects non-object entries
without aborting the repository-wide scan.

## Learning dispositions

| Learning candidate | Evidence checked | Disposition |
| --- | --- | --- |
| Skill changes need a held-out gate | Existing loop skill, agent-script cases, new validator tests | Promoted: eval split/schema validation and repository-audit protocol |
| Places UI Kit theme and CSP image origins | Isochrones CSS/tests, gateway tests, current Places reference | Promoted: Maps integration check and eval |
| Maps renderer CSP and follow-camera identity | Gateway/smoke tests, follow-camera code | CSP promoted to Maps check; array-identity fact stays app code/test |
| 3D marker slot and collision defaults | Current Code Assist reference, Strava code/tests | Promoted: Maps CF12 and selection eval |
| CSP must enumerate actual origins | Gateway source, smoke regression | Promoted: Maps repository integration check |
| Platform-default comments are claims | Deploy workflow and gateway comment | Already enforced in deployment/config; keep in learning log |
| Security cannot depend on display metadata | `apps.json` validator and gateway tests | Promoted as a Maps repository check; enforcement remains primary |
| Chromium third-party reachability is ambiguous | No-CSP browser control and direct GET | Promoted: portfolio-review diagnostic and eval |
| Hover must remain distinct from focus | Rendered audit and current CSS | Promoted: frontend/design skills and evals |
| Mechanical prose rules belong in a checker | `check:content` and its fixtures | Already encoded in portfolio-review and tests |
| Publication predicates drift | Build, social-draft, and scheduled-publish parity tests | Promoted: portfolio-content rule and eval |
| Do not vendor dynamically fetched skills | Live GMP index and removed local mirrors | Promoted: repository-audit protocol; no sub-skills vendored |
| Voice examples become boilerplate | Corpus repetition check and writing skill | Already encoded in portfolio-writing |
| Embedded SVGs need host `color-scheme` | Current CSS and build tests | Promoted: portfolio-design and eval |
| Keep the local skill set focused | Current nine-skill inventory | Promoted as a no-duplicate/no-vendoring audit rule |
| Field Note copy and bespoke image taste | Writing/design skills and content checker | Already encoded |
| Playwright browser shadow in remote sandboxes | Historical environment-specific recovery | Keep in learning log; too environment-specific for a skill |
| Domain mapping replacement can interrupt TLS | Migration runbook | Keep in deployment documentation |
| Parallel-service compatibility boundaries | Smoke configuration and migration docs | Already enforced/documented |
| Brand migrations need compatibility gates | Domain/Fieldwork runbooks and smoke tests | Already enforced/documented |
| Mobile navigation should prioritize | Current portfolio-design navigation contract/tests | Already encoded |
| Collection CTAs need the correct owner | Build tests and current content links | Already enforced |
| Heatmap selectors use API map type IDs | AQI implementation/tests and live Maps routing | Already enforced; dynamic GMP sources own API detail |
| Browser/server Maps keys need separate restrictions | Architecture/docs and gateway boundary | Already encoded in repository instructions and Maps key guidance |
| Tile URL generation is not tile-load proof | AQI tests and browser verification rules | Already encoded in frontend/review evidence requirements |
| Gitleaks Action licensing | CI workflow state | Keep in CI history; not a local-skill behavior |
| Portable tar behavior | Lab scripts/tests | Keep in tests/docs; not a local-skill behavior |
| Curiosity should correct a real assumption | Writing calibration | Already encoded semantically; no new prompt phrase added |
| Social automation stops at editable drafts | Social staging code/tests and writing skill | Already enforced |
| Separate content, orchestration, and approval | Writer/social workflow and content skill | Already encoded/enforced |
| Primary content belongs in navigation | Portfolio-design contract and build tests | Already encoded |
| Navigation/card affordances need structural tests | Portfolio build tests | Already enforced |
| Pin every GCP command to the authorized project | `AGENTS.md` and deploy guards | Already encoded at repository authority level |
| Domain cutover includes binaries and dependent origins | Migration runbook and production smoke | Keep in docs/tests |
| Privacy copy must match runtime | Design skill, privacy page, gateway/build tests | Already encoded |
| Optimize social previews and sitemap images | Build validation and review/design skills | Already encoded/enforced |
| Use explicit Node test globs | Package scripts | Already enforced; no skill duplication |
| Reader features reuse existing boundaries | Gateway/design architecture | Already encoded/documented |
| AEO needs visible summaries and compatible OG sizes | Build and review skill | Already enforced |
| Let resident agents adapt portable prompts | Agent-script README/roles | Keep with portable agent-script package |
| Private previews need an identity boundary | Gateway auth code/tests and writer docs | Already enforced |
| Review requests need explicit handoff | Writer workflow and portfolio-review skill | Already encoded/enforced |
| Agent instructions and executables need separate namespaces | Repository layout and `AGENTS.md` | Already encoded |
| Metric, tool-name, and humble-voice taste | Writing/review skills and evidence ledger | Already encoded |
| Initial release compression | Historical marker only | No behavior to promote |

## Older Git-history clusters

The pre-release history adds three useful clusters beyond the current learning
log:

- Responsive demo fixes established dynamic mobile viewport, safe-area,
  touch-target, bottom-sheet, and reduced-motion requirements. These are now in
  `frontend-responsive-design`.
- Portfolio image and theme fixes established exact intrinsic dimensions,
  `height: auto`, honest imagery, and explicit host color schemes. The first
  three were already in `portfolio-design`; host `color-scheme` was added.
- June 2026 Maps 3D commits contain contradictory `pin.element` versus direct
  `PinElement` fixes across release channels. Those historical implementations
  were rejected as stale. Only the current official slot/collision contract
  and current application tests were promoted.

Older dependency bumps, UI experiments later reverted, and app-specific
animation tuning were not agent-skill behaviors.

## Skill-level outcome

- Changed: `frontend-responsive-design`, `google-maps-platform`,
  `portfolio-content`, `portfolio-design`, `portfolio-review`, and
  `skill-improvement-loop`.
- No change: `portfolio-writing` and `portfolio-presenting`, because the
  relevant durable evidence was already encoded.
- No change: `infographic-agent`, because it is an externally maintained pinned
  skill and this audit found no locally verified behavioral gap that justified
  a fork.

Invalidate this audit when the publication predicate, gateway CSP model, Maps
3D marker API, Places UI Kit resource origins, portfolio theme mechanism, or
the local skill set changes materially.
