/**
 * Operations dashboard — retired SCADA board; points to facility status screening.
 */
import { Link } from 'react-router';

export default function OpsDashboardView() {
  return (
    <div
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
      <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Operations dashboard — retired</h1>
      <p style={{ fontSize: 14, color: '#9ca3af', maxWidth: 640, lineHeight: 1.6 }}>
        The live river-gauge board was retired on 2026-09-29 by owner decision:
        TSM does not run a SCADA-style continuous gauge board here. No gauges are
        auto-polled on this page, and nothing is fabricated to fill the gap.
      </p>
      <p style={{ fontSize: 14, color: '#9ca3af', maxWidth: 640, lineHeight: 1.6 }}>
        Screening facility context (inventory + Scenario Studio cascade + button stage
        refresh) lives on the{' '}
        <Link to="/facility-status" style={{ color: '#34d399' }}>Facility status dashboard</Link>
        {' '}and on{' '}
        <Link to="/twin" style={{ color: '#38bdf8' }}>Twin Canvas</Link>.
        Those surfaces are not SCADA and not operational open/closed truth.
      </p>
      <p style={{ fontSize: 14, color: '#9ca3af', maxWidth: 640, lineHeight: 1.6 }}>
        Human authority remains final.
      </p>
    </div>
  );
}
