export type StructuralPipelineLayer =
  | { readonly index: 1; readonly id: 'terrain-rgb'; readonly name: string; readonly kind: 'terrain'; readonly sourceAuthority: string; readonly endpoint: string; readonly notes: string; readonly mapRenderable: boolean }
  | { readonly index: 2; readonly id: 'hydro-bathymetry'; readonly name: string; readonly kind: 'api'; readonly sourceAuthority: string; readonly endpoint: string; readonly notes: string; readonly mapRenderable: boolean }
  | { readonly index: 3; readonly id: 'navd88-gage-zero'; readonly name: string; readonly kind: 'api'; readonly sourceAuthority: string; readonly endpoint: string; readonly notes: string; readonly mapRenderable: boolean }
  | { readonly index: 4; readonly id: 'hec-ras-2d'; readonly name: string; readonly kind: 'api'; readonly sourceAuthority: string; readonly endpoint: string; readonly notes: string; readonly mapRenderable: boolean }
  | { readonly index: 5; readonly id: 'fema-nfhl'; readonly name: string; readonly kind: 'raster'; readonly sourceAuthority: string; readonly endpoint: string; readonly notes: string; readonly mapRenderable: boolean }
  | { readonly index: 6; readonly id: 'indiana-bafm'; readonly name: string; readonly kind: 'raster'; readonly sourceAuthority: string; readonly endpoint: string; readonly notes: string; readonly mapRenderable: boolean }
  | { readonly index: 7; readonly id: 'streamstats'; readonly name: string; readonly kind: 'api'; readonly sourceAuthority: string; readonly endpoint: string; readonly notes: string; readonly mapRenderable: boolean }
  | { readonly index: 8; readonly id: 'indiana-parcels'; readonly name: string; readonly kind: 'feature'; readonly sourceAuthority: string; readonly endpoint: string; readonly notes: string; readonly mapRenderable: boolean }
  | { readonly index: 9; readonly id: 'building-extrusions'; readonly name: string; readonly kind: 'feature'; readonly sourceAuthority: string; readonly endpoint: string; readonly notes: string; readonly mapRenderable: boolean }
  | { readonly index: 10; readonly id: 'hydrologic-telemetry'; readonly name: string; readonly kind: 'api'; readonly sourceAuthority: string; readonly endpoint: string; readonly notes: string; readonly mapRenderable: boolean }
  | { readonly index: 11; readonly id: 'section-204-enclaves'; readonly name: string; readonly kind: 'api'; readonly sourceAuthority: string; readonly endpoint: string; readonly notes: string; readonly mapRenderable: boolean }
  | { readonly index: 12; readonly id: 'cinematic-volumetric-mist'; readonly name: string; readonly kind: 'presentation'; readonly sourceAuthority: string; readonly endpoint: string; readonly notes: string; readonly mapRenderable: boolean };

export const TSM_STRUCTURAL_PIPELINE_FABRIC: readonly StructuralPipelineLayer[] = [
  { index:1,id:'terrain-rgb',name:'Continuous Terrain-RGB DEM Engine',kind:'terrain',sourceAuthority:'USGS 3DEP / configured terrain cache',endpoint:'',notes:'Engineering terrain source; fail-closed when unavailable.',mapRenderable:true },
  { index:2,id:'hydro-bathymetry',name:'Verified Hydrographic Bathymetry Mappings',kind:'api',sourceAuthority:'Controlled hydrographic evidence',endpoint:'/v1/twin/hydrography',notes:'Evidence-backed hydrographic context.',mapRenderable:false },
  { index:3,id:'navd88-gage-zero',name:'Vertical NAVD88 Gage-Zero Conversion Mesh',kind:'api',sourceAuthority:'Validated datum control',endpoint:'/v1/twin/datum/navd88',notes:'Datum middleware; never a presentation calculation.',mapRenderable:false },
  { index:4,id:'hec-ras-2d',name:'HEC-RAS 2D Hydro-Geometry Mesh Centroids',kind:'api',sourceAuthority:'Project engineering evidence',endpoint:'/v1/twin/hec-ras',notes:'Hydraulic results require evidence and engineering review.',mapRenderable:false },
  { index:5,id:'fema-nfhl',name:'FEMA NFHL Effective Special Hazard Zones',kind:'raster',sourceAuthority:'FEMA NFHL',endpoint:'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',notes:'Effective federal regulatory reference; not interchangeable with state planning layers.',mapRenderable:true },
  { index:6,id:'indiana-bafm',name:'Indiana DNR Best Available Flood Planes',kind:'raster',sourceAuthority:'Indiana DNR',endpoint:'https://gisdata.in.gov/arcgis/rest/services',notes:'State planning/reference plane; not NFIP effective evidence.',mapRenderable:true },
  { index:7,id:'streamstats',name:'USGS StreamStats Hydrologic Scenario Inputs',kind:'api',sourceAuthority:'USGS StreamStats',endpoint:'https://streamstats.usgs.gov',notes:'Hydrologic analysis source; outputs remain derived unless independently evidenced.',mapRenderable:false },
  { index:8,id:'indiana-parcels',name:'Indiana Parcel Vector Fabric',kind:'feature',sourceAuthority:'Indiana public parcel reference',endpoint:'https://gisdata.in.gov/arcgis/rest/services',notes:'Parcel context; cadastral boundaries do not establish surveyed project geometry.',mapRenderable:true },
  { index:9,id:'building-extrusions',name:'3D Photorealistic Building Extrusions',kind:'feature',sourceAuthority:'Public building reference',endpoint:'https://gisdata.in.gov/arcgis/rest/services',notes:'Visualization geometry only; not survey-certified structure height.',mapRenderable:true },
  { index:10,id:'hydrologic-telemetry',name:'Hydrologic Gauge Observation Matrix',kind:'api',sourceAuthority:'Configured observation sources',endpoint:'/v1/twin/observations',notes:'Live or cached observations must retain provenance and freshness.',mapRenderable:false },
  { index:11,id:'section-204-enclaves',name:'Conditional USACE Section 204 Placement Enclaves',kind:'api',sourceAuthority:'USACE / project authorization',endpoint:'/v1/twin/section-204',notes:'Scenario/placement plane; authorization is required before engineering use.',mapRenderable:false },
  { index:12,id:'cinematic-volumetric-mist',name:'Cinematic Volumetric Mist Grid',kind:'presentation',sourceAuthority:'TSM presentation runtime',endpoint:'',notes:'Presentation-only effect; cannot mutate engineering state.',mapRenderable:true },
];

export function getStructuralPipelineLayer(id: StructuralPipelineLayer['id']): StructuralPipelineLayer | undefined {
  return TSM_STRUCTURAL_PIPELINE_FABRIC.find((layer) => layer.id === id);
}
