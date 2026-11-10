/**
 * Evidence-to-Cinema Storyboard — presentation that cannot mutate evidence.
 */
import { getSignatureExperience } from "./signatureExperiences";

const exp = getSignatureExperience("evidence-to-cinema-storyboard")!;

const SHOTS = [
  {
    id: "shot-1",
    title: "Regional context",
    evidenceRef: "NFHL panel 18129C0300C query",
    narration: "Show Posey County structure pin and effective panel — REGULATORY layer only.",
  },
  {
    id: "shot-2",
    title: "Stage vs WSE",
    evidenceRef: "MTVI3 NWPS vertical datum table",
    narration: "Label stage in GAGE_DATUM; show conversion only with published 318.59 ft zero.",
  },
  {
    id: "shot-3",
    title: "Uncertainty",
    evidenceRef: "3DEP screening / AOI nodata report",
    narration: "Terrain is DERIVED. Do not morph hashes or claim survey LAG.",
  },
] as const;

export default function EvidenceCinemaStoryboardView(): React.JSX.Element {
  return (
    <div style={{ padding: 16, maxWidth: 960, margin: "0 auto", color: "#e2e8f0" }}>
      <h1 style={{ color: "#fbbf24" }}>{exp.title}</h1>
      <p>{exp.promise}</p>
      <p style={{ fontSize: 12, color: "#f87171" }}>
        PRESENTATION plane — storyboard shots reference evidence; they do not rewrite it.
      </p>

      <ol style={{ marginTop: 16 }}>
        {SHOTS.map((s) => (
          <li key={s.id} style={{ marginBottom: 16 }}>
            <strong>{s.title}</strong>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>Evidence: {s.evidenceRef}</div>
            <div style={{ fontSize: 13 }}>{s.narration}</div>
          </li>
        ))}
      </ol>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Never</h2>
      <ul>
        {exp.neverClaims.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
