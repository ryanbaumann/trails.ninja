/**
 * Session image registry. Generated creatives and inspected Street View frames
 * are large base64 data URLs; we keep them out of the chat transcript and A2UI
 * data models by storing them here and passing only a short `img:<id>` reference.
 * The AdCreative / Image catalog components resolve refs back to data URLs via
 * `getImage` (or the reactive `useImage` hook). Cleared implicitly when the tab
 * closes (demo-session scoped).
 *
 * The registry is reactive: a ref can be reserved up front (reserveImage) and
 * handed to the UI before its data exists, then filled asynchronously (setImage)
 * when a slow image job finishes. Components subscribed via useImage re-render
 * the moment the data lands — so an A2UI surface composed while a creative is
 * still generating shows the image live, without the caller re-emitting it.
 */
import { useSyncExternalStore } from 'react';
import { uid } from '@/lib/id';

const store = new Map<string, string>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Store a data URL (or any image src) and return a stable `img:<id>` reference. */
export function putImage(dataUrl: string): string {
  const id = `img:${uid('g')}`;
  store.set(id, dataUrl);
  emit();
  return id;
}

/**
 * Allocate an empty `img:<id>` reference for an image produced asynchronously.
 * Callers hand the ref to the UI immediately and fill it with setImage() once
 * generation completes; components reading it via useImage re-render then.
 */
export function reserveImage(): string {
  return `img:${uid('g')}`;
}

/** Fill a (usually reserved) reference with its data URL and notify subscribers. */
export function setImage(ref: string, dataUrl: string): void {
  if (typeof ref !== 'string' || !ref) return;
  store.set(ref, dataUrl);
  emit();
}

/** Resolve an `img:<id>` reference to its data URL. Non-refs pass through unchanged. */
export function getImage(ref: string): string | undefined {
  if (typeof ref !== 'string') return undefined;
  if (ref.startsWith('img:')) return store.get(ref);
  return ref; // already a URL / data URL
}

/** True when a string is an image registry reference. */
export function isImageRef(ref: unknown): ref is string {
  return typeof ref === 'string' && ref.startsWith('img:');
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * React hook mirror of getImage that re-renders when a reserved ref is later
 * filled via setImage/putImage. Pass-through URLs and not-yet-filled refs follow
 * getImage semantics (URL returned as-is; unknown ref → undefined).
 */
export function useImage(ref: string | undefined): string | undefined {
  const snapshot = () => (typeof ref === 'string' ? getImage(ref) : undefined);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
