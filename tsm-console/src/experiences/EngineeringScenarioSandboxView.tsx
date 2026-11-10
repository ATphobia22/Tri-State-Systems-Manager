/**
 * Engineering Scenario Sandbox — calculate/compare with explicit uncertainty.
 */
import { useMemo, useState } from "react";
import { computeLagBfeFreeboard } from "../lib/lag-bfe-freeboard";
import { getSignatureExperience } from "./signatureExperiences";

const exp = getSignatureExperience("engineering-scenario-sandbox")!;

export default function EngineeringScenarioSandboxView(): React.JSX.Element {
  const [lag, setLag] = useState(377.2);
  const [bfe, setBfe] = useState(375.0);
  const result = useMemo(() => computeLagBfeFreeboard({ lagFt: lag, bfeFt: bfe, verticalDatum: "NAVD88" }), [lag, bfe]);

  return (
    <div style={{ padding: 16, maxWidth: 960, margin: "0 auto", color: "#e2e8f0" }}>
      <h1 style={{ color: "#a78bfa" }}>{exp.title}</h1>
      <p>{exp.promise}</p>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
        <label>
          LAG (ft, same datum as BFE)
          <input
            type="number"
            step="0.1"
            value={lag}
            onChange={(e) => setLag(Number(e.target.value))}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          />
        </label>
        <label>
          BFE (ft)
          <input
            type="number"
            step="0.1"
            value={bfe}
            onChange={(e) => setBfe(Number(e.target.value))}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          />
        </label>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 8,
          border: "1px solid #334155",
          background: "#0f172a",
        }}
      >
        <div>
          freeboard = LAG − BFE = <strong>{result.freeboardRoundedFt} ft</strong> ({result.verticalDatum})
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>{result.disclaimer}</div>
        <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 8 }}>Authority: {result.authority}</div>
      </div>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Math contracts</h2>
      <ul>
        {exp.mathContracts.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Sources</h2>
      <ul>
        {exp.sources.map((s) => (
          <li key={s.name}>
            <strong>{s.name}</strong> [{s.authority}] — {s.use}
          </li>
        ))}
      </ul>
    </div>
  );
}
