import plan from '../../../data/cinematic/film-shot-plan.v1.json';

export const FILM_SHOTS = plan.shots;
export const FILM_PREVIEW_FPS = plan.previewFrameRate;
export type FilmShotPreview = NonNullable<(typeof FILM_SHOTS)[number]['preview']>;

export function lastShotFrame(preview: FilmShotPreview) {
  return preview.keyframes[1]!.frame;
}

export function sampleShotCamera(preview: FilmShotPreview, frame: number) {
  const first = preview.keyframes[0]!;
  const last = preview.keyframes[1]!;
  const progress = Math.min(1, Math.max(0, frame / last.frame));
  const eased = progress * progress * (3 - 2 * progress);
  const mix = (start: number, end: number) => start + (end - start) * eased;
  return {
    headingOffsetDeg: mix(first.headingOffsetDeg, last.headingOffsetDeg),
    rangeScale: mix(first.rangeScale, last.rangeScale),
  };
}
