export interface GovernmentCapability {
 readonly id:string; readonly authority:'FEMA'|'USGS'|'NOAA'|'CENSUS'|'EPA'|'USDA'|'DOT'|'USACE';
 readonly operation:string; readonly status:'registered'|'discovery-only';
 readonly description:string;
}
export const GOVERNMENT_CAPABILITIES:readonly GovernmentCapability[]=[
 {id:'geo.nfhl.query',authority:'FEMA',operation:'read-only-query',status:'registered',description:'Query registered FEMA NFHL layers with provenance and source metadata.'},
 {id:'geo.firm.lookup',authority:'FEMA',operation:'lookup',status:'discovery-only',description:'Resolve effective FIRM panel and community metadata.'},
 {id:'geo.loma.lookup',authority:'FEMA',operation:'lookup',status:'discovery-only',description:'Discover LOMA case metadata.'},
 {id:'geo.lomr.lookup',authority:'FEMA',operation:'lookup',status:'discovery-only',description:'Discover LOMR case metadata.'},
 {id:'geo.flood.risk',authority:'FEMA',operation:'discovery',status:'discovery-only',description:'Discover Risk MAP study products; not a regulatory determination.'},
 {id:'geo.dem.query',authority:'USGS',operation:'discovery',status:'discovery-only',description:'Discover 3DEP elevation products and service metadata.'},
 {id:'geo.elevation.profile',authority:'USGS',operation:'profile',status:'discovery-only',description:'Elevation profile capability pending CRS/datum/nodata validation.'},
 {id:'geo.hydrology.query',authority:'USGS',operation:'discovery',status:'discovery-only',description:'Discover NHD and hydrography products.'},
 {id:'geo.watershed.query',authority:'USGS',operation:'watershed',status:'discovery-only',description:'Watershed delineation requires a validated DEM, pour point, and pinned algorithm.'},
 {id:'weather.forecast',authority:'NOAA',operation:'forecast',status:'discovery-only',description:'Discover NWS forecast data with issue and valid times.'},
 {id:'coastal.flood.risk',authority:'NOAA',operation:'discovery',status:'discovery-only',description:'Discover coastal flooding and sea-level-rise products.'},
 {id:'stormsurge.analysis',authority:'NOAA',operation:'analysis',status:'discovery-only',description:'Storm-surge analysis requires validated forcing and model inputs.'},
 {id:'census.lookup',authority:'CENSUS',operation:'lookup',status:'discovery-only',description:'Query Census geography and attributes.'},
 {id:'census.boundary.query',authority:'CENSUS',operation:'boundary',status:'discovery-only',description:'Retrieve versioned Census statistical boundaries.'},
 {id:'soil.lookup',authority:'USDA',operation:'lookup',status:'discovery-only',description:'Discover SSURGO and soil map-unit attributes.'},
 {id:'agriculture.analysis',authority:'USDA',operation:'analysis',status:'discovery-only',description:'Discover cropland and forest products; derived analysis requires versioned inputs.'},
 {id:'epa.water.query',authority:'EPA',operation:'discovery',status:'discovery-only',description:'Discover EPA water program and water-quality data.'},
 {id:'epa.facility.lookup',authority:'EPA',operation:'lookup',status:'discovery-only',description:'Discover EPA facility records and reporting metadata.'},
 {id:'research.search',authority:'USGS',operation:'research-search',status:'registered',description:'Run injected, hash-verified research providers; retrieved claims remain unverified until synthesized and reviewed.'}
] as const;
