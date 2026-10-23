/**
 * CesiumPhotorealisticView — opt-in photorealistic 3D globe via Cesium ion (free Community tier).
 *
 * ADDITIVE ONLY: the MapLibre globe (/globe) stays the default offline path. This view
 * loads only when visited, and only does anything when VITE_CESIUM_ION_TOKEN is set at
 * build time. Without a token it shows an honest "not configured" panel — never a stub
 * that pretends to work.
 *
 * What it shows: Google Photorealistic 3D Tiles (public Cesium ion asset 2275207),
 * opened over the Ohio–Wabash confluence (rounded reference point 37.85, -88.01).
 *
 * Token hygiene: the token lives in VITE_CESIUM_ION_TOKEN (local .env.local, never
 * committed). In the ion dashboard, restrict the token's allowed URLs to the
 * deployment domains. Free-tier quotas apply — see the dashboard, not this file.
 */

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window { Cesium?: any }
}

const CESIUM_VERSION = '1.146';
const CESIUM_SCRIPT_URL = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Cesium.js`;
const CESIUM_CSS_URL = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Widgets/widgets.css`;

const ION_TOKEN = (import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined)?.trim() ?? '';

type Status = 'loading' | 'ready' | 'error' | 'unconfigured';

const panelStyle: React.CSSProperties = {
  maxWidth: 640,
  margin: '4rem auto',
  padding: '2rem',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  color: '#1e293b',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

export default function CesiumPhotorealisticView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>(ION_TOKEN ? 'loading' : 'unconfigured');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ION_TOKEN || !containerRef.current) return;
    let cancelled = false;
    let viewer: any = null;

    const loadCesiumOnce = (): Promise<void> => {
      if (window.Cesium) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = CESIUM_CSS_URL;
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = CESIUM_SCRIPT_URL;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error('Could not load CesiumJS from the Cesium CDN. Check your network connection and try again.'));
        document.head.appendChild(script);
      });
    };

    (async () => {
      try {
        await loadCesiumOnce();
        if (cancelled || !containerRef.current) return;
        const C = window.Cesium;
        C.Ion.defaultAccessToken = ION_TOKEN;
        // Official pattern per https://cesium.com/learn/cesiumjs-learn/cesiumjs-photorealistic-3d-tiles/:
        // the Google tiles cover the whole globe, so the default globe is turned
        // off; the tileset is built with the dedicated helper (ion-brokered).
        viewer = new C.Viewer(containerRef.current, {
          globe: false,
          timeline: false,
          animation: false,
          baseLayerPicker: false,
          geocoder: C.IonGeocodeProviderType.GOOGLE,
        });
        const tileset = await C.createGooglePhotorealistic3DTileset();
        viewer.scene.primitives.add(tileset);
        viewer.camera.flyTo({
          destination: C.Cartesian3.fromDegrees(-88.01, 37.85, 12000),
          orientation: {
            heading: C.Math.toRadians(0),
            pitch: C.Math.toRadians(-45),
            roll: 0,
          },
          duration: 2.5,
        });
        if (!cancelled) setStatus('ready');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'The photorealistic globe could not start.');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      try { viewer?.destroy(); } catch { /* viewer teardown is best-effort */ }
    };
  }, []);

  if (status === 'unconfigured') {
    return (
      <div style={panelStyle}>
        <h1 style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>Photorealistic 3D is not configured</h1>
        <p style={{ lineHeight: 1.6 }}>
          This optional view streams Google Photorealistic 3D Tiles through a free Cesium ion
          Community account. No token has been configured for this build, so there is nothing
          to show here — and nothing is broken.
        </p>
        <ol style={{ lineHeight: 1.7, paddingLeft: '1.25rem' }}>
          <li>Create a free account at <strong>ion.cesium.com</strong>.</li>
          <li>In the ion dashboard, go to <strong>Access Tokens</strong> and create a token
            (restrict its allowed URLs to your deployment domains).</li>
          <li>Set <code>VITE_CESIUM_ION_TOKEN</code> in your <code>.env.local</code> (never commit it)
            and rebuild.</li>
        </ol>
        <p style={{ lineHeight: 1.6 }}>
          The default <a href="/globe">3D globe</a> (MapLibre, fully offline-capable) is unaffected.
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 64px)' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {status !== 'ready' && (
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.85)', color: '#1e293b',
            fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center', padding: '2rem',
          }}
        >
          {status === 'loading' && <p>Loading the photorealistic globe…</p>}
          {status === 'error' && (
            <div style={panelStyle}>
              <h1 style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>The globe could not start</h1>
              <p style={{ lineHeight: 1.6 }}>{error}</p>
              <p style={{ lineHeight: 1.6 }}>
                This usually means the network, the Cesium CDN, or the ion token is unavailable.
                The rest of the console is unaffected.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
