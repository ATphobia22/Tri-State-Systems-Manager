import type { Map } from 'maplibre-gl';

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

export function playCinematicTour(
  map: Map,
  keyframes: readonly CinematicCameraKeyframe[] = DEFAULT_CONFLUENCE_TOUR,
): () => void {
  if (keyframes.length === 0) return () => {};

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
