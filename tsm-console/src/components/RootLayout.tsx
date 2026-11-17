/** Root Layout — community trust-fabric status + live telemetry + operator settings. */

import { useEffect, useState } from 'react';
import { Outlet, NavLink, useRouteLoaderData } from 'react-router';
import type { RootLoaderData } from '../types/loaders';
import { t } from '../lib/design-tokens';
import { StageAuthorityBanner } from './StageAuthorityBanner';
import { EngineeringSimSettings } from './EngineeringSimSettings';
import { RouteTitle } from './RouteTitle';
import { TourOnboardingHint } from './TourOnboardingHint';
import BackgroundMusic from './BackgroundMusic';

const nav = [
  { to: '/atlas', label: '4D Engineering Atlas' },
  { to: '/memorial', label: 'Memorial', end: true }, { to: '/architecture', label: 'Trust Planes' }, { to: '/experiences', label: 'Experiences' },
  { to: '/cinematic', label: '3D Cinema' }, { to: '/cesium', label: 'Cesium 3D' },
  { to: '/cinematic-engineering', label: 'Cinema Eng' }, { to: '/workspaces', label: 'Workspaces' },
  { to: '/river-watch', label: 'River Watch' },
  { to: '/engineering-section', label: 'Engineering Section' }, { to: '/needs', label: 'Human Needs' }, { to: '/ledger', label: 'Evidence Ledger' },
  { to: '/lineage', label: 'Data Contracts' }, { to: '/benefit', label: 'Benefit Engine' }, { to: '/map', label: 'Hydraulic Map' },
  { to: '/twin', label: 'Twin Canvas' }, { to: '/digital-twin-v2', label: '3D Twin' }, { to: '/eoc', label: 'EOC Surface' },
  { to: '/data-fabric', label: 'Data Fabric' }, { to: '/flood-sim', label: 'Flood Simulator' },
  { to: '/globe', label: 'Globe (MapLibre)' }, { to: '/terrain-3d', label: '3D Terrain (3DEP)' }, { to: '/platform', label: 'Platform Capabilities' },
];

const navGroups = [
  { title: 'Explore the River Valley', routes: ['/atlas', '/map', '/globe', '/terrain-3d', '/twin', '/digital-twin-v2'] },
  { title: 'Engineering & Simulation', routes: ['/engineering-section', '/flood-sim', '/cinematic', '/cesium', '/cinematic-engineering', '/river-watch', '/eoc'] },
  { title: 'Data & Evidence', routes: ['/data-fabric', '/lineage', '/ledger', '/architecture'] },
  { title: 'Community & Platform', routes: ['/memorial', '/experiences', '/workspaces', '/needs', '/benefit', '/platform'] },
] as const;

const SHELL_CSS = `
.tsm-skip-link {
  position: absolute; left: -9999px; top: 0; z-index: 200;
  background: ${t.color.action.primary}; color: ${t.color.text.inverse}; font-weight: 700; font-size: 0.85rem;
  padding: 0.6rem 1rem; border-radius: 0 0 8px 0; text-decoration: none;
}
.tsm-skip-link:focus { left: 0; }
.tsm-hamburger { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; padding: 0.4rem 0.6rem; border-radius: 8px; cursor: pointer; background: #fff; color: #17324d; border: 1px solid #cbd5e1; }
.tsm-hamburger:hover { background: #e6f3f4; }
.tsm-sidebar a:focus-visible, .tsm-hamburger:focus-visible, .tsm-sidebar summary:focus-visible { outline: 3px solid #287d85; outline-offset: 2px; }
.tsm-sidebar summary { list-style-position: inside; }
.tsm-sidebar details[open] > summary { color: #205a63; }
.tsm-sidebar { box-shadow: 5px 0 22px rgba(23,50,77,0.07); }
@media (min-width: 768px) { .tsm-sidebar.collapsed { display: none !important; } }
.tsm-backdrop { display: none; }
@media (max-width: 767px) {
  .tsm-hamburger {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 44px; min-height: 44px; padding: 0.4rem 0.6rem;
    background: #fff; border: 1px solid #cbd5e1; border-radius: 8px;
    color: #17324d; font-size: 1.25rem; cursor: pointer;
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
  const [navOpen, setNavOpen] = useState(false);
  const closeMenu = (): void => setNavOpen(false);
  useEffect(() => {
    if (!navOpen) return;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [navOpen]);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', background: '#f8fafc', color: '#17324d' }}>
      <style>{SHELL_CSS}</style>
      <RouteTitle />
      <a href="#main-content" className="tsm-skip-link">Skip to main content</a>
      <header style={{ background: '#ffffff', borderBottom: '1px solid #dce8e6', padding: '0.75rem 1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="tsm-hamburger"
              aria-label={navOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={navOpen}
              aria-controls="tsm-sidebar"
              onClick={() => setNavOpen((open) => !open)}
            >
              ☰
            </button>
            <div><div style={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.95rem', color: '#205a63' }}>TRI-STATE SYSTEMS MANAGER // RIVER VALLEY ENGINEERING CONSOLE</div><div style={{ fontSize: '0.7rem', color: '#526879', marginTop: 2 }}>{community?.region ?? 'Tri-State River Valley'} · {community?.county ?? 'Posey County'} · Human Authority Final</div></div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace' }}>
            {community && <div><span style={{ color: '#526879' }}>Scope </span><span style={{ color: '#205a63', fontWeight: 600 }}>{community.township}</span></div>}
            <div><span style={{ color: '#526879' }}>Access </span><span style={{ color: '#205a63' }}>{auth ? `Authenticated: ${auth.uid.slice(0, 16)}…` : 'PUBLIC — no account required'}</span></div>
          </div>
        </div>
      </header>
      <TourOnboardingHint />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {navOpen && <button type="button" className="tsm-backdrop" aria-label="Close navigation menu" onClick={closeMenu} />}
        <aside id="tsm-sidebar" inert={!navOpen} className={`tsm-sidebar${navOpen ? ' open' : ' collapsed'}`} style={{ width: 280, background: '#ffffff', borderRight: '1px solid #dce8e6', padding: '1rem 0.75rem', flexShrink: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <nav aria-label="Primary navigation" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {navGroups.map((group) => <details key={group.title} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
              <summary style={{ cursor: 'pointer', padding: '0.75rem 0.5rem', minHeight: 44, fontSize: '0.82rem', fontWeight: 700, color: '#17324d' }}>{group.title}</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {nav.filter((item) => (group.routes as readonly string[]).includes(item.to)).map((item) =>
                  <NavLink key={item.to} to={item.to} end={item.end} onClick={closeMenu} style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', minHeight: 44, padding: '0.5rem 0.75rem',
                    borderRadius: t.radius.sm, fontSize: '0.8rem', fontWeight: 600,
                    textDecoration: 'none', color: isActive ? '#205a63' : '#526879',
                    background: isActive ? '#dcefeb' : 'transparent',
                    border: isActive ? '1px solid #9accbf' : '1px solid transparent',
                  })}>{item.label}</NavLink>)}
              </div>
            </details>)}
          </nav>
          <details style={{ marginTop: 4 }}><summary style={{ cursor: 'pointer', padding: '0.75rem', minHeight: 44, fontWeight: 600 }}>Engineering settings</summary><EngineeringSimSettings /></details>
          <div style={{ marginTop: 'auto', padding: '0.75rem', fontSize: '0.65rem', color: t.color.text.secondary, borderTop: '1px solid #dce8e6' }}>
            <div style={{ color: '#205a63', marginBottom: 4 }}>● Trust Fabric Active</div>
            <div>Technology informs.</div>
            <div>Humans decide.</div>
            <div style={{ marginTop: 6 }}>Public scope: community river valley. No private property is an engineering anchor.</div>
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${t.color.surface.card}` }}>
              <a href="https://github.com/sponsors/ATphobia22" target="_blank" rel="noopener noreferrer" style={{ color: t.color.accent.brand, fontWeight: 600, fontSize: '0.75rem' }}>
                Support this open-source project (optional)
              </a>
              <div style={{ marginTop: 4 }}>The console is free. No contribution is needed to access public features.</div>
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', minHeight: 32 }}>View GitHub Sponsors card</summary>
                <iframe
                  title="Sponsor ATphobia22 on GitHub"
                  src="https://github.com/sponsors/ATphobia22/card"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  width="600"
                  height="225"
                  style={{ width: '100%', maxWidth: '600px', height: 225, border: 0, marginTop: 8 }}
                />
              </details>
            </div>
          </div>
        </aside>
        <main id="main-content" tabIndex={-1} style={{ flex: 1, overflow: 'auto', background: '#f8fafc', minWidth: 0 }}>
          <div style={{ padding: '0.75rem 1rem 0' }}><StageAuthorityBanner provisional={provisional} isSimulationDemo={false} verticalReference="GAGE_DATUM" conversionApplied={stage?.conversion_applied ?? false} disclaimer={stageDisclaimer} finding={stage?.qualifier === 'P' ? `USGS qualifier P — subject to revision. Discharge: ${stage.discharge_cfs ?? 'unavailable'} cfs.` : undefined} /></div>
          <Outlet />
        </main>
      </div>
      <BackgroundMusic />
    </div>
  );
}
