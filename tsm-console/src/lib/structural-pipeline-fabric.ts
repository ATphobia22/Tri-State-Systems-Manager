export type StructuralPipelineLayerKind = 'terrain' | 'raster' | 'feature' | 'api' | 'presentation' | 'geojson-local';

export interface StructuralPipelineLayer {
  readonly index: number;
  readonly id: string;
  readonly name: string;
  readonly sourceAuthority: string;
  readonly kind: StructuralPipelineLayerKind;
  readonly endpoint: string;
  readonly notes: string;
  readonly mapRenderable: boolean;
}

/**
 * Canonical twelve-layer MapLibre plane. This is a presentation/source
 * registry only; regulatory and engineering authority remain in their
 * respective provenance contracts.
 */
export const TSM_STRUCTURAL_PIPELINE_FABRIC: readonly StructuralPipelineLayer[] = [
  { index: 1, id: 'terrain-rgb', name: 'TSM Terrain-RGB 3DEP Mesh', sourceAuthority: 'USGS 3DEP / TSM materialized terrain', kind: 'terrain', endpoint: 'https://atphobia22.github.io/Tri-State-Systems-Manager/terrain_3dep/{z}/{x}/{y}.png', notes: 'Visualization terrain; fail-closed when the materialized source is unavailable.', mapRenderable: true },
  { index: 2, id: 'indiana-imagery', name: 'Indiana Current Imagery', sourceAuthority: 'Indiana Geographic Information Office', kind: 'raster', endpoint: 'https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer', notes: 'Current imagery visualization; ImageServer export access.', mapRenderable: true },
  { index: 3, id: 'fema-nfhl', name: 'FEMA NFHL Effective Flood Hazard', sourceAuthority: 'FEMA', kind: 'raster', endpoint: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer', notes: 'Regulatory/effective flood products remain a distinct authority plane.', mapRenderable: true },
  { index: 4, id: 'indiana-bafm', name: 'Indiana Best Available Flood Hazard', sourceAuthority: 'Indiana DNR Division of Water', kind: 'raster', endpoint: 'https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer', notes: 'Planning/construction context; not FEMA insurance authority.', mapRenderable: true },
  { index: 5, id: 'indiana-parcels', name: 'Indiana Parcel Boundaries 2025', sourceAuthority: 'Indiana Geographic Information Office', kind: 'feature', endpoint: 'https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer', notes: 'Statewide context layer; not survey geometry.', mapRenderable: true },
  { index: 6, id: 'indiana-roads', name: 'Indiana Current Road Centerlines', sourceAuthority: 'Indiana Geographic Information Office', kind: 'feature', endpoint: 'https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_Current/FeatureServer', notes: 'Transportation context.', mapRenderable: true },
  { index: 7, id: 'indiana-buildings', name: 'Indiana Building Footprints 2016–2020', sourceAuthority: 'Indiana Geographic Information Office', kind: 'feature', endpoint: 'https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer', notes: 'Derived/reference footprints; not current survey geometry.', mapRenderable: true },
  { index: 8, id: 'usgs-3dep-index', name: 'USGS 3DEP Elevation Index', sourceAuthority: 'USGS 3DEP', kind: 'raster', endpoint: 'https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer', notes: 'Elevation index/context.', mapRenderable: true },
  { index: 9, id: 'posey-cslf', name: 'Posey Changes Since Last FIRM', sourceAuthority: 'Indiana GIS / Posey CSLF', kind: 'feature', endpoint: 'https://gisdata.in.gov/server/rest/services/Hosted/Posey_CSLF_Feb2025/FeatureServer', notes: 'County flood-study context.', mapRenderable: true },
  { index: 10, id: 'osm-base', name: 'OpenStreetMap Context', sourceAuthority: 'OpenStreetMap contributors', kind: 'raster', endpoint: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', notes: 'Context basemap; attribution required.', mapRenderable: true },
  { index: 11, id: 'indiana-plss', name: 'Indiana PLSS State Boundary', sourceAuthority: 'Indiana GIS / DNR', kind: 'feature', endpoint: 'https://gisdata.in.gov/server/rest/services/Hosted/PLSS_Indiana_State_Boundary/FeatureServer', notes: 'Public-land-survey context.', mapRenderable: true },
  { index: 12, id: 'usgs-3dep-elevation', name: 'USGS 3DEP Elevation ImageServer', sourceAuthority: 'USGS National Map 3DEP', kind: 'raster', endpoint: 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer', notes: 'Elevation visualization source; does not become survey-grade engineering terrain by display.', mapRenderable: true },
  { index: 13, id: 'usgs-quad-index', name: 'USGS 24K Quadrangle Index', sourceAuthority: 'USGS', kind: 'geojson-local', endpoint: 'reference/usgs-24k-quadrangle-boundaries.geojson', notes: 'USGS 24K quad boundaries, tri-state subset (36 quads). Reference index only — not survey evidence.', mapRenderable: true },
] as const;
