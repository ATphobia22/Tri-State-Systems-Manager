/** Historical floods in the Ohio–Wabash valley; published point observations only. */
import { useEffect, useState } from 'react';

interface FloodRecord {
  id: string; label: string; year: number; stationId: string; location: string;
  gageHeightFt: number; gageDatum: string; authority: string; sourceUrl: string;
  evidenceClass: string; note: string;
}
interface HistoryFile { records: FloodRecord[]; spatialLimitations: string }
export default function CommunityFloodHistory(): JSX.Element {
  const [records, setRecords] = useState<FloodRecord[]>([]);
  const [status, setStatus] = useState('Loading historical sources…');
  const [selected, setSelected] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/community-flood-history.json`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<HistoryFile>; })
      .then((data) => { setRecords(data.records); setSelected(data.records[0]?.id ?? ''); setStatus(data.spatialLimitations); })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return;
        setStatus(`Historical evidence unavailable: ${e instanceof Error ? e.message : String(e)}`);
      });
    return () => controller.abort();
  }, []);
  const active = records.find((r) => r.id === selected);
  return (
    <section aria-label="Past flooding evidence from government sources">
      <h2>Remember the water — historic flood records</h2>
      <p>Explore recorded flood crests and the government reports behind them. A historical crest is not a georeferenced inundation map or a replay of a calibrated hydraulic model.</p>
      <label htmlFor="tsm-history-record">Historic event
        <select id="tsm-history-record" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {records.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </label>
      {active && <article className="tsm-atlas-history-record">
        <h3>{active.year} · {active.location}</h3>
        <p><strong>{active.gageHeightFt.toFixed(2)} feet</strong> — historical station stage as reported; NOT NAVD88 elevation, NOT a predicted water surface.</p>
        <dl>
          <dt>USGS station</dt><dd>{active.stationId}</dd>
          <dt>Datum classification</dt><dd>{active.gageDatum}</dd>
          <dt>Evidence status</dt><dd>{active.evidenceClass}</dd>
          <dt>Source</dt><dd>{active.authority}</dd>
        </dl>
        <p>{active.note}</p>
        <a href={active.sourceUrl} target="_blank" rel="noopener noreferrer">Review original government report</a>
      </article>}
      <p className="tsm-atlas-note" role="status">{status}</p>
      <a href="https://pubs.usgs.gov/publication/wsp838" target="_blank" rel="noopener noreferrer">1937 Ohio and Mississippi flood — USGS archival report</a>
    </section>
  );
}
