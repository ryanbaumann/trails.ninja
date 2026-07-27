// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GroundingAttribution } from './GroundingAttribution';
import type { SurfaceState } from '../store';

const surface: SurfaceState = {
  id: 'explorer', catalogId: 'atlas', scenario: 'scout', rootId: 'root', rev: 1, components: {}, dataModel: {},
};

describe('GroundingAttribution', () => {
  it('preserves the supplied title, links within one interaction, and prevents Google Maps translation', () => {
    const html = renderToStaticMarkup(<GroundingAttribution
      node={{ id: 'source', component: 'GroundingAttribution', title: 'Exact source title', url: 'https://maps.google.com/source', placeUrl: 'https://maps.google.com/place' }}
      surface={surface}
    />);
    expect(html).toContain('Exact source title');
    expect(html).toContain('translate="no"');
    expect(html).toContain('Google Maps');
    expect(html).toContain('View place');
  });

  it('fails closed when the source URL is missing or unsafe', () => {
    expect(renderToStaticMarkup(<GroundingAttribution
      node={{ id: 'source', component: 'GroundingAttribution', title: 'Source', url: 'javascript:alert(1)' }}
      surface={surface}
    />)).toBe('');
  });
});
