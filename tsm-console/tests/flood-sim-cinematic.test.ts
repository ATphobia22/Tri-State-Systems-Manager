import { describe, expect, it } from 'vitest';
import {
  FLOOD_SIM_INTRO_TOUR,
  FLOOD_SIM_OUTRO_TOUR,
  SCENARIO_FLYTHROUGHS,
  scenarioFlythrough,
  INTRO_SHOTS,
  OUTRO_SHOTS,
  TimeLapseDriver,
} from '../src/lib/flood-sim/cinematic';

describe('flood-sim cinematic', () => {
  it('reuses the CinematicCameraKeyframe shape without touching existing APIs', () => {
    for (const kf of [...FLOOD_SIM_INTRO_TOUR, ...FLOOD_SIM_OUTRO_TOUR]) {
      expect(Array.isArray(kf.center)).toBe(true);
      expect(kf.center).toHaveLength(2);
      expect(typeof kf.zoom).toBe('number');
      expect(typeof kf.pitch).toBe('number');
      expect(typeof kf.bearing).toBe('number');
      expect(typeof kf.durationMs).toBe('number');
    }
  });

  it('provides a flythrough per shipped scenario plus intro/outro shot lists', () => {
    for (const id of ['1937-ohio-river-flood', 'q100-design-event', 'live-gauge-driven']) {
      expect(scenarioFlythrough(id).length).toBeGreaterThan(0);
    }
    // Unknown ids fall back to the intro tour (never throw in the UI path).
    expect(scenarioFlythrough('nope')).toBe(FLOOD_SIM_INTRO_TOUR);
    expect(Object.keys(SCENARIO_FLYTHROUGHS).sort()).toEqual([
      '1937-ohio-river-flood',
      'live-gauge-driven',
      'q100-design-event',
    ]);
    expect(INTRO_SHOTS.length).toBe(FLOOD_SIM_INTRO_TOUR.length);
    expect(OUTRO_SHOTS.length).toBe(FLOOD_SIM_OUTRO_TOUR.length);
  });

  it('TimeLapseDriver is deterministic and eases between keyframes', () => {
    const keys = scenarioFlythrough('q100-design-event');
    const d1 = new TimeLapseDriver(keys, 24 * 3600);
    const d2 = new TimeLapseDriver(keys, 24 * 3600);
    for (const t of [0, 1500, 5000, 20000]) {
      expect(d1.poseAt(3600, t)).toEqual(d2.poseAt(3600, t));
    }
    const start = d1.poseAt(0, 0);
    const end = d1.poseAt(0, d1.tourLengthMs);
    expect(start.distanceFt).toBeGreaterThan(end.distanceFt); // dive-in tour
    expect(start.pitchDeg).toBeLessThanOrEqual(end.pitchDeg);
  });

  it('pins the first keyframe to sim-time zero', () => {
    const d = new TimeLapseDriver(FLOOD_SIM_INTRO_TOUR, 3600);
    expect(d.pinnedSimTime(0)).toBe(0);
  });

  it('is fail-closed on empty keyframes', () => {
    expect(() => new TimeLapseDriver([], 3600)).toThrow();
  });
});
