/**
 * Collapsible cinematic engineering-sim settings (GamePigeon / EOC HUD style).
 * No headless animation loops; pure UI state for operators and officials.
 */

import { useState } from 'react';
import { INDIANA_COMPENSATORY_STORAGE_POLICY, JURISDICTION_RULES } from '../lib/jurisdiction-rules';
import { GAGE_DATUM_TABLE } from '../lib/gage-datums';
import { FIRM_SSOT } from '../lib/firm-panel-ssot';
import { VIEWPORT_CONFIG } from '../lib/viewport-config';

const panel: React.CSSProperties = {
  background: '#0b1220',
  border: '1px solid #1e293b',
  borderRadius: 12,
  color: '#e2e8f0',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  overflow: 'hidden',
  boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
};

const headerBtn: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '12px 16px',
  background: 'linear-gradient(90deg,#0f172a,#1e293b)',
  border: 'none',
  color: '#f8fafc',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  letterSpacing: 0.03,
};

const body: React.CSSProperties = {
  padding: '12px 16px 16px',
  fontSize: 12,
  lineHeight: 1.5,
  color: '#cbd5e1',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ borderTop: '1px solid #1e293b' }}>
      <button type="button" style={headerBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? '▾' : '▸'} {title}
      </button>
      {open && <div style={body}>{children}</div>}
    </div>
  );
}

export function EngineeringSimSettings() {
  const [masterOpen, setMasterOpen] = useState(true);
  const inRule = JURISDICTION_RULES.INDIANA;

  return (
    <div style={panel}>
      <button type="button" style={headerBtn} onClick={() => setMasterOpen((v) => !v)}>
        {masterOpen ? '▾' : '▸'} TSM Engineering Simulation · Operator Settings
      </button>
      {masterOpen && (
        <>
          <Section title="Site lock (Bonebank)">
            <div>BFE {VIEWPORT_CONFIG.elevations.bfeFt} ft NAVD88</div>
            <div>LAG {VIEWPORT_CONFIG.elevations.lagFt} ft NAVD88 (+{VIEWPORT_CONFIG.elevations.clearanceLagMinusBfeFt} ft)</div>
            <div>FFE {VIEWPORT_CONFIG.elevations.ffeFt} · Berm {VIEWPORT_CONFIG.elevations.bermCrestFt}</div>
            <div>CRS EPSG:{VIEWPORT_CONFIG.crs.horizontalEpsg} · {VIEWPORT_CONFIG.crs.verticalDatum}</div>
            <div>APN {VIEWPORT_CONFIG.parcel.apn}</div>
          </Section>

          <Section title="Gage datums (S-1)">
            <p style={{ marginTop: 0 }}>
              Raw stage is <strong>GAGE_DATUM</strong>. NAVD88 only after published zero is applied.
            </p>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {Object.values(GAGE_DATUM_TABLE).map((g) => (
                <li key={g.id} style={{ marginBottom: 6 }}>
                  <code>{g.id}</code> {g.name}
                  {g.conversionPublished && g.gageZeroNavd88Ft != null
                    ? ` — zero ${g.gageZeroNavd88Ft} ft NAVD88`
                    : ' — conversion unpublished'}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="FIRM panel SSOT (S-2)">
            <div>Status: <strong>{FIRM_SSOT.verificationStatus}</strong></div>
            <div>CID {FIRM_SSOT.communityId}</div>
            <ul style={{ paddingLeft: 18 }}>
              {FIRM_SSOT.candidates.map((c) => (
                <li key={c.panelId}>
                  {c.panelId} ({c.role})
                </li>
              ))}
            </ul>
            <div style={{ color: '#94a3b8' }}>{FIRM_SSOT.policy}</div>
          </Section>

          <Section title="Indiana 312 IAC / compensatory (S-3)">
            <div>No-rise (FEMA floodway practice): {inRule.no_rise_threshold_ft.toFixed(2)} ft</div>
            <div>IDNR adverse (312 IAC 10-2-3): 0.15 ft</div>
            <div>
              Compensatory ratio: <strong>{INDIANA_COMPENSATORY_STORAGE_POLICY.ratio}×</strong>
            </div>
            <div>Freeboard (building practice): {inRule.freeboard_req_ft.toFixed(1)} ft</div>
            <div style={{ color: '#94a3b8', marginTop: 6 }}>{INDIANA_COMPENSATORY_STORAGE_POLICY.note}</div>
          </Section>

          <Section title="Posey nodes · Myers · Hovey · Twin Swamps">
            <div>John T. Myers L&D — NWS UNWK2 / USGS 03322420</div>
            <div>Hovey Lake FWA — IDNR Fish & Wildlife (~7,404 ac)</div>
            <div>Twin Swamps Nature Preserve — IDNR Nature Preserves (~598 ac)</div>
            <div style={{ color: '#94a3b8' }}>Registry: data/posey/idnr-posey-registry.json</div>
          </Section>

          <Section title="Operator recommendations">
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              <li>Never compare gage height to BFE/LAG without conversion.</li>
              <li>Keep NFHL and Indiana Best Available layers separate.</li>
              <li>Provisional USGS/NWPS banners must remain visible.</li>
              <li>No auto LOMA / No-Rise / FARA (ADR-004 / ADR-006 S1).</li>
              <li>Export EvidenceArtifacts with full transformation chain.</li>
              <li>Confirm FIRM panel on MSC before PE packages.</li>
            </ul>
          </Section>
        </>
      )}
    </div>
  );
}

export default EngineeringSimSettings;
