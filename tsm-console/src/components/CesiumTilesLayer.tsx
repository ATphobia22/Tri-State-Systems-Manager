/**
 * CesiumTilesLayer — CesiumJS renderer for TSM 3D Tiles.
 *
 * Self-hosted 3D Tiles 1.1, no Cesium ion token required.
 * Loads the HLOD building tileset via CesiumJS native 3D Tiles support.
 *
 * Fail-closed: reports unavailable if tileset URL is invalid or unreachable.
 */

import { useEffect, useRef, useState } from 'react';

interface CesiumTilesLayerProps {
  tilesetUrl: string;
  onStatusChange?: (status: 'loading' | 'ready' | 'error' | 'disabled') => void;
}

// CesiumJS is an optional peer dependency. We use `any` types to avoid
// requiring it at build time. Install with: npm install cesium
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CesiumModule = any;
export default function CesiumTilesLayer({
  tilesetUrl,
  onStatusChange,
}: CesiumTilesLayerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let viewer: unknown = null;
    let cancelled = false;

    async function init() {
      try {
        onStatusChange?.('loading');

        // Validate URL (fail-closed)
        const url = new URL(tilesetUrl);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
          throw new Error('Tileset URL must be http(s)');
        }

        // Dynamic import CesiumJS (optional peer dependency)
        // Install with: npm install cesium
        let Cesium: CesiumModule;
        try {
          Cesium = await Function('return import("cesium")')();
        } catch {
          throw new Error(
            'CesiumJS not installed. Run: npm install cesium'
          );
        }

        if (cancelled || !mountRef.current) return;

        // Create viewer without ion token (self-hosted only)
        viewer = new Cesium.Viewer(mountRef.current, {
          // No base imagery — TSM provides its own map layers
          imageryProvider: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          timeline: false,
          animation: false,
          // Self-hosted: no ion access token
          infoBox: false,
          selectionIndicator: false,
        });

        // Load HLOD tileset
        const tileset = await Cesium.Cesium3DTileset.fromUrl(tilesetUrl, {
          // Enable Draco decoding (KHR_draco_mesh_compression)
          // CesiumJS handles this automatically via DracoLoader
        });

        if (cancelled) return;

        (viewer as { scene: { primitives: { add: (t: unknown) => void } } }).scene.primitives.add(tileset);

        // Zoom to tileset
        await (viewer as { zoomTo: (t: unknown) => Promise<void> }).zoomTo(tileset);

        onStatusChange?.('ready');
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Failed to load tileset';
          setError(msg);
          onStatusChange?.('error');
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (viewer && typeof (viewer as { destroy?: () => void }).destroy === 'function') {
        (viewer as { destroy: () => void }).destroy();
      }
    };
  }, [tilesetUrl, onStatusChange]);

  if (error) {
    return (
      <div ref={mountRef} style={{ width: '100%', height: '100%' }}>
        <div style={{ padding: 16, color: '#a00' }}>
          3D Tiles unavailable: {error}
        </div>
      </div>
    );
  }

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}
