/**
 * AdCreative render tests — prove the fix for mustache `{token}` leaks. Before,
 * AdCreative alone (unlike Text/StatGrid) never interpolated literal `{path}`
 * tokens, so a List-template ad card rendered raw "{headline}"/"{body}"/"{cta}"
 * braces on screen. It now resolves tokens against the data model and drops any
 * the model never satisfied.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { AdCreative } from './AdCreative';
import { reserveImage, setImage } from '../images';
import type { SurfaceState } from '../store';
import type { ComponentNode } from '../protocol';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function surface(dataModel: Record<string, unknown>): SurfaceState {
  return {
    id: 's1',
    catalogId: 'atlas://maps-agentic-ui-catalog',
    scenario: 'adstudio',
    components: {},
    dataModel,
    rootId: 'root',
    rev: 1,
  };
}

const node = (props: Record<string, unknown>): ComponentNode => ({
  component: 'AdCreative',
  id: 'ad',
  ...props,
});

describe('AdCreative token resolution', () => {
  it('interpolates literal {path} tokens against a List-item scope', () => {
    const s = surface({ creatives: [{ headline: 'Warm mornings', body: 'Pour-over daily', cta: 'Order now' }] });
    const html = renderToStaticMarkup(
      <AdCreative node={node({ headline: '{headline}', body: '{body}', cta: '{cta}' })} surface={s} scope="/creatives/0" />,
    );
    expect(html).toContain('Warm mornings');
    expect(html).toContain('Pour-over daily');
    expect(html).toContain('Order now');
    expect(html).not.toContain('{headline}');
    expect(html).not.toContain('{body}');
    expect(html).not.toContain('{cta}');
  });

  it('drops unresolved tokens instead of leaking raw braces', () => {
    const s = surface({ creatives: [{ headline: 'Warm mornings' }] });
    const html = renderToStaticMarkup(
      <AdCreative node={node({ headline: '{headline}', body: '{body}', cta: '{cta}' })} surface={s} scope="/creatives/0" />,
    );
    expect(html).toContain('Warm mornings');
    // body/cta had no matching field — they must not leak the raw placeholder.
    expect(html).not.toContain('{body}');
    expect(html).not.toContain('{cta}');
  });

  it('fills in the image live when a reserved ref is set after the card renders', async () => {
    // Mirrors the real flow: generate_ad_creatives returns a reserved img: ref
    // immediately, the model composes an AdCreative surface with it, and the
    // background job fills the ref ~30-75s later. The card must show the image
    // then, without the surface being re-emitted.
    const ref = reserveImage();
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<AdCreative node={node({ imageRef: ref, headline: 'Live' })} surface={surface({})} />);
    });
    // Ref reserved but empty → placeholder box, no <img>, Download disabled.
    expect(container.querySelector('img.genui-adcreative__img')).toBeNull();
    expect(container.querySelector('.genui-adcreative__img--empty')).not.toBeNull();

    await act(async () => {
      setImage(ref, png);
    });
    const img = container.querySelector('img.genui-adcreative__img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe(png);

    await act(async () => root.unmount());
    container.remove();
  });

  it('resolves a mustache {imageRef} token against a List-item scope and renders the image', async () => {
    // The real regression: Gemini emits `imageRef: "{imageRef}"` in a List
    // template with the actual `img:` ref living in the data model. imageRef used
    // resolveDynamic (bindings only), so the literal "{imageRef}" reached the
    // guard, failed, and every ad card rendered an empty poster.
    const ref = reserveImage();
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    setImage(ref, png);
    const s = surface({ creatives: [{ imageRef: ref, headline: 'Live' }] });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<AdCreative node={node({ imageRef: '{imageRef}', headline: '{headline}' })} surface={s} scope="/creatives/0" />);
    });
    const img = container.querySelector('img.genui-adcreative__img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe(png);
    expect(container.querySelector('.genui-adcreative__img--empty')).toBeNull();
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders plain literal copy verbatim', () => {
    const s = surface({});
    const html = renderToStaticMarkup(
      <AdCreative node={node({ headline: 'Rainy day, warm cup', cta: 'Visit today' })} surface={s} />,
    );
    expect(html).toContain('Rainy day, warm cup');
    expect(html).toContain('Visit today');
  });

  it('always shows the fixed AI disclosure — a caller-supplied badge cannot override it', () => {
    const s = surface({});
    const html = renderToStaticMarkup(
      <AdCreative node={node({ headline: 'Any', badge: 'Sponsored — 100% real photo' })} surface={s} />,
    );
    expect(html).toContain('AI-generated image');
    expect(html).not.toContain('Sponsored — 100% real photo');
  });
});
