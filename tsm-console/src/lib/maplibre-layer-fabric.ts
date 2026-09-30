export type MapLibreFabricKind = 'terrain' | 'raster' | 'feature';

export interface MapLibreFabricLayer {
  readonly id: string;
  readonly title: string;
  readonly authorityClass: 'OBSERVATION' | 'REGULATORY' | 'PLANNING' | 'CONTEXT' | 'DERIVED';
  readonly kind: MapLibreFabricKind;
  readonly endpoint: string;
  readonly attribution: string;
  readonly defaultVisible: boolean;
  readonly arcgisLayerIds?: readonly number[];
}

export const MAPLIBRE_FABRIC_LAYERS: readonly MapLibreFabricLayer[] = [
  {
    id: 'terrain-rgb',
    title: 'TSM Terrain-RGB 3DEP Mesh',
    authorityClass: 'OBSERVATION',
    kind: 'terrain',
    endpoint: 'https://atphobia22.github.io/Tri-State-Systems-Manager/terrain_3dep/{z}/{x}/{y}.png',
    attribution: 'TSM Terrain-RGB / USGS 3DEP-derived',
    defaultVisible: true,
  },
  {
    id: 'indiana-imagery',
    title: 'Indiana Current Imagery',
    authorityClass: 'OBSERVATION',
    kind: 'raster',
    endpoint: 'https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer',
    attribution: 'Indiana Geographic Information Office',
    defaultVisible: true,
  },
  {
    id: 'fema-effective',
    title: 'FEMA NFHL Effective Flood Hazard',
    authorityClass: 'REGULATORY',
    kind: 'raster',
    endpoint: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
    attribution: 'FEMA NFHL',
    defaultVisible: false,
    arcgisLayerIds: [28, 16, 3, 1, 34, 23],
  },
  {
    id: 'indiana-bafm',
    title: 'Indiana Best Available Flood Hazard',
    authorityClass: 'PLANNING',
    kind: 'raster',
    endpoint: 'https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer',
    attribution: 'Indiana DNR Division of Water',
    defaultVisible: false,
    arcgisLayerIds: [104, 438],
  },
  {
    id: 'indiana-parcels',
    title: 'Indiana Parcel Boundaries 2025',
    authorityClass: 'CONTEXT',
    kind: 'feature',
    endpoint: 'https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer',
    attribution: 'Indiana Geographic Information Office',
    defaultVisible: false,
  },
  {
    id: 'indiana-roads',
    title: 'Indiana Current Road Centerlines',
    authorityClass: 'CONTEXT',
    kind: 'feature',
    endpoint: 'https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_Current/FeatureServer',
    attribution: 'Indiana Geographic Information Office',
    defaultVisible: false,
  },
  {
    id: 'indiana-buildings',
    title: 'Indiana Building Footprints 2016–2020',
    authorityClass: 'DERIVED',
    kind: 'feature',
    endpoint: 'https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer',
    attribution: 'Indiana Geographic Information Office',
    defaultVisible: false,
  },
  {
    id: 'usgs-3dep-index',
    title: 'USGS 3DEP Elevation Index',
    authorityClass: 'OBSERVATION',
    kind: 'raster',
    endpoint: 'https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer',
    attribution: 'USGS 3DEP',
    defaultVisible: false,
  },
  {
    id: 'posey-cslf',
    title: 'Posey Changes Since Last FIRM',
    authorityClass: 'CONTEXT',
    kind: 'feature',
    endpoint: 'https://gisdata.in.gov/server/rest/services/Hosted/Posey_CSLF_Feb2025/FeatureServer',
    attribution: 'Indiana GIS / Posey CSLF',
    defaultVisible: false,
  },
  {
    id: 'osm-base',
    title: 'OpenStreetMap Context',
    authorityClass: 'CONTEXT',
    kind: 'raster',
    endpoint: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    defaultVisible: false,
  },
  {
    id: 'indiana-plss',
    title: 'Indiana PLSS State Boundary',
    authorityClass: 'CONTEXT',
    kind: 'feature',
    endpoint: 'https://gisdata.in.gov/server/rest/services/Hosted/PLSS_Indiana_State_Boundary/FeatureServer',
    attribution: 'Indiana GIS / DNR',
    defaultVisible: false,
  },
  {
    id: 'usgs-3dep-elevation',
    title: 'USGS 3DEP Elevation ImageServer',
    authorityClass: 'OBSERVATION',
    kind: 'raster',
    endpoint: 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',
    attribution: 'USGS National Map 3DEP',
    defaultVisible: false,
  },
] as const;

export function getMapLibreFabricLayer(id: string): MapLibreFabricLayer {
  const layer = MAPLIBRE_FABRIC_LAYERS.find((candidate) => candidate.id === id);
  if (!layer) throw new Error(`Unknown MapLibre fabric layer: ${id}`);
  return layer;
}

export function buildArcGisExportTemplate(endpoint: string, layerIds: readonly number[] = []): string {
  const layers = layerIds.length > 0 ? `&layers=show:${layerIds.join(',')}` : '';
  return `${endpoint.replace(/\/$/, '')}/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=512,512&format=png32&transparent=true${layers}&f=image`;
}

export function buildArcGisFeatureQueryUrl(endpoint: string): string {
  const base = endpoint.replace(/\/$/, '');
  const queryEndpoint = /\/FeatureServer\/\d+$/.test(base) ? base : `${base}/0`;
  return `${queryEndpoint}/query?where=1%3D1&geometry={bbox-epsg-4326}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=500&f=geojson`;
}
