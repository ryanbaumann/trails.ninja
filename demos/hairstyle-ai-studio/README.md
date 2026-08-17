# Hairstyle AI Studio

Try a haircut before committing at the salon. Upload a front photo, choose a style or describe one, then generate and refine a private, on-device history of looks.

The canonical source now lives in
[ryanbaumann/fieldwork](https://github.com/ryanbaumann/fieldwork/tree/main/demos/hairstyle-ai-studio).
It was imported from the former `ryanbaumann/hairstyle-ai-studio` repository at
commit `9ea2c0f31e5e1d252220ede6731b655bf2fb8fba`.

## What changed for Fieldwork

- The React, Vite, Tailwind, local-history, result, refinement, and salon-brief flows remain app-local.
- The standalone Express server and Docker image were removed. Fieldwork's zero-dependency gateway owns `/api/hairstyle-ai-studio/*`.
- The shared server key provides five successful image generations per client IP per UTC day. Recommendation analysis does not consume that allowance.
- Visitors can connect a personal Gemini API key after the shared allowance is exhausted or at any time. The proxy validates it without generating content; the browser keeps it only in React memory and sends it in a transient same-origin request header.
- Personal-key calls bypass the shared spend cap but retain a generous per-IP abuse guard. The gateway never stores, logs, returns, or analyzes a visitor key.
- The gateway validates image data, caps request size and prompt length, requires same-origin browser mutations, and separates shared allowance, visitor-key quota, and site-abuse errors.
- Google Analytics uses Fieldwork's privacy-limited shared loader. Events contain only enumerated funnel states, never keys, photos, prompts, style URLs, filenames, IDs, or raw errors.

## Models

| Task | Model |
| --- | --- |
| Optional, user-triggered style recommendation | `gemini-3.7-flash` (low thinking) |
| Image generation and refinement | `gemini-3.1-flash-lite-image` |

The newer Flash text models do not generate images, so image work stays on the current image-capable model. Titles are derived locally to keep a normal makeover to one model call.

## Local development

From the app directory:

```bash
npm install
npm run dev
```

Run the Fieldwork gateway from the repository root in a second terminal:

```bash
node gateway/server.js
```

Vite forwards `/api/*` to `http://localhost:8080` by default. Override that with `PROXY_TARGET` if needed.

## Verify

```bash
npm run typecheck
npm test
npm run build
```

Gateway behavior and rate limits are tested from `gateway/test/hairstyleAi.test.js` and `gateway/test/rateLimit.test.js`.

## Privacy

Photos are sent to Google Gemini only after the visitor explicitly requests a recommendation, generation, or refinement. Fieldwork does not store those photos on the server. The shared allowance keeps an in-memory daily generation count keyed by client IP; a service restart can reset it early. Generated history is stored in the browser's IndexedDB and can be deleted from the app.

## License

MIT. See [LICENSE](LICENSE).
