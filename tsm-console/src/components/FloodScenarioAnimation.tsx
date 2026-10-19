/**
 * FloodScenarioAnimation.tsx — Canvas flood-fill animation for historical /
 * design flood scenarios. SIMULATION only: the terrain is procedural and
 * illustrative; only the target crest elevations are sourced (see
 * digital-twin/floodScenario.ts). Human-triggered; no auto-play.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FLOOD_SCENARIOS,
  getScenario,
  type FloodScenario,
  type FloodScenarioId,
} from '../digital-twin/floodScenario';
import {
  computeFloodMask,
  paintFloodCanvas,
  type FloodGrid,
} from '../lib/canvas-flood-layer';

const FT_TO_M = 0.3048;

/** Anchor site bounding box [west, south, east, north]. */
const ANCHOR_BOUNDS: [number, number, number, number] = [-88.02, 37.83, -87.99, 37.86];

/**
 * Build a deterministic illustrative terrain grid (meters, NAVD88).
 * The anchor pad is set to the real owner-supplied LAG (377.2 ft = 114.97 m)
 * so the 1937 crest animation (377.80 ft) shows ~0.6 ft of water at the site
 * — matching the real arithmetic. Everything else is procedural noise plus
 * a carved river channel along the south edge. NOT surveyed elevation.
 */
export function buildIllustrativeTerrain(rows = 96, cols = 96, seed = 1937): FloodGrid {
  // Mulberry32 seeded PRNG — deterministic across runs.
  let s = seed >>> 0;
  const rand = (): number => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const elevations = new Float32Array(rows * cols);
  const lagM = 377.2 * FT_TO_M; // real LAG at the anchor pad
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      const v = r / (rows - 1);
      // Rolling upland 113–118 m with two octaves of noise.
      let e =
        115.5 +
        2.2 * Math.sin(u * 9.1 + seed) * Math.cos(v * 7.3) +
        0.9 * (rand() - 0.5) * 2;
      // River channel along the south edge (v -> 1): carve down to ~108 m.
      const channel = Math.max(0, (v - 0.72) / 0.28);
      e -= channel * channel * 8.5;
      // Anchor pad near center: pin to the real LAG.
      const du = u - 0.5;
      const dv = v - 0.42;
      const pad = Math.exp(-(du * du + dv * dv) / 0.004);
      e = e * (1 - pad) + lagM * pad;
      elevations[r * cols + c] = e;
    }
  }
  return {
    elevations,
    rows,
    cols,
    bounds: ANCHOR_BOUNDS,
    verticalDatum: 'NAVD88',
  };
}

interface AnimTarget {
  /** Target water-surface elevation, meters NAVD88. Null = not animatable. */
  targetM: number | null;
  /** Why not animatable, when targetM is null. */
  reason: string | null;
  /** Short provenance label shown under the canvas. */
  provenance: string;
}

/** Resolve the animation target for a scenario. Only sourced elevations animate. */
export function resolveAnimationTarget(scenario: FloodScenario): AnimTarget {
  switch (scenario.id) {
    case 'historical-1937':
      // Verified: MTVI3 gauge zero 318.59 ft NAVD88 + 59.21 ft stage.
      return {
        targetM: 377.8 * FT_TO_M,
        reason: null,
        provenance:
          'Target 377.80 ft NAVD88 — verified 1937 crest at Mount Vernon (MTVI3 zero 318.59 ft + 59.21 ft stage).',
      };
    case '100yr':
      return {
        targetM: 369.1 * FT_TO_M,
        reason: null,
        provenance:
          'Target 369.1 ft NAVD88 — regulatory BFE (FIS 18129CV000A Table 9, Section A).',
      };
    case 'historical-2011':
      return {
        targetM: null,
        reason:
          'No Mount Vernon (MTVI3) 2011 crest is sourced in the repository — only Evansville (46.78 ft), J.T. Myers (56.94 ft), and New Harmony (23.67 ft). Not invented.',
        provenance: '',
      };
    default:
      return {
        targetM: null,
        reason: 'No sourced water-surface elevation for this scenario.',
        provenance: '',
      };
  }
}

type Props = {
  scenarioId?: FloodScenarioId;
};

const fmtFt = (m: number): string => `${(m / FT_TO_M).toFixed(1)} ft`;

export default function FloodScenarioAnimation({ scenarioId = 'historical-1937' }: Props): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<FloodScenarioId>(scenarioId);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'paused' | 'done'>('idle');
  const [levelM, setLevelM] = useState<number | null>(null);
  const [floodedPct, setFloodedPct] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const fromRef = useRef<number>(0);

  const grid = useMemo(() => buildIllustrativeTerrain(), []);
  const scenario = getScenario(selectedId) ?? FLOOD_SCENARIOS[0];
  const target = useMemo(() => resolveAnimationTarget(scenario), [scenario]);

  const startM = useMemo(() => {
    // Start just above the river channel so the first frames show the river.
    let min = Infinity;
    for (let i = 0; i < grid.elevations.length; i++) {
      if (grid.elevations[i] < min) min = grid.elevations[i];
    }
    return min + 0.5;
  }, [grid]);

  const render = (level: number | null): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (level === null) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = grid.cols;
        canvas.height = grid.rows;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, grid.cols, grid.rows);
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Press Play to run the simulation', grid.cols / 2, grid.rows / 2);
      }
      return;
    }
    const mask = computeFloodMask(grid, level);
    let n = 0;
    for (let i = 0; i < mask.length; i++) n += mask[i];
    setFloodedPct((100 * n) / mask.length);
    // Paint terrain faintly underneath: draw elevation shading first.
    const ctx = canvas.getContext('2d');
    canvas.width = grid.cols;
    canvas.height = grid.rows;
    if (ctx) {
      const img = ctx.createImageData(grid.cols, grid.rows);
      for (let i = 0; i < grid.elevations.length; i++) {
        const t = Math.min(1, Math.max(0, (grid.elevations[i] - 106) / 14));
        const g = Math.round(30 + t * 60);
        img.data[i * 4] = Math.round(20 + t * 40);
        img.data[i * 4 + 1] = g + 40;
        img.data[i * 4 + 2] = Math.round(30 + t * 30);
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
    paintFloodCanvas(grid, mask, canvas, 'rgba(56, 189, 248, 0.65)');
  };

  const stopLoop = (): void => {
    cancelAnimationFrame(rafRef.current);
  };

  useEffect(() => stopLoop, []);

  const play = (): void => {
    if (target.targetM === null) return;
    stopLoop();
    const from = levelM ?? startM;
    fromRef.current = from;
    startRef.current = performance.now();
    setPhase('playing');
    const durationMs = 9000;
    const step = (now: number): void => {
      const t = Math.min(1, (now - startRef.current) / durationMs);
      // Ease-in-out so the rise reads clearly at both ends.
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const level = fromRef.current + (target.targetM! - fromRef.current) * eased;
      setLevelM(level);
      render(level);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setPhase('done');
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const pause = (): void => {
    stopLoop();
    setPhase('paused');
  };

  const reset = (): void => {
    stopLoop();
    setLevelM(null);
    setFloodedPct(0);
    setPhase('idle');
    render(null);
  };

  const select = (id: FloodScenarioId): void => {
    stopLoop();
    setSelectedId(id);
    setLevelM(null);
    setFloodedPct(0);
    setPhase('idle');
  };

  useEffect(() => {
    render(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mtvi3StageFt =
    levelM === null ? null : levelM / FT_TO_M - 318.59;

  return (
    <div
      role="region"
      aria-label="Flood scenario animation"
      style={{
        marginTop: 10,
        padding: 10,
        borderRadius: 8,
        border: '1px solid #334155',
        background: 'rgba(15,23,42,0.9)',
      }}
    >
      <strong style={{ color: '#38bdf8' }}>Flood animation · SIMULATION</strong>
      <div style={{ marginTop: 4, color: '#94a3b8', fontSize: 11 }}>
        Illustrative terrain — <strong>not</strong> surveyed elevation. Only the
        target crest elevations are sourced. Not SFHA · not a warning system.
      </div>

      <label style={{ display: 'block', marginTop: 8, fontSize: 11, color: '#cbd5e1' }}>
        Scenario
        <select
          value={selectedId}
          onChange={(e) => select(e.target.value as FloodScenarioId)}
          style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 40, background: '#020617', color: '#e2e8f0', border: '1px solid #1e293b', borderRadius: 6 }}
        >
          {FLOOD_SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} {s.status === 'verified' ? '✓' : s.status === 'unverified' ? '(unverified)' : '(no data)'}
            </option>
          ))}
        </select>
      </label>

      <div style={{ marginTop: 8, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', borderRadius: 6, border: '1px solid #1e293b', display: 'block' }}
        />
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1,
            color: '#fbbf24',
            background: 'rgba(2,6,23,0.8)',
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid #854d0e',
          }}
        >
          SIMULATION
        </div>
      </div>

      {target.targetM !== null ? (
        <>
          <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>{target.provenance}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#e2e8f0' }}>
            Water surface:{' '}
            <strong style={{ color: '#38bdf8' }}>
              {levelM === null ? '—' : fmtFt(levelM) + ' NAVD88'}
            </strong>
            {mtvi3StageFt !== null && (
              <span style={{ color: '#64748b' }}>
                {' '}· MTVI3 stage ≈ {mtvi3StageFt.toFixed(1)} ft
              </span>
            )}
            <span style={{ color: '#64748b' }}> · {floodedPct.toFixed(1)}% of grid wet</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {phase !== 'playing' ? (
              <button
                type="button"
                onClick={play}
                style={{
                  minHeight: 44, padding: '0.5rem 0.9rem', borderRadius: 8,
                  border: '1px solid #0c4a6e', background: 'rgba(56,189,248,0.15)',
                  color: '#38bdf8', fontWeight: 700, cursor: 'pointer',
                }}
              >
                {phase === 'paused' ? 'Resume' : levelM !== null ? 'Replay' : 'Play (human-triggered)'}
              </button>
            ) : (
              <button
                type="button"
                onClick={pause}
                style={{
                  minHeight: 44, padding: '0.5rem 0.9rem', borderRadius: 8,
                  border: '1px solid #1e293b', background: '#020617',
                  color: '#94a3b8', cursor: 'pointer',
                }}
              >
                Pause
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: 44, padding: '0.5rem 0.9rem', borderRadius: 8,
                border: '1px solid #1e293b', background: '#020617',
                color: '#94a3b8', cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 8, fontSize: 11, color: '#f87171' }}>
          Animation unavailable: {target.reason}
        </div>
      )}

      {scenario.crests.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
          <strong style={{ color: '#cbd5e1' }}>Sourced crests</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
            {scenario.crests.map((c) => (
              <li key={c.gaugeId}>
                {c.gaugeName}: <strong>{c.crestStageFt.toFixed(2)} ft</strong> on {c.crestDate}
                {c.floodStageFt !== null && (
                  <span style={{ color: '#64748b' }}> (flood stage {c.floodStageFt.toFixed(1)} ft)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
