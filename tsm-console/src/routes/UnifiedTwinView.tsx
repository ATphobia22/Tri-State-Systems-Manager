/**
 * UnifiedTwinView — one front door for 3D.
 *
 * Joins the engineering twin (MapLibre, offline-first: the project's own
 * buildings, terrain and flood data) and the photorealistic globe (Cesium ion,
 * online: Google Photorealistic 3D Tiles) behind a single "3D Twin" view with
 * a mode switcher. The engineering twin is the default mode, so the
 * offline/air-gapped path is never gated behind the ion token. Each mode only
 * mounts (and downloads its code) when selected.
 */

import { lazy, Suspense, useState } from 'react';

const TwinCanvasView = lazy(() => import('./TwinCanvasView'));
const CesiumPhotorealisticView = lazy(() => import('./CesiumPhotorealisticView'));

type Mode = 'engineering' | 'photorealistic';

const MODES: Array<[Mode, string]> = [
  ['engineering', 'Engineering Twin'],
  ['photorealistic', 'Photorealistic'],
];

function initialMode(): Mode {
  try {
    return new URLSearchParams(window.location.search).get('mode') === 'photorealistic'
      ? 'photorealistic'
      : 'engineering';
  } catch {
    return 'engineering';
  }
}

export default function UnifiedTwinView() {
  const [mode, setMode] = useState<Mode>(initialMode);

  const pick = (m: Mode) => {
    setMode(m);
    try {
      const url = new URL(window.location.href);
      if (m === 'photorealistic') url.searchParams.set('mode', 'photorealistic');
      else url.searchParams.delete('mode');
      window.history.replaceState(null, '', url);
    } catch {
      /* URL sync is best-effort */
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 64px)' }}>
      <div
        role="group"
        aria-label="3D twin mode"
        style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
          display: 'flex', padding: 4, borderRadius: 999,
          background: 'rgba(255,255,255,0.96)', border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(0,0,0,0.14)',
        }}
      >
        {MODES.map(([m, label]) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              onClick={() => pick(m)}
              style={{
                minHeight: 48, padding: '0 22px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: active ? '#0f172a' : 'transparent',
                color: active ? '#ffffff' : '#334155',
                fontWeight: 700, fontSize: '0.95rem',
                fontFamily: 'system-ui, -apple-system, sans-serif', whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <Suspense
        fallback={
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%',
            color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            Loading the 3D twin…
          </div>
        }
      >
        {mode === 'engineering' ? <TwinCanvasView /> : <CesiumPhotorealisticView />}
      </Suspense>
    </div>
  );
}
