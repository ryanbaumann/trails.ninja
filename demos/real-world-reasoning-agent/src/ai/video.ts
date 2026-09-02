/**
 * Gemini "omni" video generation — image→video.
 *
 * `gemini-omni-1.1-flash-preview` (MODELS.omni) is a VIDEO generation model driven
 * through the @google/genai Interactions API (`ai.interactions.create`), NOT the
 * `generateContent` path the rest of the app uses, and NOT an image-grounding
 * model. It powers the Cinema "generate a video of this tour" and Scout
 * "walkthrough video of the winning site" surfaces.
 *
 * Gating: inert unless VIDEO_GEN_ENABLED (VITE_VIDEO_GEN_ENABLED=true) AND the
 * deployer adds MODELS.omni to the server allowlist (GENAI_EXTRA_MODELS) — the
 * /ai proxy 403s any model not on that list. Calling it while disabled throws.
 *
 * Transport: `ai.interactions.create` POSTs to `/{version}/interactions` (not
 * `models/<id>:generateContent`), so the /ai proxy has a dedicated interactions
 * branch that pins the host and enforces the same model allowlist by inspecting
 * the request body's `model` field (see server/index.mjs). The response's
 * SDK-added `output_video` block carries the base64 MP4.
 */
import { genai } from './client';
import { MODELS, VIDEO_GEN_ENABLED } from '@/lib/config';
import { useAtlas } from '@/state/store';

export interface VideoGenInput {
  /** Base64-encoded seed frame (no data: prefix), e.g. a Street View still. */
  imageBase64: string;
  imageMimeType?: string;
  /** Motion / scene direction, e.g. "slow dolly-in along the storefront at golden hour". */
  prompt: string;
  /** image_to_video (default) uses the frame as the first frame; reference_to_video uses it as a subject reference. */
  task?: 'image_to_video' | 'reference_to_video';
}

export interface VideoGenResult {
  /** data: URL for the generated MP4, ready to drop into a <video src>. */
  dataUrl: string;
  mimeType: string;
}

/**
 * Generate a short video from a seed frame + prompt via the omni model. Throws
 * if the feature is disabled or the SDK doesn't expose the Interactions API.
 * Never call from a hot UI path without a loading/opt-in affordance — omni
 * video generation is slow and billable.
 */
export async function generateVideo(input: VideoGenInput): Promise<VideoGenResult> {
  if (!VIDEO_GEN_ENABLED) {
    throw new Error(
      'Video generation is disabled. Set VITE_VIDEO_GEN_ENABLED=true and add ' +
        `"${MODELS.omni}" to the server allowlist (GENAI_EXTRA_MODELS) to enable it.`,
    );
  }

  const ai = genai();
  if (typeof ai.interactions?.create !== 'function') {
    throw new Error('The Interactions API is unavailable in this @google/genai build — cannot run omni video gen.');
  }

  try {
    const res = await ai.interactions.create({
      model: MODELS.omni,
      input: [
        { type: 'image', data: input.imageBase64, mime_type: input.imageMimeType ?? 'image/jpeg' },
        { type: 'text', text: input.prompt },
      ],
      generation_config: { video_config: { task: input.task ?? 'image_to_video' } },
    });

    const data = res.output_video?.data;
    if (!data) throw new Error('omni video gen returned no video payload.');
    const mimeType = res.output_video?.mime_type ?? 'video/mp4';
    return { dataUrl: `data:${mimeType};base64,${data}`, mimeType };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = (err as { status?: unknown } | null)?.status;
    if (status === 429 || /\b429\b|too many requests|rate.?limit|\bbusy\b/i.test(msg)) {
      useAtlas.getState().pushToast('warn', 'Video generation is rate-limited. Add your Gemini API key from AI Studio to continue, or try again later.');
      useAtlas.getState().setKeyDialogOpen(true);
      throw new Error('Video generation is rate-limited. Add your Gemini API key from AI Studio to continue.');
    }
    throw err;
  }
}
