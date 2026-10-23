export interface GovernmentCapability {
 readonly id:string; readonly authority:'FEMA'|'USGS'|'NOAA'|'CENSUS'|'EPA'|'USDA'|'DOT'|'USACE';
 readonly operation:string; readonly status:'registered'|'discovery-only';
 readonly description:string;
}
export const GOVERNMENT_CAPABILITIES:readonly GovernmentCapability[]=[
 {id:'geo.nfhl.query',authority:'FEMA',operation:'read-only-query',status:'registered',description:'Query registered FEMA NFHL layers with provenance and source metadata.'},
 {id:'geo.nfhl.local',authority:'FEMA',operation:'read-only-query',status:'registered',description:'Serve locally-held NFHL flood-zone GeoJSONs (hash-verified against the holdings manifest) for counties we hold. Missing holdings report the exact expected path.'},
 {id:'geo.firm.lookup',authority:'FEMA',operation:'lookup',status:'discovery-only',description:'Resolve effective FIRM panel and community metadata.'},
 {id:'geo.loma.lookup',authority:'FEMA',operation:'lookup',status:'discovery-only',description:'Discover LOMA case metadata.'},
 {id:'geo.lomr.lookup',authority:'FEMA',operation:'lookup',status:'discovery-only',description:'Discover LOMR case metadata.'},
 {id:'geo.flood.risk',authority:'FEMA',operation:'discovery',status:'discovery-only',description:'Discover Risk MAP study products; not a regulatory determination.'},
 {id:'geo.dem.query',authority:'USGS',operation:'discovery',status:'registered',description:'Query 3DEP elevation service metadata with provenance (UsgsAdapter).'},
 {id:'geo.elevation.profile',authority:'USGS',operation:'profile',status:'discovery-only',description:'Elevation profile capability pending CRS/datum/nodata validation.'},
 {id:'geo.hydrology.query',authority:'USGS',operation:'discovery',status:'discovery-only',description:'Discover NHD and hydrography products.'},
 {id:'geo.watershed.query',authority:'USGS',operation:'watershed',status:'discovery-only',description:'Watershed delineation requires a validated DEM, pour point, and pinned algorithm.'},
 {id:'weather.forecast',authority:'NOAA',operation:'forecast',status:'registered',description:'NWS forecast metadata via api.weather.gov with provenance (NoaaAdapter). Live fetch is user-initiated only.'},
 {id:'river.gauge.query',authority:'NOAA',operation:'read-only-query',status:'registered',description:'NWPS river gauge metadata, flood thresholds, and stageflow (NwpsAdapter). Live fetch is user-initiated only; pinned snapshots are the default.'},
 {id:'river.iv.query',authority:'USGS',operation:'read-only-query',status:'registered',description:'NWIS instantaneous gage height/discharge via the JSON IV service (NwisAdapter). Site metadata has no JSON service; datums come from the pinned snapshot. Live fetch is user-initiated only.'},
 {id:'coastal.flood.risk',authority:'NOAA',operation:'discovery',status:'discovery-only',description:'Discover coastal flooding and sea-level-rise products.'},
 {id:'stormsurge.analysis',authority:'NOAA',operation:'analysis',status:'discovery-only',description:'Storm-surge analysis requires validated forcing and model inputs.'},
 {id:'census.lookup',authority:'CENSUS',operation:'lookup',status:'discovery-only',description:'Query Census geography and attributes.'},
 {id:'census.boundary.query',authority:'CENSUS',operation:'boundary',status:'discovery-only',description:'Retrieve versioned Census statistical boundaries.'},
 {id:'soil.lookup',authority:'USDA',operation:'lookup',status:'discovery-only',description:'SSURGO county surveys held locally, hash-verified (8/8 tri-state counties, saverest 2026-08/09, via Web Soil Survey); serve via localHoldings + ssurgo-holdings-manifest.json. Tabular/spatial query adapter pending (needs GDAL/shapely). SoilGrids v2.0 REST remains the operational raster substitute.'},
 {id:'agriculture.analysis',authority:'USDA',operation:'analysis',status:'discovery-only',description:'Discover cropland and forest products; derived analysis requires versioned inputs.'},
 {id:'epa.water.query',authority:'EPA',operation:'discovery',status:'discovery-only',description:'Discover EPA water program and water-quality data.'},
 {id:'epa.facility.lookup',authority:'EPA',operation:'lookup',status:'discovery-only',description:'Discover EPA facility records and reporting metadata.'},
 {id:'research.search',authority:'USGS',operation:'research-search',status:'registered',description:'Run injected, hash-verified research providers; retrieved claims remain unverified until synthesized and reviewed.'}
] as const;
