import { describe, expect, it } from 'vitest';
import { NO_PADDING, fitPadding, intentRequiresMode, resolveCamera } from './cameraDirector';

const CENTER = { lat: 37.79, lng: -122.4 };

describe('cameraDirector', () => {
  it('flies straight to the target — no offset compensation on a declared viewport', () => {
    expect(resolveCamera({ kind: 'fly', center: CENTER, zoom: 15, animate: true })).toEqual({
      kind: 'pan',
      center: CENTER,
      zoom: 15,
      heading: undefined,
      tilt: undefined,
    });
  });

  it('jumps instead of animating when the intent is a restore', () => {
    expect(resolveCamera({ kind: 'fly', center: CENTER, zoom: 12 })).toMatchObject({ kind: 'move', zoom: 12 });
  });

  it('suspends automatic movement once the user takes the camera', () => {
    expect(resolveCamera({ kind: 'fly', center: CENTER }, { owner: 'user' })).toEqual({ kind: 'none' });
    expect(resolveCamera({ kind: 'fit', bounds: [CENTER] }, { owner: 'user' })).toEqual({ kind: 'none' });
  });

  it('resumes when the agent owns the camera again', () => {
    expect(resolveCamera({ kind: 'fly', center: CENTER }, { owner: 'agent' })).toMatchObject({ kind: 'move' });
  });

  it('adds only the real overlapping chrome to fit padding', () => {
    const desktop = resolveCamera({ kind: 'fit', bounds: [CENTER] });
    expect(desktop).toMatchObject({ kind: 'fit', padding: { top: 24, right: 24, bottom: 24, left: 24 } });

    // Mobile: the sheet reports its own height; nothing else overlaps.
    const mobile = resolveCamera(
      { kind: 'fit', bounds: [CENTER] },
      { viewport: { ...NO_PADDING, bottom: 320 } },
    );
    expect(mobile).toMatchObject({ padding: { top: 24, right: 24, bottom: 344, left: 24 } });
  });

  it('ignores an empty fit rather than moving somewhere arbitrary', () => {
    expect(resolveCamera({ kind: 'fit', bounds: [] })).toEqual({ kind: 'none' });
  });

  it('approximates a 2D fly as a fly-over when the map is in 3D', () => {
    expect(resolveCamera({ kind: 'fly', center: CENTER, zoom: 16 }, { mode: '3d' })).toMatchObject({
      kind: 'fly3d',
      center: { ...CENTER, altitude: 120 },
      range: 1600,
    });
  });

  it('passes 3D intents through unchanged', () => {
    expect(resolveCamera({ kind: 'orbit3d', center: CENTER, range: 900, repeatCount: 2 }, { mode: '3d' }))
      .toMatchObject({ kind: 'orbit3d', range: 900, repeatCount: 2 });
    expect(resolveCamera({ kind: 'stop3d' }, { mode: '3d' })).toEqual({ kind: 'stop3d' });
  });

  it('is a no-op with no intent', () => {
    expect(resolveCamera(null)).toEqual({ kind: 'none' });
  });

  describe('intentRequiresMode', () => {
    it('reports that photoreal-3D intents need the 3D map', () => {
      expect(intentRequiresMode({ kind: 'fly3d', center: CENTER })).toBe('3d');
      expect(intentRequiresMode({ kind: 'orbit3d', center: CENTER })).toBe('3d');
    });

    it('does not force 3D for intents either map can execute', () => {
      expect(intentRequiresMode({ kind: 'fly', center: CENTER })).toBeNull();
      expect(intentRequiresMode({ kind: 'fit', bounds: [CENTER] })).toBeNull();
      expect(intentRequiresMode(null)).toBeNull();
    });

    it('never enters 3D just to stop an animation', () => {
      // stop3d arrives after a run is cancelled; escalating on it would drag the
      // user into 3D at the exact moment they asked the camera to stop.
      expect(intentRequiresMode({ kind: 'stop3d' })).toBeNull();
    });
  });

  it('fitPadding is additive and pure', () => {
    const viewport = { top: 1, right: 2, bottom: 3, left: 4 };
    expect(fitPadding(viewport)).toEqual({ top: 25, right: 26, bottom: 27, left: 28 });
    expect(viewport).toEqual({ top: 1, right: 2, bottom: 3, left: 4 });
  });
});
