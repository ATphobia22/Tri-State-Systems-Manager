/**
 * CesiumGlobeView — self-hosted CesiumJS 3D globe for TSM.
 *
 * Self-hosting contract (standing rule):
 * - CesiumJS is bundled from the npm `cesium` package (Apache-2.0).
 * - NO Cesium ion: no access token, no ion asset IDs, no ion API endpoints.
 * - NO MapTiler API keys: no token-gated services of any kind.
 * - All layers load from this deployment's own URLs (GitHub Pages / local).
 *
 * Terrain (preferred order):
 *  1. Quantized-mesh via CesiumTerrainProvider — the CesiumJS terrain
 *     standard — from `3d-tiles/terrain-quantized-mesh/layer.json`
 *     (see scripts/geospatial/TERRAIN-QUANTIZED-MESH.md for the build).
 *  2. Fallback: the existing Terrain-RGB-derived GLB tileset
 *     (`3d-tiles/terrain-3dep/tileset.json`, OGC 3D Tiles 1.1).
 *
 * Imagery drape: optional self-hosted URL-template imagery layer
 * (`tiles/imagery/{z}/{x}/{y}.png`); probed, never fabricated.
 *
 * Graceful degradation (visuals are NOT fail-closed):
 * - The globe always initializes, even with zero layers.
 * - Each layer is probed independently (LayerAvailability); a missing layer
 *   shows "unavailable" in the layer panel instead of crashing the scene.
 * - Missing data stays unavailable — never invented. The viewer degrades,
 *   the data does not get fabricated.
 *
 * Design: cyber-cartographic dark theme (see styles/tsm-design-system.css).
 * Every numeric readout pairs with a provenance badge
 * (OBSERVED / DERIVED / SIMULATED / SCENARIO / UNAVAILABLE).
 */

import { useEffect, useRef, useState } from 'react';
import {
  Viewer,
  Cesium3DTileset,
  CesiumTerrainProvider,
  UrlTemplateImageryProvider,
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
  readonly kind: 'tiles3d' | 'geojson' | 'terrain-qm' | 'imagery';
  readonly provenance: string;
  /** Provenance class for the honesty badge. */
  readonly provClass: 'observed' | 'derived' | 'simulated' | 'scenario' | 'unavailable';
}

const BASE = import.meta.env.BASE_URL;

export const GLOBE_LAYERS: readonly GlobeLayer[] = [
  {
    id: 'terrain-qm',
    label: 'Terrain quantized-mesh (USGS 3DEP)',
    url: `${BASE}3d-tiles/terrain-quantized-mesh/layer.json`,
    kind: 'terrain-qm',
    provenance: 'DERIVED — USGS 3DEP DEM → quantized-mesh (ctb-tile), GEOID18 vertical (h = H + N).',
    provClass: 'derived',
  },
  {
    id: 'terrain',
    label: 'Terrain GLB fallback (USGS 3DEP)',
    url: `${BASE}3d-tiles/terrain-3dep/tileset.json`,
    kind: 'tiles3d',
    provenance: 'DERIVED — USGS 3DEP Terrain-RGB → OGC 3D Tiles 1.1, GEOID18 vertical (h = H + N). Screening only.',
    provClass: 'derived',
  },
  {
    id: 'imagery',
    label: 'Imagery drape (self-hosted)',
    url: `${BASE}tiles/imagery/{z}/{x}/{y}.png`,
    kind: 'imagery',
    provenance: 'OBSERVATION — self-hosted tile pyramid; absent until the imagery pipeline publishes it.',
    provClass: 'observed',
  },
  {
    id: 'buildings',
    label: 'Buildings (23,082)',
    url: `${BASE}3d-tiles/buildings/tileset.json`,
    kind: 'tiles3d',
    provenance: 'OBSERVED + DERIVED — 3DEP EPT Class 6 + Indiana 2020 COPC. See building pipeline manifest.',
    provClass: 'derived',
  },
  {
    id: 'buildings-lidar-12450',
    label: 'Buildings LiDAR (12,450)',
    url: `${BASE}3d-tiles/buildings-lidar-12450/tileset.json`,
    kind: 'tiles3d',
    provenance: 'OBSERVED — 3DEP EPT Class 6 LiDAR-derived heights only.',
    provClass: 'observed',
  },
  {
    id: 'bathymetry',
    label: 'eHydro bathymetry extents',
    url: `${BASE}data/ehydro-survey-extents.geojson`,
    kind: 'geojson',
    provenance: 'OBSERVATION — 20 USACE eHydro surveys, Ohio River Datum (NAVD88 offset unavailable).',
    provClass: 'observed',
  },
];

/** Plain-word explanations paired with the honest provenance codes. */
const PROV_WORDS: Record<'observed' | 'derived' | 'simulated' | 'scenario' | 'unavailable', [string, string]> = {
  observed: ['OBSERVED', 'Measured by laser (3DEP)'],
  derived: ['DERIVED', 'Calculated from measured data'],
  simulated: ['SIMULATED', 'Computer model estimate'],
  scenario: ['SCENARIO', 'What-if scenario, not a prediction'],
  unavailable: ['UNAVAILABLE', 'Data not available'],
};

/** Probe a layer URL. Returns true when the resource responds OK. */
export async function checkLayerAvailability(url: string): Promise<boolean> {
  try {
    // URL templates can't be HEAD-probed directly; try z0 tile.
    const probeUrl = url.includes('{z}') ? url.replace('{z}', '0').replace('{x}', '0').replace('{y}', '0') : url;
    // HEAD first (cheap); fall back to a ranged GET for servers that reject HEAD.
    let res = await fetch(probeUrl, { method: 'HEAD' });
    if (!res.ok) {
      res = await fetch(probeUrl, { headers: { Range: 'bytes=0-0' } });
    }
    return res.ok;
  } catch {
    return false;
  }
}

/** Map a terrain layer.json URL to its directory for CesiumTerrainProvider. */
function terrainProviderUrl(layerJsonUrl: string): string {
  return layerJsonUrl.slice(0, layerJsonUrl.lastIndexOf('/') + 1);
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

        // Terrain: quantized-mesh preferred (CesiumJS terrain standard);
        // fall back to the GLB tileset when quantized-mesh is unavailable.
        const qm = results.find((r) => r.id === 'terrain-qm');
        const glb = results.find((r) => r.id === 'terrain');
        let terrainSet = false;
        if (qm?.ok) {
          try {
            viewer.terrainProvider = await CesiumTerrainProvider.fromUrl(
              terrainProviderUrl(GLOBE_LAYERS.find((l) => l.id === 'terrain-qm')!.url),
            );
            terrainSet = true;
          } catch {
            setAvailability((prev) => ({ ...prev, 'terrain-qm': 'unavailable' }));
          }
        }
        if (!terrainSet && glb?.ok) {
          // GLB fallback renders as a 3D tileset (not a terrain provider).
          try {
            const tileset = await Cesium3DTileset.fromUrl(
              GLOBE_LAYERS.find((l) => l.id === 'terrain')!.url,
            );
            if (cancelled) {
              tileset.destroy();
              return;
            }
            viewer.scene.primitives.add(tileset);
          } catch {
            setAvailability((prev) => ({ ...prev, terrain: 'unavailable' }));
          }
        }

        for (const layer of GLOBE_LAYERS) {
          if (layer.kind === 'terrain-qm' || (layer.kind === 'tiles3d' && layer.id === 'terrain')) continue; // handled above
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
            } else if (layer.kind === 'imagery') {
              const provider = new UrlTemplateImageryProvider({ url: layer.url });
              viewer.imageryLayers.addImageryProvider(provider);
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
        <div role="alert" className="tsm-panel" style={{ position: 'absolute', top: 12, left: 12, padding: 16, maxWidth: 360, background: 'var(--tsm-danger-bg)', borderColor: 'var(--tsm-danger-border)' }}>
          <strong style={{ fontSize: 16, color: 'var(--tsm-danger-text)' }}>Globe unavailable</strong>
          <div className="tsm-panel__meta" style={{ color: 'var(--tsm-danger-text)' }}>{viewerError}</div>
        </div>
      )}
      <div
        aria-label="Layer availability"
        className="tsm-panel tsm-globe-panel"
      >
        <h2 className="tsm-panel__title">Map layers</h2>
        {GLOBE_LAYERS.map((layer) => {
          const state = availability[layer.id];
          const stateClass =
            state === 'available' ? 'tsm-layer-state tsm-layer-state-available'
            : state === 'unavailable' ? 'tsm-layer-state tsm-layer-state-unavailable'
            : 'tsm-layer-state tsm-layer-state-checking';
          const stateText =
            state === 'available' ? 'On' : state === 'unavailable' ? 'Unavailable' : 'Checking…';
          const provClass =
            state === 'unavailable' ? 'tsm-prov tsm-prov-unavailable'
            : `tsm-prov tsm-prov-${layer.provClass}`;
          const [code, plain] = PROV_WORDS[state === 'unavailable' ? 'unavailable' : layer.provClass];
          return (
            <div key={layer.id} className="tsm-layer-row">
              <div>
                <div className="tsm-layer-name">{layer.label}</div>
                <div>
                  <span className={provClass}>{code}</span>{' '}
                  <span className="tsm-prov-plain" style={{ fontSize: 14 }}>{state === 'unavailable' ? 'Data not available' : plain}</span>
                </div>
                <div className="tsm-panel__meta">{layer.provenance}</div>
              </div>
              <span className={stateClass} aria-live="polite">{stateText}</span>
            </div>
          );
        })}
        <div className="tsm-panel__meta" style={{ marginTop: 8 }}>
          Self-hosted CesiumJS · no ion · no token-gated tiles
        </div>
      </div>
    </div>
  );
}

// Re-exported for tests: CesiumMath is otherwise unused at module scope.
export const __cesiumMath = CesiumMath;
