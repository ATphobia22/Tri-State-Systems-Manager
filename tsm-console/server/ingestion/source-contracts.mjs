const DATA_CLASSES = new Set(['observation', 'forecast', 'simulation', 'derived', 'evidence', 'regulatory-reference']);
const STATUSES = new Set(['current', 'provisional', 'stale', 'unavailable', 'error']);

export const SOURCE_CATALOG = Object.freeze([
  Object.freeze({ id: 'USGS-NWIS-IV', authority: 'USGS', endpoint: 'https://waterservices.usgs.gov/nwis/iv/', cadence: 'real-time', formats: ['JSON', 'RDB'], authorityNote: 'Raw stage parameter 00065 remains GAGE_DATUM.' }),
  Object.freeze({ id: 'USGS-TNM', authority: 'USGS National Map / 3DEP', endpoint: 'https://tnmaccess.nationalmap.gov/api/v1/products', cadence: 'on-demand', formats: ['JSON', 'LAS', 'LAZ', 'GeoTIFF'], authorityNote: 'Product metadata and quality references are retained.' }),
  Object.freeze({ id: 'NOAA-NWPS', authority: 'NOAA/NWS', endpoint: 'https://api.water.noaa.gov/nwps/v1/', cadence: 'real-time', formats: ['JSON'], authorityNote: 'Observed and forecast products remain separate.' }),
  Object.freeze({ id: 'FEMA-NFHL', authority: 'FEMA', endpoint: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer', cadence: 'reference', formats: ['JSON', 'GeoJSON', 'PBF'], authorityNote: 'Regulatory-reference layers; TSM does not issue determinations.' }),
  Object.freeze({ id: 'IDNR-BAFL', authority: 'Indiana DNR Division of Water', endpoint: 'https://www.in.gov/dnr/water/', cadence: 'reference', formats: ['GIS'], authorityNote: 'State floodplain reference; preserve published status.' }),
  Object.freeze({ id: 'INDIANA-GIS', authority: 'Indiana Geographic Information Office', endpoint: 'https://gisdata.in.gov/server/rest/', cadence: 'reference', formats: ['JSON', 'GeoJSON', 'PBF'], authorityNote: 'Preserve each service native CRS.' }),
  Object.freeze({ id: 'USACE-NLD', authority: 'USACE', endpoint: 'https://nld.sec.usace.army.mil/data-services/services/', cadence: 'reference', formats: ['JSON', 'GeoJSON', 'WMS', 'WFS'], authorityNote: 'National levee geospatial reference.' }),
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
