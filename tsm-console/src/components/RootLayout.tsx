/** Root Layout — community trust-fabric status + live telemetry + operator settings. */

import { useState } from 'react';
import { Outlet, NavLink, useRouteLoaderData } from 'react-router';
import type { RootLoaderData } from '../types/loaders';
import { t } from '../lib/design-tokens';
import { StageAuthorityBanner } from './StageAuthorityBanner';
import { EngineeringSimSettings } from './EngineeringSimSettings';
import { RouteTitle } from './RouteTitle';
import { TourOnboardingHint } from './TourOnboardingHint';

/**
 * Phase 2 nav: the four twin surfaces are differentiated by label, and the
 * previously orphaned routes /eoc and /data-fabric are now reachable.
 * /digital-twin (Twin Summary) stays a documented deep link — see router.tsx
 * ROUTE MAP comment — reachable from the Twin Canvas footer, not the nav.
 */
const nav = [
  { to: '/', label: 'Charter', end: true }, { to: '/architecture', label: 'Trust Planes' }, { to: '/river-watch', label: 'River Watch' },
  { to: '/engineering-section', label: 'Engineering Section' }, { to: '/needs', label: 'Human Needs' }, { to: '/ledger', label: 'Evidence Ledger' },
  { to: '/lineage', label: 'Data Contracts' }, { to: '/benefit', label: 'Benefit Engine' }, { to: '/map', label: 'Hydraulic Map' },
  { to: '/twin', label: 'Twin Canvas' }, { to: '/digital-twin-v2', label: '3D Twin' }, { to: '/eoc', label: 'EOC Surface' },
  { to: '/data-fabric', label: 'Data Fabric' }, { to: '/flood-sim', label: 'Flood Simulator' },
];

/**
 * Responsive shell styles. These are the first `@media` queries in the app:
 * below 768px the fixed 280px sidebar becomes a hamburger-driven drawer so
 * the content column gets the full phone width.
 */
const SHELL_CSS = `
.tsm-skip-link {
  position: absolute; left: -9999px; top: 0; z-index: 200;
  background: ${t.color.action.primary}; color: ${t.color.text.inverse}; font-weight: 700; font-size: 0.85rem;
  padding: 0.6rem 1rem; border-radius: 0 0 8px 0; text-decoration: none;
}
.tsm-skip-link:focus { left: 0; }
.tsm-hamburger { display: none; }
.tsm-backdrop { display: none; }
@media (max-width: 767px) {
  .tsm-hamburger {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 44px; min-height: 44px; padding: 0.4rem 0.6rem;
    background: transparent; border: 1px solid ${t.color.surface.card}; border-radius: 8px;
    color: ${t.color.text.body}; font-size: 1.25rem; cursor: pointer;
  }
  .tsm-sidebar {
    position: fixed; top: 0; left: 0; bottom: 0; z-index: 100;
    transform: translateX(-105%); transition: transform 0.2s ease;
    box-shadow: 8px 0 24px rgba(0,0,0,0.5); width: 280px !important;
  }
  .tsm-sidebar.open { transform: translateX(0); }
  .tsm-backdrop {
    display: block; position: fixed; inset: 0; z-index: 90;
    background: rgba(0,0,0,0.55); border: 0; padding: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tsm-sidebar { transition: none; }
}
`;

export default function RootLayout() {
  const data = useRouteLoaderData('root') as RootLoaderData | undefined;
  const auth = data?.auth; const community = data?.communitySummary; const stage = data?.stage;
  const provisional = stage?.status === 'provisional' || stage?.qualifier === 'P';
  const sourceLabel = stage?.source === 'NOAA' ? 'NOAA NWPS' : stage?.source === 'USGS' ? 'USGS Water Data' : 'UNAVAILABLE';
  const stageDisclaimer = stage?.source === 'UNAVAILABLE'
    ? 'Live hydrologic telemetry unavailable. No continuity is fabricated; verify authoritative sources directly.'
    : `${sourceLabel} observed stage is ${provisional ? 'PROVISIONAL' : 'current'}; raw stage remains GAGE_DATUM. Human authority remains final.`;
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = (): void => setMenuOpen(false);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', background: t.color.surface.base, color: t.color.text.body }}>
      <style>{SHELL_CSS}</style>
      <RouteTitle />
      {/* Skip link: first focusable element, visually hidden until focused. */}
      <a href="#main-content" className="tsm-skip-link">Skip to main content</a>
      <header style={{ background: t.color.surface.deep, borderBottom: `1px solid ${t.color.surface.card}`, padding: '0.75rem 1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="tsm-hamburger"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              aria-controls="tsm-sidebar"
              onClick={() => setMenuOpen((open) => !open)}
            >
              ☰
            </button>
            <div><div style={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.95rem', color: t.color.accent.brand }}>TRI-STATE SYSTEMS MANAGER // RIVER VALLEY ENGINEERING CONSOLE</div><div style={{ fontSize: '0.7rem', color: t.color.text.secondary, marginTop: 2 }}>{community?.region ?? 'Tri-State River Valley'} · {community?.county ?? 'Posey County'} · Human Authority Final</div></div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace' }}>
            {community && <div><span style={{ color: t.color.text.secondary }}>Scope </span><span style={{ color: t.color.accent.brand, fontWeight: 600 }}>{community.township}</span></div>}
            <div><span style={{ color: t.color.text.secondary }}>Access </span><span style={{ color: auth ? t.color.status.success : t.color.accent.brand }}>{auth ? `Authenticated: ${auth.uid.slice(0, 16)}…` : 'PUBLIC — no account required'}</span></div>
          </div>
        </div>
      </header>
      <TourOnboardingHint />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {menuOpen && <button type="button" className="tsm-backdrop" aria-label="Close navigation menu" onClick={closeMenu} />}
        <aside id="tsm-sidebar" className={`tsm-sidebar${menuOpen ? ' open' : ''}`} style={{ width: 280, background: t.color.surface.deep, borderRight: `1px solid ${t.color.surface.card}`, padding: '1rem 0.75rem', flexShrink: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <nav aria-label="Primary navigation" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{nav.map((item) => <NavLink key={item.to} to={item.to} end={item.end} onClick={closeMenu} style={({ isActive }) => ({ display: 'flex', alignItems: 'center', minHeight: 44, padding: '0.5rem 0.75rem', borderRadius: t.radius.sm, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', color: isActive ? t.color.accent.brand : t.color.text.secondary, background: isActive ? t.color.accent.brandSoft : 'transparent', border: isActive ? `1px solid ${t.color.accent.brandHairline}` : '1px solid transparent' })}>{item.label}</NavLink>)}</nav>
          <div style={{ marginTop: 4 }}><EngineeringSimSettings /></div>
          <div style={{ marginTop: 'auto', padding: '0.75rem', fontSize: '0.65rem', color: t.color.text.secondary, borderTop: `1px solid ${t.color.surface.card}` }}><div style={{ color: t.color.status.success, marginBottom: 4 }}>● Trust Fabric Active</div><div>Technology informs.</div><div>Humans decide.</div><div style={{ marginTop: 6, color: t.color.text.secondary }}>Public scope: community river valley. No private property is an engineering anchor.</div></div>
        </aside>
        <main id="main-content" tabIndex={-1} style={{ flex: 1, overflow: 'auto', background: t.color.surface.base, minWidth: 0 }}>
          <div style={{ padding: '0.75rem 1rem 0' }}><StageAuthorityBanner provisional={provisional} isSimulationDemo={false} verticalReference="GAGE_DATUM" conversionApplied={stage?.conversion_applied ?? false} disclaimer={stageDisclaimer} finding={stage?.qualifier === 'P' ? `USGS qualifier P — subject to revision. Discharge: ${stage.discharge_cfs ?? 'unavailable'} cfs.` : undefined} /></div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
