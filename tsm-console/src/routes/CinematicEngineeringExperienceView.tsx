/**
 * Full cinematic engineering experience — wired math, sources, streaming labels,
 * animation timeline, freeboard, gage discipline. PRESENTATION + MODEL_SIMULATION.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import TriStateDigitalTwinMap from "../components/TriStateDigitalTwinMap";
import CesiumRegionalTwinView from "./CesiumRegionalTwinView";
import { prefersReducedMotion } from "../lib/reduced-motion";
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
  // The public route defaults to the verified lightweight MapLibre viewer.
  // ?renderer=cesium opens the actual streamed 3D globe, not a graphic placeholder.
  const [renderer, setRenderer] = useState<'maplibre' | 'cesium'>(() =>
    new URLSearchParams(window.location.search).get('renderer') === 'cesium' ? 'cesium' : 'maplibre');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [hudOpen, setHudOpen] = useState(false);
  const stopTourForReducedMotion = useCallback(() => setPlaying(false), []);
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
    <div style={{ display: "flex", flexDirection: "column", minHeight: "min(85dvh, 850px)", background: "#070b14", color: "#e2e8f0", fontFamily: "system-ui,sans-serif" }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid #334155" }}>
        <strong style={{ flex: "1 1 180px" }}>Cinematic Engineering · real regional map</strong>
        <button type="button" data-testid="engineering-renderer-toggle" aria-pressed={renderer === 'cesium'}
          onClick={() => { setPlaying(false); setRenderer((current) => current === 'cesium' ? 'maplibre' : 'cesium'); }}
          style={{ ...btn, minHeight: 44, padding: "8px 14px" }}>
          {renderer === 'cesium' ? 'Use MapLibre 3D map' : 'Use Cesium 3D terrain & buildings'}
        </button>
        <button type="button" aria-expanded={toolsOpen} aria-controls="tsm-cinematic-engineering-tools"
          onClick={() => setToolsOpen((open) => !open)} style={{ ...btn, minHeight: 44, padding: "8px 14px" }}>
          {toolsOpen ? "Hide engineering settings" : "Show engineering settings"}
        </button>
        <button type="button" aria-pressed={hudOpen} aria-controls="tsm-cinema-model-overlay"
          onClick={() => setHudOpen((shown) => !shown)} style={{ ...btn, minHeight: 44, padding: "8px 14px" }}>
          {hudOpen ? "Hide model labels" : "Show model labels"}
        </button>
        <button type="button" disabled={prefersReducedMotion()} onClick={() => setPlaying((playing) => !playing)}
          style={{ ...btn, minHeight: 44, padding: "8px 14px" }}>{playing ? "Pause map flyover" : "Play map flyover"}</button>
        <Link to="/cesium" style={{ color: "#a5e9ff", padding: 10 }}>Cesium cinematic shots &amp; 3D tiles</Link>
      </header>
      <div style={{ display: "flex", flexWrap: "wrap", flex: 1, minHeight: 0 }}>
      <section style={{ position: "relative", flex: "1 1 540px", minWidth: 0, minHeight: "min(75dvh, 790px)", borderRight: "1px solid #1e293b" }}>
        {renderer === 'cesium'
          ? <CesiumRegionalTwinView autoFlyover={playing} />
          : <TriStateDigitalTwinMap hideSidebar regionalAtlas cinematicTour={playing}
              onTourReducedMotion={stopTourForReducedMotion} />}
        {/* The engineering model timeline is displayed OVER the actual map; it is not the rendered camera pose. */}
        {hudOpen && <div id="tsm-cinema-model-overlay"
          style={{
            position: "absolute",
            inset: 0,
            background: "transparent",
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: `${30 + sample.yawDeg * 0.2}%`,
              top: `${40 + sample.pitchDeg * 0.15}%`,
              width: 180,
              height: 120,
              border: "1px solid rgba(56,189,248,0.5)",
              borderRadius: 8,
              background: "rgba(15,23,42,0.6)",
              padding: 8,
              fontSize: 11,
              transition: "left 0.05s linear, top 0.05s linear",
            }}
          >
            <div style={{ color: "#38bdf8", fontWeight: 600 }}>Illustrative model path · not measured map camera</div>
            <div>lon {sample.lon.toFixed(5)}</div>
            <div>lat {sample.lat.toFixed(5)}</div>
            <div>h {sample.heightM.toFixed(0)} m</div>
            <div>pitch {sample.pitchDeg.toFixed(1)}°</div>
            {sample.wseFt != null && <div>WSE {sample.wseFt.toFixed(2)} ft</div>}
            <div style={{ color: "#94a3b8" }}>{sample.label}</div>
          </div>
          <div style={{ position: "absolute", left: 16, bottom: 16, fontSize: 11, color: "#94a3b8", maxWidth: 420 }}>
            Source-derived {renderer === 'cesium' ? 'Cesium 3D' : 'MapLibre'} regional viewport. Separate computed sample values are illustrative only. Terrain-RGB and 3D Tiles are source-conditional;
            Native: UE World Partition + staged TSMData. SIMULATION_DEMO / DERIVED where labeled.
          </div>
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              padding: "4px 8px",
              background: "rgba(251,191,36,0.15)",
              border: "1px solid #fbbf24",
              borderRadius: 4,
              fontSize: 11,
              color: "#fbbf24",
            }}
          >
            PRESENTATION + MODEL_SIMULATION — not FIRM / not LOMA
          </div>
        </div>}
      </section>

      <aside id="tsm-cinematic-engineering-tools" aria-label="Cinematic engineering settings" hidden={!toolsOpen}
        style={{ flex: "1 1 300px", minWidth: 0, maxWidth: "min(100%, 390px)", maxHeight: "min(85dvh, 900px)", padding: 16, overflow: "auto", background: "#0f172a" }}>
        <h1 style={{ fontSize: 18, margin: "0 0 8px", color: "#38bdf8" }}>Cinematic Engineering</h1>
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 0 }}>{CINEMA_SITE.name}</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button type="button" onClick={() => setPlaying((p) => !p)} style={btn}>
            {playing ? "Pause" : "Play"} animation
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
