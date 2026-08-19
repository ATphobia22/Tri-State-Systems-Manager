import { useLoaderData, useSearchParams, Link } from 'react-router';
import type { NeedsLoaderData } from '../types/loaders';

const locations = [
  { id: 'tri_state', name: 'Tri-State River Valley' },
  { id: 'posey', name: 'Posey County' },
  { id: 'point', name: 'Point Township' },
  { id: 'mt_vernon', name: 'Mount Vernon' },
];

const metricLabels: Record<string, string> = {
  housing: 'Housing & Shelter',
  mobility: 'Mobility & Transportation',
  healthcare: 'Healthcare Access',
  employment: 'Employment & Income',
  food: 'Food Security',
  education: 'Education & Info Access',
  safety: 'Safety & Resilience',
};

export default function NeedsView() {
  const data = useLoaderData() as NeedsLoaderData;
  const [, setSearchParams] = useSearchParams();

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.4rem', color: '#f8fafc', marginBottom: '0.25rem' }}>
        Human Needs Graph
      </h1>
      <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
        CASOA / FSSA aligned · Aggregate / de-identified · {data.source}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '1.5rem' }}>
        {locations.map((loc) => (
          <button
            key={loc.id}
            onClick={() => setSearchParams({ location: loc.id })}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 8,
              border: data.selectedLocation.id === loc.id ? '1px solid #38bdf8' : '1px solid #334155',
              background: data.selectedLocation.id === loc.id ? 'rgba(56,189,248,0.15)' : '#1e293b',
              color: data.selectedLocation.id === loc.id ? '#38bdf8' : '#94a3b8',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loc.name}
          </button>
        ))}
      </div>

      <div style={{ background: '#1e293b', borderRadius: 16, padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.15rem', color: '#f8fafc', margin: 0 }}>{data.selectedLocation.name}</h2>
          <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>
            {data.selectedLocation.level}
          </span>
        </div>

        {(Object.keys(metricLabels) as Array<keyof typeof data.metrics>).map((key) => {
          const value = data.metrics[key];
          const color = value > 40 ? '#f87171' : value > 25 ? '#fbbf24' : '#34d399';
          return (
            <div key={key} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                <span style={{ color: '#cbd5e1' }}>{metricLabels[key]}</span>
                <span style={{ color, fontWeight: 700 }}>{value}% gap</span>
              </div>
              <div style={{ height: 8, background: '#0f172a', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: '1rem', fontSize: '0.7rem', color: '#475569' }}>
        Contract: {data.dataContractId} · Privacy: de-identified aggregate only · No PII/PHI
      </p>
    </div>
  );
}
