import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Map } from 'maplibre-gl';
import { DEFAULT_CONFLUENCE_TOUR, playCinematicTour } from '../src/lib/cinematic/camera-tour';

function fakeMap() {
  return {
    jumpTo: vi.fn(),
    easeTo: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    stop: vi.fn(),
  };
}

function setReducedMotion(matches: boolean): void {
  (globalThis as Record<string, unknown>).window = {
    matchMedia: () => ({ matches }),
  };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe('playCinematicTour reduced-motion gate', () => {
  it('renders a static frame and returns null when reduced motion is preferred', () => {
    setReducedMotion(true);
    const map = fakeMap();
    const stop = playCinematicTour(map as unknown as Map);

    expect(stop).toBeNull();
    const first = DEFAULT_CONFLUENCE_TOUR[0];
    expect(map.jumpTo).toHaveBeenCalledTimes(1);
    expect(map.jumpTo).toHaveBeenCalledWith({
      center: first.center,
      zoom: first.zoom,
      pitch: first.pitch,
      bearing: first.bearing,
    });
    expect(map.easeTo).not.toHaveBeenCalled();
    expect(map.on).not.toHaveBeenCalled();
  });

  it('plays the animated tour when reduced motion is not preferred', () => {
    setReducedMotion(false);
    const map = fakeMap();
    const stop = playCinematicTour(map as unknown as Map);

    expect(typeof stop).toBe('function');
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    expect(map.jumpTo).not.toHaveBeenCalled();

    (stop as () => void)();
    expect(map.off).toHaveBeenCalledWith('moveend', expect.any(Function));
    expect(map.stop).toHaveBeenCalled();
  });

  it('treats missing matchMedia as no reduced motion (SSR-safe)', () => {
    (globalThis as Record<string, unknown>).window = {};
    const map = fakeMap();
    const stop = playCinematicTour(map as unknown as Map);
    expect(typeof stop).toBe('function');
  });
});
