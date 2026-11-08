/**
 * AOI coverage / nodata panel — DERIVED / non-FIRM labels only.
 * Loads optional report JSON produced by scripts/reports/aoi-terrain-coverage-nodata-report.mjs.
 */
import React, { useEffect, useState } from "react";

export type AoiCoverageReport = {
  report_id?: string;
  status?: string;
  generated_at?: string;
  labels?: Record<string, string>;
  aoi?: {
    aoi_id?: string;
    name?: string;
    verification_state?: string;
    bbox?: { westLon: number; southLat: number; eastLon: number; northLat: number };
  };
  nodata?: {
    required_pins_missing?: string[];
    program_pending_providers?: string[];
    note?: string;
  };
  warnings?: string[];
  failures?: string[];
  assets?: Array<{ id: string; present: boolean; sha256?: string | null; label?: string }>;
};

type Props = {
  /** URL or import path to JSON report; if omitted, shows static policy banner only */
  reportUrl?: string;
  report?: AoiCoverageReport | null;
};

export function AoiCoveragePanel({ reportUrl, report: reportProp }: Props) {
  const [report, setReport] = useState<AoiCoverageReport | null>(reportProp ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reportProp || !reportUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(reportUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as AoiCoverageReport;
        if (!cancelled) setReport(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportUrl, reportProp]);

  return (
    <section
      aria-label="AOI terrain coverage"
      style={{
        border: "1px solid #444",
        borderRadius: 8,
        padding: 12,
        background: "#111",
        color: "#eee",
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
        maxWidth: 480,
      }}
    >
      <header style={{ marginBottom: 8 }}>
        <strong>AOI coverage</strong>
        <span
          style={{
            marginLeft: 8,
            padding: "2px 6px",
            borderRadius: 4,
            background: "#664400",
            color: "#ffd",
            fontSize: 11,
          }}
        >
          DERIVED · non-FIRM
        </span>
      </header>
      <p style={{ margin: "0 0 8px", opacity: 0.85 }}>
        3DEP / Terrain-RGB screening is not survey control and is not a substitute for the effective FIRM/FIS.
      </p>
      {error && <p style={{ color: "#f88" }}>Report load error: {error}</p>}
      {report && (
        <>
          <div>
            <div>Status: {report.status ?? "—"}</div>
            <div>AOI: {report.aoi?.name ?? report.aoi?.aoi_id ?? "—"}</div>
            <div>Verification: {report.aoi?.verification_state ?? "—"}</div>
            {report.generated_at && <div>Report: {report.generated_at}</div>}
          </div>
          {(report.nodata?.program_pending_providers?.length ?? 0) > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong>Program-pending providers</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {report.nodata!.program_pending_providers!.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            </div>
          )}
          {(report.failures?.length ?? 0) > 0 && (
            <div style={{ marginTop: 8, color: "#f88" }}>
              Fail-closed gaps: {report.failures!.join("; ")}
            </div>
          )}
          {report.assets && (
            <details style={{ marginTop: 8 }}>
              <summary>Pinned assets ({report.assets.length})</summary>
              <ul style={{ paddingLeft: 18 }}>
                {report.assets.map((a) => (
                  <li key={a.id}>
                    {a.id}: {a.present ? "present" : "missing"}
                    {a.sha256 ? ` · ${a.sha256.slice(0, 12)}…` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {!report && !error && (
        <p style={{ opacity: 0.7 }}>No report bound — run aoi-terrain-coverage-nodata-report.mjs</p>
      )}
    </section>
  );
}

export default AoiCoveragePanel;
