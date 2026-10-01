/**
 * RiverGaugeBoard — on-demand live snapshots.
 *
 * Owner direction 2026-10-01: river data yes, live polling no — plus a button
 * that fetches a live snapshot of all gauges when the user presses it.
 *
 * This component NEVER polls. The button is the only trigger: it fetches
 * current instantaneous values from USGS (OGC latest-continuous, falling back
 * to Water Services nwis/iv), timestamps the snapshot, and marks every value
 * provisional. Stations that do not return data are shown as unavailable —
 * never filled in. Gage-height values are on the USGS gage datum, NOT NAVD88.
 */
import { useCallback, useRef, useState } from 'react';
import {
  fetchUsgsLatestContinuous,
  type UsgsDirectObservation,
} from '../lib/usgs-direct';

interface SnapshotStation {
  siteNo: string;
  name: string;
  river: string;
}

const SNAPSHOT_STATIONS: readonly SnapshotStation[] = [
  { siteNo: '03378500', name: 'Wabash River at Mount Carmel, IL', river: 'Wabash River' },
  { siteNo: '03322000', name: 'Ohio River at Evansville, IN', river: 'Ohio River' },
  { siteNo: '03304300', name: 'Ohio River at Newburgh Lock and Dam, IN', river: 'Ohio River' },
  { siteNo: '03322420', name: 'Ohio River at Uniontown Dam, KY', river: 'Ohio River' },
  { siteNo: '03381700', name: 'Ohio River at Old Shawneetown, IL-KY', river: 'Ohio River' },
  { siteNo: '03399800', name: 'Ohio River at Smithland Dam, Smithland, KY', river: 'Ohio River' },
  { siteNo: '03303280', name: 'Ohio River at Cannelton Dam at Cannelton, IN', river: 'Ohio River' },
  { siteNo: '03612600', name: 'Ohio River at Olmsted, IL', river: 'Ohio River' },
  { siteNo: '03277200', name: 'Ohio River at Markland Dam near Warsaw, KY', river: 'Ohio River' },
  { siteNo: '03293600', name: 'Ohio River at McAlpine Dam — Headwater', river: 'Ohio River' },
  { siteNo: '03294500', name: 'Ohio River at Louisville, KY', river: 'Ohio River' },
  { siteNo: '03293551', name: 'Ohio River upstream of McAlpine Dam at railroad bridge, Louisville, KY', river: 'Ohio River' },
];

interface StationSnapshot {
  station: SnapshotStation;
  observations: UsgsDirectObservation[];
  unavailable: boolean;
  error?: string;
}

const cardStyle = {
  background: '#06101a',
  color: '#f8fafc',
  border: '1px solid #334155',
  borderRadius: 18,
  padding: 20,
} as const;

const buttonStyle = {
  background: '#0ea5e9',
  color: '#04121f',
  border: 'none',
  borderRadius: 12,
  padding: '12px 22px',
  fontSize: '1.05rem',
  fontWeight: 800,
  cursor: 'pointer',
} as const;

async function fetchStationIvFallback(siteNo: string): Promise<UsgsDirectObservation[]> {
  const url =
    `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteNo}&parameterCd=00060,00065`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`NWIS IV HTTP ${response.status}`);
    const payload = (await response.json()) as {
      value?: { timeSeries?: Array<any> };
    };
    const retrievedAt = new Date().toISOString();
    const out: UsgsDirectObservation[] = [];
    for (const ts of payload.value?.timeSeries ?? []) {
      const code = String(ts?.variable?.variableCode?.[0]?.value ?? '');
      if (code !== '00060' && code !== '00065') continue;
      const vals = ts?.values?.[0]?.value ?? [];
      const latest = vals[vals.length - 1];
      const value = Number(latest?.value);
      if (!Number.isFinite(value)) continue;
      out.push({
        stationId: siteNo,
        parameterCode: code,
        value,
        unit: typeof ts?.variable?.unit?.unitCode === 'string' ? ts.variable.unit.unitCode : null,
        observedAt: typeof latest?.dateTime === 'string' ? latest.dateTime : retrievedAt,
        retrievedAt,
        sourceUri: url,
        verticalDatum: 'GAGE_DATUM',
        provider: 'USGS',
      });
    }
    if (!out.length) throw new Error('NWIS IV returned no usable observations');
    return out;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchStation(station: SnapshotStation): Promise<StationSnapshot> {
  try {
    const observations = await fetchUsgsLatestContinuous(station.siteNo, ['00065', '00060']);
    return { station, observations, unavailable: false };
  } catch (primaryError) {
    try {
      const observations = await fetchStationIvFallback(station.siteNo);
      return { station, observations, unavailable: false };
    } catch (fallbackError) {
      return {
        station,
        observations: [],
        unavailable: true,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      };
    }
  }
}

function formatValue(obs: UsgsDirectObservation | undefined, digits: number): string {
  if (!obs) return '—';
  return `${obs.value.toFixed(digits)}${obs.unit ? ` ${obs.unit}` : ''}`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function RiverGaugeBoard(): JSX.Element {
  const [snapshots, setSnapshots] = useState<StationSnapshot[] | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [doneCount, setDoneCount] = useState(0);
  const runId = useRef(0);

  const fetchSnapshot = useCallback(async () => {
    const id = ++runId.current;
    setFetching(true);
    setFetchError(null);
    setDoneCount(0);
    setSnapshots(null);
    try {
      const results: StationSnapshot[] = [];
      await Promise.all(
        SNAPSHOT_STATIONS.map(async (station) => {
          const snap = await fetchStation(station);
          if (runId.current !== id) return;
          results.push(snap);
          setDoneCount((c) => c + 1);
        }),
      );
      if (runId.current !== id) return;
      results.sort((a, b) => a.station.siteNo.localeCompare(b.station.siteNo));
      setSnapshots(results);
      setFetchedAt(new Date().toISOString());
      if (results.every((r) => r.unavailable)) {
        setFetchError('USGS did not return data for any station. Nothing is fabricated — try again later.');
      }
    } catch (err) {
      if (runId.current !== id) return;
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      if (runId.current === id) setFetching(false);
    }
  }, []);

  return (
    <section aria-labelledby="river-gauge-board-title" style={cardStyle}>
      <h2 id="river-gauge-board-title" style={{ fontSize: '1.15rem', lineHeight: 1.5, margin: 0, fontWeight: 900 }}>
        River Watch — on-demand snapshots
      </h2>
      <p style={{ margin: '6px 0 12px', color: '#cbd5e1', fontSize: '1rem' }}>
        No automatic polling. Press the button to fetch one live snapshot of all{' '}
        {SNAPSHOT_STATIONS.length} registry gauges from USGS. Every value is provisional.
      </p>
      <button
        type="button"
        onClick={fetchSnapshot}
        disabled={fetching}
        style={{ ...buttonStyle, opacity: fetching ? 0.6 : 1, cursor: fetching ? 'wait' : 'pointer' }}
      >
        {fetching ? `Fetching… ${doneCount}/${SNAPSHOT_STATIONS.length}` : 'Fetch live snapshot'}
      </button>

      {fetchError && (
        <p role="alert" style={{ margin: '12px 0 0', color: '#fca5a5', fontSize: '0.95rem' }}>
          {fetchError}
        </p>
      )}

      {fetchedAt && snapshots && (
        <p style={{ margin: '12px 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
          Snapshot taken {formatTime(fetchedAt)} · user-initiated · provisional USGS observations ·
          gage heights on USGS gage datum (not NAVD88)
        </p>
      )}

      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        {(snapshots ?? SNAPSHOT_STATIONS.map((station) => ({ station, observations: [], unavailable: false }))).map(
          (snap) => {
            const s = snap as StationSnapshot;
            const discharge = s.observations.find((o) => o.parameterCode === '00060');
            const gageHeight = s.observations.find((o) => o.parameterCode === '00065');
            const hasData = snapshots !== null;
            return (
              <div
                key={s.station.siteNo}
                style={{
                  border: '1px solid #1e293b',
                  borderRadius: 12,
                  padding: '10px 14px',
                  background: '#0a1622',
                }}
              >
                <div style={{ fontWeight: 700 }}>{s.station.name}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  {s.station.river} · USGS {s.station.siteNo}
                </div>
                {!hasData ? (
                  <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 4 }}>
                    No snapshot yet — press the button above.
                  </div>
                ) : s.unavailable ? (
                  <div style={{ color: '#fca5a5', fontSize: '0.9rem', marginTop: 4 }}>
                    Unavailable{s.error ? ` — ${s.error}` : ''} (not fabricated)
                  </div>
                ) : (
                  <div style={{ marginTop: 4, fontSize: '0.95rem' }}>
                    <span style={{ marginRight: 16 }}>
                      Discharge: <strong>{formatValue(discharge, 0)}</strong>
                    </span>
                    <span style={{ marginRight: 16 }}>
                      Gage height: <strong>{formatValue(gageHeight, 2)}</strong>
                    </span>
                    <span
                      style={{
                        background: '#854d0e',
                        color: '#fef3c7',
                        borderRadius: 6,
                        padding: '2px 8px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                      }}
                    >
                      PROVISIONAL
                    </span>
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 2 }}>
                      Observed {formatTime((discharge ?? gageHeight)?.observedAt)}
                    </div>
                  </div>
                )}
              </div>
            );
          },
        )}
      </div>
    </section>
  );
}
