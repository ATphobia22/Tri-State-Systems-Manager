/**
 * CesiumGlobeView — self-hosted CesiumJS 3D globe for TSM.
 *
 * Self-hosting contract (standing rule):
 * - CesiumJS is bundled from the npm `cesium` package (Apache-2.0).
 * - NO Cesium ion: no access token, no ion asset IDs, no ion API endpoints.
 * - All layers load from this deployment's own URLs (GitHub Pages / local).
 *
 * Graceful degradation (visuals are NOT fail-closed):
 * - The globe always initializes, even with zero layers.
 * - Each layer is probed independently (LayerAvailability); a missing layer
 *   shows "unavailable" in the layer panel instead of crashing the scene.
 * - Missing data stays unavailable — never invented. The viewer degrades,
 *   the data does not get fabricated.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Viewer,
  Cesium3DTileset,
  GeoJsonDataSource,
  Color,
  Cartesian3,
  Math as CesiumMath,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

export type LayerAvailabilityState = 'checking' | 'available' | 'unavailable';

export interface GlobeLayer {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly kind: 'tiles3d' | 'geojson';
  readonly provenance: string;
}

export const GLOBE_LAYERS: readonly GlobeLayer[] = [
  {
    id: 'terrain',
    label: 'Terrain (USGS 3DEP)',
    url: `${import.meta.env.BASE_URL}3d-tiles/terrain-3dep/tileset.json`,
    kind: 'tiles3d',
    provenance: 'DERIVED — USGS 3DEP Terrain-RGB → OGC 3D Tiles 1.1, GEOID18 vertical (h = H + N). Screening only.',
  },
  {
    id: 'buildings',
    label: 'Buildings (23,082)',
    url: `${import.meta.env.BASE_URL}3d-tiles/buildings/tileset.json`,
    kind: 'tiles3d',
    provenance: 'OBSERVED + DERIVED — 3DEP EPT Class 6 + Indiana 2020 COPC. See building pipeline manifest.',
  },
  {
    id: 'buildings-lidar-12450',
    label: 'Buildings LiDAR (12,450)',
    url: `${import.meta.env.BASE_URL}3d-tiles/buildings-lidar-12450/tileset.json`,
    kind: 'tiles3d',
    provenance: 'OBSERVED — 3DEP EPT Class 6 LiDAR-derived heights only.',
  },
  {
    id: 'bathymetry',
    label: 'eHydro bathymetry extents',
    url: `${import.meta.env.BASE_URL}data/ehydro-survey-extents.geojson`,
    kind: 'geojson',
    provenance: 'OBSERVATION — 20 USACE eHydro surveys, Ohio River Datum (NAVD88 offset unavailable).',
  },
];

/** Probe a layer URL. Returns true when the resource responds OK. */
export async function checkLayerAvailability(url: string): Promise<boolean> {
  try {
    // HEAD first (cheap); fall back to a ranged GET for servers that reject HEAD.
    let res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) {
      res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    }
    return res.ok;
  } catch {
    return false;
  }
}

interface CesiumGlobeViewProps {
  /** Initial camera target: [lng, lat]. Defaults to the Bonebank anchor. */
  center?: [number, number];
  initialHeightM?: number;
}

export default function CesiumGlobeView({
  center = [-88.005075, 37.845887],
  initialHeightM = 25000,
}: CesiumGlobeViewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [availability, setAvailability] = useState<Record<string, LayerAvailabilityState>>(
    Object.fromEntries(GLOBE_LAYERS.map((l) => [l.id, 'checking' as LayerAvailabilityState])),
  );
  const [viewerError, setViewerError] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    let viewer: Viewer | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        // Probe every layer independently — one failure never blocks the rest.
        const results = await Promise.all(
          GLOBE_LAYERS.map(async (layer) => ({
            id: layer.id,
            ok: await checkLayerAvailability(layer.url),
          })),
        );
        if (cancelled) return;
        setAvailability(Object.fromEntries(results.map((r) => [r.id, (r.ok ? 'available' : 'unavailable') as LayerAvailabilityState])));

        // The globe always initializes — even with zero layers.
        viewer = new Viewer(mountRef.current as HTMLElement, {
          animation: false,
          baseLayer: false, // no ion imagery; self-hosted only
          baseLayerPicker: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: true,
          navigationHelpButton: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          // Deliberately no Ion.defaultAccessToken — ion is never used.
        });

        for (const layer of GLOBE_LAYERS) {
          const result = results.find((r) => r.id === layer.id);
          if (!result?.ok) continue; // unavailable: labeled in panel, skipped in scene
          try {
            if (layer.kind === 'tiles3d') {
              const tileset = await Cesium3DTileset.fromUrl(layer.url);
              if (cancelled) {
                tileset.destroy();
                return;
              }
              viewer.scene.primitives.add(tileset);
            } else {
              const source = await GeoJsonDataSource.load(layer.url, {
                stroke: Color.CYAN,
                fill: Color.CYAN.withAlpha(0.15),
                strokeWidth: 2,
              });
              if (cancelled) return;
              viewer.dataSources.add(source);
            }
          } catch {
            // A layer that fails at load time degrades to unavailable.
            setAvailability((prev) => ({ ...prev, [layer.id]: 'unavailable' }));
          }
        }

        viewer.camera.setView({
          destination: Cartesian3.fromDegrees(center[0], center[1], initialHeightM),
        });
      } catch (e) {
        if (!cancelled) setViewerError(e instanceof Error ? e.message : 'Globe failed to initialize.');
      }
    };

    void init();
    return () => {
      cancelled = true;
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      viewer = null;
    };
  }, [center, initialHeightM]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 480 }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} aria-label="Self-hosted CesiumJS globe — no ion" />
      {viewerError && (
        <div role="alert" style={{ position: 'absolute', top: 12, left: 12, padding: 12, background: '#3a1111', color: '#fff', borderRadius: 8 }}>
          Globe unavailable: {viewerError}
        </div>
      )}
      <div
        aria-label="Layer availability"
        style={{
          position: 'absolute', top: 12, right: 12, padding: 12, borderRadius: 8,
          background: 'rgba(10,16,24,0.85)', color: '#dfe7ef', fontSize: 13, maxWidth: 300,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Layers</div>
        {GLOBE_LAYERS.map((layer) => {
          const state = availability[layer.id];
          const dot = state === 'available' ? '#35d07f' : state === 'unavailable' ? '#e5484d' : '#e8a13c';
          return (
            <div key={layer.id} style={{ marginBottom: 8 }}>
              <div>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: dot, marginRight: 8 }} />
                {layer.label} — <em>{state}</em>
              </div>
              <div style={{ fontSize: 11, color: '#9fb0c3', marginLeft: 18 }}>{layer.provenance}</div>
            </div>
          );
        })}
        <div style={{ fontSize: 11, color: '#9fb0c3', marginTop: 4 }}>
          Self-hosted CesiumJS {`1.146.0`} · zero ion traffic
        </div>
      </div>
    </div>
  );
}

// Re-exported for tests: CesiumMath is otherwise unused at module scope.
export const __cesiumMath = CesiumMath;
