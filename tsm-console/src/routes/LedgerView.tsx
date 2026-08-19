import { useLoaderData, Form, useNavigation } from 'react-router';
import type { LedgerLoaderData } from '../types/loaders';

export default function LedgerView() {
  const data = useLoaderData() as LedgerLoaderData;
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.4rem', color: '#f8fafc', marginBottom: '0.25rem' }}>
        Evidence Ledger
      </h1>
      <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
        Cryptographic provenance · SHA-256 · Merkle root · Daubert-ready
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '1.5rem' }}>
        {/* Append form */}
        <div style={{ background: '#1e293b', borderRadius: 16, padding: '1.25rem' }}>
          <h2 style={{ fontSize: '0.9rem', color: '#38bdf8', margin: '0 0 1rem' }}>
            Append Evidence Block
          </h2>
          <Form method="post" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              Source Organization
              <input name="source_org" required placeholder="e.g., Indiana DNR"
                style={inputStyle} />
            </label>
            <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              Source URI
              <input name="source_uri" required placeholder="e.g., usgs.gov/nwis/..."
                style={inputStyle} />
            </label>
            <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              Epistemology Tier (0–6)
              <select name="tier" defaultValue="1" style={inputStyle}>
                <option value="0">0 — Law / Regulation</option>
                <option value="1">1 — Gov Authoritative</option>
                <option value="2">2 — Gov Standards (NIST/GSA)</option>
                <option value="3">3 — Academic</option>
                <option value="4">4 — Public Interest</option>
                <option value="5">5 — Commercial</option>
                <option value="6">6 — Community Observation</option>
              </select>
            </label>
            <button type="submit" disabled={busy} style={{
              marginTop: 8, padding: '0.6rem', background: '#0284c7', color: '#fff',
              border: 'none', borderRadius: 8, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
            }}>
              {busy ? 'Sealing…' : 'Sign & Append (Server Merkle)'}
            </button>
          </Form>
          <p style={{ fontSize: '0.65rem', color: '#475569', marginTop: 12 }}>
            Hash and Merkle root are computed server-side. Client never supplies a trusted root.
          </p>
        </div>

        {/* Ledger table */}
        <div style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, color: '#f8fafc' }}>Immutable Log</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{data.totalCount} blocks</span>
          </div>
          {data.merkleRoot && (
            <div style={{ padding: '0.5rem 1.25rem', fontSize: '0.65rem', fontFamily: 'monospace', color: '#34d399', background: '#0f172a' }}>
              Merkle Root: {data.merkleRoot.slice(0, 32)}…
            </div>
          )}
          <div style={{ maxHeight: 420, overflow: 'auto' }}>
            {data.blocks.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: '#475569', fontSize: '0.85rem' }}>
                Ledger empty. Append the first evidence block.
              </p>
            ) : (
              data.blocks.map((b) => (
                <div key={b.evidence_id} style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #0f172a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#38bdf8' }}>{b.evidence_id}</span>
                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Tier {b.tier}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>{b.source_org}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                    {b.sha256_hash.slice(0, 24)}…
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 4, padding: '0.5rem 0.65rem',
  background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
  color: '#e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box',
};
