import { Link } from 'react-router';

const groups = [
  {
    title: 'Evidence-governed agent platform (UACF)',
    summary: 'Typed capability contracts, provider routing, evidence and provenance surfaces, ADR-006 autonomy ladder, and gateway runtime.',
    items: ['packages/core', 'packages/contracts', 'packages/gates', 'packages/evidence', 'packages/agent-runtime', 'providers/local', 'apps/uacf-gateway'],
    status: 'Repository implementation; human authority remains final.',
  },
  {
    title: 'Geospatial digital twin',
    summary: 'MapLibre interactive mapping, regional source overlays, flood and hydrology context, terrain derivatives, and OGC 3D Tiles generation.',
    items: ['tsm-console/src/components/CesiumTilesLayer.tsx', 'tsm-console/src/routes/CesiumTerrainView.tsx', 'tsm-console/src/routes/GlobeView.tsx', 'scripts/geospatial/build-terrain-3d-tiles.py'],
    status: 'Visualization when deployment assets are built and published.',
  },
  {
    title: 'Self-hosted 3D rendering',
    summary: 'Pinned CesiumJS runtime and OGC 3D Tiles 1.1 terrain from the same origin; no Cesium ion token.',
    items: ['scripts/ci/install-cesium-static.mjs', '.github/workflows/deploy-pages.yml', '/terrain-3d', '/globe'],
    status: '3DEP-derived terrain is screening/visualization data, not survey-grade or regulatory evidence.',
  },
  {
    title: 'Evidence, data, and scientific validation',
    summary: 'Source manifests, hashes, CRS/datum metadata, fail-closed gage conversion, LOMA helpers that never auto-file.',
    items: ['packages/gates', 'database/migrations/090_tsm_hydrology.sql', 'database/migrations/094_tsm_fema.sql', 'tests/contracts'],
    status: 'A green static check is not agency acceptance or engineering certification.',
  },
];

export default function PlatformCapabilitiesView(): JSX.Element {
  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '1.5rem', color: '#e7f0fa' }}>
      <header style={{ borderBottom: '1px solid #20354b', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
        <p style={{ color: '#70d6ff', letterSpacing: '0.12em', fontSize: '0.75rem', fontWeight: 700 }}>TSM / UACF · PLATFORM INDEX</p>
        <h1 style={{ fontSize: 'clamp(1.7rem,4vw,2.6rem)', margin: '0.2rem 0 0.6rem' }}>Capabilities, packages and operational boundaries</h1>
        <p style={{ maxWidth: 850, lineHeight: 1.6, color: '#a8bbcf' }}>
          Code presence is not a claim that every external service is configured or every production gate is green.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/terrain-3d" style={{ color: '#70d6ff' }}>Open 3D Terrain Viewer →</Link>
          <Link to="/globe" style={{ color: '#70d6ff' }}>Open Cesium Globe →</Link>
          <Link to="/twin" style={{ color: '#70d6ff' }}>Open Twin Canvas →</Link>
        </div>
      </header>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,330px),1fr))', gap: 14 }}>
        {groups.map((group) => (
          <article key={group.title} style={{ background: '#0d1b2b', border: '1px solid #20354b', borderRadius: 12, padding: '1rem' }}>
            <h2 style={{ fontSize: '1.08rem', margin: '0 0 0.5rem', color: '#70d6ff' }}>{group.title}</h2>
            <p style={{ lineHeight: 1.55, color: '#c1d0df', fontSize: '0.9rem' }}>{group.summary}</p>
            <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.65, fontSize: '0.82rem', overflowWrap: 'anywhere' }}>
              {group.items.map((item) => (
                <li key={item}><code>{item}</code></li>
              ))}
            </ul>
            <p style={{ borderTop: '1px solid #20354b', paddingTop: '0.75rem', marginBottom: 0, color: '#a8bbcf', fontSize: '0.8rem' }}>{group.status}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
