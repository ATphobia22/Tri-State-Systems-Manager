import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl, { type Map, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_PLANE_FABRIC, type MapPlaneLayer } from '../lib/map-plane-fabric';
import { buildArcGisFeatureQueryUrl, getMapLibreFabricLayer } from '../lib/maplibre-layer-fabric';
import { getTerrainRgbStatus, TERRAIN_RGB_SOURCE_ID } from '../lib/twin-map-style';

const INITIAL_CENTER: [number, number] = [-88.0167, 37.8331];
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-88.08, 37.75],
  [-87.92, 37.90],
];

const ARCGIS_EXPORT = (service: string, layers?: string): string => {
  const query = [
    'bbox={bbox-epsg-3857}',
    'bboxSR=3857',
    'imageSR=3857',
    'size=512,512',
    'format=png32',
    'transparent=true',
    layers ? `layers=show:${layers}` : '',
    'f=image',
  ].filter(Boolean).join('&');
  return `${service.replace(/\/$/, '')}/export?${query}`;
};

const layerColor = (id: string): string => {
  if (id === 'indiana-parcels') return '#38bdf8';
  if (id === 'indiana-roads') return '#fbbf24';
  if (id === 'building-extrusions') return '#a78bfa';
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
        tiles: [ARCGIS_EXPORT(imagery)],
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

async function fetchGeoJson(source: string, map: Map): Promise<GeoJSON.GeoJSON> {
  const bounds = map.getBounds();
  const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
  const url = buildArcGisFeatureQueryUrl(source).replace('{bbox-epsg-4326}', encodeURIComponent(bbox));
  const response = await fetch(url, {
    headers: { Accept: 'application/geo+json,application/json' },
  });
  if (!response.ok) throw new Error(`ArcGIS FeatureServer request failed: HTTP ${response.status}`);
  const payload = await response.json() as GeoJSON.GeoJSON;
  if (payload.type !== 'FeatureCollection') throw new Error('ArcGIS source did not return a GeoJSON FeatureCollection');
  return payload;
}

function addRasterSource(map: Map, id: string, service: string, layers: string | undefined, visible: boolean): void {
  if (map.getSource(id)) return;
  map.addSource(id, {
    type: 'raster',
    tiles: [ARCGIS_EXPORT(service, layers)],
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
  if (item.id === 'building-extrusions') {
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

export default function TriStateDigitalTwinMap(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>(
    Object.fromEntries(MAP_PLANE_FABRIC.map((item) => [item.id, item.defaultVisible])),
  );
  const [terrainEnabled, setTerrainEnabled] = useState(false);
  const [status, setStatus] = useState('Initializing MapLibre plane…');
  const requestGeneration = useRef(0);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const setLayerVisibility = useCallback((map: Map, item: MapPlaneLayer, enabled: boolean): void => {
    const layerIds = [
      `${item.id}-layer`,
      `${item.id}-fill`,
      `${item.id}-line`,
      `${item.id}-extrusion`,
    ];
    for (const layerId of layerIds) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', enabled ? 'visible' : 'none');
    }
  }, []);

  const refreshFeatureLayer = useCallback(async (map: Map, item: MapPlaneLayer): Promise<void> => {
    const source = map.getSource(item.id) as GeoJSONSource | undefined;
    if (!source) return;
    const generation = ++requestGeneration.current;
    try {
      const geojson = await fetchGeoJson(item.endpoint, map);
      if (generation === requestGeneration.current) source.setData(geojson);
    } catch (error) {
      if (generation === requestGeneration.current) {
        setStatus(`${item.title}: ${error instanceof Error ? error.message : 'source unavailable'}`);
      }
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

      addRasterSource(map, 'fema-nfhl', getMapLibreFabricLayer('fema-effective').endpoint, '28,16,3,1,34,23', false);
      addRasterSource(map, 'indiana-bafm', getMapLibreFabricLayer('indiana-bafm').endpoint, '104,438', false);
      addRasterSource(map, 'usgs-3dep-index', getMapLibreFabricLayer('usgs-3dep-index').endpoint, undefined, false);
      addRasterSource(map, 'usgs-3dep-elevation', getMapLibreFabricLayer('usgs-3dep-elevation').endpoint, undefined, false);
      if (!map.getSource('osm-base')) {
        map.addSource('osm-base', { type: 'raster', tiles: [getMapLibreFabricLayer('osm-base').endpoint], tileSize: 256, attribution: getMapLibreFabricLayer('osm-base').attribution });
        map.addLayer({ id: 'osm-base-layer', type: 'raster', source: 'osm-base', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.65 } });
      }

      for (const item of MAP_PLANE_FABRIC) {
        if (item.kind === 'arcgis-feature') addFeatureSource(map, item);
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
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Initial visibility is intentionally captured only when the map is created.
    // Subsequent visibility changes are applied by the separate effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshFeatureLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const item of MAP_PLANE_FABRIC) {
      setLayerVisibility(map, item, Boolean(visible[item.id]));
    }
    const terrain = getTerrainRgbStatus();
    if (terrain.enabled && visible['terrain-rgb'] && !map.getTerrain()) {
      map.setTerrain({ source: TERRAIN_RGB_SOURCE_ID, exaggeration: 1 });
    } else if ((!terrain.enabled || !visible['terrain-rgb']) && map.getTerrain()) {
      map.setTerrain(null);
    }
    setTerrainEnabled(terrain.enabled);
  }, [setLayerVisibility, visible]);

  const terrain = getTerrainRgbStatus();
  const mistVisible = Boolean(visible['cinematic-volumetric-mist']);

  return (
    <section aria-label="TSM MapLibre twelve-layer plane" style={{ position: 'relative', height: '100%', minHeight: 560, background: '#05080f', color: '#e2e8f0' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: mistVisible ? 0.18 : 0, transition: 'opacity 180ms ease', background: 'radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(148,163,184,.55) 100%)', mixBlendMode: 'screen' }} />
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
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(148,163,184,.18)', fontSize: 9, lineHeight: 1.45, color: '#64748b' }}>
          MapLibre renders in EPSG:3857. Engineering source products may be transformed to EPSG:2966 only inside the evidence/scientific pipeline with recorded transformation metadata; the browser plane does not silently relabel Web Mercator coordinates as EPSG:2966. Vertical datum is likewise provenance metadata, not a MapLibre CRS switch.
        </div>
      </aside>
    </section>
  );
}
