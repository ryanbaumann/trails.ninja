/**
 * Image — a bound/literal URL, gated by `isAllowedImageUrl`. Resolves through
 * the session image registry first so `img:<id>` refs (from generated
 * creatives or inspected Street View frames) work transparently. A present URL
 * that fails the guard or fails to load renders a recoverable error state with
 * Retry; a missing/unresolved URL renders nothing (structural).
 */
import { useState, type FC } from 'react';
import type { ComponentNode, Dynamic } from '../protocol';
import { resolveDisplayText, resolveMediaRef } from '../protocol';
import type { SurfaceState } from '../store';
import { isImageRef, useImage } from '../images';
import { isAllowedImageUrl } from './imageGuard';
import { MediaError } from './MediaState';

export const Image: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({ node, surface, scope }) => {
  // resolveMediaRef so a mustache `{url}` token inside a List template resolves
  // against the item scope (models emit that form), not just {"path":...} bindings.
  const rawUrl = resolveMediaRef(node.url as Dynamic<string> | undefined, surface.dataModel, scope);
  // useImage (called unconditionally) so a reserved ref filled later renders live.
  const resolvedRef = useImage(typeof rawUrl === 'string' ? rawUrl : undefined);
  // Route alt through resolveDisplayText so {path} tokens interpolate and any
  // unresolved token is dropped rather than leaking raw braces.
  const alt = resolveDisplayText(node.alt as Dynamic<unknown> | undefined, surface.dataModel, scope);
  // Default to non-cropping `contain`; only crop when the caller explicitly asks.
  const fit = node.fit === 'cover' ? 'cover' : 'contain';
  const aspect = typeof node.aspect === 'string' ? node.aspect : undefined;

  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  if (typeof rawUrl !== 'string') return null;
  const resolved = resolvedRef ?? rawUrl;
  // A reserved `img:` ref not yet filled — nothing to show yet; it renders live
  // once setImage lands (structural, not an error).
  if (isImageRef(resolved)) return null;

  if (!isAllowedImageUrl(resolved) || failed) {
    return (
      <MediaError
        label="Couldn't load the image."
        onRetry={() => {
          setFailed(false);
          setReloadKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <img
      key={reloadKey}
      src={resolved}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: '100%', display: 'block', objectFit: fit, aspectRatio: aspect, borderRadius: 'var(--r-sm)' }}
    />
  );
};
