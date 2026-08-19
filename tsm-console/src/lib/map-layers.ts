/**
 * MapLibre layer catalog — Public Visualization Plane
 * REGULATORY layers are display-only; never sole basis for determination without human gate.
 */

export type LayerAuthority =
  | 'OBSERVATION'
  | 'REGULATORY'
  | 'DERIVED'
  | 'VISUALIZATION'
  | 'CONTEXT';

export interface MapLayerSpec {
  id: string;
  title: string;
  authority_class: LayerAuthority;
  type: 'raster' | 'raster-dem' | 'vector-tile' | 'geojson' | 'arcgis-mapserver';
  url: string;
  attribution?: string;
  notes?: string;
  defaultVisible?: boolean;
  /** MapLibre source config hints */
  maplibre?: Record<string, unknown>;
}

/** Authoritative + context layers for Tri-State / Posey */
export const MAP_LAYERS: MapLayerSpec[] = [
  {
    id: 'osm-base',
    title: 'OpenStreetMap',
    authority_class: 'CONTEXT',
    type: 'raster',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    defaultVisible: true,
  },
  {
    id: 'fema-nfhl',
    title: 'FEMA National Flood Hazard Layer',
    authority_class: 'REGULATORY',
    type: 'arcgis-mapserver',
    url: 'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer',
    attribution: 'FEMA NFHL',
    notes:
      'Effective FIRM/SFHA for insurance. Layer 28 Flood Hazard Zones typical. Do not use alone for Indiana local regulatory where BAFM differs.',
    defaultVisible: false,
  },
  {
    id: 'indiana-bafm',
    title: 'Indiana Best Available Flood Hazard Layer',
    authority_class: 'REGULATORY',
    type: 'arcgis-mapserver',
    url: 'https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer',
    attribution: 'Indiana DNR Division of Water',
    notes:
      'DNR-approved studies beyond NFHL. Planning/construction; NOT for flood insurance. Never collapse with FEMA NFHL.',
    defaultVisible: false,
  },
  {
    id: 'in-parcels-2025',
    title: 'Parcel Boundaries of Indiana 2025',
    authority_class: 'CONTEXT',
    type: 'arcgis-mapserver',
    url: 'https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer',
    attribution: 'IGIO Data Harvest',
    notes: 'Not a survey product; accuracy varies by county.',
    defaultVisible: false,
  },
  {
    id: 'in-roads-2025',
    title: 'Road Centerlines of Indiana 2025',
    authority_class: 'CONTEXT',
    type: 'arcgis-mapserver',
    url: 'https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_2025/FeatureServer',
    attribution: 'IGIO Data Harvest',
    defaultVisible: false,
  },
  {
    id: 'indiana-imagery',
    title: 'Indiana Current Imagery (ImageServer)',
    authority_class: 'OBSERVATION',
    type: 'raster',
    url: 'https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer',
    attribution: 'IGIO',
    notes: '4-band COG; may require token/CORS for browser.',
    defaultVisible: false,
  },
];

/** HEC-RAS / Scientific plane integration notes (not executed in browser) */
export const HECRAS_INTEGRATION = {
  role: 'Scientific & Simulation Plane — offline / server adapters',
  inputs: [
    'IGIO S3 DEM / LAS → Terrain GeoTIFF (NAVD88 preferred)',
    'Channel bathymetry merge via RAS Mapper XS interpolation when available',
    'Land use / Manning n from external layers',
  ],
  workflow: [
    '1. Acquire DEM from s3://giselevationingov (mosaic/dem or derived)',
    '2. Clip to AOI; reproject as needed (HEC-RAS project CRS)',
    '3. RAS Mapper → Create New RAS Terrain',
    '4. Define 2D Flow Areas; optional 1D/2D coupling',
    '5. Unsteady flow with USGS/NWPS boundary conditions',
    '6. Export inundation rasters → EvidenceArtifact MODEL_OUTPUT with model_version',
  ],
  openmi: 'Future OpenMI 2.0 contracts couple HEC-RAS outputs to TSM Evidence Bus — human gate before regulatory use',
  references: [
    'https://www.hec.usace.army.mil/software/hec-ras/',
    'https://www.hec.usace.army.mil/confluence/hmsdocs/hmsguides/gis-tools-and-terrain-data',
  ],
};
