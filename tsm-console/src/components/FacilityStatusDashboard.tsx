/**
 * Facility status dashboard — screening inventory + optional scenario cascade + stage context.
 *
 * NOT SCADA / operational facility status.
 * NOT real-time certification of open/closed facilities.
 * Status rows combine:
 *   - inventory metadata (SCREENING_INVENTORY)
 *   - last Scenario Studio cascade severity (SIMULATION_DEMO) if run
 *   - nearest river stage snapshot age if user fetched / shadow enabled
 *
 * Human authority remains final.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadCriticalFacilitiesCatalog, type CriticalFacilitiesCatalog } from '../lib/critical-facilities';
import type { CriticalFacility, ImpactSeverity, ScenarioStudioResult } from '../lib/scenario-studio';
import type { StationLiveSnapshot } from '../lib/multi-stage-fetch';
import { fetchAllLiveStations } from '../lib/multi-stage-fetch';

const SEV_COLOR: Record<ImpactSeverity | 'unknown', string> = {
  none: '#64748b',
  watch: '#38bdf8',
  elevated: '#fbbf24',
  severe: '#f87171',
  unknown: '#475569',
};

export type FacilityRowStatus = {
  facility: CriticalFacility;
  cascadeSeverity: ImpactSeverity | 'unknown';
  cascadeScore: number | null;
  nearestStationId: string | null;
  nearestStageFt: number | null;
  stageAgeLabel: string;
  situational: string;
};

type Props = {
  scenarioResult?: ScenarioStudioResult | null;
  stations?: StationLiveSnapshot[];
  compact?: boolean;
};

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function ageLabel(iso: string | null | undefined): string {
  if (!iso) return 'no stage snapshot';
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return 'no stage snapshot';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function buildFacilityRows(
  facilities: readonly CriticalFacility[],
  scenarioResult: ScenarioStudioResult | null | undefined,
  stations: StationLiveSnapshot[] | undefined,
): FacilityRowStatus[] {
  const byId = new Map(scenarioResult?.impacts.map((i) => [i.assetId, i]) ?? []);
  const usableStations = (stations ?? []).filter((s) => s.stage_ft != null && s.lat && s.lon);

  return facilities.map((f) => {
    const impact = byId.get(f.id);
    let nearest: StationLiveSnapshot | null = null;
    let best = Infinity;
    for (const s of usableStations) {
      const d = haversineKm(f.lat, f.lon, s.lat, s.lon);
      if (d < best) {
        best = d;
        nearest = s;
      }
    }
    const cascadeSeverity = impact?.severity ?? 'unknown';
    const situational =
      cascadeSeverity === 'unknown'
        ? 'No scenario run — inventory only'
        : `Cascade ${cascadeSeverity} (SIMULATION_DEMO)`;
    return {
      facility: f,
      cascadeSeverity,
      cascadeScore: impact?.score ?? null,
      nearestStationId: nearest?.stationId ?? null,
      nearestStageFt: nearest?.stage_ft ?? null,
      stageAgeLabel: ageLabel(nearest?.retrievedAt ?? nearest?.observedAt),
      situational,
    };
  });
}

export default function FacilityStatusDashboard({
  scenarioResult = null,
  stations: stationsProp,
  compact = false,
}: Props): React.JSX.Element {
  const [catalog, setCatalog] = useState<CriticalFacilitiesCatalog | null>(null);
  const [localStations, setLocalStations] = useState<StationLiveSnapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCriticalFacilitiesCatalog()
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Catalog load failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stations = stationsProp ?? localStations;

  const rows = useMemo(
    () => buildFacilityRows(catalog?.features ?? [], scenarioResult, stations),
    [catalog, scenarioResult, stations],
  );

  const refreshStages = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const snaps = await fetchAllLiveStations();
      setLocalStations(snaps);
      setRefreshedAt(new Date().toISOString());
      if (snaps.every((s) => s.status === 'unavailable')) {
        setError('All stations unavailable (resilient).');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stage refresh failed');
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div
      role="region"
      aria-label="Facility status dashboard"
      style={{
        marginTop: compact ? 10 : 0,
        padding: compact ? 10 : 16,
        borderRadius: 8,
        border: '1px solid #334155',
        background: compact ? 'rgba(15,23,42,0.9)' : '#0b1220',
        color: '#e2e8f0',
        fontSize: compact ? 12 : 14,
      }}
    >
      <strong style={{ color: '#34d399' }}>Facility status dashboard</strong>
      <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
        Screening inventory + optional cascade severity + nearest USGS stage context.
        <strong> Not SCADA</strong>, not operational open/closed truth, not a warning system.
        Cascade rows are <strong>SIMULATION_DEMO</strong> only.
      </div>
      {catalog && (
        <div style={{ marginTop: 4, fontSize: 10, color: '#64748b' }}>
          {catalog.authorityClass} · {catalog.features.length} facilities · {catalog.source.slice(0, 100)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refreshStages()}
          style={{
            minHeight: 40,
            padding: '0.4rem 0.8rem',
            borderRadius: 8,
            border: '1px solid #065f46',
            background: 'rgba(52,211,153,0.12)',
            color: '#34d399',
            fontWeight: 700,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? 'Refreshing…' : 'Refresh nearest stages (button)'}
        </button>
      </div>
      {refreshedAt && (
        <div style={{ marginTop: 4, fontSize: 10, color: '#64748b' }}>Stages retrieved {refreshedAt}</div>
      )}
      {error && <div style={{ marginTop: 4, fontSize: 11, color: '#f87171' }}>{error}</div>}

      <div style={{ marginTop: 10, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: compact ? 11 : 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>
              <th style={{ padding: '6px 4px' }}>Facility</th>
              <th style={{ padding: '6px 4px' }}>Category</th>
              <th style={{ padding: '6px 4px' }}>Cascade</th>
              <th style={{ padding: '6px 4px' }}>Nearest stage</th>
              <th style={{ padding: '6px 4px' }}>Situational</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.facility.id} style={{ borderBottom: '1px solid #1e293b' }}>
                <td style={{ padding: '6px 4px' }}>
                  <strong>{r.facility.name}</strong>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{r.facility.county}</div>
                </td>
                <td style={{ padding: '6px 4px' }}>{r.facility.category}</td>
                <td style={{ padding: '6px 4px', color: SEV_COLOR[r.cascadeSeverity] }}>
                  {r.cascadeSeverity}
                  {r.cascadeScore != null ? ` · ${r.cascadeScore.toFixed(2)}` : ''}
                </td>
                <td style={{ padding: '6px 4px' }}>
                  {r.nearestStationId
                    ? `${r.nearestStationId}: ${r.nearestStageFt?.toFixed(2) ?? '—'} ft`
                    : '—'}
                  <div style={{ fontSize: 10, color: '#64748b' }}>{r.stageAgeLabel}</div>
                </td>
                <td style={{ padding: '6px 4px', fontSize: 10, color: '#94a3b8' }}>{r.situational}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 8, color: '#64748b' }}>
                  Loading inventory…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
