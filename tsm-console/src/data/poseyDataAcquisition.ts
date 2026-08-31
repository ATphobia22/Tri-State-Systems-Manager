export type PoseyAcquisitionStatus = 'ready' | 'requires_download' | 'site_specific' | 'program_specific';

export interface PoseyDataAsset {
  id: string;
  dataset: string;
  authority: string;
  purpose: string;
  status: PoseyAcquisitionStatus;
  sourceUrl: string;
  validation: string[];
}

export const POSEY_DATA_ASSETS: readonly PoseyDataAsset[] = [
  { id: 'fema-effective-mapping', dataset: 'FEMA effective FIRM/FIS/NFHL', authority: 'FEMA', purpose: 'Federal flood-regulatory evidence', status: 'requires_download', sourceUrl: 'https://msc.fema.gov/', validation: ['effective date', 'panel/FIS identifier', 'horizontal CRS', 'vertical datum', 'source hash'] },
  { id: 'indiana-bafl', dataset: 'Indiana Best Available Flood Hazard Layer', authority: 'Indiana DNR', purpose: 'State flood-hazard planning/regulatory context', status: 'requires_download', sourceUrl: 'https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer/0', validation: ['native CRS EPSG:26916', 'layer metadata', 'feature provenance', 'source hash'] },
  { id: 'infip-fara', dataset: 'INFIP / FARA records', authority: 'Indiana DNR', purpose: 'Site-specific floodplain assessment', status: 'site_specific', sourceUrl: 'https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/', validation: ['site/address', 'FARA date', 'BFE source', 'regulatory status'] },
  { id: 'doworc', dataset: 'DoWORC records', authority: 'Indiana DNR', purpose: 'Permits, dams, drainage, models and regulatory records', status: 'site_specific', sourceUrl: 'https://www.in.gov/dnr/water/online-research-center/', validation: ['record identifier', 'jurisdiction', 'document date', 'source hash'] },
  { id: 'usgs-03378500', dataset: 'Wabash River at New Harmony 03378500', authority: 'USGS', purpose: 'Hydrologic observations and model boundary conditions', status: 'requires_download', sourceUrl: 'https://waterdata.usgs.gov/monitoring-location/USGS-03378500/', validation: ['station identifier', 'parameter', 'time zone', 'provisional/final status', 'datum metadata'] },
  { id: 'usgs-sir-2016-5119', dataset: 'New Harmony flood-inundation study', authority: 'USGS', purpose: 'Existing inundation evidence/model comparison', status: 'requires_download', sourceUrl: 'https://pubs.usgs.gov/publication/sir20165119', validation: ['model scope', 'gage linkage', 'depth-grid metadata', 'shapefile metadata'] },
  { id: 'posey-parcels', dataset: 'County parcel boundaries', authority: 'Posey County / authoritative GIS custodian', purpose: 'Parcel-level digital twin', status: 'requires_download', sourceUrl: 'https://www.poseycountyin.gov/', validation: ['custodian', 'publication date', 'parcel identifiers', 'PII policy', 'CRS'] },
  { id: 'roads-bridges', dataset: 'Road, bridge, culvert and emergency-route inventory', authority: 'Posey County / INDOT / local agencies', purpose: 'Critical infrastructure resilience', status: 'requires_download', sourceUrl: 'https://www.in.gov/indot/', validation: ['asset identifier', 'jurisdiction', 'condition', 'flood exposure', 'source date'] },
  { id: 'legal-drains', dataset: 'Legal drains / drainage infrastructure', authority: 'Posey County Drainage Board / county records', purpose: 'Drainage system modeling', status: 'requires_download', sourceUrl: 'https://www.poseycountyin.gov/', validation: ['legal-drain identifier', 'jurisdiction', 'maintenance authority', 'geometry', 'source record'] },
  { id: 'lidar-dem', dataset: 'Indiana LiDAR / DEM / orthophotography', authority: 'Indiana GIS / state and federal elevation programs', purpose: 'Terrain and digital twin modeling', status: 'requires_download', sourceUrl: 'https://www.in.gov/indot/', validation: ['collection project', 'point density/resolution', 'vertical accuracy', 'horizontal CRS', 'vertical datum', 'source hash'] },
];
