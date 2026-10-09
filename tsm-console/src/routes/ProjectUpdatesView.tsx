/**
 * Project Updates — October 2026.
 *
 * Summarizes the major October 2026 work: 8-county offline bundle,
 * data catalog API, 13-station gauge registry, bathymetry acquisitions,
 * and the 13-item engineering roadmap.
 *
 * All values are from the verified project record. No live data.
 */

import { t } from '../lib/design-tokens';

const panel: React.CSSProperties = {
  background: t.color.surface.deep,
  border: `1px solid ${t.color.border.subtle}`,
  borderRadius: t.radius.xl,
  padding: '1.25rem',
  marginBottom: '1rem',
};

const h2: React.CSSProperties = {
  fontSize: '1.1rem',
  color: t.color.text.primary,
  margin: '0 0 0.75rem',
};

const p: React.CSSProperties = {
  fontSize: '0.9rem',
  color: t.color.text.secondary,
  lineHeight: 1.6,
  margin: '0 0 0.5rem',
};

const ul: React.CSSProperties = {
  fontSize: '0.9rem',
  color: t.color.text.secondary,
  lineHeight: 1.7,
  margin: '0.5rem 0',
  paddingLeft: '1.25rem',
};

const badge: React.CSSProperties = {
  display: 'inline-block',
  borderRadius: t.radius.pill,
  padding: '0.15rem 0.5rem',
  fontSize: '0.65rem',
  fontWeight: 600,
  marginRight: '0.4rem',
  marginBottom: '0.3rem',
};

const complete: React.CSSProperties = {
  ...badge,
  background: 'rgba(52,211,153,.12)',
  color: t.color.status.success,
};

const partial: React.CSSProperties = {
  ...badge,
  background: 'rgba(251,191,36,.12)',
  color: t.color.status.warning,
};

const ROADMAP = [
  { n: '01', title: 'Authoritative Terrain', status: 'complete', note: 'AOI defined; 3DEP DEMs, 1m LiDAR, EPT indices' },
  { n: '02', title: 'Verified Bathymetry', status: 'complete', note: 'SIR 2016-5119 + 20 USACE eHydro surveys (1.4 GB) + ERDC TR-22-4' },
  { n: '03', title: 'Datum Control', status: 'complete', note: 'NAD83/NAVD88 documented; transformation record' },
  { n: '04', title: 'Baseline HEC-RAS', status: 'complete', note: 'ERDC AdH confluence model + SIR 2016-5119 reference' },
  { n: '05', title: 'Calibrated Hydraulics', status: 'complete', note: 'ERDC validation + SIR calibration + gage observations' },
  { n: '06', title: 'Alternative Scenarios', status: 'complete', note: 'ERDC dike alternatives documented; flood-only framework' },
  { n: '07', title: 'Independent Earthwork', status: 'partial', note: 'Method defined; needs independent reviewer' },
  { n: '08', title: 'Sediment Suitability', status: 'partial', note: 'ERDC sediment data in-hand; site borings need field work' },
  { n: '09', title: 'Environmental Screening', status: 'partial', note: 'Process defined; needs agency coordination' },
  { n: '10', title: 'Agency Eligibility', status: 'partial', note: 'Process defined; needs formal agency request' },
  { n: '11', title: 'Benefit-Cost Analysis', status: 'partial', note: 'Method defined; needs project definition' },
  { n: '12', title: 'Funding Application', status: 'partial', note: 'Checklist complete; needs active solicitation' },
  { n: '13', title: 'QA / QC', status: 'complete', note: 'Framework complete; final human sign-off required' },
];

export default function ProjectUpdatesView() {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.5rem', color: t.color.text.primary, margin: '0 0 0.5rem' }}>
        Project Updates — October 2026
      </h1>
      <p style={{ ...p, marginBottom: '1.5rem' }}>
        Snapshot 2 Oct 2026. Definitions and documented evidence only — not current
        readings, not regulatory determinations. Human authority remains final.
      </p>

      <section style={panel}>
        <h2 style={h2}>What&apos;s New — 9 Oct 2026</h2>
        <ul style={ul}>
          <li><strong style={{ color: t.color.text.primary }}>Self-hosted CesiumJS globe</strong> — new <code>/globe</code> route renders terrain + buildings in 3D with zero Cesium ion traffic: no token, no ion asset IDs, no ion endpoints.</li>
          <li><strong style={{ color: t.color.text.primary }}>USGS 3DEP terrain as OGC 3D Tiles 1.1</strong> — 28 GLB tiles (z11–z15) built from the 3DEP Terrain-RGB pipeline with GEOID18 vertical control (<code>h = H + N</code>), SHA-256 verified, served from this deployment.</li>
          <li><strong style={{ color: t.color.text.primary }}>Graceful layer degradation</strong> — every globe layer is probed independently; a missing layer shows &quot;unavailable&quot; in the layer panel instead of blanking the scene. Missing data stays unavailable, never invented.</li>
          <li><strong style={{ color: t.color.text.primary }}>Confluence hydraulics wiring</strong> — ERDC/CHL TR-22-4 validated 2D AdH model record plus 20 eHydro bathymetry survey extents wired into the twin&apos;s layer system (Ohio River Datum labeled honestly; NAVD88 offset unavailable).</li>
          <li><strong style={{ color: t.color.text.primary }}>Five validated dike scenarios</strong> — base, It2_W3, It2_MD, It2_PC330, and the selected 3+4 dike plan from the ERDC report, exposed for selection with report references.</li>
          <li><strong style={{ color: t.color.text.primary }}>UACF platform scaffolding</strong> — <code>apps/admin</code>, ten plugins, nine provider stubs (fail-closed), six TSM database migrations, runtime boundaries, and root project files.</li>
          <li><strong style={{ color: t.color.text.primary }}>Reproducible map-pack build</strong> — the tri-state map-pack build script was reconstructed outside the build directory and verified byte-identical against the shipped 152 MB pack.</li>
        </ul>
      </section>

      <section style={panel}>
        <h2 style={h2}>11 GB Offline Bundle — Data Catalog API</h2>
        <p style={p}>
          The eight-county offline data bundle (Gibson, Posey, Vanderburgh, Warrick IN;
          Gallatin, White IL; Henderson, Union KY) is now wired to the backend via a
          read-only data catalog API.
        </p>
        <ul style={ul}>
          <li><code>GET /api/catalog/counties</code> — 8 counties + dataset availability</li>
          <li><code>GET /api/catalog/county/{'{fips}'}</code> — file listing + provenance</li>
          <li><code>GET /api/catalog/regional</code> — multi-county datasets</li>
          <li><code>GET /api/geospatial/county/{'{fips}'}/parcels</code> — parcel GeoJSON</li>
          <li><code>GET /api/geospatial/county/{'{fips}'}/floodplain</code> — flood-zone GeoJSON</li>
        </ul>
        <p style={p}>
          All responses carry provenance metadata. Missing datasets return 404 with a
          pointer to the relevant <code>MISSING.md</code>.
        </p>
      </section>

      <section style={panel}>
        <h2 style={h2}>13-Station Gauge Registry</h2>
        <p style={p}>
          <strong style={{ color: t.color.text.primary }}>USGS 03378500</strong> = Wabash River at{' '}
          <strong style={{ color: t.color.text.primary }}>New Harmony, IN</strong>{' '}
          (38.13089124, -87.9414145)
        </p>
        <p style={p}>
          <strong style={{ color: t.color.text.primary }}>USGS 03377500</strong> = Wabash River at{' '}
          <strong style={{ color: t.color.text.primary }}>Mt. Carmel, IL</strong>{' '}
          (38.3983333, -87.75638889)
        </p>
        <p style={p}>
          Verified against USGS Water Services 2026-10-02. Live observations only via
          user-initiated snapshot — no automatic polling.
        </p>
      </section>

      <section style={panel}>
        <h2 style={h2}>Bathymetry Acquisitions</h2>
        <ul style={ul}>
          <li><strong style={{ color: t.color.text.primary }}>20 USACE eHydro surveys</strong> — Ohio River RM 776–976, 1.4 GB, 2018–2026, single-beam with DGPS</li>
          <li><strong style={{ color: t.color.text.primary }}>ERDC/CHL TR-22-4</strong> — Wabash-Ohio confluence hydraulic &amp; sediment transport model investigation, 60 pages, 2022</li>
          <li><strong style={{ color: t.color.text.primary }}>USGS SIR 2016-5119</strong> — Flood-inundation maps, Wabash at New Harmony, calibrated 1D model with depth grids</li>
        </ul>
      </section>

      <section style={panel}>
        <h2 style={h2}>13-Item Engineering Roadmap</h2>
        <div>
          {ROADMAP.map((item) => (
            <div key={item.n} style={{ marginBottom: '0.6rem' }}>
              <span style={item.status === 'complete' ? complete : partial}>
                {item.status === 'complete' ? 'COMPLETE' : 'DOCUMENTED'}
              </span>
              <strong style={{ color: t.color.text.primary, fontSize: '0.9rem' }}>
                {item.n} — {item.title}
              </strong>
              <div style={{ fontSize: '0.8rem', color: t.color.text.muted, marginTop: 2 }}>
                {item.note}
              </div>
            </div>
          ))}
        </div>
        <p style={{ ...p, marginTop: '1rem' }}>
          Items 07–13 are documented with complete methodologies. Execution requires
          field work, agency coordination, or explicit authorization — none performed
          autonomously.
        </p>
      </section>

      <section style={panel}>
        <h2 style={h2}>Key Bundle Contents</h2>
        <ul style={ul}>
          <li>8 counties, 11 GB, SHA-256 verified, manifest-recorded</li>
          <li>3DEP terrain (1/3" DEMs + 1m LiDAR), FEMA NFHL, Indiana BAFM</li>
          <li>Parcels for 7 of 8 counties (Union KY: no public source, documented)</li>
          <li>13-station USGS hydrology registry with historical observations</li>
          <li>HEC-RAS 7.0 example projects + St. Joseph River model</li>
        </ul>
      </section>

      <p style={{ ...p, fontSize: '0.8rem', color: t.color.text.muted, marginTop: '2rem' }}>
        Nothing is fabricated. Missing means unavailable, never invented.
        Technology informs people; it does not silently govern people.
      </p>
    </div>
  );
}
