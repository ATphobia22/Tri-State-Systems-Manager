import { useCallback, useState } from 'react';
import CesiumTilesLayer from '../components/CesiumTilesLayer';

type RendererState = 'loading' | 'ready' | 'error' | 'disabled';

const tilesetUrl = `${import.meta.env.BASE_URL}3d-tiles/terrain-3dep/tileset.json`;

const palette = {
  background: '#07111f',
  panel: '#0d1b2b',
  border: '#20354b',
  text: '#e7f0fa',
  muted: '#a8bbcf',
  accent: '#70d6ff',
};

export default function CesiumTerrainView(): JSX.Element {
  const [renderer, setRenderer] = useState<RendererState>('loading');
  const handleStatus = useCallback((status: RendererState): void => setRenderer(status), []);

  const statusText: Record<RendererState, string> = {
    loading: 'Loading self-hosted CesiumJS and OGC 3D Tiles…',
    ready: '3D terrain tiles loaded in the browser',
    error: '3D renderer needs attention; 2D terrain remains available',
    disabled: '3D renderer disabled',
  };

  return (
    <main style={{ minHeight: 'calc(100dvh - 56px)', background: palette.background, color: palette.text, display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${palette.border}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem' }}>USGS 3DEP · 3D Terrain</h1>
            <p style={{ margin: '0.35rem 0 0', color: palette.muted, fontSize: '0.875rem' }}>
              Self-hosted CesiumJS · OGC 3D Tiles 1.1 · static GitHub Pages assets
            </p>
          </div>
          <span role="status" aria-live="polite" data-renderer-state={renderer} style={{ border: `1px solid ${renderer === 'ready' ? '#3a9b75' : palette.border}`, borderRadius: 999, padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}>
            {statusText[renderer]}
          </span>
        </div>
      </header>

      <section aria-label="Interactive 3D terrain viewer" style={{ position: 'relative', minHeight: '58dvh', height: 'calc(100dvh - 220px)', flex: 1, borderBottom: `1px solid ${palette.border}` }}>
        <CesiumTilesLayer tilesetUrl={tilesetUrl} onStatusChange={handleStatus} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0.75rem', padding: '1rem 1.25rem' }}>
        <article style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 10, padding: '0.9rem' }}>
          <h2 style={{ fontSize: '0.95rem', margin: '0 0 0.4rem', color: palette.accent }}>Terrain service</h2>
          <p style={{ margin: 0, color: palette.muted, fontSize: '0.85rem' }}>The terrain tileset and CesiumJS runtime are published under this site’s own base path. No Cesium ion token or third-party Cesium runtime is required.</p>
        </article>
        <article style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 10, padding: '0.9rem' }}>
          <h2 style={{ fontSize: '0.95rem', margin: '0 0 0.4rem', color: palette.accent }}>Data provenance</h2>
          <p style={{ margin: 0, color: palette.muted, fontSize: '0.85rem' }}>USGS 3DEP-derived terrain mesh. A derived visualization is not survey-grade elevation control and is not a FEMA regulatory determination.</p>
        </article>
        <article style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 10, padding: '0.9rem' }}>
          <h2 style={{ fontSize: '0.95rem', margin: '0 0 0.4rem', color: palette.accent }}>Operational behavior</h2>
          <p style={{ margin: 0, color: palette.muted, fontSize: '0.85rem' }}>Rendering does not depend on live gauges or an API login. If the generated tileset fails to load, the error is visible and the 2D terrain/map views remain usable; source claims remain provenance-gated.</p>
        </article>
      </section>
    </main>
  );
}
