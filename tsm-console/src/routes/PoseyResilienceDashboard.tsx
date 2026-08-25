import { useMemo, useState } from 'react';
import { POSEY_EVIDENCE, POSEY_GRANTS, POSEY_PRIORITIES, type PoseyEvidenceRecord } from '../data/poseyEvidence';

const panel: React.CSSProperties = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: 14,
  padding: '1rem',
};

function EvidenceRow({ record }: { record: PoseyEvidenceRecord }) {
  const verified = record.status === 'verified';
  return (
    <article style={{ ...panel, padding: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <strong style={{ color: '#f8fafc', fontSize: '0.82rem' }}>{record.title}</strong>
          <div style={{ color: '#64748b', fontSize: '0.68rem', marginTop: 3 }}>{record.agency}</div>
        </div>
        <span style={{
          borderRadius: 999,
          padding: '0.2rem 0.45rem',
          fontSize: '0.62rem',
          background: verified ? 'rgba(52,211,153,.12)' : 'rgba(251,191,36,.12)',
          color: verified ? '#34d399' : '#fbbf24',
          whiteSpace: 'nowrap',
        }}>
          {verified ? 'VERIFIED' : 'LEGACY / UNVERIFIED'}
        </span>
      </div>
      <p style={{ color: '#cbd5e1', fontSize: '0.74rem', lineHeight: 1.45, margin: '0.65rem 0' }}>{record.claim}</p>
      <p style={{ color: '#64748b', fontSize: '0.68rem', lineHeight: 1.4, margin: 0 }}>{record.notes}</p>
      {record.sourceUrl && (
        <a href={record.sourceUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, color: '#38bdf8', fontSize: '0.68rem' }}>
          Official source ↗
        </a>
      )}
    </article>
  );
}

export default function PoseyResilienceDashboard() {
  const [query, setQuery] = useState('');
  const [showLegacy, setShowLegacy] = useState(false);
  const filteredEvidence = useMemo(() => POSEY_EVIDENCE.filter((record) => {
    if (!showLegacy && record.status !== 'verified') return false;
    const haystack = `${record.title} ${record.agency} ${record.claim}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [query, showLegacy]);

  const verifiedCount = POSEY_EVIDENCE.filter((record) => record.status === 'verified').length;
  const currentFunding = POSEY_GRANTS.filter((grant) => grant.status === 'current').length;

  return (
    <section aria-labelledby="posey-title" style={{ maxWidth: 1180, margin: '0 auto', padding: '1.25rem', color: '#e2e8f0' }}>
      <header style={{ marginBottom: '1rem' }}>
        <div style={{ color: '#38bdf8', fontSize: '0.68rem', letterSpacing: '0.12em', fontWeight: 700 }}>PUBLIC-INTEREST ENGINEERING // POSEY COUNTY</div>
        <h1 id="posey-title" style={{ color: '#f8fafc', fontSize: '1.65rem', margin: '0.35rem 0' }}>Posey County Resilience & Community Benefit Platform</h1>
        <p style={{ color: '#94a3b8', maxWidth: 850, lineHeight: 1.55, fontSize: '0.82rem', margin: 0 }}>
          One evidence-controlled workspace for flood safety, infrastructure, water quality, housing, economic resilience and grant readiness. The system informs people; humans decide.
        </p>
      </header>

      <div role="note" style={{ ...panel, borderColor: '#7c5e10', background: '#17130a', marginBottom: '1rem' }}>
        <strong style={{ color: '#fbbf24', fontSize: '0.78rem' }}>Human authority remains final.</strong>
        <span style={{ color: '#cbd5e1', fontSize: '0.73rem', marginLeft: 8 }}>
          This application does not make regulatory, property, funding, health or safety decisions. Conflicting legacy engineering values are surfaced for reconciliation rather than silently promoted to facts.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginBottom: '1rem' }}>
        <Metric label="Verified government sources" value={String(verifiedCount)} />
        <Metric label="Current funding pathways" value={String(currentFunding)} />
        <Metric label="Community priorities" value={String(POSEY_PRIORITIES.length)} />
        <Metric label="Evidence policy" value="Provenance-first" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(300px,.65fr)', gap: 12, alignItems: 'start' }}>
        <div>
          <section aria-labelledby="priorities-title" style={{ marginBottom: 12 }}>
            <h2 id="priorities-title" style={{ color: '#f8fafc', fontSize: '1rem' }}>Community benefit priorities</h2>
            <div style={{ display: 'grid', gap: 9 }}>
              {POSEY_PRIORITIES.map((priority) => (
                <article key={priority.id} style={panel}>
                  <h3 style={{ color: '#38bdf8', fontSize: '0.84rem', margin: 0 }}>{priority.title}</h3>
                  <div style={{ color: '#64748b', fontSize: '0.68rem', marginTop: 4 }}>Beneficiaries: {priority.beneficiaries}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 9 }}>
                    <div><div style={{ color: '#34d399', fontSize: '0.65rem', fontWeight: 700 }}>OUTCOMES</div>{priority.outcomes.map((x) => <div key={x} style={{ color: '#cbd5e1', fontSize: '0.7rem', marginTop: 4 }}>• {x}</div>)}</div>
                    <div><div style={{ color: '#a78bfa', fontSize: '0.65rem', fontWeight: 700 }}>FIRST ACTIONS</div>{priority.firstActions.map((x) => <div key={x} style={{ color: '#cbd5e1', fontSize: '0.7rem', marginTop: 4 }}>• {x}</div>)}</div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="funding-title" style={{ marginBottom: 12 }}>
            <h2 id="funding-title" style={{ color: '#f8fafc', fontSize: '1rem' }}>Funding pathways</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {POSEY_GRANTS.map((grant) => (
                <article key={grant.id} style={{ ...panel, padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong style={{ color: '#f8fafc', fontSize: '0.78rem' }}>{grant.agency} · {grant.program}</strong>
                    <span style={{ color: grant.status === 'closed' ? '#f87171' : '#34d399', fontSize: '0.62rem', textTransform: 'uppercase' }}>{grant.status}</span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.68rem', marginTop: 4 }}>{grant.useCase} · Deadline: {grant.deadline}</div>
                  <div style={{ color: '#cbd5e1', fontSize: '0.69rem', lineHeight: 1.4, marginTop: 6 }}>{grant.nextAction}</div>
                  <a href={grant.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', fontSize: '0.65rem', display: 'inline-block', marginTop: 7 }}>Issuing agency / official notice ↗</a>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside>
          <section aria-labelledby="evidence-title">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <h2 id="evidence-title" style={{ color: '#f8fafc', fontSize: '1rem' }}>Evidence integrity</h2>
              <label style={{ color: '#94a3b8', fontSize: '0.65rem' }}>
                <input type="checkbox" checked={showLegacy} onChange={(event) => setShowLegacy(event.target.checked)} /> legacy
              </label>
            </div>
            <input
              aria-label="Search evidence"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search agency, source or claim…"
              style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, padding: '0.55rem 0.65rem', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0', fontSize: '0.72rem' }}
            />
            <div style={{ display: 'grid', gap: 8 }}>
              {filteredEvidence.map((record) => <EvidenceRow key={record.id} record={record} />)}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...panel, padding: '0.8rem' }}>
      <div style={{ color: '#64748b', fontSize: '0.64rem' }}>{label}</div>
      <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '1.1rem', marginTop: 4 }}>{value}</div>
    </div>
  );
}
