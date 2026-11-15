import { describe, expect, it } from 'vitest';
import { FILM_PREVIEW_FPS, FILM_SHOTS, lastShotFrame, sampleShotCamera } from '../src/lib/cesium-film-shots';

describe('Cesium film shots', () => {
  it('samples bounded camera poses on the shared 24 fps shot timeline', () => {
    const preview = FILM_SHOTS.find(({ id }) => id === '02-mount-vernon')?.preview;
    expect(preview).toBeDefined();
    const last = lastShotFrame(preview!);
    expect((last + 1) / FILM_PREVIEW_FPS).toBe(6);
    expect(sampleShotCamera(preview!, -5)).toEqual({ headingOffsetDeg: -18, rangeScale: 1.35 });
    const middle = sampleShotCamera(preview!, last / 2);
    expect(middle.headingOffsetDeg).toBe(-7);
    expect(middle.rangeScale).toBeCloseTo(1.055);
    expect(sampleShotCamera(preview!, last + 5)).toEqual({ headingOffsetDeg: 4, rangeScale: 0.76 });
  });

  it('reserves the flood comparison for evidence-backed production', () => {
    const shot = FILM_SHOTS.find(({ id }) => id === '04-flood-comparison');
    expect(shot?.preview).toBeNull();
    expect(shot?.requiredEvidence).toContain('model-calibration');
    expect(shot?.requiredEvidence).toContain('water-surface-provenance');
  });
});
