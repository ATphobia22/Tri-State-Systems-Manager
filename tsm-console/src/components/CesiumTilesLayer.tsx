import { useEffect, useRef, useState } from 'react';

interface Tileset { destroy(): void }
interface Primitives { add(tileset: Tileset): Tileset }
interface Scene { primitives: Primitives }
interface Viewer { scene: Scene; zoomTo(target: Tileset): Promise<boolean>; destroy(): void }
interface CesiumApi {
  Viewer: new (container: HTMLElement, options: Record<string, unknown>) => Viewer;
  Cesium3DTileset: {
    fromUrl(url: string): Promise<Tileset>;
    fromIonAssetId(assetId: number, options?: { accessToken?: string }): Promise<Tileset>;
  };
}

declare global { interface Window { Cesium?: unknown; CESIUM_BASE_URL?: string } }

interface CesiumTilesLayerProps {
  readonly tilesetUrl?: string;
  readonly ionAssetId?: number;
  readonly ionAccessToken?: string;
  readonly cesiumBaseUrl?: string;
  readonly onStatusChange?: (status: 'loading' | 'ready' | 'error' | 'disabled') => void;
}

function isCesium(value: unknown): value is CesiumApi {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  const c = r.Cesium3DTileset;
  return typeof r.Viewer === 'function' && typeof c === 'object' && c !== null
    && typeof (c as Record<string, unknown>).fromUrl === 'function'
    && typeof (c as Record<string, unknown>).fromIonAssetId === 'function';
}

function normalize(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

async function loadCesium(baseUrl: string): Promise<CesiumApi> {
  const base = normalize(baseUrl);
  window.CESIUM_BASE_URL = base;
  if (!document.getElementById('tsm-cesium-widgets-css')) {
    const link = document.createElement('link');
    link.id = 'tsm-cesium-widgets-css';
    link.rel = 'stylesheet';
    link.href = `${base}Widgets/widgets.css`;
    document.head.appendChild(link);
  }
  if (!isCesium(window.Cesium)) {
    const existing = document.querySelector<HTMLScriptElement>('script[data-tsm-cesium="true"]');
    if (existing) {
      await new Promise<void>((resolve, reject) => {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('CesiumJS failed to load.')), { once: true });
      });
    } else {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `${base}Cesium.js`;
        script.async = true;
        script.dataset.tsmCesium = 'true';
        script.addEventListener('load', () => resolve(), { once: true });
        script.addEventListener('error', () => reject(new Error('Self-hosted CesiumJS failed to load.')), { once: true });
        document.head.appendChild(script);
      });
    }
  }
  if (!isCesium(window.Cesium)) throw new Error('Self-hosted CesiumJS does not expose the required 3D Tiles API.');
  return window.Cesium;
}

export default function CesiumTilesLayer({
  tilesetUrl,
  ionAssetId,
  ionAccessToken,
  cesiumBaseUrl = `${import.meta.env.BASE_URL}vendor/cesium/`,
  onStatusChange,
}: CesiumTilesLayerProps) {
  const mount = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mount.current) return;
    let viewer: Viewer | null = null;
    let tileset: Tileset | null = null;
    let cancelled = false;

    const initialize = async (): Promise<void> => {
      try {
        setError(null);
        onStatusChange?.('loading');
        const hasIonAsset = ionAssetId !== undefined;
        if (hasIonAsset && (!Number.isSafeInteger(ionAssetId) || ionAssetId <= 0)) {
          throw new Error('Cesium ion asset ID must be a positive integer.');
        }
        if (hasIonAsset && !ionAccessToken?.trim()) {
          throw new Error('Cesium ion access token is not configured. Set VITE_CESIUM_ION_ACCESS_TOKEN at build time.');
        }
        if (hasIonAsset === Boolean(tilesetUrl)) {
          throw new Error('Configure exactly one 3D Tiles source: a tileset URL or a Cesium ion asset ID.');
        }
        let validatedUrl: string | undefined;
        if (tilesetUrl) {
          const url = new URL(tilesetUrl, window.location.href);
          if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Tileset URL must use HTTP or HTTPS.');
          validatedUrl = url.href;
        }

        const Cesium = await loadCesium(cesiumBaseUrl);
        if (cancelled || !mount.current) return;
        viewer = new Cesium.Viewer(mount.current, {
          animation: false,
          baseLayer: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          navigationHelpButton: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
        });
        tileset = ionAssetId !== undefined
          ? await Cesium.Cesium3DTileset.fromIonAssetId(ionAssetId, { accessToken: ionAccessToken })
          : await Cesium.Cesium3DTileset.fromUrl(validatedUrl as string);
        if (cancelled) {
          tileset.destroy();
          return;
        }
        viewer.scene.primitives.add(tileset);
        await viewer.zoomTo(tileset);
        if (!cancelled) onStatusChange?.('ready');
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'CesiumJS failed to initialize.');
          onStatusChange?.('error');
        }
      }
    };

    void initialize();
    return () => {
      cancelled = true;
      tileset?.destroy();
      viewer?.destroy();
      viewer = null;
      tileset = null;
    };
  }, [cesiumBaseUrl, ionAccessToken, ionAssetId, onStatusChange, tilesetUrl]);

  return (
    <div ref={mount} style={{ position: 'relative', width: '100%', height: '100%' }} aria-label="CesiumJS 3D Tiles viewer">
      {error && (
        <div role="alert" style={{ position: 'absolute', zIndex: 5, top: 12, left: 12, right: 12, padding: 16, background: '#301d24', color: '#fff', border: '1px solid #a94c5d', borderRadius: 8 }}>
          3D Tiles unavailable: {error}
        </div>
      )}
    </div>
  );
}
