import { describe, expect, it } from 'vitest';
import { proxiedPlacePhotoUrl } from './placePhoto';

describe('proxiedPlacePhotoUrl', () => {
  it('leaves same-origin image paths unchanged', () => {
    expect(proxiedPlacePhotoUrl('/api/real-world-reasoning-agent/gmp/streetview/maps/api/streetview?size=640x400')).toBe(
      '/api/real-world-reasoning-agent/gmp/streetview/maps/api/streetview?size=640x400',
    );
  });

  it('proxies Google-hosted Places photo URLs through /gmp/placephoto', () => {
    const url = 'https://places.googleapis.com/v1/places/abc/photos/def/media?maxWidthPx=800';
    const proxied = proxiedPlacePhotoUrl(url);
    expect(proxied).toBe(`/api/real-world-reasoning-agent/gmp/placephoto?url=${encodeURIComponent(url)}`);
  });

  it('does not proxy non-Google HTTPS URLs', () => {
    const url = 'https://example.com/photo.jpg';
    expect(proxiedPlacePhotoUrl(url)).toBe(url);
  });
});
