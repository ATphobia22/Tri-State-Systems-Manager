/**
 * Unified Experience Hub — entry to Living River, Scenario Sandbox, Evidence Cinema,
 * Cinematic Engineering, and Workspaces. Surfaces gage discipline + Terrain-RGB truth.
 */
import { Link } from "react-router";
import { MTVI3_GAGE_ZERO_NAVD88, mtvi31937CrestWseNavd88 } from "../../../packages/geo/src/hydrology/GageDatumDiscipline";
import { decodeTerrariumMeters, sampleDerivedElevationFt } from "../../../packages/geo/src/terrain/TerrainRgbCodec";
import { freeboardFt, REAL_WORLD_SOURCES } from "../../../packages/geo/src/cinema/CinematicEngineeringModel";
import { SIGNATURE_EXPERIENCES } from "./signatureExperiences";

const cards = [
  ...SIGNATURE_EXPERIENCES.map((e) => ({
    to: e.routePath.startsWith("/") ? e.routePath : `/${e.routePath}`,
    title: e.title,
    body: e.promise,
  })),
  {
    to: "/cinematic-engineering",
    title: "Cinematic Engineering",
    body: "Animated path, WSE keyframes, stream layers, freeboard math.",
  },
  {
    to: "/workspaces",
    title: "Workspace Shell",
    body: "Six workspaces: explore, layers, engineering, scenarios, cinema, evidence.",
  },
  {
    to: "/twin",
    title: "Twin Canvas",
    body: "Live map/twin surface with authority-aware layers.",
  },
];

export default function ExperienceHubView(): React.JSX.Element {
  // Illustrative Terrarium sample ~115 m ≈ screening orthometric scale near site
  const demoM = decodeTerrariumMeters(128, 115, 0);
  const derived = sampleDerivedElevationFt(demoM, { verticalDatumLabel: "PRODUCT_NATIVE" });
  const fb = freeboardFt(377.2, 375.0);
  const wse1937 = mtvi31937CrestWseNavd88();

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem", color: "#e2e8f0" }}>
      <h1 style={{ color: "#38bdf8", marginBottom: 8 }}>Tri-State Experience Hub</h1>
      <p style={{ color: "#94a3b8", fontSize: 14 }}>
        Open-world digital twin entry — explore, engineer, and explain without rewriting evidence.
        Human authority remains final.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
          gap: 12,
          marginTop: 20,
        }}
      >
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            style={{
              display: "block",
              padding: 14,
              borderRadius: 10,
              border: "1px solid #334155",
              background: "#0f172a",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <strong style={{ color: "#7dd3fc" }}>{c.title}</strong>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>{c.body}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>{c.to}</div>
          </Link>
        ))}
      </div>

      <section style={{ marginTop: 28, padding: 14, border: "1px solid #1e293b", borderRadius: 10 }}>
        <h2 style={{ fontSize: 15, color: "#a78bfa", marginTop: 0 }}>Live science strip</h2>
        <ul style={{ fontSize: 13, lineHeight: 1.6 }}>
          <li>
            MTVI3 gage zero: <strong>{MTVI3_GAGE_ZERO_NAVD88.gageZeroFt} ft NAVD88</strong> (NWPS product table)
          </li>
          <li>
            1937 crest WSE: <strong>{wse1937.toFixed(2)} ft NAVD88</strong> (59.21 + 318.59)
          </li>
          <li>
            Modeling freeboard: <strong>{fb.toFixed(2)} ft</strong> (LAG 377.2 − BFE 375.0)
          </li>
          <li>
            Terrain-RGB sample: {derived.elevationFt.toFixed(2)} ft [{derived.authority}] — {derived.disclaimer.slice(0, 80)}…
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 15, color: "#a5b4fc" }}>Real-world sources</h2>
        <ul style={{ fontSize: 12 }}>
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
      </section>
    </div>
  );
}
