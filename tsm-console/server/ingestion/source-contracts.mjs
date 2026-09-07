const DATA_CLASSES = new Set([
  'observation',
  'forecast',
  'simulation',
  'derived',
  'evidence',
  'regulatory-reference',
]);

const STATUSES = new Set(['current', 'provisional', 'stale', 'unavailable', 'error']);

function requireNonEmptyString(record, field) {
  if (typeof record[field] !== 'string' || record[field].trim() === '') {
    throw new TypeError(`source record requires non-empty ${field}`);
  }
}

function requireIsoTimestamp(record, field) {
  requireNonEmptyString(record, field);
  if (Number.isNaN(Date.parse(record[field]))) {
    throw new TypeError(`source record ${field} must be an ISO-8601 timestamp`);
  }
}

export function assertSourceRecord(record) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('source record must be an object');
  }

  requireNonEmptyString(record, 'sourceId');
  requireNonEmptyString(record, 'sourceUri');
  requireIsoTimestamp(record, 'observedAt');
  requireIsoTimestamp(record, 'retrievedAt');
  requireNonEmptyString(record, 'unit');
  requireNonEmptyString(record, 'crs');
  requireNonEmptyString(record, 'verticalDatum');

  if (!STATUSES.has(record.status)) {
    throw new TypeError(`unsupported status: ${String(record.status)}`);
  }
  if (!DATA_CLASSES.has(record.dataClass)) {
    throw new TypeError(`unsupported dataClass: ${String(record.dataClass)}`);
  }
  if (record.provenance === null || typeof record.provenance !== 'object' || Array.isArray(record.provenance)) {
    throw new TypeError('source record requires provenance object');
  }

  requireNonEmptyString(record.provenance, 'provider');
  return Object.freeze(record);
}

export { DATA_CLASSES, STATUSES };
