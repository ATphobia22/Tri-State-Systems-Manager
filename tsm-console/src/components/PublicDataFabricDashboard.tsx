import { useEffect, useState } from 'react';
import { Link } from 'react-router';

type CatalogResponse = { sources?: Array<Record<string, unknown>>; health?: Array<Record<string, unknown>> };

export default function PublicDataFabricDashboard() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const base = String(import.meta.env.VITE_TSM_API_BASE_URL || '').replace(/\/$/, '');
    fetch(base + '/api/data-sources/catalog', { credentials: 'include' })
      .then(async (response) => { if (!response.ok) throw new Error('catalog request failed: ' + response.status); return response.json() as Promise<CatalogResponse>; })
      .then(setCatalog)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'catalog unavailable'));
  }, []);
  const fabrics = [
    ['public-maps', 'PRESENTATION', true, 'USGS, NOAA, FEMA, state/local GIS', 'Read-only public exploration; source authority remains visible.'],
    ['hydrology', 'AUTHORITATIVE', true, 'USGS, NOAA/NWS', 'Observed and forecast values remain distinct.'],
    ['community-submissions', 'OBSERVATIONAL', false, 'community', 'Public contributions enter validation quarantine before promotion.'],
    ['engineering-models', 'DERIVED', false, 'validated source records', 'Simulation output never silently becomes regulatory evidence.'],
  ] as const;
  return <main style={{ maxWidth: 1180, margin: '0 auto', padding: '1.5rem', color: '#e2e8f0' }}>
    <section style={{ borderRadius: 18, padding: '1.5rem', background: '#0f172a', border: '1px solid #334155' }}>
      <p style={{ color: '#38bdf8', fontWeight: 700 }}>TRI-STATE PUBLIC DATA FABRIC</p>
      <h1>Explore first. Authenticate only when necessary.</h1>
      <p style={{ maxWidth: 800, color: '#cbd5e1', lineHeight: 1.6 }}>Free public exploration. Identity is required only where accountability or restricted data requires it.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to="/map">Explore maps</Link>{' '}<Link to="/river-watch">River Watch</Link>{' '}<Link to="/architecture">Architecture</Link>
      </div>
    </section>
    <section aria-labelledby="fabric-heading"><h2 id="fabric-heading">Data fabrics</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
      {fabrics.map(([id, authority, live, sources, notes]) => <article key={id} style={{ background: '#111827', border: '1px solid #334155', borderRadius: 14, padding: 14 }}><strong>{id.replaceAll('-', ' ')}</strong><p>{notes}</p><small>{authority} · {live ? 'live-capable' : 'review/model flow'}</small><p>Sources: {sources}</p></article>)}
    </div></section>
    <section aria-labelledby="transparency-heading"><h2 id="transparency-heading">Source transparency</h2>
      {error ? <p role="status">Live source catalog unavailable: {error}</p> : null}
      {!error && !catalog ? <p role="status">Loading current source catalog…</p> : null}
      {catalog ? <p>{catalog.sources?.length ?? 0} registered source contracts; {catalog.health?.length ?? 0} source-health records.</p> : null}
      <p>Visibility does not make TSM the source of record. Provenance, licensing, CRS, freshness and limitations remain attached to source products.</p>
    </section>
  </main>;
}
