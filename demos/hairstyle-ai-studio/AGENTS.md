# AGENTS.md — Hairstyle AI Studio

## Project overview
Hairstyle AI Studio is a React + Vite + TypeScript web app for AI hairstyle visualization using Gemini image models.

## Key files
- `app/services/geminiService.ts`: Gemini calls, prompts, image generation/refinement.
- `gateway/lib/hairstyleAi.js` (repository root): Gemini model names, prompts, validation, and API calls.
- `app/services/geminiModels.ts`: Client-visible layout labels only.
- `app/hooks/useAppFlow.ts`: Flow state, history, generation/refinement actions.
- `app/components/`: upload, style, loading, result, and refinement UI.
- `app/types.ts`: shared app state and generated-image metadata.

## Commands
- `npm install`: install dependencies.
- `npm run dev`: start local Vite server.
- `npm run typecheck`: TypeScript validation.
- `npm run build`: production build.
- `npm run check`: typecheck, tests, and build.

## Gemini model policy
Model IDs are server-owned in the repository root's `gateway/lib/hairstyleAi.js`; do not expose or duplicate them in browser code. Use `gemini-3.7-flash` (with low thinking) for the explicit opt-in style recommendation and `gemini-3.1-flash-lite-image` for image generation and refinement. Verify model changes against current official Gemini API documentation.

## Secret handling
- Never add `VITE_GEMINI_API_KEY`; Vite would publish it in the browser bundle.
- The server-side `GEMINI_API_KEY` owns the five-successful-image-generations-per-IP daily allowance. Recommendation analysis does not consume it.
- A user may override the shared key at runtime. Validate the personal key through the non-generating proxy endpoint before activation, keep it only in React memory, and pass it transiently in `X-Gemini-API-Key`.
- A valid personal key bypasses the shared daily spend cap but remains subject to the gateway's separate abuse limiter. Never silently fall back to the shared key when a supplied personal key is malformed or rejected.
- The gateway must never log, store, return, or send either key to analytics.
- Never commit real API keys or screenshots containing keys.

## UX rules
Prioritize a polished mobile-first salon workflow: Upload → Style/layout → Generate → Refine → Share / Save / Salon Brief. Every visible control must change real output (no dead pickers). Avoid blocking `alert()` calls; use inline, recoverable UI.

## Styling
Tailwind is compiled via PostCSS (`tailwind.config.js` + `postcss.config.js`), not the CDN. The full `primary` scale and non-standard slate/gray/red steps live in the config — add any new shade there rather than referencing an undefined class.

## Privacy rules
User face images are sensitive. Clearly explain when images are sent to Gemini, keep browser history local unless server storage is explicitly added, and preserve delete/clear-history affordances.
