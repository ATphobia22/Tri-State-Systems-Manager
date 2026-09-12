import { useLoaderData } from 'react-router';
import type { MapTwinLoaderData } from '../types/loaders';
import RealWorldTwinMap from '../components/RealWorldTwinMap';
import { SimulationDemoBanner } from '../components/AuthorityBadge';

export default function TwinCanvasView() {
  const data = useLoaderData() as MapTwinLoaderData;
  const unavailable = data.stage.source === 'UNAVAILABLE';
  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', minHeight: 0, background: '#020617' }}>
      {unavailable && <div style={{ padding: '0.5rem 1.25rem' }}><SimulationDemoBanner /></div>}
      <div style={{ flex: 1, minHeight: 0 }}><RealWorldTwinMap data={data} /></div>
      <footer style={{ padding: '0.5rem 1.25rem', fontSize: '0.7rem', color: '#94a3b8', background: '#020617', borderTop: '1px solid #1e293b' }}>
        Real-source visualization · FEMA NFHL and Indiana BAFM remain distinct · HEC-RAS outputs are simulation/model evidence only · Human authority remains final.
      </footer>
    </main>
  );
}
