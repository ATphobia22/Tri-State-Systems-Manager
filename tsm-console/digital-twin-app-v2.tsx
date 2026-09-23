import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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
  wthgisFeatureId?: number;
  wthgisRecordUrl?: string;
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

type MapLibreHazardColor = NonNullable<
  Extract<maplibregl.LayerSpecification, { type: 'fill-extrusion' }>['paint']
>['fill-extrusion-color'];

interface OpenMIWaterSurfaceMessage {
  waterSurfaceElevationFtNavd88: number;
  timestamp: string;
  sourceProvenanceHash: string;
  validationStatus: 'VALIDATED' | 'REVIEW_REQUIRED' | 'REJECTED';
}

const POINT_TOWNSHIP_CENTER: [number, number] = [-87.9312, 37.8825];
const ENGINEERING_CRS = 'EPSG:2966';
const DISPLAY_CRS = 'EPSG:4326 → WebMercator';
const DEFAULT_BFE_FT_NAVD88 = 375;
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

function makeRecordUrl(featureId?: number): string {
  if (!featureId || !Number.isInteger(featureId) || featureId <= 0) return POSEY_WTHGIS_URL;
  return `${POSEY_WTHGIS_URL}tgis/custom.aspx?DSID=205&FeatureID=${featureId}&RequestType=PropertyRecordCard`;
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
  const [humanGateEnabled, setHumanGateEnabled] = useState(true);
  const [waterSurfaceFt, setWaterSurfaceFt] = useState<number | null>(null);
  const [openMiStatus, setOpenMiStatus] = useState<'DISCONNECTED' | 'LIVE' | 'REJECTED'>('DISCONNECTED');
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
      center: POINT_TOWNSHIP_CENTER,
      zoom: 13.5,
      pitch: 62,
      bearing: -18,
      maxPitch: 85,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      mapRef.current = map;

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
          wthgisFeatureId: Number(properties.wthgisFeatureId),
          wthgisRecordUrl: typeof properties.wthgisRecordUrl === 'string' ? properties.wthgisRecordUrl : undefined,
        };
        const geometry = feature.geometry as ParcelFeature['geometry'];
        setSelected({
          type: 'Feature',
          geometry: geometry as ParcelFeature['geometry'],
          properties: {
            ...parsed,
            wthgisRecordUrl: parsed.wthgisRecordUrl ?? makeRecordUrl(parsed.wthgisFeatureId),
          },
        });
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const url = import.meta.env.VITE_POSEY_WTHGIS_GEOJSON_URL?.trim();
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

  useEffect(() => {
    const url = import.meta.env.VITE_TSM_OPENMI_WSE_URL?.trim();
    if (!url) return;

    let cancelled = false;
    const poll = async (): Promise<void> => {
      try {
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`OpenMI WSE endpoint returned HTTP ${response.status}`);
        const message = (await response.json()) as OpenMIWaterSurfaceMessage;
        if (
          !isFiniteNumber(message.waterSurfaceElevationFtNavd88) ||
          !message.timestamp ||
          !/^[a-f0-9]{64}$/.test(message.sourceProvenanceHash) ||
          message.validationStatus !== 'VALIDATED'
        ) {
          setOpenMiStatus('REJECTED');
          return;
        }
        if (!cancelled) {
          setWaterSurfaceFt(message.waterSurfaceElevationFtNavd88);
          setOpenMiStatus('LIVE');
        }
      } catch {
        if (!cancelled) setOpenMiStatus('DISCONNECTED');
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
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
      .then((geometry: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>) => {
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
          <div><strong style={{ color: '#e2e8f0' }}>WTH GIS geometry:</strong> {geometryStatus}</div>
          <div><strong style={{ color: '#e2e8f0' }}>OpenMI WSE:</strong> {openMiStatus}{waterSurfaceFt != null ? ` · ${waterSurfaceFt.toFixed(2)} ft NAVD88` : ''}</div>
        </div>

        <div style={{ display: 'grid', gap: 7, margin: '14px 0' }}>
          <label><input type="checkbox" checked={parcelVisible} onChange={(event) => setParcelVisible(event.target.checked)} /> 3D cadastral parcels</label>
          <label><input type="checkbox" checked={telemetryVisible} onChange={(event) => setTelemetryVisible(event.target.checked)} /> streamgage / OpenMI telemetry</label>
          <label><input type="checkbox" checked={humanGateEnabled} onChange={(event) => setHumanGateEnabled(event.target.checked)} /> human authority gate</label>
        </div>

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
              <a href={selected.properties.wthgisRecordUrl ?? makeRecordUrl(selected.properties.wthgisFeatureId)} target="_blank" rel="noreferrer">Open WTH GIS record ↗</a>
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
            Click a parcel after a validated WTH GIS GeoJSON geometry source is configured.
          </div>
        )}

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(148,163,184,0.18)', fontSize: 11, lineHeight: 1.45, color: '#fbbf24' }}>
          {humanGateEnabled
            ? 'Human authority gate ON: this display cannot convert visualization into a sealed survey, FEMA determination, or regulatory certification.'
            : 'Human authority gate OFF: presentation mode only; no engineering determination is authorized.'}
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
