/**
 * AdCreative — a poster card for generated ad imagery. `imageRef` is a
 * dataModel value that may be an `img:<id>` registry reference (resolved via
 * useImage, so a still-generating creative fills in live) or a direct URL;
 * always renders an "AI-generated image" badge
 * regardless of caller-supplied `badge` text. Footer: Download
 * (download_image) + Remix (send_prompt).
 */
import { useState, type FC } from 'react';
import type { ComponentNode, Dynamic } from '../protocol';
import { resolveDisplayText, resolveMediaRef } from '../protocol';
import type { SurfaceState } from '../store';
import { isImageRef, useImage } from '../images';
import { dispatchSurfaceAction } from '../actions';
import { buildAction } from './actionHelpers';
import { isAllowedImageUrl } from './imageGuard';
import { stripMarkdown } from './Markdown';

/** The AI-generated-image disclosure is a fixed, non-overridable label — a
 *  caller-supplied `badge` must never be able to hide or reword it. */
const AI_DISCLOSURE = 'AI-generated image';

/** Normalizes a resolved display string to a clean, markdown-free string. */
function displayText(value: string): string {
  return value.trim() ? stripMarkdown(value) : '';
}

export const AdCreative: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({
  node,
  surface,
  scope,
}) => {
  // resolveMediaRef (not resolveDynamic) so a mustache `{imageRef}` token inside a
  // List template resolves against the item scope — models emit that form and the
  // bare literal would otherwise fail the image guard and render an empty poster.
  const imageRef = resolveMediaRef(node.imageRef as Dynamic<string> | undefined, surface.dataModel, scope);
  const headline = displayText(resolveDisplayText(node.headline as Dynamic<unknown> | undefined, surface.dataModel, scope));
  const body = displayText(resolveDisplayText(node.body as Dynamic<unknown> | undefined, surface.dataModel, scope));
  const cta = displayText(resolveDisplayText(node.cta as Dynamic<unknown> | undefined, surface.dataModel, scope));
  // The disclosure badge is fixed and non-overridable — `node.badge` is ignored.
  const badge = AI_DISCLOSURE;

  // useImage (not getImage) so a card composed while the creative is still
  // generating fills in live once the background job stores the image.
  const resolvedSrc = useImage(typeof imageRef === 'string' ? imageRef : undefined);
  const src = resolvedSrc && isAllowedImageUrl(resolvedSrc) ? resolvedSrc : undefined;

  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Distinguish the empty-poster states: LOADING (a reserved img: ref still
  // generating), ERROR (a present src that failed to load), else EMPTY (no ref).
  const loading = isImageRef(imageRef) && !resolvedSrc;

  let imageArea;
  if (src && !failed) {
    imageArea = (
      <img
        key={reloadKey}
        className="genui-adcreative__img"
        src={src}
        alt={headline || 'Ad creative'}
        onError={() => setFailed(true)}
      />
    );
  } else if (failed) {
    imageArea = (
      <div className="genui-adcreative__img genui-adcreative__img--empty genui-adcreative__img--error" role="alert">
        <span className="genui-adcreative__state-text">Couldn't load the image.</span>
        <button
          type="button"
          className="genui-btn genui-adcreative__retry"
          onClick={() => {
            setFailed(false);
            setReloadKey((k) => k + 1);
          }}
        >
          Retry
        </button>
      </div>
    );
  } else if (loading) {
    imageArea = (
      <div className="genui-adcreative__img genui-adcreative__img--empty" role="status" aria-label="Generating image" />
    );
  } else {
    imageArea = <div className="genui-adcreative__img genui-adcreative__img--empty" />;
  }

  return (
    <div className="genui-adcreative">
      {imageArea}
      <span className="genui-adcreative__badge">{badge}</span>
      <div className="genui-adcreative__overlay">
        {headline ? <div className="genui-adcreative__headline">{headline}</div> : null}
        {body ? <div className="genui-adcreative__body">{body}</div> : null}
        {cta ? <div className="genui-adcreative__cta">{cta}</div> : null}
      </div>
      <div className="genui-adcreative__actions">
        <button
          type="button"
          className="genui-btn genui-btn--borderless"
          disabled={!src}
          onClick={() => src && dispatchSurfaceAction(buildAction('download_image', surface, node.id, { dataUrl: src }))}
        >
          Download
        </button>
        <button
          type="button"
          className="genui-btn genui-btn--borderless"
          onClick={() =>
            dispatchSurfaceAction(
              buildAction('send_prompt', surface, node.id, { prompt: `remix this ad: ${headline}` }),
            )
          }
        >
          Remix
        </button>
      </div>
    </div>
  );
};
