/**
 * Deterministic A2UI walkthrough-video surface for Scout's `walkthrough_video`.
 *
 * The clip is generated server-side (Gemini omni, seeded on the winner's Street
 * View evidence frame) and stashed in the session image registry, so we build
 * the surface ourselves with a plain ref binding — mirroring compareSurface.ts —
 * rather than letting the model hand-author a `<video>` with a bad URL.
 */
import type { A2uiMessage, ComponentNode } from '@/genui/protocol';
import { ATLAS_CATALOG_ID } from '@/genui/protocol';

let seq = 0;

export interface BuiltWalkthroughSurface {
  surfaceId: string;
  messages: A2uiMessage[];
}

/** Build the A2UI messages for a generated walkthrough clip bound to a registry ref. */
export function buildWalkthroughVideoSurface(input: { label: string; videoRef: string }): BuiltWalkthroughSurface {
  const surfaceId = `scout-walkthrough-${++seq}`;

  const components: ComponentNode[] = [
    { id: 'root', component: 'Column', children: ['wt-hdr', 'wt-cap', 'wt-video'] },
    { id: 'wt-hdr', component: 'Text', variant: 'h3', text: `Walkthrough — ${input.label}` },
    {
      id: 'wt-cap',
      component: 'Text',
      variant: 'caption',
      text: 'A short establishing clip generated from the winning site’s Street View evidence.',
    },
    { id: 'wt-video', component: 'Video', url: input.videoRef },
  ];

  const messages: A2uiMessage[] = [
    { version: 'v0.9', createSurface: { surfaceId, catalogId: ATLAS_CATALOG_ID } },
    { version: 'v0.9', updateComponents: { surfaceId, components } },
  ];

  return { surfaceId, messages };
}
