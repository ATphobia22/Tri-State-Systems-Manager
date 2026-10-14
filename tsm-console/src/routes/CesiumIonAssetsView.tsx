import { useCallback, useMemo, useState } from 'react';
import CesiumTilesLayer from '../components/CesiumTilesLayer';

type RendererState = 'loading' | 'ready' | 'error' | 'disabled';

const palette = {
  background: '#07111f',
  panel: '#0d1b2b',
  border: '#20354b',
  text: '#e7f0fa',
  muted: '#a8bbcf',
  accent: '#70d6ff',
};

export default function CesiumIonAssetsView(): JSX.Element {
  const [renderer, setRenderer] = useState<RendererState>('loading');
  const handleStatus = useCallback((status: RendererState): void => setRenderer(status), []);
  const config = useMemo(() => {
    const rawId = import.meta.env.VITE_CESIUM_ION_ASSET_ID?.trim();
    const assetId = rawId && /^\d+$/.test(rawId) ? Number(rawId) : undefined;
    const token = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN?.trim();
    return { assetId: assetId && Number.isSafeInteger(assetId) && assetId > 0 ? assetId : undefined, token };
  }, []);

  const statusText: Record<RendererState, string> = {
    loading: 'Connecting to Cesium ion…',
    ready: 'Hosted 3D Tiles asset loaded',
    error: 'Hosted asset unavailable; check asset access and configuration',
    disabled: '3D renderer disabled',
  };

  return (
    <main style={{ minHeight: 'calc(100dvh - 56px)', background: palette.background, color: palette.text, display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${palette.border}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Cesium ion · Hosted 3D Assets</h1>
            <p style={{ margin: '0.35rem 0 0', color: palette.muted, fontSize: '0.875rem' }}>
              Stream your selected Cesium ion asset without Google Maps Platform tile billing.
            </p>
          </div>
          <span role="status" aria-live="polite" data-renderer-state={renderer} style={{ border: `1px solid ${renderer === 'ready' ? '#3a9b75' : palette.border}`, borderRadius: 999, padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}>
            {statusText[renderer]}
          </span>
        </div>
      </header>

      <section aria-label="Cesium ion hosted 3D asset viewer" style={{ position: 'relative', minHeight: '58dvh', height: 'calc(100dvh - 220px)', flex: 1, borderBottom: `1px solid ${palette.border}` }}>
        {config.assetId && config.token ? (
          <CesiumTilesLayer ionAssetId={config.assetId} ionAccessToken={config.token} onStatusChange={handleStatus} />
        ) : (
          <div style={{ maxWidth: 760, margin: '2rem auto', padding: '1.25rem', background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 12 }}>
            <h2 style={{ marginTop: 0, color: palette.accent, fontSize: '1.05rem' }}>Configure your ion asset</h2>
            <p style={{ color: palette.muted, lineHeight: 1.6 }}>
              Choose an asset you can access in the Cesium ion dashboard, then configure the asset ID and a browser-safe, restricted read token at build time.
            </p>
            <ol style={{ color: palette.text, lineHeight: 1.8, paddingLeft: '1.25rem' }}>
              <li><a href="https://ion.cesium.com/assets" target="_blank" rel="noreferrer" style={{ color: palette.accent }}>Open Cesium ion assets</a> and select the hosted 3D Tiles asset.</li>
              <li>Create a dedicated token with read-only access to that asset and restrict it to the deployed site’s allowed URLs.</li>
              <li>Set <code>VITE_CESIUM_ION_ASSET_ID</code> and <code>VITE_CESIUM_ION_ACCESS_TOKEN</code> in the build environment, then rebuild and deploy.</li>
            </ol>
            <p style={{ color: palette.muted, fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 0 }}>
              No token or asset ID is hard-coded. The USGS 3DEP terrain viewer remains available independently at <code>/terrain-3d</code>.
            </p>
          </div>
        )}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0.75rem', padding: '1rem 1.25rem' }}>
        <article style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 10, padding: '0.9rem' }}>
          <h2 style={{ fontSize: '0.95rem', margin: '0 0 0.4rem', color: palette.accent }}>Cost controls</h2>
          <p style={{ margin: 0, color: palette.muted, fontSize: '0.85rem' }}>Use the Community plan only within its published quotas and eligible use terms. Monitor streaming and storage usage before public rollout.</p>
        </article>
        <article style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 10, padding: '0.9rem' }}>
          <h2 style={{ fontSize: '0.95rem', margin: '0 0 0.4rem', color: palette.accent }}>Token security</h2>
          <p style={{ margin: 0, color: palette.muted, fontSize: '0.85rem' }}>VITE_ variables are embedded in public client code. Use only a read-only token restricted to the selected asset and approved site URLs; never use a write-capable token here.</p>
        </article>
        <article style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 10, padding: '0.9rem' }}>
          <h2 style={{ fontSize: '0.95rem', margin: '0 0 0.4rem', color: palette.accent }}>Data provenance</h2>
          <p style={{ margin: 0, color: palette.muted, fontSize: '0.85rem' }}>Ion-hosted assets are visualization inputs, not automatically authoritative elevation control, a survey, or a FEMA regulatory determination. Preserve source attribution and metadata.</p>
        </article>
      </section>
    </main>
  );
}
