import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import ThreeDTilesLayer from './src/components/ThreeDTilesLayer';

type HazardState = 'SFHA_HIGH_RISK' | 'SFHA_COMPLIANT' | 'REVIEW_REQUIRED';

interface ParcelProperties {
  apn?: string;
  wthPin?: string;
  owner?: string;
  legalDescription?: string;
  acreage?: number;
  township?: string;
  section?: string;
  range?: string;
  lagFtNavd88?: number;
  bfeFtNavd88?: number;
  floodway?: boolean;
  floodwayName?: string;
  floodwayElevationFtNavd88?: number;
  elevationEvidenceStatus?: 'CERTIFIED' | 'OBSERVED' | 'USER_SUPPLIED' | 'UNVERIFIED';
  visualExtrusionFt?: number;
  sourceObjectId?: number;
}

type Position = [number, number] | [number, number, number];
type PolygonCoordinates = Position[][];
type MultiPolygonCoordinates = Position[][][];
type ParcelGeometry =
  | { type: 'Polygon'; coordinates: PolygonCoordinates }
  | { type: 'MultiPolygon'; coordinates: MultiPolygonCoordinates };
type ParcelFeature = {
  type: 'Feature';
  geometry: ParcelGeometry;
  properties: ParcelProperties;
};
type ParcelFeatureCollection = {
  type: 'FeatureCollection';
  features: ParcelFeature[];
  sourceCrs?: string;
  sourceAuthority?: string;
};

type WaterSurfaceGeometry = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: ParcelGeometry;
    properties: Record<string, unknown> | null;
  }>;
};

type MapLibreHazardColor = NonNullable<
  Extract<maplibregl.LayerSpecification, { type: 'fill-extrusion' }>['paint']
>['fill-extrusion-color'];

interface OpenMIWaterSurfaceMessage {
  waterSurfaceElevationFtNavd88: number;
  timestamp: string;
  sourceProvenanceHash: string;
  validationStatus: 'VALIDATED' | 'VALIDATED_PROVISIONAL' | 'REVIEW_REQUIRED' | 'REJECTED';
}

/** Site anchor (13101 Bonebank Road) — the twin opens on the project site, not the township centroid. */
const ANCHOR_CENTER: [number, number] = [-88.005075, 37.845887];
const ENGINEERING_CRS = 'EPSG:2966';
const DISPLAY_CRS = 'EPSG:4326 → WebMercator';
const DEFAULT_BFE_FT_NAVD88 = 375;
const DEFAULT_3D_TILES_URL = `${import.meta.env.BASE_URL}3d-tiles/terrain-3dep/tileset.json`;
const API_BASE_URL = (import.meta.env.VITE_TSM_API_BASE_URL?.trim() || '').replace(/\/$/, '');
const DEFAULT_POSEY_GEOMETRY_URL = API_BASE_URL
  ? `${API_BASE_URL}/api/geospatial/posey/parcels`
  : `${import.meta.env.BASE_URL}data/posey-parcels.geojson`;
const DEFAULT_OPENMI_WSE_URL = `${API_BASE_URL}/api/hydrologic/posey/openmi-wse`;
const THREE_D_TILES_URL = import.meta.env.VITE_TSM_3D_TILES_URL?.trim() || DEFAULT_3D_TILES_URL;
const POSEY_WTHGIS_URL = 'https://poseyin.wthgis.com/';
const POSEY_COUNTYGISMAPS_URL = 'https://countygismaps.com/map/in/posey';
const FEMA_NFHL_URL = 'https://msc.fema.gov/nfhl';
const POSEY_EQUATOR_URL = 'https://gis.equatorstudios.com/indiana_posey/';
const POSEY_LANDRECORDS_URL = 'https://landrecords.us/documentation/coverage/counties/18-129-posey';
const INDIANA_ELEVATION_CATALOG_URL = 'https://elevation.gio.in.gov/';
const INDIANA_ELEVATION_S3_URL = 'https://giselevationingov.s3.amazonaws.com/index.html';
const INDIANA_LIDAR_VIEWER_URL = 'https://indianamap-inmap.hub.arcgis.com/maps/ff98e3834d464619bd5c8974b0038a13/about';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function classifyParcel(parcel: ParcelProperties, defaultBfe: number): HazardState {
  const bfe = parcel.bfeFtNavd88 ?? defaultBfe;
  if (parcel.floodway === true) return 'SFHA_HIGH_RISK';
  if (isFiniteNumber(parcel.lagFtNavd88) && parcel.lagFtNavd88 < bfe) return 'SFHA_HIGH_RISK';
  if (
    parcel.elevationEvidenceStatus === 'CERTIFIED' &&
    isFiniteNumber(parcel.lagFtNavd88) &&
    parcel.lagFtNavd88 >= bfe
  ) {
    return 'SFHA_COMPLIANT';
  }
  return 'REVIEW_REQUIRED';
}

function hazardColorExpression(_defaultBfe: number): MapLibreHazardColor {
  return [
    'match',
    ['to-string', ['get', 'hazardState']],
    'SFHA_HIGH_RISK',
    '#ef4444',
    'SFHA_COMPLIANT',
    '#22c55e',
    '#f59e0b',
  ] as MapLibreHazardColor;
}

function normalizeCollection(value: unknown): ParcelFeatureCollection {
  if (!value || typeof value !== 'object') throw new Error('WTH GIS geometry response is not an object.');
  const candidate = value as Partial<ParcelFeatureCollection>;
  if (candidate.type !== 'FeatureCollection' || !Array.isArray(candidate.features)) {
    throw new Error('Expected a GeoJSON FeatureCollection.');
  }

  const features = candidate.features.filter((feature): feature is ParcelFeature => {
    if (!feature || feature.type !== 'Feature' || !feature.geometry || !feature.properties) return false;
    return feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon';
  });

  return {
    type: 'FeatureCollection',
    features,
    sourceCrs: typeof candidate.sourceCrs === 'string' ? candidate.sourceCrs : 'EPSG:4326',
    sourceAuthority:
      typeof candidate.sourceAuthority === 'string'
        ? candidate.sourceAuthority
        : 'Posey County WTHGIS',
  };
}

function decorateHazardState(collection: ParcelFeatureCollection, defaultBfe: number): ParcelFeatureCollection {
  return {
    ...collection,
    features: collection.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        hazardState: classifyParcel(feature.properties, defaultBfe),
      },
    })),
  };
}

function buildStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#07111f' },
      },
    ],
  };
}

export default function DigitalTwinAppV2(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [parcels, setParcels] = useState<ParcelFeatureCollection | null>(null);
  const [selected, setSelected] = useState<ParcelFeature | null>(null);
  const [parcelVisible, setParcelVisible] = useState(true);
  const [telemetryVisible, setTelemetryVisible] = useState(true);
  const [humanGateEnabled] = useState(true);
  const [tiles3DVisible, setTiles3DVisible] = useState(true);
  const [tiles3DStatus, setTiles3DStatus] = useState<'loading' | 'ready' | 'error' | 'disabled'>('loading');
  const [mapReady, setMapReady] = useState(false);
  const [waterSurfaceFt, setWaterSurfaceFt] = useState<number | null>(null);
  const [openMiStatus, setOpenMiStatus] = useState<'DISCONNECTED' | 'LIVE' | 'REJECTED'>('DISCONNECTED');
  const [openMiRefreshing, setOpenMiRefreshing] = useState(false);
  const [geometryStatus, setGeometryStatus] = useState<'NOT_CONFIGURED' | 'LOADING' | 'LIVE' | 'ERROR'>('NOT_CONFIGURED');
  const [error, setError] = useState<string | null>(null);

  const defaultBfe = useMemo(() => {
    const configured = Number(import.meta.env.VITE_TSM_POINT_TOWNSHIP_BFE_FT_NAVD88);
    return isFiniteNumber(configured) ? configured : DEFAULT_BFE_FT_NAVD88;
  }, []);

  const applyParcelLayer = useCallback((map: maplibregl.Map, collection: ParcelFeatureCollection): void => {
    const sourceId = 'posey-wthgis-parcels';
    const fillId = 'posey-wthgis-parcels-3d';
    const lineId = 'posey-wthgis-parcels-outline';

    if (map.getLayer(fillId)) map.removeLayer(fillId);
    if (map.getLayer(lineId)) map.removeLayer(lineId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    map.addSource(sourceId, { type: 'geojson', data: collection });

    map.addLayer({
      id: fillId,
      type: 'fill-extrusion',
      source: sourceId,
      layout: { visibility: parcelVisible ? 'visible' : 'none' },
      paint: {
        'fill-extrusion-color': hazardColorExpression(defaultBfe),
        'fill-extrusion-opacity': 0.68,
        'fill-extrusion-height': [
          '*',
          ['coalesce', ['get', 'visualExtrusionFt'], 6],
          0.3048006096,
        ],
        'fill-extrusion-base': 0,
      },
    });

    map.addLayer({
      id: lineId,
      type: 'line',
      source: sourceId,
      layout: { visibility: parcelVisible ? 'visible' : 'none' },
      paint: {
        'line-color': '#e2e8f0',
        'line-opacity': 0.55,
        'line-width': 1,
      },
    });
  }, [defaultBfe, parcelVisible]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(),
      center: ANCHOR_CENTER,
      zoom: 13.5,
      pitch: 62,
      bearing: -18,
      maxPitch: 85,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      mapRef.current = map;
      setMapReady(true);

      map.on('mousemove', (event) => {
        if (!map.getLayer('posey-wthgis-parcels-3d')) {
          map.getCanvas().style.cursor = '';
          return;
        }
        const features = map.queryRenderedFeatures(event.point, { layers: ['posey-wthgis-parcels-3d'] });
        map.getCanvas().style.cursor = features.length ? 'pointer' : '';
      });

      map.on('click', (event) => {
        if (!map.getLayer('posey-wthgis-parcels-3d')) return;
        const feature = map.queryRenderedFeatures(event.point, { layers: ['posey-wthgis-parcels-3d'] })[0];
        if (!feature) return;
        const properties = feature.properties ?? {};
        const parsed: ParcelProperties = {
          apn: typeof properties.apn === 'string' ? properties.apn : undefined,
          wthPin: typeof properties.wthPin === 'string' ? properties.wthPin : undefined,
          owner: typeof properties.owner === 'string' ? properties.owner : undefined,
          legalDescription:
            typeof properties.legalDescription === 'string' ? properties.legalDescription : undefined,
          acreage: Number(properties.acreage),
          township: typeof properties.township === 'string' ? properties.township : undefined,
          section: typeof properties.section === 'string' ? properties.section : undefined,
          range: typeof properties.range === 'string' ? properties.range : undefined,
          lagFtNavd88: Number(properties.lagFtNavd88),
          bfeFtNavd88: Number(properties.bfeFtNavd88),
          floodway: properties.floodway === true || properties.floodway === 'true',
          floodwayName: typeof properties.floodwayName === 'string' ? properties.floodwayName : undefined,
          floodwayElevationFtNavd88: Number(properties.floodwayElevationFtNavd88),
          elevationEvidenceStatus:
            properties.elevationEvidenceStatus === 'CERTIFIED'
              ? 'CERTIFIED'
              : properties.elevationEvidenceStatus === 'OBSERVED'
                ? 'OBSERVED'
                : properties.elevationEvidenceStatus === 'USER_SUPPLIED'
                  ? 'USER_SUPPLIED'
                  : 'UNVERIFIED',
          visualExtrusionFt: Number(properties.visualExtrusionFt),
          sourceObjectId: Number(properties.sourceObjectId),
        };
        const geometry = feature.geometry as ParcelFeature['geometry'];
        setSelected({
          type: 'Feature',
          geometry: geometry as ParcelFeature['geometry'],
          properties: {
            ...parsed,
          },
        });
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const url = import.meta.env.VITE_POSEY_WTHGIS_GEOJSON_URL?.trim() || DEFAULT_POSEY_GEOMETRY_URL;
    if (!url) {
      setGeometryStatus('NOT_CONFIGURED');
      return;
    }

    let cancelled = false;
    setGeometryStatus('LOADING');
    setError(null);

    fetch(url, { headers: { Accept: 'application/geo+json, application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`WTH GIS geometry request failed: HTTP ${response.status}`);
        return normalizeCollection(await response.json());
      })
      .then((collection) => {
        if (cancelled) return;
        const sourceCrs = collection.sourceCrs ?? 'EPSG:4326';
        if (sourceCrs !== 'EPSG:4326' && sourceCrs !== 'CRS84') {
          throw new Error(
            `Unsupported display CRS ${sourceCrs}. Reproject WTH GIS geometry to EPSG:4326 before browser ingestion; engineering CRS remains ${ENGINEERING_CRS}.`,
          );
        }
        const decorated = decorateHazardState(collection, defaultBfe);
        setParcels(decorated);
        applyParcelLayer(map, decorated);
        setGeometryStatus('LIVE');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setGeometryStatus('ERROR');
        setError(reason instanceof Error ? reason.message : 'Unknown WTH GIS geometry error.');
      });

    return () => {
      cancelled = true;
    };
  }, [applyParcelLayer, defaultBfe]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !parcels) return;
    applyParcelLayer(map, parcels);
  }, [applyParcelLayer, parcels, parcelVisible]);

  const refreshOpenMiWse = useCallback(async (): Promise<void> => {
    const url = import.meta.env.VITE_TSM_OPENMI_WSE_URL?.trim() || DEFAULT_OPENMI_WSE_URL;
    if (!url) {
      setOpenMiStatus('DISCONNECTED');
      return;
    }
    setOpenMiRefreshing(true);
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`WSE adapter returned HTTP ${response.status}`);
      const message = (await response.json()) as OpenMIWaterSurfaceMessage;
      if (
        !isFiniteNumber(message.waterSurfaceElevationFtNavd88) ||
        !message.timestamp ||
        !/^[a-f0-9]{64}$/.test(message.sourceProvenanceHash) ||
        !['VALIDATED', 'VALIDATED_PROVISIONAL'].includes(message.validationStatus)
      ) {
        setOpenMiStatus('REJECTED');
        return;
      }
      setWaterSurfaceFt(message.waterSurfaceElevationFtNavd88);
      setOpenMiStatus('LIVE');
    } catch {
      setOpenMiStatus('DISCONNECTED');
    } finally {
      setOpenMiRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sourceId = 'tsm-openmi-water-surface';
    const layerId = 'tsm-openmi-water-surface';
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    if (!telemetryVisible || waterSurfaceFt == null) return;

    // The water surface layer intentionally requires a configured polygon geometry.
    // Never manufacture a community-wide water polygon from a single WSE value.
    const waterGeoJsonUrl = import.meta.env.VITE_TSM_OPENMI_WATER_GEOJSON_URL?.trim();
    if (!waterGeoJsonUrl) return;

    fetch(waterGeoJsonUrl, { headers: { Accept: 'application/geo+json, application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error(`Water-surface geometry returned HTTP ${response.status}`);
        return response.json();
      })
      .then((geometry: WaterSurfaceGeometry) => {
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, { type: 'geojson', data: geometry });
        }
        if (!map.getLayer(layerId)) {
          map.addLayer({
            id: layerId,
            type: 'fill-extrusion',
            source: sourceId,
            paint: {
              'fill-extrusion-color': '#38bdf8',
              'fill-extrusion-opacity': 0.34,
              'fill-extrusion-height': waterSurfaceFt * 0.3048006096,
              'fill-extrusion-base': 0,
            },
          });
        }
      })
      .catch(() => {
        // Water geometry remains absent on any validation/network failure.
      });
  }, [telemetryVisible, waterSurfaceFt]);

  const selectedState = selected ? classifyParcel(selected.properties, defaultBfe) : null;
  const selectedBfe = selected?.properties.bfeFtNavd88 ?? defaultBfe;
  const selectedLag = selected?.properties.lagFtNavd88;
  const freeboard =
    isFiniteNumber(selectedLag) && isFiniteNumber(selectedBfe) ? selectedLag - selectedBfe : null;

  return (
    <section style={{ position: 'relative', minHeight: 720, height: '100%', background: '#020617', color: '#e2e8f0' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      <aside
        aria-label="Posey County cadastral parcel inspector"
        style={{
          position: 'absolute',
          right: 12,
          top: 12,
          zIndex: 5,
          width: 360,
          maxHeight: 'calc(100% - 24px)',
          overflow: 'auto',
          padding: 16,
          border: '1px solid rgba(148,163,184,0.25)',
          borderRadius: 12,
          background: 'rgba(2,6,23,0.94)',
          backdropFilter: 'blur(10px)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: 1.2, color: '#38bdf8' }}>TSM DIGITAL TWIN V2</div>
        <h1 style={{ margin: '5px 0 12px', fontSize: 21 }}>Posey County Parcel Console</h1>

        <div style={{ display: 'grid', gap: 6, fontSize: 12, color: '#94a3b8' }}>
          <div><strong style={{ color: '#e2e8f0' }}>Engineering CRS:</strong> {ENGINEERING_CRS}</div>
          <div><strong style={{ color: '#e2e8f0' }}>Map display:</strong> {DISPLAY_CRS}</div>
          <div><strong style={{ color: '#e2e8f0' }}>Point Township target BFE:</strong> {defaultBfe.toFixed(1)} ft NAVD88</div>
          <div><strong style={{ color: '#e2e8f0' }}>WTH GIS record:</strong> REFERENCE · record cross-reference</div>
          <div><strong style={{ color: '#e2e8f0' }}>Parcel vector geometry:</strong> {geometryStatus} · XSoft Engage ArcGIS</div>
          <div><strong style={{ color: '#e2e8f0' }}>OpenMI-compatible WSE adapter:</strong> {openMiStatus}{waterSurfaceFt != null ? ` · ${waterSurfaceFt.toFixed(2)} ft NAVD88` : ''}</div>
        </div>

        <div style={{ display: 'grid', gap: 7, margin: '14px 0' }}>
          <label><input type="checkbox" checked={parcelVisible} onChange={(event) => setParcelVisible(event.target.checked)} /> 3D cadastral parcels</label>
          <label><input type="checkbox" checked={telemetryVisible} onChange={(event) => setTelemetryVisible(event.target.checked)} /> streamgage / WSE adapter visualization</label>
          <button type="button" onClick={() => void refreshOpenMiWse()} disabled={openMiRefreshing}>{openMiRefreshing ? 'Refreshing…' : 'Refresh USGS WSE'}</button>
          <label><input type="checkbox" checked={humanGateEnabled} disabled /> human authority gate</label>
          <label><input type="checkbox" checked={tiles3DVisible} onChange={(event) => setTiles3DVisible(event.target.checked)} /> 3D tiles (open-source renderer)</label>
        </div>

        {tiles3DVisible && mapReady && mapRef.current && (
          <div style={{ margin: '14px 0' }}>
            <ThreeDTilesLayer
              source={{
                id: 'tsm-3d-tiles',
                tilesetUrl: THREE_D_TILES_URL,
                enabled: true,
              }}
              map={mapRef.current}
              onStatusChange={setTiles3DStatus}
            />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
              Self-hosted OGC 3D Tiles 1.1 · terrain-3dep · renderer: 3d-tiles-renderer · status: {tiles3DStatus}
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: 10, borderRadius: 8, background: 'rgba(127,29,29,0.35)', color: '#fecaca', fontSize: 12 }}>
            {error}
          </div>
        )}

        {selected ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'inline-block', padding: '3px 7px', borderRadius: 999, fontSize: 10, background: selectedState === 'SFHA_HIGH_RISK' ? '#7f1d1d' : selectedState === 'SFHA_COMPLIANT' ? '#14532d' : '#78350f' }}>
              {selectedState}
            </div>
            <h2 style={{ margin: '9px 0 8px', fontSize: 17 }}>{selected.properties.owner ?? 'Owner unavailable'}</h2>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: 0, fontSize: 12 }}>
              <dt>APN</dt><dd>{selected.properties.apn ?? 'unavailable'}</dd>
              <dt>WTH PIN</dt><dd>{selected.properties.wthPin ?? 'unavailable'}</dd>
              <dt>Acres</dt><dd>{isFiniteNumber(selected.properties.acreage) ? selected.properties.acreage.toFixed(2) : 'unavailable'}</dd>
              <dt>Section</dt><dd>{selected.properties.section ?? 'unavailable'}</dd>
              <dt>Township</dt><dd>{selected.properties.township ?? 'unavailable'}</dd>
              <dt>Range</dt><dd>{selected.properties.range ?? 'unavailable'}</dd>
              <dt>LAG</dt><dd>{isFiniteNumber(selectedLag) ? `${selectedLag.toFixed(1)} ft NAVD88` : 'unverified'}</dd>
              <dt>BFE</dt><dd>{selectedBfe.toFixed(1)} ft NAVD88</dd>
              <dt>Freeboard</dt><dd>{freeboard == null ? 'unverified' : `${freeboard >= 0 ? '+' : ''}${freeboard.toFixed(1)} ft`}</dd>
              <dt>Evidence</dt><dd>{selected.properties.elevationEvidenceStatus ?? 'UNVERIFIED'}</dd>
            </dl>
            <p style={{ fontSize: 12, color: '#94a3b8' }}>{selected.properties.legalDescription ?? 'Legal description unavailable from current source.'}</p>
            {selected.properties.floodway && (
              <div style={{ marginTop: 8, padding: 9, borderRadius: 8, background: 'rgba(127,29,29,0.35)', fontSize: 12 }}>
                Floodway: {selected.properties.floodwayName ?? 'mapped floodway'}
                {isFiniteNumber(selected.properties.floodwayElevationFtNavd88) ? ` · ${selected.properties.floodwayElevationFtNavd88.toFixed(1)} ft NAVD88` : ''}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <a href={POSEY_WTHGIS_URL} target="_blank" rel="noreferrer">Posey WTH GIS ↗</a>
              <a href={POSEY_COUNTYGISMAPS_URL} target="_blank" rel="noreferrer">CountyGISMaps reference ↗</a>
              <a href={POSEY_EQUATOR_URL} target="_blank" rel="noreferrer">Equator GIS reference ↗</a>
              <a href={POSEY_LANDRECORDS_URL} target="_blank" rel="noreferrer">Land Records reference ↗</a>
              <a href={INDIANA_ELEVATION_CATALOG_URL} target="_blank" rel="noreferrer">Indiana elevation catalog ↗</a>
              <a href={INDIANA_ELEVATION_S3_URL} target="_blank" rel="noreferrer">Indiana LiDAR S3 archive ↗</a>
              <a href={INDIANA_LIDAR_VIEWER_URL} target="_blank" rel="noreferrer">Indiana LiDAR viewer ↗</a>
              <a href={FEMA_NFHL_URL} target="_blank" rel="noreferrer">FEMA NFHL ↗</a>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 16, color: '#94a3b8', fontSize: 12 }}>
            Click a parcel after validated XSoft parcel geometry is loaded; WTH GIS remains the property-record cross-reference.
          </div>
        )}

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(148,163,184,0.18)', fontSize: 11, lineHeight: 1.45, color: '#fbbf24' }}>
          Human authority gate ON: this display cannot convert visualization into a sealed survey, FEMA determination, or regulatory certification.
        </div>
      </aside>

      <div
        style={{
          position: 'absolute',
          left: 12,
          bottom: 12,
          zIndex: 4,
          maxWidth: 620,
          padding: 10,
          borderRadius: 9,
          background: 'rgba(2,6,23,0.88)',
          fontSize: 11,
          color: '#cbd5e1',
        }}
      >
        WTH GIS is treated as cadastral/property-record evidence. Parcel geometry must arrive through a configured,
        documented GeoJSON feed; the console does not scrape undocumented WTH GIS endpoints or fabricate geometry.
        FEMA LAG/BFE comparisons require the applicable surveyed/certified elevation evidence.
      </div>
    </section>
  );
}
