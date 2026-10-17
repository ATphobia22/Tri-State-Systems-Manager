import { Link } from 'react-router';
import FacilityStatusDashboard from '../components/FacilityStatusDashboard';

export default function FacilityStatusView() {
  return (
    <main style={{ minHeight: 'calc(100dvh - 56px)', background: '#0b1220', padding: '1.25rem', color: '#e2e8f0' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <p style={{ margin: '0 0 12px', fontSize: 13 }}>
          <Link to="/twin" style={{ color: '#38bdf8' }}>← Twin Canvas</Link>
          {' · '}
          <Link to="/ledger" style={{ color: '#a78bfa' }}>Evidence ledger</Link>
        </p>
        <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Facility status</h1>
        <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 720, lineHeight: 1.5 }}>
          Real-time <em>context</em> dashboard for screening facilities: inventory rows, optional Scenario Studio
          cascade severity, and button-fetched USGS stages at the nearest station. This is not SCADA and does not
          certify facility operational status.
        </p>
        <FacilityStatusDashboard />
      </div>
    </main>
  );
}
