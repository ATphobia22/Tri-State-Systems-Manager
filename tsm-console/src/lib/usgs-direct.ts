/**
 * User-triggered, read-only USGS Water Data OGC v1 browser fallback.
 * Prefer the TSM hydrologic server API. No polling and no datum conversion.
 * A successful HTTP response does not authenticate a returned feature's identity;
 * every observation is checked against the requested station and parameter.
 */
const USGS_OGC_LATEST =
  'https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items';
const USGS_SITE_RE = /^[0-9]{8}$/;
const SUPPORTED_PARAMETER_CODES = new Set(['00065', '00060']);
const DECIMAL_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const MISSING_VALUES = new Set([-999, -9999, -8888]);
const ISO8601_TIMEZONE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;

export interface UsgsDirectObservation {
  stationId: string;
  parameterCode: string;
  value: number;
  unit: string | null;
  observedAt: string;
  retrievedAt: string;
  sourceUri: string;
  /** 00065 is on a station-specific GAGE_DATUM. Discharge (00060) has none. */
  verticalDatum: 'GAGE_DATUM' | null;
  provider: 'USGS';
  approvalStatus: string | null;
}

function parseNumericObservation(raw: unknown): number | null {
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  if (typeof raw === 'string' && !DECIMAL_RE.test(raw.trim())) return null;
  const number = typeof raw === 'number' ? raw : Number(raw.trim());
  return Number.isFinite(number) && !MISSING_VALUES.has(number) ? number : null;
}

function isObservationTimestamp(value: unknown): value is string {
  return typeof value === 'string' &&
    ISO8601_TIMEZONE_RE.test(value) &&
    Number.isFinite(Date.parse(value));
}

/** Never call from a loader, polling timer, or background task. */
export async function fetchUsgsLatestContinuous(
  stationId: string,
  parameterCodes: string[] = ['00065', '00060'],
  options: { timeoutMs?: number; fetcher?: typeof fetch } = {},
): Promise<UsgsDirectObservation[]> {
  if (!USGS_SITE_RE.test(stationId)) throw new Error('USGS_OBSERVATION_INVALID_STATION');
  if (!Array.isArray(parameterCodes) || parameterCodes.length === 0 ||
      parameterCodes.some((code) => !SUPPORTED_PARAMETER_CODES.has(code))) {
    throw new Error('USGS_OBSERVATION_UNSUPPORTED_PARAMETERS');
  }
  const requested = new Set(parameterCodes);
  const timeoutMs = options.timeoutMs ?? 8000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
    throw new Error('USGS_OBSERVATION_INVALID_TIMEOUT');
  }
  const fetcher = options.fetcher ?? fetch;
  const url = new URL(USGS_OGC_LATEST);
  url.searchParams.set('f', 'json');
  url.searchParams.set('monitoring_location_id', `USGS-${stationId}`);
  url.searchParams.set('parameter_code', [...requested].join(','));
  url.searchParams.set('limit', String(Math.max(requested.size * 2, 4)));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`USGS OGC HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !('features' in payload) ||
        !Array.isArray(payload.features)) {
      throw new Error('USGS_OBSERVATION_INVALID_FEATURE_COLLECTION');
    }
    const retrievedAt = new Date().toISOString();
    const out: UsgsDirectObservation[] = [];
    for (const feature of payload.features) {
      if (!feature || typeof feature !== 'object' || !('properties' in feature)) continue;
      const p: unknown = feature.properties;
      if (!p || typeof p !== 'object' || Array.isArray(p)) continue;
      const record = p as Record<string, unknown>;
      if (record.monitoring_location_id !== `USGS-${stationId}`) continue;
      const code = record.parameter_code;
      if (typeof code !== 'string' || !requested.has(code)) continue;
      const value = parseNumericObservation(record.value);
      if (value === null || !isObservationTimestamp(record.time)) continue;
      const unit = record.unit_of_measure;
      if (typeof unit !== 'string' || unit.trim().length === 0) continue;
      out.push({
        stationId,
        parameterCode: code,
        value,
        unit,
        observedAt: record.time,
        retrievedAt,
        sourceUri: url.toString(),
        verticalDatum: code === '00065' ? 'GAGE_DATUM' : null,
        provider: 'USGS',
        approvalStatus: typeof record.approval_status === 'string' ? record.approval_status : null,
      });
    }
    if (!out.length) throw new Error('USGS OGC returned no usable station-matched observations');
    return out;
  } finally {
    clearTimeout(timer);
  }
}
