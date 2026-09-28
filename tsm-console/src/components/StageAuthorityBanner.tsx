/**
 * Always-on stage / regulatory authority banners (S-4).
 * Cinematic engineering-sim HUD — static, no headless animation loops.
 */

import { t } from '../lib/design-tokens';
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
  borderRadius: t.radius.sm,
  border: `1px solid ${t.color.border.default}`,
  background: `linear-gradient(180deg, ${t.color.surface.base} 0%, ${t.color.surface.card} 100%)`,
  color: t.color.text.body,
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  fontSize: 12,
  lineHeight: 1.45,
  boxShadow: `0 0 0 1px ${t.color.accent.brandHairline}, ${t.shadow.card}`,
};

const chip = (bg: string, color: string = t.color.text.onLight): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: t.radius.pill,
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
        <span style={chip(t.color.accent.brand)}>Human authority final</span>
        <span style={chip(t.color.status.warning)}>Not a regulatory determination</span>
        {provisional && <span style={chip(t.color.status.dangerLight, t.color.text.inverse)}>Provisional data</span>}
        {isSimulationDemo && <span style={chip(t.color.status.violet, t.color.text.inverse)}>Simulation demo</span>}
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
      <div style={{ color: t.color.text.secondary }}>{disclaimer}</div>
      <div style={{ color: t.color.text.secondary }}>{firmPanelBannerText()}</div>
      <div style={{ color: t.color.text.secondary }}>
        Technology informs; it does not govern. PE / local floodplain administrator / IDNR remain authoritative.
      </div>
    </aside>
  );
}

export default StageAuthorityBanner;
