# AI Saves the Hour: visual sources

These visuals are deterministic SVG compositions built from the article's verified facts and rendered with the site's system-font, warm-paper, charcoal, and blue visual language. No generative image model was used. Both inline SVGs carry a `prefers-color-scheme` block and were checked in light and dark.

## Header

- Source: `portfolio/static/img/writing/ai-jagged-frontier.svg`
- Size: 1200×675
- Job: show that the same tool helped inside the frontier and hurt just outside it, and that the boundary is unmarked.
- Inputs: the preregistered 758-consultant BCG field experiment (Dell'Acqua et al., *Organization Science*), where GPT-4 improved speed and quality inside the frontier and degraded performance on a task outside it.

## Inline mechanism

- Source: `portfolio/static/img/writing/ai-saved-hour-spend.svg`
- Size: 1200×675
- Job: show the leadership decision that follows an AI productivity gain, and that only one branch requires a decision.
- Inputs: the essay's contrast between converting saved time into requested output and reinvesting it in customers, harder problems, direct feedback, and judgment.

## Social card

- Source: `docs/ai-saves-the-hour-social-source.svg`
- Output: `portfolio/static/social/ai-saves-the-hour.jpg`
- Size: 1200×627
- Job: make the default-versus-chosen spend legible at thumbnail size.
- Rendering: Chromium via the repository's existing Playwright dev dependency, JPEG, quality 76. The card source uses flat hex values rather than CSS custom properties because it is rasterized once for the light-mode preview surface.
