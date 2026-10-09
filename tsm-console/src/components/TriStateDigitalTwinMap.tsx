import { useCallback, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map, GeoJSONSource, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_PLANE_FABRIC, type MapPlaneLayer } from '../lib/map-plane-fabric';
import { buildArcGisExportTemplate, buildArcGisFeatureQueryUrl, getMapLibreFabricLayer } from '../lib/maplibre-layer-fabric';
import { getTerrainRgbStatus } from '../lib/twin-map-style';
import { TERRAIN_RGB_SOURCE_ID } from '../lib/terrain-rgb-contract';
import { FeatureLayerRequestCoordinator } from '../lib/feature-layer-request-coordinator';
import { getCinematicLighting, type CinematicLightPreset } from '../lib/cinematic/light-presets';
import {
  FLOOD_OVERLAY_METADATA,
  FloodDeckOverlay,
  runIllustrativeScreeningScenario,
} from '../lib/flood-deck-overlay';

const INITIAL_CENTER: [number, number] = [-88.005075, 37.845887];
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-88.08, 37.75],
  [-87.92, 37.90],
];

const layerColor = (id: string): string => {
  if (id === 'indiana-parcels') return '#38bdf8';
  if (id === 'indiana-roads') return '#fbbf24';
  if (id === 'indiana-buildings') return '#a78bfa';
  if (id === 'usgs-quad-index') return '#f472b6';
  if (id === 'hydro-bathymetry') return '#22d3ee';
  return '#94a3b8';
};

function baseStyle(): StyleSpecification {
  const imagery = getMapLibreFabricLayer('indiana-imagery').endpoint;
  return {
    version: 8,
    sources: {
      'indiana-imagery': {
        type: 'raster',
        tiles: [buildArcGisExportTemplate(imagery, [], { format: 'jpg', transparent: false, compressionQuality: 90 })],
        tileSize: 512,
        attribution: 'Indiana Geographic Information Office',
      },
    },
    layers: [
      {
        id: 'indiana-imagery-layer',
        type: 'raster',
        source: 'indiana-imagery',
        paint: { 'raster-opacity': 1 },
      },
    ],
  };
}

async function fetchGeoJson(source: string, map: Map, signal: AbortSignal): Promise<Parameters<GeoJSONSource['setData']>[0]> {
  const bounds = map.getBounds();
  const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
  const url = buildArcGisFeatureQueryUrl(source).replace('{bbox-epsg-4326}', encodeURIComponent(bbox));
  const response = await fetch(url, {
    headers: { Accept: 'application/geo+json,application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`ArcGIS FeatureServer request failed: HTTP ${response.status}`);
  const payload = await response.json() as { type?: string };
  if (payload.type !== 'FeatureCollection') throw new Error('ArcGIS source did not return a GeoJSON FeatureCollection');
  return payload as Parameters<GeoJSONSource['setData']>[0];
}

function addRasterSource(map: Map, id: string, service: string, layers: readonly number[] | undefined, visible: boolean): void {
  if (map.getSource(id)) return;
  map.addSource(id, {
    type: 'raster',
    tiles: [buildArcGisExportTemplate(service, layers)],
    tileSize: 512,
  });
  map.addLayer({
    id: `${id}-layer`,
    type: 'raster',
    source: id,
    layout: { visibility: visible ? 'visible' : 'none' },
    paint: { 'raster-opacity': 0.45 },
  });
}

function addLocalGeoJsonSource(map: Map, item: MapPlaneLayer): void {
  if (map.getSource(item.id)) return;
  const url = `${import.meta.env.BASE_URL}${item.endpoint}`;
  map.addSource(item.id, { type: 'geojson', data: url });
  const color = layerColor(item.id);
  map.addLayer({
    id: `${item.id}-line`,
    type: 'line',
    source: item.id,
    layout: { visibility: 'none' },
    paint: { 'line-color': color, 'line-width': 1, 'line-opacity': 0.85, 'line-dasharray': [4, 2] },
  });
  map.addLayer({
    id: `${item.id}-label`,
    type: 'symbol',
    source: item.id,
    layout: {
      visibility: 'none',
      'text-field': ['get', 'quad_name'],
      'text-size': 10,
      'text-allow-overlap': false,
    },
    paint: { 'text-color': color, 'text-halo-color': '#05080f', 'text-halo-width': 1 },
  });
}

function addFeatureSource(map: Map, item: MapPlaneLayer): void {
  if (map.getSource(item.id)) return;
  const source = map.getSource(item.id);
  if (source) return;
  map.addSource(item.id, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  const color = layerColor(item.id);
  if (item.id === 'indiana-roads') {
    map.addLayer({
      id: `${item.id}-line`,
      type: 'line',
      source: item.id,
      layout: { visibility: 'none' },
      paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.9 },
    });
    return;
  }
  if (item.id === 'indiana-buildings') {
    map.addLayer({
      id: `${item.id}-extrusion`,
      type: 'fill-extrusion',
      source: item.id,
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': color,
        'fill-extrusion-height': ['coalesce', ['to-number', ['get', 'height']], ['to-number', ['get', 'render_height']], 9],
        'fill-extrusion-base': ['coalesce', ['to-number', ['get', 'min_height']], 0],
        'fill-extrusion-opacity': 0.78,
      },
    });
    return;
  }
  map.addLayer({
    id: `${item.id}-fill`,
    type: 'fill',
    source: item.id,
    layout: { visibility: 'none' },
    paint: { 'fill-color': color, 'fill-opacity': 0.18, 'fill-outline-color': color },
  });
}

/** Human-readable one-liner for a picked feature. Only source-provided attributes; no invented values. */
function describePickedFeature(layerId: string, props: Record<string, unknown>): string {
  const str = (key: string): string | null => {
    const value = props[key];
    return typeof value === 'string' && value.length > 0 ? value : null;
  };
  if (layerId === 'indiana-buildings-extrusion') {
    const county = str('county') ?? 'unknown county';
    const lidarYear = str('lidaryear') ?? 'unknown vintage';
    return `Building footprint · ${county} · lidar ${lidarYear} (height: uniform 9 m fallback — source provides no height)`;
  }
  if (layerId === 'indiana-roads-line') {
    const name = str('STREET_NAME') ?? str('FULLNAME') ?? str('name') ?? 'unnamed road';
    return `Road · ${name}`;
  }
  if (layerId === 'indiana-parcels-fill') {
    const parcel = str('PARCEL_ID') ?? str('parcel_id') ?? str('OBJECTID') ?? 'unknown parcel';
    return `Parcel · ${parcel}`;
  }
  if (layerId === 'usgs-quad-index-line') {
    const quad = str('quad_name') ?? 'unknown quad';
    return `USGS 24K quad · ${quad}`;
  }
  if (layerId === 'posey-cslf-fill') {
    return 'Posey Changes Since Last FIRM area';
  }
  return `Feature · ${layerId}`;
}

export interface TriStateDigitalTwinMapProps {
  /** When true, the built-in layer sidebar is hidden (an external HUD drives the map). */
  hideSidebar?: boolean;
  /** Controlled layer visibility, keyed by fabric id. Omit for internal state. */
  visible?: Record<string, boolean>;
  onVisibleChange?: (next: Record<string, boolean>) => void;
  /** Visual-only MapLibre light and sky preset; never used as environmental evidence. */
  lightPreset?: CinematicLightPreset;
}

export function defaultMapPlaneVisibility(): Record<string, boolean> {
  return Object.fromEntries(MAP_PLANE_FABRIC.map((item) => [item.id, item.defaultVisible]));
}

export default function TriStateDigitalTwinMap(props: TriStateDigitalTwinMapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [internalVisible, setInternalVisible] = useState<Record<string, boolean>>(defaultMapPlaneVisibility);
  const lightPreset = props.lightPreset ?? 'day';
  const lightPresetRef = useRef(lightPreset);
  lightPresetRef.current = lightPreset;
  const controlled = props.visible !== undefined;
  const visible = controlled ? (props.visible as Record<string, boolean>) : internalVisible;
  const [terrainEnabled, setTerrainEnabled] = useState(false);
  const [status, setStatus] = useState('Initializing MapLibre plane…');
  const [picked, setPicked] = useState<string | null>(null);
  const [floodOverlayOn, setFloodOverlayOn] = useState(false);
  const [floodBusy, setFloodBusy] = useState(false);
  const floodOverlayRef = useRef<FloodDeckOverlay | null>(null);
  const featureRequestsRef = useRef(new FeatureLayerRequestCoordinator());
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const previousVisibleRef = useRef(visible);

  const setVisible = useCallback((updater: (current: Record<string, boolean>) => Record<string, boolean>): void => {
    if (controlled) {
      props.onVisibleChange?.(updater(visibleRef.current));
    } else {
      setInternalVisible(updater);
    }
  }, [controlled, props]);

  const setLayerVisibility = useCallback((map: Map, item: MapPlaneLayer, enabled: boolean): void => {
    const layerIds = [
      `${item.id}-layer`,
      `${item.id}-fill`,
      `${item.id}-line`,
      `${item.id}-label`,
      `${item.id}-extrusion`,
    ];
    for (const layerId of layerIds) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', enabled ? 'visible' : 'none');
    }
  }, []);

  const refreshFeatureLayer = useCallback(async (map: Map, item: MapPlaneLayer): Promise<void> => {
    const source = map.getSource(item.id) as GeoJSONSource | undefined;
    if (!source) return;
    const request = featureRequestsRef.current.begin(item.id);
    try {
      const geojson = await fetchGeoJson(item.endpoint, map, request.signal);
      if (request.isCurrent() && mapRef.current === map && map.getSource(item.id) === source) source.setData(geojson);
    } catch (error) {
      if (request.isCurrent() && !(error instanceof Error && error.name === 'AbortError')) {
        setStatus(`${item.title}: ${error instanceof Error ? error.message : 'source unavailable'}`);
      }
    } finally {
      request.finish();
    }
  }, []);

  /**
   * Flood overlay toggle — user-initiated only. On enable, runs the
   * illustrative screening scenario through the real diffusion-wave chain and
   * renders its depth grid via deck.gl. Off by default; disabling hides it.
   */
  const toggleFloodOverlay = useCallback(async (enable: boolean): Promise<void> => {
    const map = mapRef.current;
    if (!map) {
      setStatus('Flood overlay: map not ready yet.');
      return;
    }
    if (!enable) {
      floodOverlayRef.current?.setVisible(false);
      setFloodOverlayOn(false);
      return;
    }
    setFloodBusy(true);
    try {
      let overlay = floodOverlayRef.current;
      if (!overlay) {
        overlay = new FloodDeckOverlay(map);
        floodOverlayRef.current = overlay;
      }
      // Synchronous screening run on a small illustrative grid; fail-closed.
      const { result, bounds } = runIllustrativeScreeningScenario();
      overlay.setInundation({
        depthFt: result.inundation.depthFt,
        nx: result.inundation.depthFt[0]?.length ?? 0,
        ny: result.inundation.depthFt.length,
        bounds,
      });
      overlay.setVisible(true);
      setFloodOverlayOn(true);
      setStatus(
        `Flood overlay: screening run complete — max depth ${result.inundation.maxDepthFt.toFixed(2)} ft, ` +
          `${result.inundation.floodedCellCount} wet cells. ${FLOOD_OVERLAY_METADATA.disclaimer}`,
      );
    } catch (error) {
      setStatus(`Flood overlay unavailable: ${error instanceof Error ? error.message : 'screening run failed'}`);
      setFloodOverlayOn(false);
    } finally {
      setFloodBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle(),
      center: INITIAL_CENTER,
      zoom: 13,
      pitch: 58,
      bearing: -15,
      maxPitch: 85,
      minZoom: 9,
      maxZoom: 19,
      maxBounds: MAX_BOUNDS,
      cooperativeGestures: true,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('load', () => {
      mapRef.current = map;
      const lighting = getCinematicLighting(lightPresetRef.current);
      map.setLight(lighting.light);
      map.setSky(lighting.sky);
      const terrain = getTerrainRgbStatus();
      setTerrainEnabled(terrain.enabled);
      setStatus(terrain.enabled ? 'Terrain-RGB connected; source fabric online.' : 'Terrain-RGB fail-closed; configure VITE_TSM_TERRAIN_RGB_URL_TEMPLATE.');

      if (terrain.enabled && !map.getSource(TERRAIN_RGB_SOURCE_ID)) {
        map.addSource(TERRAIN_RGB_SOURCE_ID, {
          type: 'raster-dem',
          tiles: [terrain.template],
          tileSize: 256,
          encoding: 'mapbox',
          maxzoom: 14,
        });
        map.setTerrain({ source: TERRAIN_RGB_SOURCE_ID, exaggeration: 1 });
      }

      addRasterSource(map, 'fema-nfhl', getMapLibreFabricLayer('fema-effective').endpoint, [28, 16, 3, 1, 34, 23], false);
      addRasterSource(map, 'indiana-bafm', getMapLibreFabricLayer('indiana-bafm').endpoint, [104, 438], false);
      addRasterSource(map, 'usgs-3dep-index', getMapLibreFabricLayer('usgs-3dep-index').endpoint, undefined, false);
      addRasterSource(map, 'usgs-3dep-elevation', getMapLibreFabricLayer('usgs-3dep-elevation').endpoint, undefined, false);
      if (!map.getSource('osm-base')) {
        map.addSource('osm-base', { type: 'raster', tiles: [getMapLibreFabricLayer('osm-base').endpoint], tileSize: 256, attribution: getMapLibreFabricLayer('osm-base').attribution });
        map.addLayer({ id: 'osm-base-layer', type: 'raster', source: 'osm-base', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.65 } });
      }

      for (const item of MAP_PLANE_FABRIC) {
        if (item.kind === 'arcgis-feature') addFeatureSource(map, item);
        if (item.kind === 'geojson-local') addLocalGeoJsonSource(map, item);
        if (item.mapRenderable) setLayerVisibility(map, item, Boolean(visibleRef.current[item.id]));
      }

      const featureItems = MAP_PLANE_FABRIC.filter((item) => item.kind === 'arcgis-feature');
      const refresh = (): void => {
        for (const item of featureItems) {
          if (visibleRef.current[item.id]) void refreshFeatureLayer(map, item);
        }
      };
      map.on('moveend', refresh);
      refresh();

      map.on('error', (event) => {
        const message = event.error instanceof Error ? event.error.message : 'MapLibre source error';
        setStatus(message);
      });

      // Object picking (raycast selection): click buildings, roads, parcels, quads.
      map.on('click', (event) => {
        const pickable = [
          'indiana-buildings-extrusion',
          'indiana-roads-line',
          'indiana-parcels-fill',
          'usgs-quad-index-line',
          'posey-cslf-fill',
        ].filter((id) => map.getLayer(id));
        const features = map.queryRenderedFeatures(event.point, { layers: pickable });
        if (features.length === 0) {
          setPicked(null);
          return;
        }
        const feature = features[0];
        const layerId = feature.layer.id;
        const props = feature.properties ?? {};
        const summary = describePickedFeature(layerId, props);
        setPicked(summary);
      });
      map.on('mousemove', (event) => {
        const pickable = [
          'indiana-buildings-extrusion',
          'indiana-roads-line',
          'indiana-parcels-fill',
          'usgs-quad-index-line',
        ].filter((id) => map.getLayer(id));
        const features = map.queryRenderedFeatures(event.point, { layers: pickable });
        map.getCanvas().style.cursor = features.length > 0 ? 'pointer' : '';
      });
    });

    return () => {
      featureRequestsRef.current.cancelAll();
      floodOverlayRef.current?.dispose();
      floodOverlayRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // Initial visibility is intentionally captured only when the map is created.
    // Subsequent visibility changes are applied by the separate effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshFeatureLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const lighting = getCinematicLighting(lightPreset);
    map.setLight(lighting.light);
    map.setSky(lighting.sky);
  }, [lightPreset]);

  useEffect(() => {
    const previouslyVisible = previousVisibleRef.current;
    previousVisibleRef.current = visible;
    const map = mapRef.current;
    if (!map) return;
    for (const item of MAP_PLANE_FABRIC) {
      const enabled = Boolean(visible[item.id]);
      setLayerVisibility(map, item, enabled);
      if (item.kind === 'arcgis-feature') {
        if (enabled && !previouslyVisible[item.id]) void refreshFeatureLayer(map, item);
        else if (!enabled && previouslyVisible[item.id]) featureRequestsRef.current.cancel(item.id);
      }
    }
    const terrain = getTerrainRgbStatus();
    if (terrain.enabled && visible['terrain-rgb'] && !map.getTerrain()) {
      map.setTerrain({ source: TERRAIN_RGB_SOURCE_ID, exaggeration: 1 });
    } else if ((!terrain.enabled || !visible['terrain-rgb']) && map.getTerrain()) {
      map.setTerrain(null);
    }
    setTerrainEnabled(terrain.enabled);
  }, [refreshFeatureLayer, setLayerVisibility, visible]);

  const terrain = getTerrainRgbStatus();
  const mistVisible = Boolean(visible['cinematic-volumetric-mist']);

  return (
    <section aria-label="TSM MapLibre twelve-layer plane" style={{ position: 'relative', height: '100%', minHeight: 560, background: '#05080f', color: '#e2e8f0' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: mistVisible ? 0.18 : 0, transition: 'opacity 180ms ease', background: 'radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(148,163,184,.55) 100%)', mixBlendMode: 'screen' }} />
      {picked && (
        <div role="status" style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 15, maxWidth: 'min(92%, 560px)', padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(34,211,238,.4)', background: 'rgba(5,8,15,.92)', fontSize: 12, color: '#e2e8f0', backdropFilter: 'blur(8px)' }}>
          <span style={{ color: '#22d3ee', fontWeight: 700 }}>▸ </span>{picked}
          <button type="button" onClick={() => setPicked(null)} aria-label="Dismiss selection" style={{ marginLeft: 10, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>×</button>
        </div>
      )}
      {!props.hideSidebar && (
      <aside style={{ position: 'absolute', top: 12, left: 12, width: 360, maxHeight: 'calc(100% - 24px)', overflow: 'auto', padding: 14, border: '1px solid rgba(148,163,184,.25)', borderRadius: 12, background: 'rgba(5,8,15,.92)', backdropFilter: 'blur(8px)' }}>
        <strong style={{ letterSpacing: '.12em' }}>TSM // MAPLIBRE PLANE</strong>
        <div style={{ marginTop: 6, fontSize: 12, color: terrainEnabled ? '#86efac' : '#fbbf24' }}>
          {terrainEnabled ? '● TERRAIN-RGB ONLINE' : '● TERRAIN-RGB FAIL-CLOSED'}
        </div>
        <div role="status" aria-live="polite" style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>{status}</div>
        <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
          {MAP_PLANE_FABRIC.map((item) => {
            const checked = Boolean(visible[item.id]);
            const terrainItem = item.id === 'terrain-rgb';
            return (
              <label key={`${item.index}-${item.id}`} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8, alignItems: 'start', padding: 8, borderRadius: 8, background: checked ? 'rgba(56,189,248,.08)' : 'rgba(15,23,42,.45)' }}>
                <input
                  type="checkbox"
                  checked={terrainItem ? terrain.enabled && checked : checked}
                  disabled={terrainItem ? !terrain.enabled : !item.mapRenderable}
                  onChange={(event) => setVisible((current) => ({ ...current, [item.id]: event.target.checked }))}
                />
                <span>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>L{String(item.index).padStart(2, '0')} · {item.title}</span>
                  <span style={{ display: 'block', marginTop: 2, fontSize: 9, color: '#64748b' }}>{item.authority}</span>
                </span>
              </label>
            );
          })}
        </div>
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          <label style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8, alignItems: 'start', padding: 8, borderRadius: 8, background: floodOverlayOn ? 'rgba(56,189,248,.08)' : 'rgba(15,23,42,.45)', border: '1px dashed rgba(56,189,248,.35)' }}>
            <input
              type="checkbox"
              checked={floodOverlayOn}
              disabled={floodBusy}
              onChange={(event) => void toggleFloodOverlay(event.target.checked)}
            />
            <span>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>
                {floodBusy ? 'Running screening…' : FLOOD_OVERLAY_METADATA.title}
              </span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 9, color: '#64748b' }}>
                {FLOOD_OVERLAY_METADATA.authority}
              </span>
              <span style={{ display: 'block', marginTop: 4, fontSize: 9, lineHeight: 1.4, color: '#fbbf24' }}>
                {FLOOD_OVERLAY_METADATA.disclaimer}
              </span>
            </span>
          </label>
        </div>
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(148,163,184,.18)', fontSize: 9, lineHeight: 1.45, color: '#64748b' }}>
          MapLibre renders in EPSG:3857. Engineering source products may be transformed to EPSG:2966 only inside the evidence/scientific pipeline with recorded transformation metadata; the browser plane does not silently relabel Web Mercator coordinates as EPSG:2966. Vertical datum is likewise provenance metadata, not a MapLibre CRS switch.
        </div>
      </aside>
      )}
    </section>
  );
}
