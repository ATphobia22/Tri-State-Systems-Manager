/**
 * Living River Valley — regional explorable experience shell.
 * Real sources: NFHL, 3DEP (derived), NWPS MTVI3, USGS. Gage discipline enforced.
 */
import { MTVI3_GAGE_ZERO_NAVD88, stageToWseFt } from "../../../packages/geo/src/hydrology/GageDatumDiscipline";
import { getSignatureExperience } from "./signatureExperiences";

const exp = getSignatureExperience("living-river-valley")!;

export default function LivingRiverValleyView(): React.JSX.Element {
  // Example discipline: never show stage as NAVD88 without conversion.
  const demoStage = stageToWseFt(
    {
      stationId: "MTVI3",
      stageFt: 35,
      stageDatum: "GAGE_DATUM",
      source: "NOAA NWPS minor-flood category (illustrative)",
    },
    MTVI3_GAGE_ZERO_NAVD88
  );

  return (
    <div style={{ padding: 16, maxWidth: 960, margin: "0 auto", color: "#e2e8f0" }}>
      <h1 style={{ color: "#38bdf8" }}>{exp.title}</h1>
      <p>{exp.promise}</p>
      <p style={{ fontSize: 12, color: "#94a3b8" }}>
        Map twin and layers load from existing RealWorldTwinMap / river boards. This shell
        documents source contracts and gage discipline.
      </p>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Real-world sources</h2>
      <ul>
        {exp.sources.map((s) => (
          <li key={s.name}>
            <strong>{s.name}</strong> [{s.authority}] — {s.use}
            {s.url && (
              <>
                {" "}
                <a href={s.url} style={{ color: "#7dd3fc" }}>
                  source
                </a>
              </>
            )}
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Gage discipline (verified)</h2>
      <p style={{ fontSize: 13 }}>
        MTVI3 Gauge Zero = <strong>{MTVI3_GAGE_ZERO_NAVD88.gageZeroFt} ft NAVD88</strong>{" "}
        ({MTVI3_GAGE_ZERO_NAVD88.sourceLabel}). Minor flood <em>stage</em> 35 ft → WSE ≈{" "}
        <strong>{demoStage.wseFt?.toFixed(2)} ft NAVD88</strong>.
      </p>
      <code style={{ fontSize: 11, color: "#a5b4fc" }}>{demoStage.formula}</code>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Never</h2>
      <ul>
        {exp.neverClaims.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
