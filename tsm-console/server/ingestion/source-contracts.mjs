const DATA_CLASSES = new Set(['observation', 'forecast', 'simulation', 'derived', 'evidence', 'regulatory-reference']);
const STATUSES = new Set(['current', 'provisional', 'stale', 'unavailable', 'error']);

export const SOURCE_CATALOG = Object.freeze([
  Object.freeze({ id: 'USGS-NWIS-IV', authority: 'USGS', endpoint: 'https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous', cadence: 'real-time', formats: ['JSON', 'GeoJSON'], authorityNote: 'Modern USGS Water Data API runtime; raw stage 00065 remains GAGE_DATUM. Legacy WaterServices is compatibility-only.' }),
  Object.freeze({ id: 'USGS-TNM', authority: 'USGS National Geospatial Program / 3DEP', endpoint: 'https://tnmaccess.nationalmap.gov/api/v1/products', cadence: 'on-demand', formats: ['JSON', 'LAS', 'LAZ', 'GeoTIFF'], authorityNote: 'Programmatic 3DEP product discovery; persist provenance rather than bulk redistribution.' }),
  Object.freeze({ id: 'USGS-3DEP-INDEX', authority: 'USGS National Geospatial Program / 3DEP', endpoint: 'https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer', cadence: 'reference', formats: ['JSON', 'GeoJSON', 'PBF'], authorityNote: 'Elevation and lidar coverage index.' }),
  Object.freeze({ id: 'NOAA-NWPS', authority: 'NOAA/NWS Office of Water Prediction', endpoint: 'https://api.water.noaa.gov/nwps/v1/', cadence: 'real-time', formats: ['JSON'], authorityNote: 'Observed and forecast products remain separate; NWPS is preferred for observed stage when available.' }),
  Object.freeze({ id: 'FEMA-NFHL', authority: 'FEMA', endpoint: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer', cadence: 'reference', formats: ['JSON', 'GeoJSON', 'PBF'], authorityNote: 'Effective flood insurance reference; TSM does not issue insurance determinations.' }),
  Object.freeze({ id: 'INDIANA-BAFM', authority: 'Indiana DNR Division of Water', endpoint: 'https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer', cadence: 'reference', formats: ['JSON', 'GeoJSON', 'PBF'], authorityNote: 'Planning/construction/Indiana Flood Control Act reference; not flood insurance.' }),
  Object.freeze({ id: 'INDIANA-PARCELS', authority: 'Indiana Geographic Information Office / local governments', endpoint: 'https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_Current/FeatureServer', cadence: 'periodic', formats: ['JSON', 'GeoJSON', 'PBF'], authorityNote: 'Current statewide Data Harvest parcel geometry; query with spatial geometry filter.' }),
  Object.freeze({ id: 'INDIANA-PLSS', authority: 'Indiana Geographic Information Office / DNR', endpoint: 'https://gisdata.in.gov/server/rest/services/Hosted/PLSS_Indiana_State_Boundary/FeatureServer', cadence: 'reference', formats: ['JSON', 'GeoJSON', 'PBF'], authorityNote: 'PLSS legal-description reference.' }),
  Object.freeze({ id: 'POSEY-CSLF', authority: 'Indiana Geographic Information Office', endpoint: 'https://gisdata.in.gov/server/rest/services/Hosted/Posey_CSLF_Feb2025/FeatureServer', cadence: 'reference', formats: ['JSON', 'GeoJSON', 'PBF'], authorityNote: 'Posey preliminary/pending map-change evidence.' }),
  Object.freeze({ id: 'INDIANA-CURRENT-IMAGERY', authority: 'Indiana Geographic Information Office', endpoint: 'https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer', cadence: 'current-service', formats: ['ImageServer', 'tiles'], authorityNote: 'Current Indiana imagery surface for visualization; imagery is not flood regulatory evidence.' }),
  Object.freeze({ id: 'USACE-NLD', authority: 'USACE', endpoint: 'https://levees.sec.army.mil/api-local', cadence: 'reference', formats: ['JSON', 'GeoJSON'], authorityNote: 'Read-only levee Evidence plane; no automatic accreditation decision.' }),
  Object.freeze({ id: 'USGS-BASEMAPS', authority: 'USGS National Geospatial Program', endpoint: 'https://basemap.nationalmap.gov/arcgis/rest/services', cadence: 'reference', formats: ['MapServer'], authorityNote: 'National Map cached basemaps.' }),
]);

function requireNonEmptyString(record, field) {
  if (typeof record[field] !== 'string' || record[field].trim() === '') throw new TypeError(`source record requires non-empty ${field}`);
}
function requireIsoTimestamp(record, field) {
  requireNonEmptyString(record, field);
  if (Number.isNaN(Date.parse(record[field]))) throw new TypeError(`source record ${field} must be an ISO-8601 timestamp`);
}
export function assertSourceRecord(record) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) throw new TypeError('source record must be an object');
  requireNonEmptyString(record, 'sourceId'); requireNonEmptyString(record, 'sourceUri'); requireIsoTimestamp(record, 'observedAt'); requireIsoTimestamp(record, 'retrievedAt');
  requireNonEmptyString(record, 'unit'); requireNonEmptyString(record, 'crs'); requireNonEmptyString(record, 'verticalDatum');
  if (!STATUSES.has(record.status)) throw new TypeError(`unsupported status: ${String(record.status)}`);
  if (!DATA_CLASSES.has(record.dataClass)) throw new TypeError(`unsupported dataClass: ${String(record.dataClass)}`);
  if (record.provenance === null || typeof record.provenance !== 'object' || Array.isArray(record.provenance)) throw new TypeError('source record requires provenance object');
  requireNonEmptyString(record.provenance, 'provider');
  return Object.freeze(record);
}
export { DATA_CLASSES, STATUSES };
