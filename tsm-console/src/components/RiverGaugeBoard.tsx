/**
 * RiverGaugeBoard — user-triggered hydrology snapshots.
 *
 * Live observations are fetched only after an explicit button press through
 * the TSM server API. The browser never calls USGS/NOAA provider endpoints
 * directly, and this component never polls or refreshes in the background.
 * Gage height remains on the source gage datum unless a verified conversion
 * is explicitly supplied by the source adapter.
 */
import { useCallback, useRef, useState } from 'react';
import { tsmApiUrl } from '../lib/api-base';

interface SnapshotStation {
  siteNo: string;
  name: string;
  river: string;
}

interface SnapshotObservation {
  stationId: string;
  provider: string;
  name?: string | null;
  value: number | null;
  unit: string | null;
  observedAt: string | null;
  retrievedAt: string | null;
  qualifier: string | null;
  provisional: boolean;
  status: string;
  dischargeCfs: number | null;
  dischargeObservedAt: string | null;
  sourceUri: string | null;
  verticalDatum: string;
  error?: string | null;
}

interface SnapshotPayload {
  generatedAt?: string;
  observations?: SnapshotObservation[];
  sourceRegistryVersion?: string;
}

interface ForecastValue {
  validAt: string;
  retrievedAt: string;
  value: number;
  unit: string;
  dataClass: 'forecast';
  verticalDatum: string;
  sourceUri: string;
}

interface StationForecast {
  stationId: string;
  provider: string;
  status: 'available' | 'unavailable';
  forecasts: ForecastValue[];
  error?: string | null;
}

interface ForecastPayload {
  generatedAt?: string;
  dataClass: 'forecast';
  forecasts?: StationForecast[];
  authority?: string;
}

interface StationSnapshot {
  station: SnapshotStation;
  observation: SnapshotObservation | null;
  unavailable: boolean;
  error?: string;
}

const SNAPSHOT_STATIONS: readonly SnapshotStation[] = [
  { siteNo: '03378500', name: 'Wabash River at New Harmony, IN', river: 'Wabash River' },
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
];

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

function formatValue(value: number | null | undefined, unit: string | null, digits: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}${unit ? ` ${unit}` : ''}`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export default function RiverGaugeBoard(): JSX.Element {
  const [snapshots, setSnapshots] = useState<StationSnapshot[] | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [forecasts, setForecasts] = useState<StationForecast[] | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const runId = useRef(0);

  const fetchSnapshot = useCallback(async () => {
    const id = ++runId.current;
    setFetching(true);
    setFetchError(null);
    setSnapshots(null);
    setFetchedAt(null);
    setForecasts(null);
    setForecastError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const stationIds = SNAPSHOT_STATIONS.map((station) => station.siteNo).join(',');
      const response = await fetch(
        tsmApiUrl(`/api/hydrologic/community?stationIds=${encodeURIComponent(stationIds)}`),
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error(`TSM hydrology API returned HTTP ${response.status}`);
      }
      const payload = (await response.json()) as SnapshotPayload;
      if (!Array.isArray(payload.observations)) {
        throw new Error('TSM hydrology API returned no observations array');
      }
      if (runId.current !== id) return;

      const results = SNAPSHOT_STATIONS.map((station): StationSnapshot => {
        const observation = payload.observations!.find((item) => item.stationId === station.siteNo) ?? null;
        const unavailable = !observation || observation.status === 'unavailable' ||
          (observation.value == null && observation.dischargeCfs == null);
        return {
          station,
          observation,
          unavailable,
          error: observation?.error || (unavailable ? 'No usable observation was returned.' : undefined),
        };
      });
      setSnapshots(results);
      setFetchedAt(payload.generatedAt || new Date().toISOString());

      // Forecasts are a separate NOAA data class. A forecast failure does not
      // invalidate a successfully fetched observation snapshot.
      try {
        const forecastResponse = await fetch(
          tsmApiUrl(`/api/hydrologic/forecast?stationIds=${encodeURIComponent(stationIds)}`),
          {
            method: 'GET',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!forecastResponse.ok) throw new Error(`TSM forecast API returned HTTP ${forecastResponse.status}`);
        const forecastPayload = await forecastResponse.json() as ForecastPayload;
        if (!Array.isArray(forecastPayload.forecasts) || forecastPayload.dataClass !== 'forecast') {
          throw new Error('TSM forecast API returned an invalid forecast payload');
        }
        if (runId.current === id) setForecasts(forecastPayload.forecasts);
      } catch (error) {
        if (runId.current === id) {
          setForecastError(error instanceof Error ? error.message : 'NOAA forecast unavailable.');
        }
      }

      if (results.every((result) => result.unavailable)) {
        setFetchError('No registered station returned a usable observation. Values were not fabricated; retry later.');
      }
    } catch (error) {
      if (runId.current !== id) return;
      setSnapshots(SNAPSHOT_STATIONS.map((station) => ({
        station,
        observation: null,
        unavailable: true,
        error: error instanceof Error ? error.message : 'Hydrology source unavailable.',
      })));
      setFetchError(error instanceof Error ? error.message : 'Hydrology source unavailable.');
    } finally {
      clearTimeout(timeout);
      if (runId.current === id) setFetching(false);
    }
  }, []);

  return (
    <section aria-labelledby="river-gauge-board-title" style={cardStyle}>
      <h2 id="river-gauge-board-title" style={{ fontSize: '1.15rem', lineHeight: 1.5, margin: 0, fontWeight: 900 }}>
        River Watch — on-demand snapshots
      </h2>
      <p style={{ margin: '6px 0 12px', color: '#cbd5e1', fontSize: '1rem' }}>
        No automatic polling. Press the button to request one snapshot for {SNAPSHOT_STATIONS.length} registered
        stations through the TSM server. Source approval status is shown only when supplied; gage heights remain
        on the source gage datum, not NAVD88.
      </p>
      <button
        type="button"
        onClick={fetchSnapshot}
        disabled={fetching}
        style={{ ...buttonStyle, opacity: fetching ? 0.6 : 1, cursor: fetching ? 'wait' : 'pointer' }}
      >
        {fetching ? 'Fetching snapshot…' : 'Fetch live snapshot'}
      </button>

      {fetchError && (
        <p role="alert" style={{ margin: '12px 0 0', color: '#fca5a5', fontSize: '0.95rem' }}>
          {fetchError}
        </p>
      )}

      {fetchedAt && snapshots && (
        <p style={{ margin: '12px 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
          Snapshot retrieved {formatTime(fetchedAt)} · user-initiated · provider timestamps and datum retained. Forecasts are separate from observations.
        </p>
      )}

      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        {(snapshots ?? SNAPSHOT_STATIONS.map((station) => ({
          station,
          observation: null,
          unavailable: false,
        }))).map((snapshot) => {
          const observation = snapshot.observation;
          const hasData = snapshots !== null;
          const freshnessLabel = observation?.status === 'current' ? 'FRESH' : 'STALE';
          const qualityLabel = observation?.provisional
            ? 'PROVISIONAL'
            : observation?.qualifier
              ? `QUALIFIER ${observation.qualifier}`
              : 'QUALITY NOT SUPPLIED';
          return (
            <div
              key={snapshot.station.siteNo}
              style={{
                border: '1px solid #1e293b',
                borderRadius: 12,
                padding: '10px 14px',
                background: '#0a1622',
              }}
            >
              <div style={{ fontWeight: 700 }}>{snapshot.station.name}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                {snapshot.station.river} · Station {snapshot.station.siteNo}
                {observation?.provider ? ` · source ${observation.provider}` : ''}
              </div>
              {!hasData ? (
                <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 4 }}>
                  No snapshot yet — press the button above.
                </div>
              ) : snapshot.unavailable ? (
                <div style={{ color: '#fca5a5', fontSize: '0.9rem', marginTop: 4 }}>
                  Unavailable{snapshot.error ? ` — ${snapshot.error}` : ''} (not fabricated)
                </div>
              ) : (
                <div style={{ marginTop: 4, fontSize: '0.95rem' }}>
                  <span style={{ marginRight: 16 }}>
                    Discharge: <strong>{formatValue(observation?.dischargeCfs, 'ft³/s', 0)}</strong>
                  </span>
                  <span style={{ marginRight: 16 }}>
                    Gage height: <strong>{formatValue(observation?.value, observation?.unit, 2)}</strong>
                  </span>
                  <span
                    style={{
                      background: freshnessLabel === 'FRESH' ? '#14532d' : '#7f1d1d',
                      color: '#fef2f2',
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      marginRight: 6,
                    }}
                  >
                    {freshnessLabel}
                  </span>
                  <span
                    style={{
                      background: observation?.provisional ? '#854d0e' : '#334155',
                      color: '#fef3c7',
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    {qualityLabel}
                  </span>
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 2 }}>
                    Observed {formatTime(observation?.observedAt)} · datum {observation?.verticalDatum || 'unverified'}
                  </div>
                </div>
              )}
              {hasData && (
                <div style={{ marginTop: 8, borderTop: '1px solid #334155', paddingTop: 8, fontSize: '0.9rem' }}>
                  <strong>NOAA forecast (separate from observation)</strong>
                  {(() => {
                    const forecastEntry = forecasts?.find((item) => item.stationId === snapshot.station.siteNo);
                    const series = [...(forecastEntry?.forecasts ?? [])]
                      .filter((item) => Number.isFinite(item.value) && item.validAt)
                      .sort((a, b) => Date.parse(a.validAt) - Date.parse(b.validAt));
                    const next = series[0];
                    const peak = series.reduce<ForecastValue | null>(
                      (highest, item) => !highest || item.value > highest.value ? item : highest,
                      null,
                    );
                    if (forecastEntry?.status === 'available' && next && peak) {
                      return (
                        <div style={{ color: '#cbd5e1', marginTop: 4 }}>
                          Next: {formatValue(next.value, next.unit, 2)} at {formatTime(next.validAt)} ·
                          max in returned horizon: {formatValue(peak.value, peak.unit, 2)} ·
                          datum {next.verticalDatum}
                        </div>
                      );
                    }
                    return (
                      <div style={{ color: '#94a3b8', marginTop: 4 }}>
                        Forecast unavailable — {forecastEntry?.error || forecastError || 'no verified forecast mapping or records'}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
