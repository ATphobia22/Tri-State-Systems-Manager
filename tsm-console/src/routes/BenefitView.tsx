import { useLoaderData, Form, useNavigation } from 'react-router';
import type { BenefitLoaderData } from '../types/loaders';

export default function BenefitView() {
  const data = useLoaderData() as BenefitLoaderData;
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.4rem', color: '#f8fafc', marginBottom: '0.25rem' }}>
        Community Benefit Engine
      </h1>
      <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
        Multi-dimensional impact · Human authorization required · AI informs only
      </p>

      <div style={{ background: '#1e293b', borderRadius: 16, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <Form method="post" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <label style={{ flex: 1, minWidth: 200, fontSize: '0.7rem', color: '#94a3b8' }}>
            Intervention Name
            <input name="name" required placeholder="e.g., Mount Vernon Riverfront Upgrade"
              style={inputStyle} />
          </label>
          <label style={{ width: 160, fontSize: '0.7rem', color: '#94a3b8' }}>
            Est. Cost
            <input name="cost" required placeholder="$4.2M" style={inputStyle} />
          </label>
          <button type="submit" disabled={busy} style={{
            padding: '0.55rem 1.25rem', background: '#7c3aed', color: '#fff',
            border: 'none', borderRadius: 8, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
          }}>
            {busy ? 'Evaluating…' : 'Submit for Human Review'}
          </button>
        </Form>
        <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 10 }}>
          Scores are placeholders until governed models are authorized. Status always starts as pending_human_review.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {data.interventions.length === 0 && (
          <p style={{ color: '#475569', textAlign: 'center', padding: '2rem' }}>No interventions yet.</p>
        )}
        {data.interventions.map((i) => (
          <div key={i.id} style={{ background: '#1e293b', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>{i.intervention_name}</h3>
              <span style={{
                fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: 6,
                background: i.status === 'authorized' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)',
                color: i.status === 'authorized' ? '#34d399' : '#fbbf24',
              }}>
                {i.status}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, fontSize: '0.8rem' }}>
              <Metric label="Safety" value={i.safety_impact} />
              <Metric label="Economic" value={i.economic_impact} />
              <Metric label="Health" value={i.health_impact} />
              <Metric label="Equity" value={i.equity_impact} />
              <Metric label="Resilience" value={i.resilience_impact} />
            </div>
            <div style={{ marginTop: 10, fontSize: '0.75rem', color: '#64748b' }}>
              Cost: {i.cost_estimate} · Human authorization required: yes
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ color: '#94a3b8', fontSize: '0.65rem' }}>{label}</div>
      <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{value}/100</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 4, padding: '0.5rem 0.65rem',
  background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
  color: '#e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box',
};
