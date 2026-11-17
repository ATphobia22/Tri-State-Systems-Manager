/**
 * Full cinematic engineering experience — wired math, sources, streaming labels,
 * animation timeline, freeboard, gage discipline. PRESENTATION + MODEL_SIMULATION.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import CesiumRegionalTwinView from "./CesiumRegionalTwinView";
import "./CinematicEngineeringExperienceView.css";
import {
  CINEMA_SITE,
  DEFAULT_STREAM_LAYERS,
  REAL_WORLD_SOURCES,
  buildEngineeringCinemaPath,
  freeboardFt,
  inundationDepthFt,
  sampleCinemaPath,
} from "../../../packages/geo/src/cinema/CinematicEngineeringModel";
import { MTVI3_GAGE_ZERO_NAVD88 } from "../../../packages/geo/src/hydrology/GageDatumDiscipline";
import { CINEMATIC_PRESETS } from "../../../packages/geo/src/native/CinematicProductionContract";

export default function CinematicEngineeringExperienceView(): React.JSX.Element {
  const path = useMemo(() => buildEngineeringCinemaPath(), []);
  const [playing, setPlaying] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [tAnim, setTAnim] = useState(0);
  const [preset, setPreset] = useState(CINEMATIC_PRESETS[0].id);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!playing) return;
    let start = performance.now();
    const durationMs = 20000;
    const loop = (now: number) => {
      const u = ((now - start) % durationMs) / durationMs;
      setTAnim(u);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const sample = sampleCinemaPath(path, tAnim);
  const fb = freeboardFt(CINEMA_SITE.lagFt_modeling, CINEMA_SITE.bfeFt_modeling);
  const depthAtLag = inundationDepthFt(sample.wseFt ?? CINEMA_SITE.bfeFt_modeling, CINEMA_SITE.lagFt_modeling);
  const activePreset = CINEMATIC_PRESETS.find((p) => p.id === preset) ?? CINEMATIC_PRESETS[0];

  return (
    <div className="tsm-cinema-engineering">
      <div className="tsm-cinema-engineering-toolbar">
        <strong>4D engineering cinema · live Cesium map + separately labeled screening model</strong>
        <button type="button" aria-controls="tsm-cinema-model-tools" aria-expanded={controlsOpen}
          onClick={() => setControlsOpen((open) => !open)}>{controlsOpen ? "Hide engineering controls" : "Show engineering controls"}</button>
        <Link to="/cesium">Open standalone Cesium 4D</Link>
        <Link to="/flood-sim">Open flood simulation</Link>
      </div>
      <div className={`tsm-cinema-engineering-workspace${controlsOpen ? " has-tools" : ""}`}>
      <section className="tsm-cinema-engineering-map" aria-label="Real Cesium 4D source-derived scene">
        <CesiumRegionalTwinView autoFlyover={playing} />
      </section>

      <aside id="tsm-cinema-model-tools" hidden={!controlsOpen} className="tsm-cinema-engineering-panel" style={{ padding: 16, overflow: "auto" }}>
        <h1 style={{ fontSize: 18, margin: "0 0 8px", color: "#38bdf8" }}>Cinematic Engineering</h1>
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 0 }}>{CINEMA_SITE.name}</p>
        <p style={{ fontSize: 11, color: "#fbbf24" }}>Cesium camera flyover and the illustrative hydraulic timeline share Play/Pause; map elevations and gauge readings are not driven by model WSE. No unverified flood geometry is overlaid.</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button type="button" onClick={() => setPlaying((p) => !p)} style={btn}>
            {playing ? "Pause" : "Play"} model timeline + Cesium flyover
          </button>
          <button type="button" onClick={() => { setPlaying(false); setTAnim(0); }} style={btn}>
            Reset
          </button>
        </div>

        <label style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
          Timeline
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={tAnim}
            onChange={(e) => setTAnim(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </label>

        <label style={{ fontSize: 12, display: "block", marginBottom: 12 }}>
          Cinematic preset
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as typeof preset)}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          >
            {CINEMATIC_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.solarTimeLocal})
              </option>
            ))}
          </select>
        </label>
        <p style={{ fontSize: 11, color: "#64748b" }}>
          Weather: {activePreset.weather} · authority {activePreset.authority}
        </p>

        <h2 style={h2}>Mathematics</h2>
        <ul style={{ fontSize: 12, paddingLeft: 18 }}>
          <li>
            freeboard = LAG − BFE = {CINEMA_SITE.lagFt_modeling} − {CINEMA_SITE.bfeFt_modeling} ={" "}
            <strong>{fb.toFixed(2)} ft</strong>
          </li>
          <li>
            inundation at LAG vs current WSE: <strong>{depthAtLag.toFixed(2)} ft</strong>
          </li>
          <li>
            MTVI3 zero: <strong>{MTVI3_GAGE_ZERO_NAVD88.gageZeroFt} ft NAVD88</strong>
          </li>
          <li>WSE = stage + gage_zero (same station only)</li>
        </ul>

        <h2 style={h2}>Stream layers</h2>
        <ul style={{ fontSize: 12, paddingLeft: 18 }}>
          {DEFAULT_STREAM_LAYERS.map((l) => (
            <li key={l.id}>
              {l.label} [{l.authority}] · {l.kind}
            </li>
          ))}
        </ul>

        <h2 style={h2}>Real-world sources</h2>
        <ul style={{ fontSize: 12, paddingLeft: 18 }}>
          {REAL_WORLD_SOURCES.map((s) => (
            <li key={s.id}>
              {s.url ? (
                <a href={s.url} style={{ color: "#7dd3fc" }}>
                  {s.name}
                </a>
              ) : (
                s.name
              )}{" "}
              [{s.authority}]
            </li>
          ))}
        </ul>

        <p style={{ fontSize: 11, color: "#f87171", marginTop: 16 }}>
          Native UI: UE workspaces bind the same contracts. Windows Shipping validated only when
          Phase-4 gates PASS on the TSM Native runner.
        </p>
      </aside>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #334155",
  color: "#e2e8f0",
  borderRadius: 6,
  padding: "6px 10px",
  cursor: "pointer",
};

const h2: React.CSSProperties = { fontSize: 13, color: "#a5b4fc", margin: "16px 0 8px" };
