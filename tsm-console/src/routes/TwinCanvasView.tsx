import { useLoaderData, Link } from 'react-router';
import type { MapTwinLoaderData } from '../types/loaders';
import { t } from '../lib/design-tokens';
import RealWorldTwinMap from '../components/RealWorldTwinMap';
import { SimulationDemoBanner } from '../components/AuthorityBadge';

export default function TwinCanvasView() {
  const data = useLoaderData() as MapTwinLoaderData;
  const unavailable = data.stage.source === 'UNAVAILABLE';
  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 56px)', minHeight: 0, background: t.color.surface.deep }}>
      {unavailable && <div style={{ padding: '0.5rem 1.25rem' }}><SimulationDemoBanner /></div>}
      <div style={{ flex: 1, minHeight: 0 }}><RealWorldTwinMap data={data} /></div>
      <footer style={{ padding: '0.5rem 1.25rem', fontSize: t.font.size.sm, color: t.color.text.secondary, background: t.color.surface.deep, borderTop: `1px solid ${t.color.surface.card}` }}>
        Real-source visualization · FEMA NFHL and Indiana BAFM remain distinct · HEC-RAS outputs are simulation/model evidence only · Human authority remains final.{' '}
        <Link to="/digital-twin" style={{ color: t.color.accent.brand }}>Twin summary</Link>
      </footer>
    </main>
  );
}
