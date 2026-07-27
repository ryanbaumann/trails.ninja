# Future work

## Product

- Add a two-result comparison view for choosing between saved looks.
- Offer an optional PDF export for the salon brief.
- Add an explicit opt-in option to remember a Gemini key for the browser session. The default must remain memory-only.

## Accessibility

- Add automated axe coverage for the upload, style, result, history, and salon-brief states.
- Add a focused keyboard regression for the style-link popover and history deletion.

## Operations

- Replace the single-instance in-memory limiter with a shared store before raising Cloud Run's `--max-instances` setting above one.
- Add an optional live canary outside pull-request CI for quota-bearing Gemini requests.

## Code health

- Add ESLint with React Hooks and JSX accessibility rules.
- Add a service worker only if offline installability proves useful enough to justify the cache lifecycle.
