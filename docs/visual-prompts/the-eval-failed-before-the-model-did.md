# Visual generation record: The Eval Failed Before the Model Did

Generated: 2026-08-07

The three final assets have separate jobs:

- Header: show a completed training run stopped by a missing-evidence gate.
- Social: make the single thumbnail claim, “loss down does not equal proof.”
- Inline: show the checked-in 10/8/0/4 audit and the mocked evaluator path.

All data points came from the public repository audit. No model was allowed to
invent UI, product behavior, or additional metrics.

## Header

- Final file: `portfolio/static/img/writing/the-eval-failed-before-the-model-did.jpg`
- Generator: built-in Codex image-generation tool; the tool did not expose a
  model identifier.
- Generation mode: new image, no reference image.
- Requested aspect: 16:9.
- Final dimensions: 1200×675.
- Post-processing: center-fit with Pillow LANCZOS; JPEG quality 84, optimized,
  progressive, 4:4:4 subsampling.

Prompt:

```text
Use case: infographic-diagram
Asset type: 1200×675 thesis header for a technical Field Note
Primary request: Create an editorial technical illustration that shows a completed fine-tuning run stopped by an evidence gate. The left side is one restrained terminal-style card for a completed training run. A clean arrow reaches a vertical review gate on the right, where three empty evidence slots block the claim. The image should make the mechanism obvious at a glance: training completed, but the public evidence chain did not.
Scene/backdrop: warm paper #faf9f6 with a barely visible engineering-grid texture.
Style/medium: crisp vector-like editorial diagram, content-first developer notebook, confident and understated. Not a fake product UI, not futuristic.
Composition/framing: exact 16:9 landscape. Left third: terminal card. Center: arrow and visible stop/gate. Right half: three stacked evidence slots and a blocked claim stamp. Strong hierarchy and generous whitespace; all labels mobile-readable.
Text (verbatim, and no other visible text): "TRAINING RUN"; "COMPLETE"; "LOSS 0.028*"; "*learning log only"; "EVIDENCE GATE"; "RAW OUTPUTS MISSING"; "HOLDOUT MISSING"; "GRADER STUB"; "CLAIM BLOCKED".
Color palette: warm paper #faf9f6, near-black #111827, muted gray #6b7280, restrained blue #3b82f6 for the completed run, coral-red #f05252 only for the blocking gate.
Constraints: do not repeat the article title; no logos; no decorative circuitry; no pyramid; no 3D; no glow; no gradient-filled background; no tiny microcopy; no invented metrics; no watermark. Text exact, high contrast, minimum 28px at 1200×675, nothing clipped. Arrows stop at object edges and never cross labels.
```

## Social preview

- Final file: `portfolio/static/img/writing/the-eval-failed-before-the-model-did-social.jpg`
- Generator: built-in Codex image-generation tool; the tool did not expose a
  model identifier.
- Generation mode: new image, no reference image.
- Requested aspect: landscape composed for 1200×627.
- Final dimensions: 1200×627.
- Post-processing: center-fit with Pillow LANCZOS; JPEG quality 78, optimized,
  progressive, 4:4:4 subsampling.

Prompt:

```text
Use case: ads-marketing
Asset type: 1200×627 social preview for a technical Field Note
Primary request: Create a bold, minimal editorial social card about a fine-tuning experiment audit. The only focal idea is that a falling training loss is not proof of task performance.
Scene/backdrop: warm paper #faf9f6, subtle printed-paper grain.
Style/medium: crisp editorial typography and simple vector marks, developer-notebook visual language, honest and restrained rather than hype.
Composition/framing: landscape social-card composition designed to crop exactly to 1200×627. Giant left-to-right equation fills the center. Three compact evidence chips sit along the bottom. Lots of outer padding; no title bar.
Text (verbatim, and no other visible text): "LOSS ↓"; "≠"; "PROOF"; "10 CASES"; "0 HELD-OUT"; "4 HARD-CODED SCORES".
Color palette: warm paper #faf9f6, near-black #111827, restrained blue #3b82f6 for LOSS ↓, coral-red #f05252 for ≠, gray #6b7280 for the evidence chips.
Constraints: spell and punctuate every string exactly; no article title; no logos; no pyramid; no charts; no terminal window; no decorative circuitry; no invented metrics; no watermark; high contrast; all text legible in a small link preview; no clipped text; centered visual balance and generous safe margins for the later 1200×627 crop.
```

## Inline experiment audit

- Final file: `portfolio/static/img/writing/the-eval-failed-experiment-audit.jpg`
- Draft generator: repository `infographic-agent` portable workflow with
  `gemini-3.1-flash-image`, `--no-research`, `--resolution 2K`, `--aspect 16:9`,
  `--yes`, and `--no-open`. The Prepare gate passed 6/6 checks. The installed
  SDK did not expose `image_size`, so the model returned its native resolution.
- Final editor: built-in Codex image-generation tool using the rejected draft
  as an edit target; the tool did not expose a model identifier.
- Context cleanup editor: built-in Codex image-generation tool using the first
  publication candidate as an edit target; the tool did not expose a model
  identifier. This pass removed the source/date footer and its rule so prompt
  context does not appear on the published canvas.
- Final dimensions: 1200×675.
- Post-processing: center-fit with Pillow LANCZOS; JPEG quality 84, optimized,
  progressive, 4:4:4 subsampling.

The first draft was rejected because it leaked prompt scaffolding into the top
of the canvas and clipped the heading. Its exact source text and instructions:

```text
What the public experiment actually contained. Exact evidence from the checked-in repository: 10 cases; 8 training-selected; 0 held-out split; 0 model runs executed by the evaluator; 4 hard-coded scores. The checked-in evaluator literally contains the sequence # Mocking evaluation, pass, # Output mock results. Main takeaway: A loss curve is not task evidence. Source label: Public repository audit · 2026-08-07.

Make one bold forensic evidence story, not a generic pyramid and not a fake product dashboard. Warm paper background #faf9f6, near-black ink #111827, restrained blue #3b82f6, and one coral-red failure accent. Use only these exact visible strings: WHAT THE EXPERIMENT CONTAINED; 10 CASES; 8 TRAINING-SELECTED; 0 HELD-OUT; 0 EXECUTED RUNS; 4 HARD-CODED SCORES; # Mocking evaluation; pass; # Output mock results; A LOSS CURVE IS NOT TASK EVIDENCE; Public repository audit · 2026-08-07. Keep every label at least 28px at a 1200×675 display size. Strong contrast, generous padding, one left-to-right scan, no tiny explanatory copy, no logos, no decorative circuitry, no invented metrics, no watermark.
```

Final edit prompt:

```text
Use case: infographic-diagram
Asset type: 1200×675 inline evidence image for a technical blog post
Input images: Image 1 is the edit target and evidence-layout reference.
Primary request: Redesign the same forensic experiment audit so it is publication-quality and immediately legible on mobile. Preserve the factual values and the useful left-to-right idea, but remove all prompt scaffolding, meta commentary, clipped text, and redundant labels.
Scene/backdrop: warm paper #faf9f6 with very subtle texture.
Style/medium: crisp editorial vector-like data graphic, calm developer-notebook aesthetic, not a fake product dashboard.
Composition/framing: exact 16:9 landscape. One clean left-to-right sequence: a stack labeled 10 CASES with a small split below showing 8 TRAINING-SELECTED and 0 HELD-OUT; then an evaluator card that visibly stops at the code excerpt; then 4 HARD-CODED SCORES. Large takeaway at lower right. Generous outer margin and strong whitespace.
Text (verbatim, and no other visible text): "10 CASES"; "8 TRAINING-SELECTED"; "0 HELD-OUT"; "# Mocking evaluation"; "pass"; "# Output mock results"; "0 EXECUTED RUNS"; "4 HARD-CODED SCORES"; "LOSS ↓ ≠ TASK EVIDENCE"; "Public repository audit · 2026-08-07".
Color palette: near-black #111827, restrained blue #3b82f6, one coral-red failure accent, warm paper background.
Constraints: no title beyond the exact text list; no words such as Composition, architecture, system-flow, direct evidence, actual, checked-in, evaluator model, or model; no clipped text; no tiny copy; retained labels at least 28px at 1200×675; arrows terminate at edges and never cross text; all numeric claims exactly correct; no logos, no decorative circuitry, no 3D, no glow, no watermark.
Avoid: prompt leakage, duplicate metrics, invented values, green success bars, UI chrome, excessive arrows.
```

Final context cleanup prompt:

```text
Edit this existing infographic with the smallest possible change. Preserve the entire illustration, layout, colors, typography, numbers, code snippet, and all factual labels exactly as they are. Remove only the thin horizontal rule at the very bottom and the footer text "Public repository audit · 2026-08-07". Replace that footer area with the same warm off-white paper background and subtle texture so the composition ends cleanly as a standalone graphic. Do not add any new text, captions, prompt language, watermarks, metadata, dates, logos, or decorative elements. Output the edited raster image.
```
