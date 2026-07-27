/**
 * Video — a bound/literal URL, gated by `isAllowedVideoUrl`. Resolves through
 * the session image registry first so `img:<id>` refs (from generated omni
 * clips seeded on Street View stills) work transparently. Optional `poster`
 * (also registry-resolved) shows a still frame before playback. A present URL
 * that fails the guard or fails to load renders a recoverable error state with
 * Retry; a missing/unresolved URL renders nothing (structural).
 */
import { useState, type FC } from 'react';
import type { ComponentNode, Dynamic } from '../protocol';
import { resolveMediaRef } from '../protocol';
import type { SurfaceState } from '../store';
import { isImageRef, useImage } from '../images';
import { isAllowedVideoUrl } from './videoGuard';
import { MediaError } from './MediaState';

export const Video: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({ node, surface, scope }) => {
  // resolveMediaRef so mustache `{url}`/`{poster}` tokens inside a List template
  // resolve against the item scope, not just {"path":...} bindings.
  const rawUrl = resolveMediaRef(node.url as Dynamic<string> | undefined, surface.dataModel, scope);
  const rawPoster = resolveMediaRef(node.poster as Dynamic<string> | undefined, surface.dataModel, scope);
  // useImage (called unconditionally, before any early return) so a reserved ref
  // filled later renders live.
  const resolvedUrl = useImage(typeof rawUrl === 'string' ? rawUrl : undefined);
  const resolvedPoster = useImage(typeof rawPoster === 'string' ? rawPoster : undefined);

  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  if (typeof rawUrl !== 'string') return null;
  const resolved = resolvedUrl ?? rawUrl;
  // A reserved `img:` ref not yet filled — nothing to show yet; renders live once
  // setImage lands (structural, not an error).
  if (isImageRef(resolved)) return null;

  if (!isAllowedVideoUrl(resolved) || failed) {
    return (
      <MediaError
        label="Couldn't load the video."
        onRetry={() => {
          setFailed(false);
          setReloadKey((k) => k + 1);
        }}
      />
    );
  }

  const poster = typeof rawPoster === 'string' && !isImageRef(resolvedPoster ?? rawPoster) ? (resolvedPoster ?? rawPoster) : undefined;

  return (
    <video
      key={reloadKey}
      src={resolved}
      poster={poster}
      controls
      playsInline
      onError={() => setFailed(true)}
      style={{ width: '100%', display: 'block', borderRadius: 'var(--r-sm)' }}
    />
  );
};
