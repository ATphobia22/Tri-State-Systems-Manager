/**
 * Operations dashboard — user-triggered hydrology snapshots and facility screening.
 * This is not a SCADA control plane and never auto-polls gauge providers.
 */
import { Link } from 'react-router';
import RiverGaugeBoard from '../components/RiverGaugeBoard';

export default function OpsDashboardView(): JSX.Element {
  return (
    <main
      style={{
        width: '100%',
        minHeight: '100vh',
        background: '#0b1220',
        color: '#e5e7eb',
        padding: 32,
        boxSizing: 'border-box',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Operations dashboard</h1>
      <p style={{ fontSize: 14, color: '#9ca3af', maxWidth: 760, lineHeight: 1.6 }}>
        Read-only, user-triggered river observations are available below. This page is not SCADA:
        it does not control infrastructure, infer safe/unsafe conditions, or refresh in the background.
        Missing or stale source data stays explicit.
      </p>
      <div style={{ maxWidth: 1200, margin: '20px 0' }}>
        <RiverGaugeBoard />
      </div>
      <p style={{ fontSize: 14, color: '#9ca3af', maxWidth: 760, lineHeight: 1.6 }}>
        Screening facility context (inventory + Scenario Studio cascade + button stage refresh) lives on the{' '}
        <Link to="/facility-status" style={{ color: '#34d399' }}>Facility status dashboard</Link>
        {' '}and on{' '}
        <Link to="/twin" style={{ color: '#38bdf8' }}>Twin Canvas</Link>.
        Those surfaces are not operational open/closed truth. Human authority remains final.
      </p>
    </main>
  );
}
