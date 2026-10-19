import { useLoaderData } from 'react-router';
import type { MemorialLoaderData } from '../types/loaders';

/**
 * In loving memory of Beverly Ann Tucker.
 *
 * This is a memorial dedication only. It is not governance, not policy,
 * and does not drive any code behavior. The engineering principles TSM
 * follows (human authority final, evidence over theater) stand on their
 * own technical merit.
 */
export default function MemorialView() {
  const data = useLoaderData() as MemorialLoaderData;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <div style={{ background: '#1e293b', borderRadius: 16, padding: '2rem', borderLeft: '4px solid #38bdf8', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', color: '#f8fafc', margin: '0 0 0.5rem' }}>{data.memorialName}</h1>
        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>In loving memory</p>
      </div>

      <div style={{ background: '#1e293b', borderRadius: 16, padding: '1.75rem', marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '1rem', lineHeight: 1.6, color: '#cbd5e1', margin: 0, fontStyle: 'italic' }}>
          “{data.dedication}”
        </p>
      </div>

      <p style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
        Dedicated to every person—past, present, and future—in the Tri-State River Valley.
      </p>
    </div>
  );
}
