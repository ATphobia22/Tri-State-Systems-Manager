/**
 * Authoritative real-world source fabric contract.
 * Every live ingest must produce a SourceDataset before promote.
 */
export interface SourceDataset {
  readonly sourceId: string;
  readonly version: string;
  readonly retrievedAt: string;
  readonly sha256: string;
  readonly provenanceId: string;
}

export type FabricCapability =
  | 'fema.nfhl.layers'
  | 'fema.nfhl.query'
  | 'fema.flood.zones'
  | 'fema.levees'
  | 'fema.boundaries'
  | 'noaa.datums'
  | 'noaa.geoid'
  | 'noaa.tides'
  | 'noaa.weather'
  | 'usgs.dem'
  | 'usgs.3dep'
  | 'usgs.topo'
  | 'usgs.geology'
  | 'usgs.hydrology';

export type AuthorityClass =
  | 'AUTHORITATIVE'
  | 'DERIVED'
  | 'CONTEXT'
  | 'SIMULATION_DEMO';

export interface GeodesyControls {
  readonly requireGeoidForOrthometric: true;
  readonly requireGageDatumForStageToElevation: true;
}

export const GEODESY_CONTROLS: GeodesyControls = {
  requireGeoidForOrthometric: true,
  requireGageDatumForStageToElevation: true,
};
