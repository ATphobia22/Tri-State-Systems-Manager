import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapLayerSpec } from '../lib/map-layers';
import { buildTwinStyle, applyTwinTerrain, getTerrainRgbStatus } from '../lib/twin-map-style';
import { terrainRgbBlockMessage } from '../lib/terrain-rgb-contract';
import {
  SPATIAL_PLANES,
  derivePlaneState,
  getPlaneLayers,
  summarizeFabric,
  type LayerRuntimeState,
  type PlaneRuntimeState,
  type SpatialPlane,
} from '../lib/spatial-planes';

/**
 * Tri-State River Valley spatial fabric — master MapLibre plane for the TSM web console.
 *
 * Honest-by-construction:
 * - Base style and fail-closed 3D terrain come from lib/twin-map-style.ts and
 *   lib/terrain-rgb-contract.ts. No terrain mesh without a provenance-controlled template.
 * - Overlays are wired only to endpoints in the MAP_LAYERS catalog. Planes with no
 *   configured endpoint render as NOT_CONFIGURED — never synthesized.
 * - Per-layer status is driven by real MapLibre source load/error events plus a
 *   load timeout. A dead endpoint shows SOURCE_UNAVAILABLE in the panel.
 * - No authentication, no live gauge polling, no Cesium, no placeholder tile URLs.
 *
 * Coordinate honesty: the web map displays in EPSG:3857. EPSG:2966 (NAD83 /
 * Indiana West, US Survey Feet) and NAVD88 are the documented source CRS and
 * vertical datum for TSM engineering products, labeled as such in the header.
 */

const HORIZONTAL_CRS_LABEL = 'HFrame EPSG:2966 · NAD83 / Indiana West (US ft)';
const VERTICAL_DATUM_LABEL = 'VDatum NAVD88';
const DISPLAY_CRS_NOTE = 'Display EPSG:3857 · source CRS/datum per layer authority';

const TRI_STATE_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-90.0, 36.0],
  [-82.0, 42.5],
];
/** Point Township confluence area — public anchor vicinity. */
const DEFAULT_CENTER: [number, number] = [-88.005, 37.846];
const ANCHOR: [number, number] = [-88.005075, 37.845887];

const OVERLAY_OPACITY = 0.5;
const OVERLAY_TILE_SIZE = 512;
/** Fail-closed: a source still loading after this long is reported unavailable. */
const SOURCE_LOAD_TIMEOUT_MS = 30000;

const ARCGIS_EXPORT_QUERY =
  'bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=512,512&format=png32&transparent=true&f=image';

/** Extra overlay wiring not already expressed in the MAP_LAYERS catalog. */
const OVERLAY_LAYER_IDS: Record<string, number[]> = {
  // Same composite the twin style uses for the NFHL regulatory drape.
  'fema-nfhl': [28, 16, 3, 1, 34, 23],
};

function arcgisLayerIds(spec: MapLayerSpec): number[] | null {
  const meta = spec.maplibre ?? {};
  const plural = meta['arcgisLayerIds'];
  if (Array.isArray(plural) && plural.every((n) => typeof n === 'number')) {
    return plural as number[];
  }
  const single = meta['arcgisLayerId'];
  if (typeof single === 'number') return [single];
  const extra = OVERLAY_LAYER_IDS[spec.id];
  return extra ?? null;
}

function arcgisExportTemplate(spec: MapLayerSpec): string {
  const ids = arcgisLayerIds(spec);
  const layersParam = ids && ids.length > 0 ? `&layers=show:${ids.join(',')}` : '';
  return `${spec.url}/export?${ARCGIS_EXPORT_QUERY}${layersParam}`;
}

const FALLBACK_STYLE = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#0b1220' },
    },
  ],
} as unknown as maplibregl.StyleSpecification;

export interface TriStateRiverValleyMapProps {
  center?: [number, number];
  zoom?: number;
}

const STATE_BADGE: Record<PlaneRuntimeState, string> = {
  live: 'bg-emerald-950 text-emerald-400 border-emerald-800',
  degraded: 'bg-amber-950 text-amber-400 border-amber-800',
  loading: 'bg-sky-950 text-sky-400 border-sky-800',
  source_unavailable: 'bg-rose-950 text-rose-400 border-rose-800',
  not_configured: 'bg-slate-800 text-slate-400 border-slate-700',
  blocked: 'bg-orange-950 text-orange-400 border-orange-800',
  retired: 'bg-slate-900 text-slate-500 border-slate-800 line-through',
};

const STATE_LABEL: Record<PlaneRuntimeState, string> = {
  live: 'LIVE',
  degraded: 'DEGRADED',
  loading: 'LOADING',
  source_unavailable: 'UNAVAILABLE',
  not_configured: 'NOT CONFIGURED',
  blocked: 'BLOCKED',
  retired: 'RETIRED',
};

function initialLayerStates(): Record<string, LayerRuntimeState> {
  const states: Record<string, LayerRuntimeState> = {};
  const terrainStatus = getTerrainRgbStatus();
  for (const plane of SPATIAL_PLANES) {
    if (plane.retired) continue;
    for (const layer of getPlaneLayers(plane)) {
      if (layer.id === 'indiana-terrain-rgb') {
        states[layer.id] = terrainStatus.enabled ? 'loading' : 'blocked';
      } else {
        states[layer.id] = 'loading';
      }
    }
  }
  return states;
}

export default function TriStateRiverValleyMap({
  center = DEFAULT_CENTER,
  zoom = 12,
}: TriStateRiverValleyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  /** planeId -> maplibre layer ids added for that plane */
  const planeLayerMapRef = useRef<Record<string, string[]>>({});
  /** arcgis sourceId -> MAP_LAYERS id, for error attribution */
  const sourceToSpecRef = useRef<Record<string, string>>({});
  const [layerStates, setLayerStates] =
    useState<Record<string, LayerRuntimeState>>(initialLayerStates);
  // GitHub Pages is the public visualization surface: show every configured
  // visualization plane by default. Retired/unconfigured planes remain honest
  // gaps and are never synthesized.
  const [visiblePlanes, setVisiblePlanes] = useState<Set<string>>(() =>
    new Set(SPATIAL_PLANES.filter((plane) => !plane.retired && getPlaneLayers(plane).length > 0).map((plane) => plane.id)),
  );
  const [terrainMessage] = useState(() => terrainRgbBlockMessage(getTerrainRgbStatus()));

  const markLayer = (specId: string, state: LayerRuntimeState) => {
    setLayerStates((prev) => (prev[specId] === state ? prev : { ...prev, [specId]: state }));
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let style: maplibregl.StyleSpecification;
    try {
      style = buildTwinStyle();
    } catch {
      style = FALLBACK_STYLE;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center,
      zoom,
      pitch: 45,
      maxPitch: 80,
      minZoom: 8,
      maxZoom: 19,
      maxBounds: TRI_STATE_MAX_BOUNDS,
      cooperativeGestures: true,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    const addOverlay = (plane: SpatialPlane, spec: MapLayerSpec) => {
      const sourceId = `tsm-ov-${spec.id}`;
      const layerId = `tsm-ov-${spec.id}-lyr`;
      if (map.getSource(sourceId)) return;
      sourceToSpecRef.current[sourceId] = spec.id;
      map.addSource(sourceId, {
        type: 'raster',
        tiles: [arcgisExportTemplate(spec)],
        tileSize: OVERLAY_TILE_SIZE,
        attribution: spec.attribution ?? spec.title,
      });
      map.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: { 'raster-opacity': OVERLAY_OPACITY },
        layout: { visibility: 'visible' },
      });
      const list = planeLayerMapRef.current[plane.id] ?? [];
      list.push(layerId);
      planeLayerMapRef.current[plane.id] = list;
    };

    map.on('load', () => {
      // Fail-closed 3D terrain: only when the contract validates the template.
      const terrainApplied = applyTwinTerrain(map);
      const terrainStatus = getTerrainRgbStatus();
      if (terrainStatus.enabled && !terrainApplied) {
        markLayer('indiana-terrain-rgb', 'source_unavailable');
      } else if (terrainStatus.enabled && terrainApplied) {
        markLayer('indiana-terrain-rgb', 'live');
      }

      for (const plane of SPATIAL_PLANES) {
        if (plane.retired) continue;
        for (const spec of getPlaneLayers(plane)) {
          if (spec.id === 'indiana-terrain-rgb') continue; // raster-dem source, handled above
          if (spec.id === 'indiana-imagery' || spec.id === 'osm-base') continue; // base style
          try {
            if (spec.type === 'arcgis-mapserver') {
              addOverlay(plane, spec);
            } else if (spec.type === 'geojson') {
              const sourceId = `tsm-ov-${spec.id}`;
              const layerId = `tsm-ov-${spec.id}-lyr`;
              if (!map.getSource(sourceId)) {
                sourceToSpecRef.current[sourceId] = spec.id;
                const dataUrl = new URL(spec.url, window.location.href).toString();
                map.addSource(sourceId, { type: 'geojson', data: dataUrl });
                map.addLayer({
                  id: layerId,
                  type: 'fill',
                  source: sourceId,
                  paint: {
                    'fill-color': '#f59e0b',
                    'fill-opacity': 0.16,
                    'fill-outline-color': '#f59e0b',
                  },
                });
                const list = planeLayerMapRef.current[plane.id] ?? [];
                list.push(layerId);
                planeLayerMapRef.current[plane.id] = list;
              }
            } else if (spec.type !== 'raster' && spec.type !== 'raster-dem' && spec.type !== 'vector-tile') {
              markLayer(spec.id, 'not_configured');
            }
          } catch {
            markLayer(spec.id, 'source_unavailable');
          }
        }
      }

      new maplibregl.Marker({ color: '#38bdf8' })
        .setLngLat(ANCHOR)
        .setPopup(
          new maplibregl.Popup({ offset: 12 }).setText(
            'Point Township anchor vicinity (public disclosure)',
          ),
        )
        .addTo(map);
    });

    map.on('sourcedata', (e) => {
      const sourceId = (e as { sourceId?: string }).sourceId;
      const loaded = (e as { isSourceLoaded?: boolean }).isSourceLoaded === true;
      if (sourceId && loaded) {
        const specId = sourceToSpecRef.current[sourceId];
        if (specId) markLayer(specId, 'live');
      }
    });

    map.on('error', (e) => {
      const sourceId = (e as { sourceId?: string }).sourceId;
      if (sourceId) {
        const specId = sourceToSpecRef.current[sourceId];
        if (specId) markLayer(specId, 'source_unavailable');
      }
    });

    const timeout = window.setTimeout(() => {
      setLayerStates((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key] === 'loading') next[key] = 'source_unavailable';
        }
        return next;
      });
    }, SOURCE_LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeout);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlane = (planeId: string) => {
    const map = mapRef.current;
    const layerIds = planeLayerMapRef.current[planeId];
    if (!map || !layerIds || layerIds.length === 0) return;
    const makeVisible = !visiblePlanes.has(planeId);
    for (const id of layerIds) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', makeVisible ? 'visible' : 'none');
      }
    }
    setVisiblePlanes((prev) => {
      const next = new Set(prev);
      if (makeVisible) next.add(planeId);
      else next.delete(planeId);
      return next;
    });
  };

  const summary = summarizeFabric(SPATIAL_PLANES, layerStates);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#04060a] p-2 font-sans text-[11px] select-none">
      <div className="flex items-center justify-between rounded-t-lg border border-[#263e5e]/40 bg-gradient-to-r from-[#0a101a] to-[#060a12] p-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold tracking-wide text-white">
              TRI-STATE RIVER VALLEY
            </span>
            <span className="text-sky-500/60">//</span>
            <span className="text-slate-400">SPATIAL FABRIC</span>
          </div>
          <div className="mt-0.5 font-mono text-[9px] uppercase text-slate-500">
            {HORIZONTAL_CRS_LABEL} | {VERTICAL_DATUM_LABEL}
          </div>
          <div className="font-mono text-[9px] text-slate-600">{DISPLAY_CRS_NOTE}</div>
        </div>
        <div className="rounded border border-slate-800 bg-black/60 px-4 py-1.5 font-mono text-left">
          <div className="text-[9px] font-bold uppercase text-slate-400">Fabric status</div>
          <div className="mt-0.5 font-bold text-sky-400">
            {summary.live} live · {summary.degraded} degraded · {summary.sourceUnavailable}{' '}
            unavailable
          </div>
          <div className="mt-0.5 text-[9px] text-slate-500">{terrainMessage}</div>
        </div>
      </div>

      <div className="mt-2 flex min-h-0 w-full flex-1 space-x-2">
        <div
          ref={containerRef}
          className="relative h-full flex-1 rounded-bl-lg border border-[#263e5e]/40"
          aria-label="Tri-state river valley spatial fabric map"
        />

        <aside className="flex w-72 flex-col overflow-y-auto rounded-br-lg border border-[#263e5e]/40 bg-[#060a12] p-2">
          <div className="px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Data authority planes
          </div>
          {SPATIAL_PLANES.map((plane) => {
            const state = derivePlaneState(plane, layerStates);
            const toggleable = (planeLayerMapRef.current[plane.id] ?? []).length > 0;
            const visible = visiblePlanes.has(plane.id);
            const layers = getPlaneLayers(plane);
            return (
              <div
                key={plane.id}
                className="mb-1.5 rounded border border-slate-800/60 bg-black/40 p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-200">{plane.name}</span>
                  <span
                    className={`rounded border px-1 text-[8px] font-bold ${STATE_BADGE[state]}`}
                  >
                    {STATE_LABEL[state]}
                  </span>
                </div>
                <p className="mt-1 leading-snug text-slate-500">{plane.description}</p>
                {plane.retirementNote && (
                  <p className="mt-1 leading-snug text-slate-600">{plane.retirementNote}</p>
                )}
                {layers.length > 0 && (
                  <p className="mt-1 font-mono text-[9px] text-slate-600">
                    {layers.map((l) => l.title).join(' · ')}
                  </p>
                )}
                {toggleable && (
                  <button
                    type="button"
                    onClick={() => togglePlane(plane.id)}
                    className={`mt-1.5 w-full rounded border px-2 py-1 text-[9px] font-bold uppercase ${
                      visible
                        ? 'border-sky-700 bg-sky-950 text-sky-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {visible ? 'Hide overlay' : 'Show overlay'}
                  </button>
                )}
              </div>
            );
          })}
          <p className="px-1 pt-1 text-[9px] leading-snug text-slate-600">
            Visualization plane only. Continuous terrain models do not overwrite
            regulatory benchmark filings. Human administrative approval remains
            absolute.
          </p>
        </aside>
      </div>
    </div>
  );
}
