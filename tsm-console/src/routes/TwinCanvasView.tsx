import { useLoaderData, Link } from 'react-router';
import type { MapTwinLoaderData } from '../types/loaders';
import { t } from '../lib/design-tokens';
import RealWorldTwinMap from '../components/RealWorldTwinMap';
import BuildingCoverageNotice from '../components/BuildingCoverageNotice';
import { SimulationDemoBanner } from '../components/AuthorityBadge';
import { AoiCoveragePanel } from '../components/AoiCoveragePanel';

export default function TwinCanvasView() {
  const data = useLoaderData() as MapTwinLoaderData;
  const unavailable = data.stage.source === 'UNAVAILABLE';
  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 56px)', minHeight: 0, background: t.color.surface.deep }}>
      {unavailable && <div style={{ padding: '0.5rem 1.25rem' }}><SimulationDemoBanner /></div>}
      <div style={{ flex: 1, minHeight: 0 }}><RealWorldTwinMap data={data} /></div>
      <details aria-label="Twin source coverage and building evidence" style={{ padding: '0.5rem 1.25rem', background: '#f8fafc', color: '#17324d', borderTop: '1px solid #cbd5e1' }}>
        <summary style={{ cursor: 'pointer', minHeight: 44, fontWeight: 750 }}>Coverage, buildings and evidence</summary>
        <div style={{ maxHeight: '45dvh', overflowY: 'auto' }}>
          <AoiCoveragePanel />
          <BuildingCoverageNotice />
        </div>
      </details>
      <footer style={{ padding: '0.5rem 1.25rem', fontSize: t.font.size.sm, color: t.color.text.secondary, background: t.color.surface.deep, borderTop: `1px solid ${t.color.surface.card}` }}>
        Real-source visualization · FEMA NFHL and Indiana BAFM remain distinct · HEC-RAS outputs are simulation/model evidence only · Terrain coverage is DERIVED / non-FIRM · Human authority remains final.{' '}
        <Link to="/digital-twin" style={{ color: t.color.accent.brand }}>Twin summary</Link>
      </footer>
    </main>
  );
}
