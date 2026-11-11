/**
 * Public-interest finish surface — Milestone A innovations + dual milestones.
 */
import { useMemo } from "react";
import { Link } from "react-router";
import { seedMtvi3Timeline } from "../../../packages/geo/src/public-interest/EvidenceTimeMachine";
import { defaultPoseyUncertaintyMarkers } from "../../../packages/geo/src/public-interest/UncertaintyLens";
import { buildPassport, passportToMarkdown } from "../../../packages/geo/src/public-interest/CommunityEvidencePassport";

export default function PublicInterestFinishView(): React.JSX.Element {
  const timeline = useMemo(() => seedMtvi3Timeline(), []);
  const uncertainty = useMemo(() => defaultPoseyUncertaintyMarkers(), []);
  const passport = useMemo(
    () =>
      buildPassport({
        parcelId: "65-19-08-100-008.001-010",
        addressLabel: "13101 Bonebank Rd (informational)",
        firmPanel: "Verify on MSC (e.g. 18129C0300C context)",
        stageNote: "MTVI3: stage in GAGE_DATUM; zero 318.59 ft NAVD88 from NWPS table only",
        terrainNote: "3DEP/Terrain-RGB DERIVED — not survey LAG",
      }),
    []
  );
  const md = useMemo(() => passportToMarkdown(passport), [passport]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem", color: "#e2e8f0" }}>
      <h1 style={{ color: "#38bdf8" }}>Public-Interest Finish</h1>
      <p style={{ color: "#94a3b8", fontSize: 14 }}>
        Make evidence reproducible, inspectable, and transferable — even without Unreal or a Windows workstation.
        Assembling government evidence is not the same as validating every engineering conclusion.
      </p>

      <section style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 16, color: "#a78bfa" }}>Dual milestones</h2>
        <ul style={{ fontSize: 13 }}>
          <li>
            <strong>A — Scientific / public-interest:</strong> source manifest, methods, limitations, repeatable
            non-UE tests
          </li>
          <li>
            <strong>B — Production software:</strong> UE5.8 Shipping, offline Win11, validated tiles, release package
          </li>
        </ul>
        <p style={{ fontSize: 12, color: "#fbbf24" }}>Prioritize A, then close B without compromising honesty.</p>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 16, color: "#a78bfa" }}>Evidence Time Machine</h2>
        <p style={{ fontSize: 13 }}>{timeline.label}</p>
        <ol style={{ fontSize: 12 }}>
          {timeline.revisions.map((r) => (
            <li key={r.at + r.summary}>
              <time>{r.at}</time> — [{r.authority}] {r.summary}
            </li>
          ))}
        </ol>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 16, color: "#a78bfa" }}>Uncertainty Lens</h2>
        <ul style={{ fontSize: 12 }}>
          {uncertainty.map((u) => (
            <li key={u.id}>
              <strong>{u.kind}</strong> ({u.severity}): {u.message}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 16, color: "#a78bfa" }}>Community Evidence Passport</h2>
        <pre
          style={{
            fontSize: 11,
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 8,
            padding: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {md}
        </pre>
      </section>

      <p style={{ marginTop: 24, fontSize: 13 }}>
        <Link to="/experiences" style={{ color: "#7dd3fc" }}>
          Experience Hub
        </Link>
        {" · "}
        <Link to="/cinematic-engineering" style={{ color: "#7dd3fc" }}>
          Cinematic Engineering
        </Link>
      </p>
    </div>
  );
}
