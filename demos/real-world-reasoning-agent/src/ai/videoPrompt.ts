/**
 * Pure motion-direction prompts for the Gemini omni video-gen seam
 * (src/ai/video.ts). Kept factual and concise — the model is seeded with a real
 * Street View still, so these only steer camera motion and mood, never invent
 * content. No UI or SDK coupling; unit-tested under the node project.
 */

/** Cinematic aerial/establishing flythrough of a named place (Cinema tour). */
export function buildTourVideoPrompt(name: string): string {
  return (
    `A short cinematic aerial establishing shot of ${name}. ` +
    `Slow dolly push-in, gentle forward motion, golden-hour light. ` +
    `Keep it grounded and photoreal — no text, no captions, a few seconds long.`
  );
}

/** Ground-level establishing walkthrough approaching a named site (Scout). */
export function buildWalkthroughPrompt(label: string): string {
  return (
    `A short ground-level establishing walkthrough clip of ${label}. ` +
    `Slow steady walk approaching the storefront frontage, eye-level camera, natural daylight. ` +
    `Keep it grounded and photoreal — no text, no captions, a few seconds long.`
  );
}
