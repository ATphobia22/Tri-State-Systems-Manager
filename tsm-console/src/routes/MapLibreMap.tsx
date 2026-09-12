import { useMemo, useState } from 'react';
import { useLoaderData } from 'react-router';
import type { MapTwinLoaderData } from '../types/loaders';
import RealWorldTwinMap from '../components/RealWorldTwinMap';
import { assessClearanceSupport, type JurisdictionId } from '../lib/jurisdiction-rules';
import { TWIN_ENGINEERING_CONSTANTS } from '../lib/twin-map-style';

export default function MapLibreMap() {
  const data = useLoaderData() as MapTwinLoaderData;
  const [jurisdiction, setJurisdiction] = useState<JurisdictionId>('INDIANA');
  const [stageOverride, setStageOverride] = useState(data.stage.value_ft ?? data.site.elevations.bfe_ft);
  const usingLive = data.stage.value_ft != null && data.stage.source !== 'UNAVAILABLE';
  const displayStage = usingLive ? data.stage.value_ft : stageOverride;
  const assessment = useMemo(() => assessClearanceSupport({ jurisdiction, waterStageFt: displayStage, bfeFt: TWIN_ENGINEERING_CONSTANTS.bfe_ft, lagFt: TWIN_ENGINEERING_CONSTANTS.lag_ft }), [jurisdiction, displayStage]);

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', minHeight: 0, background: '#020617' }}>
      <div style={{ flex: 1, minHeight: 0 }}><RealWorldTwinMap data={data} /></div>
      <section aria-label="Hydraulic visualization controls" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12, padding: '0.75rem 1rem', background: '#0f172a', borderTop: '1px solid #1e293b', color: '#cbd5e1', fontSize: '0.8rem' }}>
        <label>Visualization stage<input aria-label="Visualization stage" type="range" min={365} max={390} step={0.05} value={stageOverride} onChange={(event) => setStageOverride(Number(event.target.value))} disabled={usingLive} style={{ display: 'block', width: '100%' }} /></label>
        <div>Jurisdiction {(['INDIANA', 'ILLINOIS', 'KENTUCKY'] as JurisdictionId[]).map((value) => <button key={value} type="button" onClick={() => setJurisdiction(value)} style={{ marginRight: 4 }}>{value.slice(0, 3)}</button>)}</div>
        <div>{assessment.code}: {assessment.finding} · {usingLive ? `live ${displayStage?.toFixed(2)} ft` : 'simulation slider'} · FEMA NFHL and Indiana BAFM remain separate authority planes.</div>
      </section>
    </main>
  );
}
