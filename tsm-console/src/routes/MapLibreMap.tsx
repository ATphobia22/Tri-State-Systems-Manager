import { useMemo, useState } from 'react';
import { useLoaderData } from 'react-router';
import type { MapTwinLoaderData } from '../types/loaders';
import RealWorldTwinMap from '../components/RealWorldTwinMap';
import { assessClearanceSupport, type JurisdictionId } from '../lib/jurisdiction-rules';

export default function MapLibreMap() {
  const data = useLoaderData() as MapTwinLoaderData;
  const [jurisdiction, setJurisdiction] = useState<JurisdictionId>('INDIANA');
  const [stageOverride, setStageOverride] = useState<number>(data.stage.value_ft ?? 0);
  const usingLive = data.stage.value_ft != null && data.stage.source !== 'UNAVAILABLE';
  const displayStage = usingLive ? (data.stage.value_ft ?? 0) : stageOverride;
  const bfeFt = data.site.elevations.bfe_ft;
  const lagFt = data.site.elevations.lag_ft;
  const assessment = useMemo(() => bfeFt == null || lagFt == null ? null : assessClearanceSupport({ jurisdiction, waterStageFt: displayStage, bfeFt, lagFt }), [jurisdiction, displayStage, bfeFt, lagFt]);

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', minHeight: 0, background: '#020617' }}>
      <div style={{ flex: 1, minHeight: 0 }}><RealWorldTwinMap data={data} /></div>
      <section aria-label="Hydraulic visualization controls" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12, padding: '0.75rem 1rem', background: '#0f172a', borderTop: '1px solid #1e293b', color: '#cbd5e1', fontSize: '0.8rem' }}>
        <label>Visualization stage<input aria-label="Visualization stage" type="range" min={365} max={390} step={0.05} value={stageOverride} onChange={(event) => setStageOverride(Number(event.target.value))} disabled={usingLive || bfeFt == null || lagFt == null} style={{ display: 'block', width: '100%' }} /></label>
        <div>Jurisdiction {(['INDIANA', 'ILLINOIS', 'KENTUCKY'] as JurisdictionId[]).map((value) => <button key={value} type="button" onClick={() => setJurisdiction(value)} style={{ marginRight: 4 }}>{value.slice(0, 3)}</button>)}</div>
        <div>{assessment ? `${assessment.code}: ${assessment.finding}` : 'Engineering comparison unavailable: verified BFE/LAG evidence required'} · {usingLive ? `live ${displayStage.toFixed(2)} ft` : 'simulation slider'} · FEMA NFHL and Indiana BAFM remain separate authority planes.</div>
      </section>
    </main>
  );
}
