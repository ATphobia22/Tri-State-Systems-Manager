/**
 * Root Layout — Trust Fabric status bar + Stage authority banners +
 * collapsible Engineering Sim operator settings + <Outlet />
 *
 * Visual doctrine: Tri-State Engineering Simulator (Farming Simulator–class
 * grounded world) — practical Posey / Ohio–Wabash replica for flood, utilities,
 * and infrastructure work. No decorative open-world animation loops.
 */

import { Outlet, NavLink, useRouteLoaderData } from 'react-router';
import type { RootLoaderData } from '../types/loaders';
import { StageAuthorityBanner } from './StageAuthorityBanner';
import { EngineeringSimSettings } from './EngineeringSimSettings';

const nav = [
  { to: '/', label: 'Charter', end: true },
  { to: '/architecture', label: 'Trust Planes' },
  { to: '/needs', label: 'Human Needs' },
  { to: '/ledger', label: 'Evidence Ledger' },
  { to: '/lineage', label: 'Data Contracts' },
  { to: '/benefit', label: 'Benefit Engine' },
  { to: '/map', label: 'Geospatial' },
  { to: '/twin', label: 'Digital Twin' },
];

export default function RootLayout() {
  const data = useRouteLoaderData('root') as RootLoaderData | undefined;
  const auth = data?.auth;
  const site = data?.siteSummary;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
        background: '#0f172a',
        color: '#e2e8f0',
      }}
    >
      <header
        style={{
          background: '#020617',
          borderBottom: '1px solid #1e293b',
          padding: '0.75rem 1.25rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 700,
                letterSpacing: '0.05em',
                fontSize: '0.95rem',
                color: '#38bdf8',
              }}
            >
              TRI-STATE SYSTEMS MANAGER // ENGINEERING SIM COCKPIT
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>
              Posey County · Ohio–Wabash Valley · Exact engineering replica · Human Authority Final
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              fontSize: '0.75rem',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {site && (
              <>
                <div>
                  <span style={{ color: '#64748b' }}>BFE </span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>{site.bfe} ft</span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>LAG </span>
                  <span style={{ color: '#34d399', fontWeight: 600 }}>{site.lag} ft</span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Clearance </span>
                  <span style={{ color: '#a78bfa', fontWeight: 600 }}>
                    +{site.clearanceAboveBfe} ft
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>APN </span>
                  <span style={{ color: '#94a3b8' }}>{site.apn}</span>
                </div>
              </>
            )}
            <div>
              <span style={{ color: '#64748b' }}>Auth </span>
              <span style={{ color: auth ? '#34d399' : '#f87171' }}>
                {auth ? `${auth.uid.slice(0, 16)}…` : 'NONE'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside
          style={{
            width: 280,
            background: '#020617',
            borderRight: '1px solid #1e293b',
            padding: '1rem 0.75rem',
            flexShrink: 0,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={({ isActive }) => ({
                  display: 'block',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: isActive ? '#38bdf8' : '#94a3b8',
                  background: isActive ? 'rgba(56,189,248,0.1)' : 'transparent',
                  border: isActive
                    ? '1px solid rgba(56,189,248,0.2)'
                    : '1px solid transparent',
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div style={{ marginTop: 4 }}>
            <EngineeringSimSettings />
          </div>

          <div
            style={{
              marginTop: 'auto',
              padding: '0.75rem',
              fontSize: '0.65rem',
              color: '#475569',
              borderTop: '1px solid #1e293b',
            }}
          >
            <div style={{ color: '#34d399', marginBottom: 4 }}>● Trust Fabric Active</div>
            <div>Technology informs.</div>
            <div>Humans decide.</div>
            <div style={{ marginTop: 6, color: '#64748b' }}>
              Visual plane: Tri-State Engineering Simulator — grounded Posey replica, not entertainment open-world.
            </div>
          </div>
        </aside>

        <main style={{ flex: 1, overflow: 'auto', background: '#0f172a' }}>
          <div style={{ padding: '0.75rem 1rem 0' }}>
            <StageAuthorityBanner
              provisional
              isSimulationDemo={false}
              verticalReference="GAGE_DATUM"
              conversionApplied={false}
              disclaimer="PROVISIONAL hydrology subject to revision. Gage height ≠ NAVD88 until conversion. Not a regulatory determination."
            />
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
