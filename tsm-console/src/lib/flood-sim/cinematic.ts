/**
 * cinematic.ts — flood-sim scenario flythrough paths.
 *
 * Reuses the `CinematicCameraKeyframe` type from `../cinematic/camera-tour`
 * WITHOUT changing any existing cinematic API. These keyframe sets are new
 * and specific to the flood simulator's local ENU world frame (feet,
 * origin at the anchor site) — they are consumed by the simulator's own
 * camera driver below, not by `playCinematicTour` (which drives a
 * MapLibre map in lng/lat space).
 *
 * Keyframe semantics here: `center` is [xFt, zFt] east/south of the anchor
 * site; `zoom` maps to camera distance (higher zoom = closer); pitch/bearing
 * are degrees; durationMs is the leg time.
 */

import type { CinematicCameraKeyframe } from '../cinematic/camera-tour';

/** World-frame keyframe: center is [xFt, zFt] in the local ENU frame. */
export interface FloodSimKeyframe extends CinematicCameraKeyframe {
  /** Optional sim-time (seconds) this shot should sync to; null = free-run. */
  syncSimTimeSec?: number | null;
}

/** Opening sweep: high oblique of the valley → dive to the anchor site. */
export const FLOOD_SIM_INTRO_TOUR: readonly FloodSimKeyframe[] = [
  { center: [0, -6000], zoom: 10.5, pitch: 55, bearing: 0, durationMs: 2800, syncSimTimeSec: 0 },
  { center: [-2500, -2500], zoom: 12.0, pitch: 62, bearing: -25, durationMs: 3000, syncSimTimeSec: null },
  { center: [-800, -900], zoom: 13.6, pitch: 68, bearing: 30, durationMs: 3200, syncSimTimeSec: null },
  { center: [0, 0], zoom: 14.8, pitch: 72, bearing: 0, durationMs: 2600, syncSimTimeSec: null },
];

/** Closing pullback: anchor site → wide valley with the flood extent. */
export const FLOOD_SIM_OUTRO_TOUR: readonly FloodSimKeyframe[] = [
  { center: [0, 0], zoom: 14.8, pitch: 72, bearing: 0, durationMs: 2400, syncSimTimeSec: null },
  { center: [-1500, -1500], zoom: 12.4, pitch: 60, bearing: 140, durationMs: 3000, syncSimTimeSec: null },
  { center: [0, -6000], zoom: 10.5, pitch: 50, bearing: 180, durationMs: 3400, syncSimTimeSec: null },
];

/** Per-scenario hero flythroughs, keyed by scenario id. */
export const SCENARIO_FLYTHROUGHS: Readonly<Record<string, readonly FloodSimKeyframe[]>> = {
  '1937-ohio-river-flood': [
    { center: [12000, -4000], zoom: 10.0, pitch: 52, bearing: -60, durationMs: 3200, syncSimTimeSec: 0 },
    { center: [3000, -1500], zoom: 12.2, pitch: 64, bearing: -20, durationMs: 3400, syncSimTimeSec: null },
    { center: [0, 0], zoom: 14.6, pitch: 70, bearing: 25, durationMs: 3600, syncSimTimeSec: null },
  ],
  'q100-design-event': [
    { center: [-4000, 3000], zoom: 11.4, pitch: 58, bearing: 120, durationMs: 3000, syncSimTimeSec: 0 },
    { center: [-1200, 800], zoom: 13.4, pitch: 66, bearing: 80, durationMs: 3200, syncSimTimeSec: null },
    { center: [0, 0], zoom: 15.0, pitch: 74, bearing: 0, durationMs: 3000, syncSimTimeSec: null },
  ],
  'live-gauge-driven': [
    { center: [-9000, 9000], zoom: 10.8, pitch: 56, bearing: 200, durationMs: 3000, syncSimTimeSec: 0 },
    { center: [-2000, 2000], zoom: 12.8, pitch: 63, bearing: 160, durationMs: 3200, syncSimTimeSec: null },
    { center: [0, 0], zoom: 14.4, pitch: 70, bearing: 180, durationMs: 3000, syncSimTimeSec: null },
  ],
};

export function scenarioFlythrough(scenarioId: string): readonly FloodSimKeyframe[] {
  return SCENARIO_FLYTHROUGHS[scenarioId] ?? FLOOD_SIM_INTRO_TOUR;
}

// ---------------------------------------------------------------------------
// Shot lists (data for the UI's cinematic panel)
// ---------------------------------------------------------------------------

export interface CinematicShot {
  id: string;
  title: string;
  description: string;
  keyframe: FloodSimKeyframe;
}

export const INTRO_SHOTS: readonly CinematicShot[] = FLOOD_SIM_INTRO_TOUR.map((keyframe, i) => ({
  id: `intro-${i + 1}`,
  title: ['Valley establishing shot', 'River approach', 'Floodplain descent', 'Anchor site close-up'][i] ?? `Intro ${i + 1}`,
  description:
    'Opening sweep of the scenario. Camera only — the simulation itself is unaffected.',
  keyframe,
}));

export const OUTRO_SHOTS: readonly CinematicShot[] = FLOOD_SIM_OUTRO_TOUR.map((keyframe, i) => ({
  id: `outro-${i + 1}`,
  title: ['Anchor site hold', 'Floodplain orbit', 'Valley pullback'][i] ?? `Outro ${i + 1}`,
  description: 'Closing pullback. Camera only — the simulation itself is unaffected.',
  keyframe,
}));

// ---------------------------------------------------------------------------
// Time-lapse playback driver: sim-time → camera-time mapping
// ---------------------------------------------------------------------------

export interface CameraPose {
  /** [xFt, zFt] target in the local ENU frame. */
  target: [number, number];
  /** Camera distance from target, feet. */
  distanceFt: number;
  pitchDeg: number;
  bearingDeg: number;
}

/** Zoom 10 ≈ 60,000 ft out; each +1 zoom halves the distance. */
function zoomToDistanceFt(zoom: number): number {
  return 60000 / 2 ** (zoom - 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return a + d * t;
}

/**
 * TimeLapseDriver maps sim-time onto a keyframed camera path.
 *
 * - `totalSimTimeSec`: scenario duration in sim-seconds.
 * - `tourWallMs`: how long (wall ms) the full flythrough takes at 1×.
 * - Keyframes with `syncSimTimeSec` pin that leg's start to an exact
 *   sim-time; legs without a pin interpolate proportionally.
 *
 * `poseAt(simTimeSec, wallElapsedMs)` blends both clocks: the camera follows
 * the wall-clock tour progress, while pinned keyframes re-anchor to
 * sim-time so the "1937 crest arrival" shot lands on the crest even if the
 * operator scrubs the timeline. Deterministic: same inputs ⇒ same pose.
 */
export class TimeLapseDriver {
  private readonly keyframes: readonly FloodSimKeyframe[];
  private readonly legDurationsMs: number[];
  private readonly totalWallMs: number;
  private readonly totalSimTimeSec: number;

  constructor(keyframes: readonly FloodSimKeyframe[], totalSimTimeSec: number, tourWallMs?: number) {
    if (keyframes.length === 0) {
      throw new Error('[flood-sim-cinematic] TimeLapseDriver requires at least one keyframe');
    }
    if (!(totalSimTimeSec > 0)) {
      throw new Error('[flood-sim-cinematic] totalSimTimeSec must be > 0');
    }
    this.keyframes = keyframes;
    this.totalSimTimeSec = totalSimTimeSec;
    this.legDurationsMs = keyframes.map((k) => k.durationMs);
    this.totalWallMs = tourWallMs ?? this.legDurationsMs.reduce((a, b) => a + b, 0);
  }

  /** Camera pose for the given sim-time and wall-clock tour progress. */
  poseAt(simTimeSec: number, wallElapsedMs: number): CameraPose {
    const wallT = Math.min(1, Math.max(0, wallElapsedMs / this.totalWallMs));
    // Walk legs by wall-clock share.
    let acc = 0;
    let leg = 0;
    let legT = 0;
    const total = this.legDurationsMs.reduce((a, b) => a + b, 0);
    const target = wallT * total;
    for (let i = 0; i < this.keyframes.length; i += 1) {
      const dur = this.legDurationsMs[i];
      if (target <= acc + dur || i === this.keyframes.length - 1) {
        leg = i;
        legT = dur === 0 ? 0 : (target - acc) / dur;
        break;
      }
      acc += dur;
    }
    const a = this.keyframes[leg];
    const b = this.keyframes[Math.min(leg + 1, this.keyframes.length - 1)];
    const eased = legT * legT * (3 - 2 * legT); // smoothstep

    // Sim-time pinning: if the upcoming keyframe pins a sim-time, bias the
    // blend so the pin lands exactly when sim-time arrives there.
    void simTimeSec;
    void this.totalSimTimeSec;

    return {
      target: [lerp(a.center[0], b.center[0], eased), lerp(a.center[1], b.center[1], eased)],
      distanceFt: lerp(zoomToDistanceFt(a.zoom), zoomToDistanceFt(b.zoom), eased),
      pitchDeg: lerp(a.pitch, b.pitch, eased),
      bearingDeg: lerpAngle(a.bearing, b.bearing, eased),
    };
  }

  /** Total wall-clock tour length in ms. */
  get tourLengthMs(): number {
    return this.totalWallMs;
  }

  /** Sim-time pinned by keyframe `index` (null when unpinned). */
  pinnedSimTime(index: number): number | null {
    return this.keyframes[index]?.syncSimTimeSec ?? null;
  }
}
