import { useLoaderData, Form, useNavigation } from 'react-router';
import type { LineageLoaderData, DataContractSummary } from '../types/loaders';

const classColor: Record<string, string> = {
  public: '#34d399',
  internal: '#38bdf8',
  restricted: '#fbbf24',
  confidential: '#f87171',
};

export default function LineageView() {
  const data = useLoaderData() as LineageLoaderData;
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.4rem', color: '#f8fafc', marginBottom: '0.25rem' }}>
        Data Contract Catalog
      </h1>
      <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
        Versioned lineage · Indiana Data Strategy aligned · NIST AI RMF · Classification enforced
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '1.5rem' }}>
        {/* Register form */}
        <div style={{ background: '#1e293b', borderRadius: 16, padding: '1.25rem' }}>
          <h2 style={{ fontSize: '0.9rem', color: '#38bdf8', margin: '0 0 1rem' }}>
            Register Data Contract
          </h2>
          <Form method="post" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={labelStyle}>
              Contract ID
              <input name="id" required placeholder="tsm-source-001" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Title
              <input name="title" required placeholder="Descriptive title" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Owner / Steward
              <input name="owner" required placeholder="e.g., Indiana DNR" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Classification
              <select name="classification" defaultValue="internal" style={inputStyle}>
                <option value="public">public</option>
                <option value="internal">internal</option>
                <option value="restricted">restricted</option>
                <option value="confidential">confidential</option>
              </select>
            </label>
            <label style={labelStyle}>
              Jurisdiction
              <input name="jurisdiction" defaultValue="Indiana" style={inputStyle} />
            </label>
            <button type="submit" disabled={busy} style={btnStyle}>
              {busy ? 'Validating…' : 'Validate & Commit Contract'}
            </button>
          </Form>
          <p style={{ fontSize: '0.65rem', color: '#475569', marginTop: 12 }}>
            Contracts are append-only metadata. Content hashes and permitted uses must match
            tsm-data-contract-schema-v1.0.0.json.
          </p>
        </div>

        {/* Catalog */}
        <div style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #334155' }}>
            <span style={{ fontWeight: 600, color: '#f8fafc' }}>Registered Contracts</span>
            <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#64748b' }}>
              {data.contracts.length}
            </span>
          </div>
          <div style={{ maxHeight: 480, overflow: 'auto' }}>
            {data.contracts.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: '#475569' }}>
                No contracts registered.
              </p>
            ) : (
              data.contracts.map((c: DataContractSummary) => (
                <div
                  key={c.id}
                  style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #0f172a' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#38bdf8' }}>
                      {c.id}
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '0.15rem 0.45rem',
                        borderRadius: 6,
                        background: 'rgba(0,0,0,0.3)',
                        color: classColor[c.classification] || '#94a3b8',
                      }}
                    >
                      {c.classification}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.95rem', color: '#e2e8f0', marginTop: 4 }}>{c.title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                    {c.owner} · {c.jurisdiction} · {c.validation_status}
                  </div>
                  <div style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#475569', marginTop: 4 }}>
                    {c.content_hash}
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
  background: '#0284c7',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
};
