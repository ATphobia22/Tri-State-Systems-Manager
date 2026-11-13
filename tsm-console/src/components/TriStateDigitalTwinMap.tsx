import { useCallback, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map, GeoJSONSource, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_PLANE_FABRIC, type MapPlaneLayer } from '../lib/map-plane-fabric';
import { buildArcGisExportTemplate, buildArcGisFeatureQueryUrl, getMapLibreFabricLayer } from '../lib/maplibre-layer-fabric';
import { getTerrainRgbStatus } from '../lib/twin-map-style';
import { BuildingInspectionPanel } from './BuildingInspectionPanel';
import { createPoseyScreeningExtrusionLayer } from '../lib/posey-screening-building-style';
import { TERRAIN_RGB_SOURCE_ID } from '../lib/terrain-rgb-contract';
import { FeatureLayerRequestCoordinator } from '../lib/feature-layer-request-coordinator';
import { getCinematicLighting, type CinematicLightPreset } from '../lib/cinematic/light-presets';
import {
  FLOOD_OVERLAY_METADATA,
  FloodDeckOverlay,
  runIllustrativeScreeningScenario,
} from '../lib/flood-deck-overlay';

const INITIAL_CENTER: [number, number] = [-88.005075, 37.845887];
// Covers the audited 23,082 Posey candidates (source bounds approximately
// -88.0913/37.7734 to -87.6883/38.2301), not only Mount Vernon.
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-88.13, 37.72],
  [-87.64, 38.28],
];
// A separate, explicit regional envelope is used only for the public Atlas.
// It covers the source-derived eHydro extents; the normal Posey map remains bounded.
const REGIONAL_MAX_BOUNDS: [[number, number], [number, number]] = [[-89.6, 36.9], [-86.8, 38.8]];

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
    // Keep footprints visible when height is missing; never invent a height.
    map.addLayer({
      id: `${item.id}-footprint`,
      type: 'fill',
      source: item.id,
      layout: { visibility: 'none' },
      paint: { 'fill-color': '#94a3b8', 'fill-opacity': 0.28, 'fill-outline-color': '#cbd5e1' },
    });
    // The live IGIO source is always 2D. Only a separately staged, SHA-pinned
    // local screening GeoJSON may supply *estimated* LoD1 massing. No arbitrary
    // remote URL, query string, parent traversal or network dependency.
    const screeningRelative = import.meta.env.VITE_TSM_POSEY_SCREENING_GEOJSON_PATH?.trim() || '';
    if (/^data\/screening\/[A-Za-z0-9_./-]+\.geojson$/.test(screeningRelative)
        && !screeningRelative.includes('..') && !screeningRelative.includes('//')) {
      const screenedSourceId = 'tsm-posey-screening-buildings';
      map.addSource(screenedSourceId, {
        type: 'geojson',
        data: `${import.meta.env.BASE_URL}${screeningRelative}`,
      });
      map.addLayer(createPoseyScreeningExtrusionLayer(screenedSourceId, `${item.id}-extrusion`));
    }
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
    const h = props.tsm_visual_height_m;
    const origin = str('tsm_height_evidence') ?? 'UNKNOWN';
    return typeof h === 'number' && Number.isFinite(h)
      ? `Estimated LoD1 building · ${h.toFixed(1)} m AGL · ${origin} · NOT SURVEYED`
      : 'Estimated building · vertical data unavailable · NOT SURVEYED';
  }
  if (layerId === 'indiana-buildings-footprint') {
    const county = str('county') ?? 'unknown county';
    const lidarYear = str('lidaryear') ?? 'unknown vintage';
    // A bare "height_m" attribute is not proof of LiDAR observation.
    // Only a separately source-pinned screening layer can display estimates.
    return `Building footprint · ${county} · source vintage ${lidarYear} · roof height not independently verified`;
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
  /** Forward actual MapLibre adapter state to an accessible external status panel. */
  onStatusChange?: (status: string) => void;
  /** Atlas-only regional map mode; uses OpenFreeMap vector basemap across state lines. */
  regionalAtlas?: boolean;
  /** Atlas-only camera preset; location is navigation, never survey evidence. */
  regionalView?: { id: string; center: [number, number]; zoom: number; pitch?: number; bearing?: number };
  /** Source-derived, locally committed point locations and eHydro survey rectangles. */
  regionalLayers?: { gauges: boolean; surveys: boolean };
  /** Indiana aerial imagery is only offered over its own coverage. */
  showIndianaImagery?: boolean;
  /** Human proposed, uncalibrated intervention geometry. Never used as a flood result. */
  proposalOverlay?: Parameters<GeoJSONSource['setData']>[0];
  /** Active drawing class. Map clicks are forwarded as WGS84 waypoints only. */
  proposalDrawMode?: 'berm' | 'road' | 'retention' | null;
  onProposalPoint?: (point: [number, number]) => void;
}

export function defaultMapPlaneVisibility(): Record<string, boolean> {
  return Object.fromEntries(MAP_PLANE_FABRIC.map((item) => [item.id, item.id === 'indiana-buildings' && Boolean(import.meta.env.VITE_TSM_POSEY_SCREENING_GEOJSON_PATH) ? true : item.defaultVisible]));
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
  useEffect(() => { props.onStatusChange?.(status); }, [status, props.onStatusChange]);
  const [picked, setPicked] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Record<string, unknown> | null>(null);
  const [floodOverlayOn, setFloodOverlayOn] = useState(false);
  const [floodBusy, setFloodBusy] = useState(false);
  const floodOverlayRef = useRef<FloodDeckOverlay | null>(null);
  const featureRequestsRef = useRef(new FeatureLayerRequestCoordinator());
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const previousVisibleRef = useRef(visible);
  const regionalLayersRef = useRef(props.regionalLayers);
  regionalLayersRef.current = props.regionalLayers;
  const showIndianaImageryRef = useRef(props.showIndianaImagery);
  showIndianaImageryRef.current = props.showIndianaImagery;
  const proposalModeRef = useRef(props.proposalDrawMode);
  proposalModeRef.current = props.proposalDrawMode;
  const proposalCallbackRef = useRef(props.onProposalPoint);
  proposalCallbackRef.current = props.onProposalPoint;
  const proposalOverlayRef = useRef(props.proposalOverlay);
  proposalOverlayRef.current = props.proposalOverlay;

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
      `${item.id}-footprint`,
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
      // Synchronous screening run on a small illustrative grid; resilient.
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
      style: props.regionalAtlas ? 'https://tiles.openfreemap.org/styles/liberty' : baseStyle(),
      center: props.regionalView?.center ?? INITIAL_CENTER,
      zoom: props.regionalView?.zoom ?? 13,
      pitch: props.regionalView?.pitch ?? 58,
      bearing: props.regionalView?.bearing ?? -15,
      maxPitch: 85,
      minZoom: props.regionalAtlas ? 6 : 9,
      maxZoom: 19,
      maxBounds: props.regionalAtlas ? REGIONAL_MAX_BOUNDS : MAX_BOUNDS,
      cooperativeGestures: true,
      fadeDuration: 300,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('load', () => {
      mapRef.current = map;
      const lighting = getCinematicLighting(lightPresetRef.current);
      map.setLight(lighting.light);
      map.setSky(lighting.sky);
      if (props.regionalAtlas) {
        // OpenFreeMap vector style is the cross-state basemap. Preserve native
        // Indiana imagery as an optional overlaid raster, never an IL/KY source.
        const imagery = getMapLibreFabricLayer('indiana-imagery').endpoint;
        map.addSource('indiana-imagery', {
          type: 'raster',
          tiles: [buildArcGisExportTemplate(imagery, [], { format: 'jpg', transparent: false, compressionQuality: 90 })],
          tileSize: 512,
          attribution: 'Indiana Geographic Information Office',
        });
        map.addLayer({
          id: 'indiana-imagery-layer',
          type: 'raster',
          source: 'indiana-imagery',
          layout: { visibility: showIndianaImageryRef.current ? 'visible' : 'none' },
        });
        // These GeoJSON sources are committed and WGS84-checked. Neither
        // source supplies a live river level, bathymetric depth raster, or BFE.
        const base = import.meta.env.BASE_URL;
        map.addSource('atlas-usgs-gauges', { type: 'geojson', data: `${base}data/tsm-river-gauge-locations.geojson` });
        map.addLayer({
          id: 'atlas-usgs-gauge-points', type: 'circle', source: 'atlas-usgs-gauges',
          layout: { visibility: regionalLayersRef.current?.gauges ? 'visible' : 'none' },
          paint: { 'circle-color': '#5de8da', 'circle-radius': 7,
            'circle-stroke-color': '#061823', 'circle-stroke-width': 2 },
        });
        map.addSource('atlas-proposals', {
          type: 'geojson',
          data: proposalOverlayRef.current ?? { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'atlas-proposals-fill', type: 'fill', source: 'atlas-proposals',
          paint: { 'fill-color': '#fb923c', 'fill-opacity': 0.17 },
        });
        map.addLayer({
          id: 'atlas-proposals-line', type: 'line', source: 'atlas-proposals',
          paint: { 'line-color': '#fb923c', 'line-width': 4, 'line-dasharray': [2, 1] },
        });
        map.addLayer({
          id: 'atlas-proposals-waypoints', type: 'circle', source: 'atlas-proposals',
          paint: { 'circle-radius': 6, 'circle-color': '#fff7ed', 'circle-stroke-color': '#fb923c', 'circle-stroke-width': 2 },
        });
        map.addSource('atlas-usace-ehydro', { type: 'geojson', data: `${base}data/ehydro-survey-extents.geojson` });
        map.addLayer({
          id: 'atlas-usace-ehydro-fill', type: 'fill', source: 'atlas-usace-ehydro',
          layout: { visibility: regionalLayersRef.current?.surveys ? 'visible' : 'none' },
          paint: { 'fill-color': '#ffca85', 'fill-opacity': 0.09 },
        });
        map.addLayer({
          id: 'atlas-usace-ehydro-outline', type: 'line', source: 'atlas-usace-ehydro',
          layout: { visibility: regionalLayersRef.current?.surveys ? 'visible' : 'none' },
          paint: { 'line-color': '#ffca85', 'line-width': 2, 'line-dasharray': [4, 2] },
        });
      }
      const terrain = getTerrainRgbStatus();
      setTerrainEnabled(terrain.enabled);
      setStatus(terrain.enabled ? 'Terrain-RGB connected; source fabric online.' : 'Terrain-RGB unavailable; continuing with the base map and available layers. Configure VITE_TSM_TERRAIN_RGB_URL_TEMPLATE to enable terrain.');

      if (terrain.enabled && !map.getSource(TERRAIN_RGB_SOURCE_ID)) {
        map.addSource(TERRAIN_RGB_SOURCE_ID, {
          type: 'raster-dem',
          tiles: [terrain.template],
          tileSize: 256,
          encoding: 'mapbox',
          maxzoom: 14,
        });
        map.setTerrain({ source: TERRAIN_RGB_SOURCE_ID, exaggeration: 1 });
        // Hillshade layer for 3D terrain visualization (per maplibre-agent-skills guide)
        if (!map.getLayer('terrain-hillshade')) {
          map.addLayer({
            id: 'terrain-hillshade',
            type: 'hillshade',
            source: TERRAIN_RGB_SOURCE_ID,
            paint: {
              'hillshade-exaggeration': 0.5,
              'hillshade-shadow-color': '#473B2B',
            },
          });
        }
      }

      addRasterSource(map, 'fema-nfhl', getMapLibreFabricLayer('fema-effective').endpoint, [28, 16, 3, 1, 34, 23], false);
      addRasterSource(map, 'indiana-bafm', getMapLibreFabricLayer('indiana-bafm').endpoint, [104, 438], false);
      addRasterSource(map, 'usgs-3dep-index', getMapLibreFabricLayer('usgs-3dep-index').endpoint, undefined, false);
      addRasterSource(map, 'usgs-3dep-elevation', getMapLibreFabricLayer('usgs-3dep-elevation').endpoint, undefined, false);
      // osm-base is a vector *style* (https://tiles.openfreemap.org/styles/liberty),
      // not raster tiles — it cannot work as a raster source. The catalog types it
      // correctly as 'vector-style'. Apply via map.setStyle() when switching
      // basemaps; do not add a broken raster source here.

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
        setStatus(`Layer warning: ${message}. The map remains available; affected data may be unavailable.`);
      });

      // Drafting receives click coordinates only when the user selected a
      // proposal mode. It has NO hydraulic/agency effect.
      // Object picking (raycast selection) continues when drafting is off.
      map.on('click', (event) => {
        if (props.regionalAtlas && proposalModeRef.current) {
          proposalCallbackRef.current?.([event.lngLat.lng, event.lngLat.lat]);
          return;
        }
        const pickable = [
          'indiana-buildings-extrusion',
          'indiana-buildings-footprint',
          'indiana-roads-line',
          'indiana-parcels-fill',
          'usgs-quad-index-line',
          'posey-cslf-fill',
          'atlas-usgs-gauge-points',
          'atlas-usace-ehydro-outline',
        ].filter((id) => map.getLayer(id));
        const features = map.queryRenderedFeatures(event.point, { layers: pickable });
        if (features.length === 0) {
          setPicked(null);
          setSelectedBuilding(null);
          return;
        }
        const feature = features[0];
        const layerId = feature.layer.id;
        const props = feature.properties ?? {};
        if (layerId === 'atlas-usgs-gauge-points') {
          const name = String(props.name ?? props.stationId ?? 'USGS station');
          setSelectedBuilding(null);
          setPicked(`${name} · station location only; fetch observations separately`);
        } else if (layerId === 'atlas-usace-ehydro-outline') {
          setSelectedBuilding(null);
          setPicked(`USACE eHydro survey extent · ${String(props.surveyDate ?? 'undated')} · Ohio River Datum; no NAVD88 offset asserted`);
        } else if (layerId === 'indiana-buildings-extrusion' || layerId === 'indiana-buildings-footprint') {
          setSelectedBuilding(props);
          setPicked(null);
        } else {
          setSelectedBuilding(null);
          setPicked(describePickedFeature(layerId, props));
        }
      });
      map.on('mousemove', (event) => {
        const pickable = [
          'indiana-buildings-extrusion',
          'indiana-buildings-footprint',
          'indiana-roads-line',
          'indiana-parcels-fill',
          'usgs-quad-index-line',
          'atlas-usgs-gauge-points',
          'atlas-usace-ehydro-outline',
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

  useEffect(() => {
    if (!props.regionalAtlas || !props.regionalView) return;
    const map = mapRef.current;
    if (!map) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.easeTo({
      center: props.regionalView.center,
      zoom: props.regionalView.zoom,
      pitch: props.regionalView.pitch ?? 58,
      bearing: props.regionalView.bearing ?? -15,
      duration: reduced ? 0 : 1400,
    });
  }, [props.regionalAtlas, props.regionalView]);

  useEffect(() => {
    if (!props.regionalAtlas) return;
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const layer = 'indiana-imagery-layer';
    if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', props.showIndianaImagery ? 'visible' : 'none');
  }, [props.regionalAtlas, props.showIndianaImagery]);

  useEffect(() => {
    if (!props.regionalAtlas) return;
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    for (const [key, ids] of [
      ['gauges', ['atlas-usgs-gauge-points']],
      ['surveys', ['atlas-usace-ehydro-fill', 'atlas-usace-ehydro-outline']],
    ] as const) {
      for (const id of ids) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', props.regionalLayers?.[key] ? 'visible' : 'none');
      }
    }
  }, [props.regionalAtlas, props.regionalLayers]);

  useEffect(() => {
    if (!props.regionalAtlas) return;
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource('atlas-proposals') as GeoJSONSource | undefined;
    if (source) source.setData(props.proposalOverlay ?? { type: 'FeatureCollection', features: [] });
  }, [props.regionalAtlas, props.proposalOverlay]);

  useEffect(() => {
    if (!props.regionalAtlas) return;
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = props.proposalDrawMode ? 'crosshair' : '';
  }, [props.regionalAtlas, props.proposalDrawMode]);

  const terrain = getTerrainRgbStatus();
  const mistVisible = Boolean(visible['cinematic-volumetric-mist']);

  return (
    <section aria-label="TSM MapLibre twelve-layer plane" style={{ position: 'relative', height: '100%', minHeight: 560, background: '#05080f', color: '#e2e8f0' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: mistVisible ? 0.18 : 0, transition: 'opacity 180ms ease', background: 'radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(148,163,184,.55) 100%)', mixBlendMode: 'screen' }} />
      {selectedBuilding && (
        <BuildingInspectionPanel properties={selectedBuilding} onClose={() => setSelectedBuilding(null)} />
      )}
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
          {terrainEnabled ? '● TERRAIN-RGB ONLINE' : '● TERRAIN-RGB RESILIENT'}
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
        {import.meta.env.VITE_TSM_POSEY_SCREENING_GEOJSON_PATH && (
          <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 8 }}>
            Building prisms are LoD1 *estimates* only — not LiDAR-measured roof models or NAVD88 design elevations.
          </div>
        )}
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
