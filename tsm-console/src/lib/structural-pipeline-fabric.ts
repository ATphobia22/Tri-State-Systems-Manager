export type StructuralPlaneKind = 'terrain' | 'raster' | 'feature' | 'api' | 'presentation';

export type StructuralAuthority = 'AUTHORITATIVE' | 'DERIVED' | 'OBSERVATIONAL' | 'PRESENTATION';

export interface StructuralPipelineLayer {
  readonly index: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  readonly id: string;
  readonly name: string;
  readonly kind: StructuralPlaneKind;
  readonly authority: StructuralAuthority;
  readonly endpoint: string;
  readonly method: 'GET' | 'POST' | 'TILE' | 'CLIENT';
  readonly horizontalCrs: 'EPSG:2966' | 'EPSG:3857' | 'SOURCE_NATIVE';
  readonly verticalDatum: 'NAVD88' | 'SOURCE_NATIVE' | 'NOT_APPLICABLE';
  readonly mapRenderable: boolean;
  readonly sourceAuthority: string;
  readonly notes: string;
}

export const TSM_STRUCTURAL_PIPELINE_FABRIC: readonly StructuralPipelineLayer[] = Object.freeze([
  { index: 1, id: 'terrain-rgb', name: 'Continuous Terrain-RGB DEM Engine', kind: 'terrain', authority: 'AUTHORITATIVE', endpoint: 'https://atphobia22.github.io/Tri-State-Systems-Manager/terrain_3dep/{z}/{x}/{y}.png', method: 'TILE', horizontalCrs: 'EPSG:3857', verticalDatum: 'SOURCE_NATIVE', mapRenderable: true, sourceAuthority: 'USGS 3DEP / TSM materialized Terrain-RGB', notes: 'Browser terrain mesh. Engineering CRS/datum metadata remains separate from MapLibre rendering CRS.' },
  { index: 2, id: 'hydro-bathymetry', name: 'Verified Hydrographic Bathymetry Mappings', kind: 'feature', authority: 'AUTHORITATIVE', endpoint: 'https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer/9', method: 'GET', horizontalCrs: 'SOURCE_NATIVE', verticalDatum: 'SOURCE_NATIVE', mapRenderable: true, sourceAuthority: 'USACE National Levee Database / Cross Sections service', notes: 'Cross-section geometry is a source plane; submerged channel-bed truth requires verified bathymetric evidence.' },
  { index: 3, id: 'navd88-gage-zero', name: 'Vertical NAVD88 Gage-Zero Conversion Mesh', kind: 'api', authority: 'DERIVED', endpoint: '/api/hydrologic/calibration', method: 'GET', horizontalCrs: 'EPSG:2966', verticalDatum: 'NAVD88', mapRenderable: false, sourceAuthority: 'TSM datum/calibration middleware', notes: 'WSE_NAVD88 = Source Gage Height + validated Gage Zero NAVD88. No datum is inferred.' },
  { index: 4, id: 'hecras-2d', name: 'HEC-RAS 2D Hydro-Geometry Mesh Centroids', kind: 'api', authority: 'DERIVED', endpoint: '/api/engineering/ras-results', method: 'POST', horizontalCrs: 'EPSG:2966', verticalDatum: 'NAVD88', mapRenderable: true, sourceAuthority: 'TSM HEC-RAS evidence pipeline', notes: 'Operator/model result plane. Results are evidence-gated and must not be synthesized by the renderer.' },
  { index: 5, id: 'fema-nfhl', name: 'FEMA NFHL Effective Special Hazard Zones', kind: 'raster', authority: 'AUTHORITATIVE', endpoint: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer', method: 'GET', horizontalCrs: 'EPSG:3857', verticalDatum: 'NOT_APPLICABLE', mapRenderable: true, sourceAuthority: 'FEMA NFHL', notes: 'Effective regulatory reference plane; never merged with Indiana Best Available flood products.' },
  { index: 6, id: 'indiana-bafm', name: 'Indiana DNR Best Available Flood Planes', kind: 'raster', authority: 'AUTHORITATIVE', endpoint: 'https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer', method: 'GET', horizontalCrs: 'EPSG:3857', verticalDatum: 'SOURCE_NATIVE', mapRenderable: true, sourceAuthority: 'Indiana DNR Division of Water', notes: 'State planning/regulatory-study reference plane with separate authority metadata.' },
  { index: 7, id: 'usgs-streamstats', name: 'USGS StreamStats Peak Inundation Cores', kind: 'api', authority: 'DERIVED', endpoint: 'https://streamstats.usgs.gov/ss/?information-portal=regionalInformation&region=IN', method: 'GET', horizontalCrs: 'SOURCE_NATIVE', verticalDatum: 'SOURCE_NATIVE', mapRenderable: false, sourceAuthority: 'USGS StreamStats Indiana', notes: 'Hydrologic scenario inputs/results are kept separate from regulatory flood boundaries.' },
  { index: 8, id: 'indiana-parcels', name: 'Indiana Parcel Vector Fabric', kind: 'feature', authority: 'AUTHORITATIVE', endpoint: 'https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_Current/FeatureServer', method: 'GET', horizontalCrs: 'SOURCE_NATIVE', verticalDatum: 'NOT_APPLICABLE', mapRenderable: true, sourceAuthority: 'Indiana Geographic Information Office', notes: 'Public parcel context; not a survey boundary and not a private-owner database.' },
  { index: 9, id: 'building-extrusions', name: '3D Photorealistic Building Extrusions', kind: 'feature', authority: 'DERIVED', endpoint: 'https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer', method: 'GET', horizontalCrs: 'SOURCE_NATIVE', verticalDatum: 'SOURCE_NATIVE', mapRenderable: true, sourceAuthority: 'Indiana GIS building-footprint reference / OSM-Overture-compatible visualization plane', notes: 'Extrusions are visualization/reference geometry, not survey-certified structure heights.' },
  { index: 10, id: 'hydrologic-telemetry', name: 'Live Hydrologic Gauge Stream Matrix', kind: 'api', authority: 'OBSERVATIONAL', endpoint: '/api/ingest/usgs', method: 'POST', horizontalCrs: 'SOURCE_NATIVE', verticalDatum: 'SOURCE_NATIVE', mapRenderable: false, sourceAuthority: 'TSM hydrologic telemetry fabric', notes: 'Telemetry is observational. A disabled/unavailable upstream feed must remain explicitly unavailable rather than fabricated.' },
  { index: 11, id: 'usace-section-204', name: 'Conditional USACE Sec 204 Placement Enclaves', kind: 'api', authority: 'DERIVED', endpoint: '/api/v1/engineering/compensatory-storage', method: 'POST', horizontalCrs: 'EPSG:2966', verticalDatum: 'NAVD88', mapRenderable: true, sourceAuthority: 'TSM compensatory-storage / Section 204 engineering gate', notes: 'Scenario-only plane. Eligibility, quantity, placement and engineering gates must pass before visualization is promoted.' },
  { index: 12, id: 'cinematic-volumetric-mist', name: 'Cinematic Volumetric Mist Grid', kind: 'presentation', authority: 'PRESENTATION', endpoint: 'client://tsm/cinematic-volumetric-mist', method: 'CLIENT', horizontalCrs: 'EPSG:3857', verticalDatum: 'NOT_APPLICABLE', mapRenderable: true, sourceAuthority: 'TSM deterministic presentation shader', notes: 'Presentation-only. It never mutates engineering metrics, evidence, elevations, or simulation results.' },
]);

export const STRUCTURAL_PIPELINE_HORIZONTAL_FRAME = 'EPSG:2966';
export const STRUCTURAL_PIPELINE_VERTICAL_DATUM = 'NAVD88';

export function getStructuralPipelineLayer(index: StructuralPipelineLayer['index']): StructuralPipelineLayer {
  const layer = TSM_STRUCTURAL_PIPELINE_FABRIC.find((candidate) => candidate.index === index);
  if (!layer) throw new Error(`Unknown structural pipeline layer: ${index}`);
  return layer;
}

export function assertStructuralPipelineComplete(): void {
  if (TSM_STRUCTURAL_PIPELINE_FABRIC.length !== 12) throw new Error('TSM structural pipeline must contain exactly 12 layers');
  const indexes = new Set(TSM_STRUCTURAL_PIPELINE_FABRIC.map((layer) => layer.index));
  for (let index = 1; index <= 12; index += 1) if (!indexes.has(index as StructuralPipelineLayer['index'])) throw new Error(`Missing structural layer ${index}`);
}
