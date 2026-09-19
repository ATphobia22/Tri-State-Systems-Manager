export type FabricPlane = 'EVIDENCE_DATA_GOVERNANCE' | 'SCIENTIFIC_SIMULATION' | 'GOVERNANCE_DECISION' | 'PUBLIC_EXPERIENCE_VISUALIZATION';
export type FabricAuthority = 'AUTHORITATIVE' | 'DERIVED' | 'OBSERVATIONAL' | 'PRESENTATION';

export interface TsmDataFabric {
  readonly id: string;
  readonly plane: FabricPlane;
  readonly authority: FabricAuthority;
  readonly implemented: boolean;
  readonly live: boolean;
  readonly persistenceAllowed: boolean;
  readonly module: string;
  readonly sources: readonly string[];
  readonly output: readonly string[];
  readonly notes: string;
}

export const TSM_DATA_FABRICS: readonly TsmDataFabric[] = Object.freeze([
  { id:'hydrology', plane:'EVIDENCE_DATA_GOVERNANCE', authority:'AUTHORITATIVE', implemented:true, live:true, persistenceAllowed:true, module:'server/ingestion/usgs-nwis.mjs + noaa-nwps.mjs', sources:['USGS-NWIS-IV','NOAA-NWPS'], output:['observations','forecasts','gage metadata'], notes:'Observed and forecast products remain distinct; datum is never inferred.' },
  { id:'weather', plane:'EVIDENCE_DATA_GOVERNANCE', authority:'AUTHORITATIVE', implemented:true, live:true, persistenceAllowed:true, module:'server/ingestion/nws-weather.mjs', sources:['NWS-WEATHER-POINT','NWS-WEATHER-OBSERVATION','NWS-WEATHER-FORECAST-HOURLY'], output:['temperature','precipitation probability','wind','forecast','radar station'], notes:'Presentation effects consume normalized weather; weather does not itself establish hydraulic conclusions.' },
  { id:'terrain-elevation', plane:'EVIDENCE_DATA_GOVERNANCE', authority:'AUTHORITATIVE', implemented:true, live:true, persistenceAllowed:true, module:'lib/open-world-terrain.ts + lib/elevationModel.ts', sources:['USGS-3DEP-TERRAIN','INDIANA-ELEVATION-2016-2020'], output:['DEM','terrain RGB','terrain mesh'], notes:'Horizontal CRS and vertical datum remain independent metadata.' },
  { id:'imagery-orthophoto', plane:'EVIDENCE_DATA_GOVERNANCE', authority:'AUTHORITATIVE', implemented:true, live:true, persistenceAllowed:true, module:'lib/open-world-imagery.ts + lib/orthophoto-texture.ts', sources:['INDIANA-CURRENT-IMAGERY'], output:['orthophoto','change-detection reference'], notes:'Imagery does not become surveyed geometry.' },
  { id:'roads', plane:'EVIDENCE_DATA_GOVERNANCE', authority:'AUTHORITATIVE', implemented:true, live:true, persistenceAllowed:true, module:'lib/map-layers.ts + server/ingestion/indiana-gis.mjs', sources:['INDIANA-ROADS-CURRENT'], output:['road centerlines','address-range context'], notes:'Engineering alignments remain separate proposed geometry.' },
  { id:'parcels-addresses', plane:'EVIDENCE_DATA_GOVERNANCE', authority:'AUTHORITATIVE', implemented:true, live:true, persistenceAllowed:true, module:'server/ingestion/indiana-gis.mjs + lib/parcel-provenance.ts', sources:['INDIANA-PARCELS','INDIANA-ADDRESS-POINTS'], output:['parcel context','address context'], notes:'Framework data is not a survey boundary.' },
  { id:'buildings', plane:'SCIENTIFIC_SIMULATION', authority:'DERIVED', implemented:true, live:true, persistenceAllowed:true, module:'lib/buildingsService.ts + LiDAR footprint manifests', sources:['INDIANA-LIDAR-BUILDING-FOOTPRINTS','permitted-derived-building-sources'], output:['building footprints','height estimates','LOD meshes'], notes:'Derived/reference unless survey or authoritative geometry is supplied.' },
  { id:'flood-regulatory', plane:'EVIDENCE_DATA_GOVERNANCE', authority:'AUTHORITATIVE', implemented:true, live:true, persistenceAllowed:true, module:'server/ingestion/fema-nfhl.mjs + server/geospatial/firm-*', sources:['FEMA-NFHL','IDNR-BAFL'], output:['effective flood layers','BFE references','panel provenance'], notes:'FEMA and Indiana planning authority paths remain separate.' },
  { id:'3d-tiles', plane:'PUBLIC_EXPERIENCE_VISUALIZATION', authority:'DERIVED', implemented:true, live:true, persistenceAllowed:true, module:'lib/martin-tile-fabric.ts + OpenWorld3DTiles*', sources:['permitted-TSM-3D-products'], output:['3D Tiles','GLB/glTF','HLOD'], notes:'Transport/rendering does not confer engineering authority.' },
  { id:'vector-tiles', plane:'PUBLIC_EXPERIENCE_VISUALIZATION', authority:'DERIVED', implemented:true, live:true, persistenceAllowed:true, module:'lib/martin-tile-fabric.ts + lib/pmtiles-fabric.ts', sources:['PostGIS','PMTiles','Martin'], output:['vector tiles','PMTiles archives'], notes:'Tile artifacts retain source provenance separately.' },
  { id:'spatial-index', plane:'SCIENTIFIC_SIMULATION', authority:'DERIVED', implemented:true, live:false, persistenceAllowed:true, module:'lib/h3-spatial-fabric.ts', sources:['TSM source records'], output:['H3 cells','neighborhood indexes'], notes:'H3 is indexing, never authority.' },
  { id:'mapillary', plane:'PUBLIC_EXPERIENCE_VISUALIZATION', authority:'OBSERVATIONAL', implemented:true, live:true, persistenceAllowed:false, module:'integrations/mapillary/evidence.ts', sources:['Mapillary'], output:['visual context'], notes:'Observational reference; human review required.' },
  { id:'apple-maps', plane:'PUBLIC_EXPERIENCE_VISUALIZATION', authority:'PRESENTATION', implemented:true, live:true, persistenceAllowed:false, module:'integrations/apple-maps/context.ts', sources:['Apple Maps / MapKit'], output:['map context','realistic 3D context','Look Around context'], notes:'Presentation-only; no Apple Map Data ingestion or derivative database.' },
  { id:'osm-context', plane:'PUBLIC_EXPERIENCE_VISUALIZATION', authority:'OBSERVATIONAL', implemented:true, live:false, persistenceAllowed:true, module:'scripts/geospatial/osm-replication-manifest.py + Martin/PMTiles', sources:['OSM PBF/diffs'], output:['contextual roads','places','landuse'], notes:'ODbL attribution/provenance remain attached.' },
  { id:'hydraulic-modeling', plane:'SCIENTIFIC_SIMULATION', authority:'DERIVED', implemented:true, live:false, persistenceAllowed:true, module:'engineering/hec_ras_worker.py + engineering/hecras_hdf5.py', sources:['TSM terrain','USGS/NOAA boundaries'], output:['simulation results'], notes:'Isolated execution, hashes, bounded runtime, human review.' },
  { id:'geodetic-datum', plane:'EVIDENCE_DATA_GOVERNANCE', authority:'AUTHORITATIVE', implemented:true, live:false, persistenceAllowed:true, module:'lib/geodetic-pipeline.ts + server/ingestion/vertical-datum.mjs', sources:['documented CRS/datum transformations'], output:['transformed coordinates','datum provenance'], notes:'No silent vertical datum conversion.' },
]);

export function listMissingDataFabrics(): readonly TsmDataFabric[] { return TSM_DATA_FABRICS.filter((fabric) => !fabric.implemented); }
export function assertFabricRegistryComplete(): void {
  const missing = listMissingDataFabrics();
  if (missing.length) throw new Error('TSM data-fabric registry incomplete: ' + missing.map((fabric) => fabric.id).join(', '));
}
