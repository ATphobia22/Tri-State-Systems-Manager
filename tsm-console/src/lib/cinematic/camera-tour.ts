import type { Map } from 'maplibre-gl';
import { prefersReducedMotion } from '../reduced-motion';

export interface CinematicCameraKeyframe {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  durationMs: number;
}

export const DEFAULT_CONFLUENCE_TOUR: readonly CinematicCameraKeyframe[] = [
  { center: [-87.94, 38.13], zoom: 13.2, pitch: 58, bearing: -18, durationMs: 2600 },
  { center: [-87.925, 38.125], zoom: 14.4, pitch: 68, bearing: 18, durationMs: 3000 },
  { center: [-87.948, 38.118], zoom: 15.2, pitch: 72, bearing: 58, durationMs: 3200 },
  { center: [-87.962, 38.135], zoom: 14.2, pitch: 62, bearing: 105, durationMs: 2800 },
];

/**
 * Plays the cinematic camera tour. Returns a stop function.
 *
 * Reduced-motion gate: when the user prefers reduced motion, no animation
 * plays — the camera snaps to the first keyframe (a static frame) and
 * `null` is returned instead of a stop function so callers can keep their
 * "tour active" state honest.
 */
export function playCinematicTour(
  map: Map,
  keyframes: readonly CinematicCameraKeyframe[] = DEFAULT_CONFLUENCE_TOUR,
): (() => void) | null {
  if (keyframes.length === 0) return () => {};

  if (prefersReducedMotion()) {
    const first = keyframes[0];
    map.jumpTo({ center: first.center, zoom: first.zoom, pitch: first.pitch, bearing: first.bearing });
    return null;
  }

  let index = 0;
  let stopped = false;
  let timer: number | undefined;

  const advance = (): void => {
    if (stopped) return;
    const frame = keyframes[index];
    map.easeTo({
      center: frame.center,
      zoom: frame.zoom,
      pitch: frame.pitch,
      bearing: frame.bearing,
      duration: frame.durationMs,
      essential: true,
    });
    index = (index + 1) % keyframes.length;
  };

  const onMoveEnd = (): void => {
    if (stopped) return;
    timer = window.setTimeout(advance, 350);
  };

  map.on('moveend', onMoveEnd);
  advance();

  return () => {
    stopped = true;
    map.off('moveend', onMoveEnd);
    if (timer !== undefined) window.clearTimeout(timer);
    map.stop();
  };
}
