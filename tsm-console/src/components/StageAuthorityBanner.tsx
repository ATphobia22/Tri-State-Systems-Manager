/**
 * Always-on stage / regulatory authority banners (S-4).
 * Cinematic engineering-sim HUD — static, no headless animation loops.
 */

import { firmPanelBannerText } from '../lib/firm-panel-ssot';

export interface StageAuthorityBannerProps {
  provisional?: boolean;
  isSimulationDemo?: boolean;
  verticalReference?: string;
  conversionApplied?: boolean;
  disclaimer?: string;
  finding?: string;
}

const bannerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid #334155',
  background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
  color: '#e2e8f0',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  fontSize: 12,
  lineHeight: 1.45,
  boxShadow: '0 0 0 1px rgba(56,189,248,0.15), 0 8px 24px rgba(0,0,0,0.35)',
};

const chip = (bg: string, color = '#0f172a'): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 999,
  background: bg,
  color,
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: 0.04,
  textTransform: 'uppercase',
  marginRight: 6,
});

export function StageAuthorityBanner(props: StageAuthorityBannerProps) {
  const {
    provisional = true,
    isSimulationDemo = false,
    verticalReference = 'GAGE_DATUM',
    conversionApplied = false,
    disclaimer,
    finding,
  } = props;

  return (
    <aside style={bannerStyle} role="status" aria-live="polite">
      <div>
        <span style={chip('#38bdf8')}>Human authority final</span>
        <span style={chip('#fbbf24')}>Not a regulatory determination</span>
        {provisional && <span style={chip('#fb7185', '#fff')}>Provisional data</span>}
        {isSimulationDemo && <span style={chip('#a78bfa', '#fff')}>Simulation demo</span>}
      </div>
      <div>
        <strong>Vertical:</strong> raw stage = <code>{verticalReference}</code>
        {conversionApplied ? ' · NAVD88 conversion applied' : ' · NAVD88 conversion not applied'}
      </div>
      {finding && (
        <div>
          <strong>Finding (decision support):</strong> {finding}
        </div>
      )}
      <div style={{ color: '#94a3b8' }}>{disclaimer}</div>
      <div style={{ color: '#64748b' }}>{firmPanelBannerText()}</div>
      <div style={{ color: '#64748b' }}>
        Technology informs; it does not govern. PE / local floodplain administrator / IDNR remain authoritative.
      </div>
    </aside>
  );
}

export default StageAuthorityBanner;
