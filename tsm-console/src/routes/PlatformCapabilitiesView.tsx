import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { filterUnrealWebBridge, type UnrealBridgeFilter } from '../lib/unreal-web-bridge';

const groups = [
  {
    title: 'Evidence-governed agent platform (UACF)',
    summary: 'Typed capability contracts, provider routing, workflow execution, evidence and provenance surfaces, security policies, observability, and gateway runtime.',
    items: ['packages/core', 'packages/contracts', 'packages/capability-runtime', 'packages/provider-runtime', 'packages/router', 'packages/policy', 'packages/security', 'packages/provenance', 'packages/evidence', 'packages/workflow', 'packages/observability', 'apps/uacf-gateway'],
    status: 'Repository implementation; each capability still requires its own tests, configuration, and operational validation.',
  },
  {
    title: 'Geospatial digital twin',
    summary: 'MapLibre interactive mapping, regional source overlays, flood and hydrology context, terrain derivatives, and building/terrain OGC 3D Tiles generation.',
    items: ['tsm-console/src/components/RealWorldTwinMap.tsx', 'scripts/geospatial/build-terrain-3d-tiles.py', 'scripts/geospatial/validate-terrain-3d-tiles.py', 'artifacts/tsm-terrain-3d-tiles-v1.json'],
    status: 'Visualization is available when deployment assets are built, validated, and published.',
  },
  {
    title: 'Self-hosted 3D rendering',
    summary: 'MapLibre GL map and configured terrain are the public default; CesiumJS is a separately selectable 3D viewer. Source availability and offline operation depend on the selected layers.',
    items: ['.github/workflows/deploy-pages.yml', 'tsm-console/public/terrain_3dep', 'tsm-console/src/routes/GlobeView.tsx'],
    status: '3DEP-derived terrain is screening/visualization data, not survey-grade or regulatory evidence.',
  },
  {
    title: 'Evidence, data, and scientific validation',
    summary: 'Source manifests, hashes, CRS/datum metadata, JSON/schema contracts, deterministic processing, tests, and explicit distinctions between observed, derived, stale, and unavailable data.',
    items: ['data-sources/manifests', 'evidence', 'contracts', 'database', 'tests', 'scripts/ci'],
    status: 'A green static check does not establish real-world source availability, agency acceptance, or engineering certification.',
  },
  {
    title: 'Operator skills and remediation runbooks',
    summary: 'Reusable operational procedures for OGC 3D Tiles releases, terrain provenance, provider adapter contracts, and evidence-preserving CI failure remediation.',
    items: ['skills/ogc-3d-tiles-release/SKILL.md', 'skills/terrain-source-provenance/SKILL.md', 'skills/provider-adapter-contract/SKILL.md', 'skills/ci-failure-remediation/SKILL.md'],
    status: 'Runbooks standardize execution and review; they do not replace test results, human approvals, or deployment evidence.',
  },
  {
    title: 'Deployment and runtime operations',
    summary: 'GitHub Actions build and publication chain, static console delivery, optional API service, Docker deployment recipes, and self-hosted terrain tile-server options.',
    items: ['.github/workflows', 'apps/uacf-gateway', 'ops/terrain-tiles', 'docker-compose.yml', 'docker-compose.uacf.yml'],
    status: 'Static Pages publication and live API/tile-host operation are separate deployment states.',
  },
];

const inventories = [
  { title: 'Workspace packages', pathPrefix: 'packages/', items: ['agent-runtime','approvals','artifacts','billing','browser','cache','capability-runtime','compute','contracts','core','credentials','data-fabric','events','evidence','gates','geo','hydraulics','jobs','maps','mcp','model-runtime','notifications','observability','ontology','openapi','policy','provenance','provider-runtime','providers','quantum','queues','registry','research','router','schemas','search','security','tenancy','tenant','twin','twin-pipeline','uacp','units','validation','web','workflow'] },
  { title: 'Applications', pathPrefix: 'apps/', items: ['admin','dashboard','docs','playground','uacf-gateway'] },
  { title: 'Provider adapters', pathPrefix: 'providers/', items: ['anthropic','browser','geo','google','local','maps','mcp','openai','openapi','openrouter','postgis','search'] },
  { title: 'Plugin families', pathPrefix: 'plugins/', items: ['ai-ready','digital-twin','engineering','evidence-ledger','fema','grants','hydrology','monitoring','research','seo'] },
  { title: 'Execution runtimes', pathPrefix: 'runtime/', items: ['docker','python','qsharp','rust','unreal'] },
  { title: 'Operational skill runbooks', pathPrefix: 'skills/', items: ['ci-failure-remediation/SKILL.md','ogc-3d-tiles-release/SKILL.md','provider-adapter-contract/SKILL.md','terrain-source-provenance/SKILL.md'] },
  { title: 'Repository engineering surfaces', pathPrefix: '', items: ['.github','.secrets','architecture','artifacts','backend','config','contracts','data','data-sources','database','db','deploy','docker','docs','evidence','frontend','infrastructure','integrations','native','offline_packages','ops','scripts','skills','tests','third_party','thirdparty','tools','tsm-console','tsm-native'] },
];

/** This panel is client-side only and never loads native Unreal modules. */
function UnrealWebBridgePanel(): JSX.Element {
  const [query, setQuery] = useState('');
  const [boundary, setBoundary] = useState<UnrealBridgeFilter>('all');
  const records = useMemo(() => filterUnrealWebBridge(query, boundary), [query, boundary]);
  const categories: { value: UnrealBridgeFilter; label: string }[] = [
    { value: 'all', label: 'All capabilities' },
    { value: 'PUBLIC_WEB_ANALOG', label: 'Web presentation analogs' },
    { value: 'NATIVE_RUNTIME', label: 'Native runtime components' },
    { value: 'EDITOR_PIPELINE', label: 'Unreal editor pipelines' },
    { value: 'DEVELOPER_TEST', label: 'Developer test tools' },
  ];
  return (
    <section id="unreal-web-bridge" aria-labelledby="unreal-web-bridge-title" style={{ marginTop: '1.4rem', border: '1px solid #31566b', background: '#091523', borderRadius: 12, padding: '1rem' }}>
      <h2 id="unreal-web-bridge-title" style={{ marginTop: 0, color: '#70d6ff' }}>Unreal Engine → Public Digital Twin</h2>
      <p style={{ lineHeight: 1.6, color: '#c1d0df' }}>
        This searchable guide maps selected Unreal Engine 5.6 module and plugin terms to current TSM web and native code. It is a capability <strong>crosswalk</strong>, not a live Unreal Engine integration: GitHub Pages runs web JavaScript, not Unreal Editor, Python commandlets, SQLite, or native Movie Render Queue.
      </p>
      <p style={{ lineHeight: 1.5, color: '#a8bbcf', fontSize: '0.86rem' }}>
        The uploaded 5.6 terms index is used for terminology; linked Epic documentation was checked against the current 5.8-oriented native architecture. All published scenes remain informational until independent source and datum evidence is accepted. Native Windows Shipping remains a separate release gate.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '1rem 0' }}>
        <label htmlFor="tsm-unreal-search" style={{ display: 'grid', flex: '2 1 260px', gap: 5, fontSize: '0.85rem' }}>
          Search technology or role
          <input id="tsm-unreal-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. HLOD, terrain, cinematic" style={{ borderRadius: 7, border: '1px solid #486b7b', padding: '0.65rem', background: '#fff', color: '#17324d', minHeight: 44 }} />
        </label>
        <label htmlFor="tsm-unreal-boundary" style={{ display: 'grid', flex: '1 1 220px', gap: 5, fontSize: '0.85rem' }}>
          Technology boundary
          <select id="tsm-unreal-boundary" value={boundary} onChange={(event) => setBoundary(event.target.value as UnrealBridgeFilter)} style={{ borderRadius: 7, border: '1px solid #486b7b', padding: '0.65rem', background: '#fff', color: '#17324d', minHeight: 44 }}>
            {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
        </label>
      </div>
      <p aria-live="polite" role="status" style={{ color: '#c1d0df', fontSize: '0.85rem' }}>Showing {records.length} capability comparisons</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))', gap: 12 }}>
        {records.map((entry) => (
          <details key={entry.id} style={{ background: '#0d1b2b', padding: '0.85rem', borderRadius: 10, border: '1px solid #284b60' }}>
            <summary style={{ color: '#70d6ff', fontWeight: 700, cursor: 'pointer', minHeight: 44, lineHeight: 1.5 }}>{entry.unrealTerm}</summary>
            <p style={{ color: '#c1d0df', fontSize: '0.78rem' }}><strong>Boundary:</strong> {entry.boundary.replaceAll('_', ' ')} · <strong>Status:</strong> {entry.status.replaceAll('_', ' ')}</p>
            <p style={{ lineHeight: 1.55, fontSize: '0.85rem' }}><strong>Public website:</strong> {entry.browserRole}</p>
            <p style={{ lineHeight: 1.55, fontSize: '0.85rem' }}><strong>Unreal/native:</strong> {entry.nativeRole}</p>
            <p style={{ lineHeight: 1.55, color: '#f9c9ab', fontSize: '0.83rem' }}><strong>Evidence limitation:</strong> {entry.evidenceCaveat}</p>
            <p style={{ fontSize: '0.8rem', overflowWrap: 'anywhere' }}><a style={{ color: '#70d6ff' }} href={`https://github.com/ATphobia22/Tri-State-Systems-Manager/blob/main/${entry.repositoryPath}`} target="_blank" rel="noopener noreferrer">Inspect TSM source</a> · <a style={{ color: '#70d6ff' }} href={entry.epicReference} target="_blank" rel="noopener noreferrer">Epic documentation</a></p>
          </details>
        ))}
      </div>
      {records.length === 0 && <p role="status" style={{ color: '#c1d0df' }}>No matching technologies. Clear the search or select another boundary.</p>}
    </section>
  );
}

export default function PlatformCapabilitiesView(): JSX.Element {
  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '1.5rem', color: '#e7f0fa', background: '#081728', borderRadius: 12, minHeight: '100%' }}>
      <header style={{ borderBottom: '1px solid #20354b', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
        <p style={{ color: '#70d6ff', letterSpacing: '0.12em', fontSize: '0.75rem', fontWeight: 700 }}>TSM / UACF · PLATFORM INDEX</p>
        <h1 style={{ fontSize: 'clamp(1.7rem,4vw,2.6rem)', margin: '0.2rem 0 0.6rem' }}>Capabilities, packages and operational boundaries</h1>
        <p style={{ maxWidth: 850, lineHeight: 1.6, color: '#a8bbcf' }}>A navigable index of the repository’s agent platform, evidence fabric, geospatial pipeline, self-hosted rendering stack, and deployment contracts. Code presence is not a claim that every external service is configured or every production gate is green.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/terrain-3d" style={{ color: '#70d6ff' }}>Open 3D Terrain Viewer →</Link>
          <Link to="/twin" style={{ color: '#70d6ff' }}>Open Twin Canvas →</Link>
          <a href="#unreal-web-bridge" style={{ color: '#70d6ff' }}>Unreal ↔ Browser crosswalk ↓</a>
          <a href="https://github.com/ATphobia22/Tri-State-Systems-Manager" style={{ color: '#70d6ff' }}>Repository →</a>
          <a href={`${import.meta.env.BASE_URL}platform-capabilities.json`} style={{ color: '#70d6ff' }}>Machine-readable manifest (JSON) →</a>
        </div>
      </header>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,330px),1fr))', gap: 14 }}>
        {groups.map((group) => (
          <article key={group.title} style={{ background: '#0d1b2b', border: '1px solid #20354b', borderRadius: 12, padding: '1rem' }}>
            <h2 style={{ fontSize: '1.08rem', margin: '0 0 0.5rem', color: '#70d6ff' }}>{group.title}</h2>
            <p style={{ lineHeight: 1.55, color: '#c1d0df', fontSize: '0.9rem' }}>{group.summary}</p>
            <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.65, fontSize: '0.82rem', overflowWrap: 'anywhere' }}>
              {group.items.map((item) => <li key={item}><code>{item}</code></li>)}
            </ul>
            <p style={{ borderTop: '1px solid #20354b', paddingTop: '0.75rem', marginBottom: 0, color: '#a8bbcf', fontSize: '0.8rem' }}>{group.status}</p>
          </article>
        ))}
      </section>
      <UnrealWebBridgePanel />
      <section style={{ marginTop: '1.25rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Repository inventory</h2>
        <p style={{ color: '#a8bbcf', lineHeight: 1.6 }}>Directory inventory from the platform development tree. Package and adapter presence identifies code locations; it does not mean every provider has credentials, every integration is enabled, or every package is independently production-certified.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 12 }}>
          {inventories.map((inventory) => (
            <article key={inventory.title} style={{ background: '#0d1b2b', border: '1px solid #20354b', borderRadius: 10, padding: '0.85rem' }}>
              <h3 style={{ margin: '0 0 0.6rem', fontSize: '0.95rem', color: '#70d6ff' }}>{inventory.title}</h3>
              <ul style={{ margin: 0, paddingLeft: '1.15rem', lineHeight: 1.55, fontSize: '0.8rem', columns: inventory.items.length > 20 ? 2 : 1 }}>
                {inventory.items.map((item) => <li key={item}><code>{inventory.pathPrefix}{item}</code></li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <section style={{ marginTop: '1.25rem', padding: '1rem', border: '1px solid #20354b', borderRadius: 12, background: '#091523' }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Evidence and visual availability policy</h2>
        <p style={{ color: '#a8bbcf', lineHeight: 1.6, marginBottom: 0 }}>The UI should render available, provenance-labelled visualization layers without requiring unrelated live services or credentials. Failure of a live source must produce a visible stale/unavailable state, not suppress unrelated local visualization and not fabricate data. Regulatory and engineering conclusions remain gated on appropriate source evidence, datum validation, uncertainty, and qualified human review.</p>
      </section>
    </main>
  );
}
