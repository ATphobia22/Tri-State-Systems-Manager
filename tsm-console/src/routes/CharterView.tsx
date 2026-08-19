import { useLoaderData } from 'react-router';
import type { CharterLoaderData } from '../types/loaders';

export default function CharterView() {
  const data = useLoaderData() as CharterLoaderData;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <div style={{ background: '#1e293b', borderRadius: 16, padding: '2rem', borderLeft: '4px solid #38bdf8', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', color: '#f8fafc', margin: '0 0 0.5rem' }}>{data.memorialName}</h1>
        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Version {data.charterVersion}</p>
      </div>

      <div style={{ background: '#1e293b', borderRadius: 16, padding: '1.75rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '0.85rem', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.75rem' }}>
          Stewardship Principle
        </h2>
        <p style={{ fontSize: '1rem', lineHeight: 1.6, color: '#cbd5e1', margin: 0, fontStyle: 'italic' }}>
          “{data.principle}”
        </p>
      </div>

      <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 16, padding: '1.5rem' }}>
        <h2 style={{ fontSize: '0.85rem', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.75rem' }}>
          Non-Negotiable Rule
        </h2>
        <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
          {data.humanAuthorityRule}
        </p>
      </div>

      <p style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
        Dedicated to every person—past, present, and future—in the Tri-State River Valley.
        When God is placed first, anything is possible. Technical governance remains religion-neutral and non-discriminatory.
      </p>
    </div>
  );
}
