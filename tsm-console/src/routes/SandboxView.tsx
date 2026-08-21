import { DataMetricsCard } from '../components/DataMetricsCard';
import { GEODETIC_POLICY, AUTHORITATIVE_HORIZONTAL_EPSG, PROJ4_EPSG_2966 } from '../lib/geodetic';
import { useLoaderData, Form, useNavigation } from 'react-router';
import type { SandboxLoaderData, SandboxProject } from '../types/loaders';

export default function SandboxView() {
  const data = useLoaderData() as SandboxLoaderData;
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.4rem', color: '#f8fafc', marginBottom: '0.25rem' }}>
        Medical / Research Sandbox
      </h1>
      <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
        Isolated PHI/PII plane · IRB gate · No production data bleed · Human oversight required
      </p>

      <div
        style={{
          background: 'rgba(248,113,113,0.08)',
          border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 12,
          padding: '0.85rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '0.8rem',
          color: '#fca5a5',
        }}
      >
        Sandbox projects never write to the production Evidence Ledger or Benefit Engine.
        Classification ceiling: confidential. Export requires dual human authorization.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem' }}>
        <div style={{ background: '#1e293b', borderRadius: 16, padding: '1.25rem' }}>
          <h2 style={{ fontSize: '0.9rem', color: '#a78bfa', margin: '0 0 1rem' }}>
            Propose Sandbox Project
          </h2>
          <Form method="post" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={labelStyle}>
              Project Title
              <input name="title" required placeholder="Study title" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Principal Investigator
              <input name="pi" required placeholder="Name / institution" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              IRB Status
              <select name="irb_status" defaultValue="pending" style={inputStyle}>
                <option value="pending">Pending review</option>
                <option value="approved">Approved</option>
                <option value="exempt">Exempt</option>
                <option value="not_required">Not required</option>
              </select>
            </label>
            <label style={labelStyle}>
              Sandbox Tier
              <select name="sandbox_tier" defaultValue="deidentified" style={inputStyle}>
                <option value="deidentified">De-identified only</option>
                <option value="limited_dataset">Limited dataset</option>
                <option value="full_phi">Full PHI (highest control)</option>
              </select>
            </label>
            <button type="submit" disabled={busy} style={btnStyle}>
              {busy ? 'Submitting…' : 'Submit for IRB Gate'}
            </button>
          </Form>
        </div>

        <div style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #334155' }}>
            <span style={{ fontWeight: 600, color: '#f8fafc' }}>Active / Proposed Projects</span>
          </div>
          <div style={{ maxHeight: 420, overflow: 'auto' }}>
            {data.projects.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: '#475569' }}>
                No sandbox projects.
              </p>
            ) : (
              data.projects.map((p: SandboxProject) => (
                <div
                  key={p.id}
                  style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #0f172a' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{p.title}</span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '0.15rem 0.45rem',
                        borderRadius: 6,
                        background:
                          p.status === 'active'
                            ? 'rgba(52,211,153,0.15)'
                            : 'rgba(251,191,36,0.15)',
                        color: p.status === 'active' ? '#34d399' : '#fbbf24',
                      }}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>
                    PI: {p.pi}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                    IRB: {p.irb_status} · Tier: {p.sandbox_tier}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    
      <div style={{ marginTop: 24, padding: 16, background: '#0f172a', borderRadius: 12, border: '1px solid #1e293b' }}>
        <h3 style={{ margin: '0 0 8px', color: '#38bdf8', fontSize: 14 }}>Geodetic policy (wired)</h3>
        <pre style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'pre-wrap', margin: 0 }}>
{JSON.stringify(GEODETIC_POLICY, null, 2)}
{`EPSG:${AUTHORITATIVE_HORIZONTAL_EPSG}`}
{PROJ4_EPSG_2966}
        </pre>
        <p style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
          NAD83→ITRF2014 uses offline NGS Helmert+HTDP; browser only records transformation_chain.
        </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginTop: 16 }}>
        <DataMetricsCard title="Evidence blocks" metricValue="—" trendPercentage={0} isPositiveTrend isSimulationDemo />
        <DataMetricsCard title="Site BFE" metricValue="375.0 ft" trendPercentage={0} isPositiveTrend isSimulationDemo />
      </div>
        <p style={{ fontSize: 11, color: '#64748b', marginTop: 8, display: 'none' }}>
        </p>
      </div>
</div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#94a3b8',
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '0.5rem 0.65rem',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: '0.85rem',
  boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  marginTop: 8,
  padding: '0.6rem',
  background: '#7c3aed',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
};
