/**
 * Static-Pages-compatible, on-demand USGS current stage reader.
 * No credential, API proxy, polling, synthetic values, or local datum conversion.
 * Source: https://api.waterdata.usgs.gov/docs/ogcapi/
 */
import { useEffect, useRef, useState } from 'react';

interface GaugeStation {
  stationId: string; name: string; river: string; sourceUri: string;
}
interface GaugeObservation {
  value: number; unit: string; timestamp: string; approval: string;
  qualifier: string; sourceUrl: string; stationId: string;
}
const ENDPOINT = 'https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items';

export default function PagesUSGSGaugeReader(): JSX.Element {
  const [stations, setStations] = useState<GaugeStation[]>([]);
  const [stationId, setStationId] = useState('03378500');
  const [status, setStatus] = useState('Choose a USGS station and request a current observation.');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState<GaugeObservation | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/tsm-river-gauge-locations.geojson`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: { features?: { properties?: GaugeStation }[] }) => {
        const items = (data.features ?? []).map((f) => f.properties)
          .filter((f): f is GaugeStation => Boolean(f?.stationId && f.name && f.sourceUri));
        setStations(items);
        if (items.length && !items.some((s) => s.stationId === stationId)) setStationId(items[0]!.stationId);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return;
        setStatus('Station registry could not be loaded from the deployed Pages artifact.');
      });
    return () => { controller.abort(); abortRef.current?.abort(); };
    // The initial station ID is intentionally the existing published local registry default.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getReading = async (): Promise<void> => {
    if (!stations.some((s) => s.stationId === stationId)) {
      setStatus('Select a verified registry station first.'); return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setReading(null);
    setBusy(true);
    setStatus('Requesting USGS latest continuous gage height (00065)…');
    const timeout = setTimeout(() => controller.abort(), 20000);
    const url = new URL(ENDPOINT);
    url.searchParams.set('monitoring_location_id', `USGS-${stationId}`);
    url.searchParams.set('parameter_code', '00065');
    url.searchParams.set('limit', '3');
    url.searchParams.set('f', 'json');
    try {
      const response = await fetch(url.toString(), { signal: controller.signal, headers: { Accept: 'application/geo+json, application/json' } });
      if (!response.ok) throw new Error(`USGS HTTP ${response.status}`);
      const data = await response.json() as { type?: string; features?: { properties?: Record<string, unknown> }[] };
      if (data.type !== 'FeatureCollection') throw new Error('USGS did not return an OGC feature collection');
      const features = (data.features ?? []).filter((f) => f.properties?.monitoring_location_id === `USGS-${stationId}`
        && f.properties?.parameter_code === '00065');
      const records = features.map((f) => {
        const p = f.properties ?? {};
        const raw = p.value;
        const numeric = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : Number.NaN;
        const time = typeof p.time === 'string' ? p.time : '';
        const unit = typeof p.unit_of_measure === 'string' ? p.unit_of_measure : '';
        const approval = Array.isArray(p.approval_status) ? p.approval_status.join(', ') : typeof p.approval_status === 'string' ? p.approval_status : 'unreported';
        const qualifier = typeof p.qualifier === 'string' ? p.qualifier : Array.isArray(p.qualifier) ? p.qualifier.join(', ') : '';
        return { value: numeric, timestamp: time, unit, approval, qualifier };
      }).filter((p) => Number.isFinite(p.value) && p.timestamp);
      records.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
      if (records.length === 0) {
        setStatus('USGS returned no usable recent gage-height observation for this station. No value was filled in.');
      } else {
        const record = records[0]!;
        setReading({
          value: record.value, unit: record.unit || 'unit not reported', timestamp: record.timestamp,
          approval: record.approval, qualifier: record.qualifier, sourceUrl: url.toString(), stationId,
        });
        setStatus('Received a source-labeled USGS observation. Stage is on its original gage reference, not NAVD88.');
      }
    } catch (e: unknown) {
      setStatus(`Live USGS request unavailable: ${e instanceof Error ? e.message : String(e)}. No observation is inferred.`);
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  };
  const station = stations.find((s) => s.stationId === stationId);
  return <section aria-label="Direct source current USGS gage height reader">
    <h2>Current river conditions — direct from USGS</h2>
    <p>Fetch a latest observation from the public federal data service. This works in a static browser if USGS permits the request. It is never an emergency warning or certified water-surface elevation.</p>
    <label htmlFor="tsm-pages-gauge-select">Gauge station
      <select id="tsm-pages-gauge-select" value={stationId} onChange={(e) => { setStationId(e.target.value); setReading(null); setStatus('Select Fetch to request a new observation.'); }}>
        {stations.map((s) => <option key={s.stationId} value={s.stationId}>{s.name}</option>)}
      </select>
    </label>
    {station && <p className="tsm-atlas-note">USGS {station.stationId} · {station.river} · <a href={station.sourceUri} target="_blank" rel="noopener noreferrer">Official monitoring location</a></p>}
    <button className="tsm-atlas-reset" type="button" onClick={() => void getReading()} disabled={busy || !station}>
      {busy ? 'Contacting USGS…' : 'Fetch current gage height (00065)'}
    </button>
    <p role="status" aria-live="polite" className="tsm-atlas-note">{status}</p>
    {reading && <article className="tsm-atlas-history-record">
      <h3>Latest retrieved stage</h3>
      <p><strong>{reading.value} {reading.unit}</strong> — station gage reference ONLY; no NAVD88 conversion.</p>
      <dl>
        <dt>Station</dt><dd>USGS-{reading.stationId}</dd>
        <dt>Observed at</dt><dd>{reading.timestamp}</dd>
        <dt>Approval</dt><dd>{reading.approval}</dd>
        <dt>Qualifiers</dt><dd>{reading.qualifier || 'none reported'}</dd>
      </dl>
      <a href={reading.sourceUrl} target="_blank" rel="noopener noreferrer">Inspect exact USGS data request</a>
    </article>}
    <p className="tsm-atlas-note">No automatic refresh. “Latest” depends on station telemetry; confirm timestamp and provisional approval before interpreting.</p>
  </section>;
}
