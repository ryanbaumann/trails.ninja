---
name: portfolio-design
description: How Ryan designs. Use before changing style.css, page layouts in build.mjs, or adding any visual element to the site.
---

# How Ryan designs

## Principles

1. **Content-first, bare bones.** The design's job is to make the work legible, then get out of the way. No hero animations, no carousels, no decorative imagery.
2. **Fast is a feature.** CSS is inlined at build time, fonts are the system stack, and client JavaScript is avoided by default. Tiny inline scripts are acceptable for explicit user-controlled color scheme and privacy-limited analytics. When configured, the Google tag loads by default only on the canonical production host. Advertising and personalization signals stay disabled. Page locations exclude query strings, only validated campaign values may be sent separately, and events must never receive form text, identity, OAuth, activity, or location data. Keep every page lean. Any other client script or webfont needs a very good reason. One such reason has been accepted: the giscus comments embed on field notes (`commentsSection` in `build.mjs`) is config-gated in `site.json`, loads lazily, renders only on writing detail pages, and stays out of the writer preview. Do not add further third-party scripts without updating this skill.
3. **Boring is deliberate.** One accent color, one column, generous whitespace. Novelty budget is spent on the writing, not the chrome.
4. **Editorial utility beats portfolio chrome.** Use plain headers and footers, a calm reading column, obvious section labels, and code blocks only when they help a reader do or understand something. The site should feel like a useful developer notebook, not a personal-brand landing page.
5. **Both color schemes, always.** Light and dark are first-class via `prefers-color-scheme` and the token block at the top of `style.css`. Never hardcode a color in a component: add or use a token. Manual `html[data-theme]` overrides must also set the matching `color-scheme`; embedded SVGs loaded through `<img>` evaluate their internal color-scheme media queries from that host value.
6. **Show, don't tell.** Every narrative page carries at least one real image. Real screenshots first (previews, product shots). When no honest screenshot exists, generate an SVG artifact card with `scripts/artifact-cards.mjs`; cards state only facts already in the entry (real commands, real published stats). Never mock a product UI or fabricate a screenshot. Utility flows such as contact, privacy, confirmation, and error pages may omit imagery when it would be decorative.
7. **No aspect ratio distortion or Cumulative Layout Shift (CLS).** Every responsive image must have `height: auto;` in CSS and exact `width` and `height` attributes in the HTML matching the physical image dimensions. For dynamic detail pages, query image dimensions at build time to populate these attributes.
8. **Strict 16:9 Landscape Rule.** All generated infographics, inline images, hero graphics, and social previews must be exactly 16:9 widescreen landscape (e.g., 1200x675). Never use vertical, square, or portrait aspect ratios. Social thumbnails must be cropped exactly to 1200x627.
9. **Diagrams explain one idea with as few words as possible.** Put supporting detail in the body or caption, not as microcopy inside the image. At 1200x675, default to at least 28px for retained labels, no more than two short lines per box, and visible padding on every side. Keep arrows and icons outside text bounds, terminate connectors at box edges with clear space, and never route a line through a label. Render each diagram at its actual desktop and narrow article widths; if essential text cannot remain readable on mobile, simplify the visual or add an explicit full-size/tap affordance.

## Tokens (style.css `:root`)

- `--bg` / `--surface` — warm paper background, card surface.
- `--ink` / `--muted` / `--faint` — three-step text hierarchy. Use `--muted` for summaries, `--faint` for metadata.
- `--line` — all borders and rules.
- `--accent` / `--accent-ink` — one blue, used for eyebrows, hover states, and focus rings only. Never for large fills.
- `--max` (page shell) and `--prose` (reading measure, ~44rem). Long-form text never exceeds `--prose`.

## Components

- **Cards** (`.card`) for work: metadata line, title, one-line summary, tag chips. Hover = border accent + 2px lift, nothing more.
- **Work-card thumbnails** (`.card-thumb`): image-on-top, demoCard-style, using a real screenshot or a generated artifact card.
- **Rows** (`.row`) for writing and talks: title + summary left, venue/type/date right; stacks on mobile.
- **Row thumbnails** (`.row-thumb`): a small image on writing/talks rows, same image rules as work cards.
- **Artifact cards**: generated SVGs (`scripts/artifact-cards.mjs`) for entries with no honest screenshot to show. State only facts already in the entry copy.
- **Eyebrows** (`.eyebrow`) label every section in uppercase accent text.
- **Empty states** (`.empty-state`) are designed, not apologetic: sections ship before their content does (see the writing section).
- **Subscribe** (`.subscribe`) and **Comments** (`.comments`): quiet bordered-top sections at the end of writing pages. The subscribe form is a plain POST to `/api/subscribe` (no client JS); comments are the sanctioned giscus embed described in principle 2. See `docs/EMAIL_LIST_AND_COMMENTS.md`.

## Accessibility

- Semantic landmarks (`header`, `main`, `footer`, `nav` with `aria-label`).
- Keep primary navigation to reader destinations. Resume belongs under About, not in the header. On mobile, keep Fieldwork, Notes, Work, Talks, Labs, About, and the theme control on one non-scrolling line; Contact remains available in the page and footer.
- Treat a section title and its explanatory subhead as one unit: keep their gap compact, then use the larger spacing before cards or the next section.
- `aria-current="page"` on active nav.
- Visible `:focus-visible` ring on everything interactive.
- Render hover, focus, and active together in both schemes. Hover may not reuse
  the focus ring's shape and weight, because the states must stay
  distinguishable.
- `prefers-reduced-motion` kills all transitions.
- Contrast: text tokens must hold ≥4.5:1 against `--bg` in both schemes: check both when touching tokens.

## Review gate

Run the `portfolio-review` skill for every public visual change. Verify file signatures and dimensions rather than trusting extensions, inspect desktop and mobile renders, and use an independent visual reviewer. Check text-box padding, line wrapping, arrow endpoints, and icon clearance in the rendered image, not just the source coordinates. For generated essay visuals, archive the final prompt and settings; the header, social preview, and inline evidence image must have distinct jobs.

## Lessons

A past UI pass added a Google Fonts import, 3D tilt card hovers, gradient hero text, and scroll-reveal animations. None of that matched this skill: system fonts, a simple border-and-lift hover, novelty spent on writing, not chrome. It got pulled back out. Read this skill before touching `style.css` or page layouts. If you want to deviate on purpose, update this skill in the same PR, don't just drift from it.
