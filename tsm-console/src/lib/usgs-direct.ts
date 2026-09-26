/**
 * Direct USGS Water Data API (OGC) fallback — browser-safe public endpoint.
 * Prefer TSM /api/hydrologic/* when the Node plane is available.
 * Vertical datum for parameter 00065 remains GAGE_DATUM (not NAVD88).
 */

const USGS_OGC_LATEST =
  'https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items';

export interface UsgsDirectObservation {
  stationId: string;
  parameterCode: string;
  value: number;
  unit: string | null;
  observedAt: string;
  retrievedAt: string;
  sourceUri: string;
  verticalDatum: 'GAGE_DATUM';
  provider: 'USGS';
}

export async function fetchUsgsLatestContinuous(
  stationId: string,
  parameterCodes: string[] = ['00065', '00060'],
  options: { timeoutMs?: number; fetcher?: typeof fetch } = {},
): Promise<UsgsDirectObservation[]> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const url = new URL(USGS_OGC_LATEST);
  url.searchParams.set('f', 'json');
  url.searchParams.set('monitoring_location_id', `USGS-${stationId}`);
  url.searchParams.set('parameter_code', parameterCodes.join(','));
  url.searchParams.set('limit', String(Math.max(parameterCodes.length * 2, 4)));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`USGS OGC HTTP ${response.status}`);
    const payload = (await response.json()) as {
      features?: Array<{ properties?: Record<string, unknown> }>;
    };
    const retrievedAt = new Date().toISOString();
    const features = Array.isArray(payload.features) ? payload.features : [];
    const out: UsgsDirectObservation[] = [];
    for (const feature of features) {
      const p = feature.properties || {};
      const code = String(p.parameter_code || '');
      const raw = p.value;
      const value = typeof raw === 'number' ? raw : Number(raw);
      if (!code || !Number.isFinite(value) || value === -999) continue;
      const observedAt = typeof p.time === 'string' ? p.time : retrievedAt;
      out.push({
        stationId,
        parameterCode: code,
        value,
        unit: typeof p.unit_of_measure === 'string' ? p.unit_of_measure : null,
        observedAt,
        retrievedAt,
        sourceUri: url.toString(),
        verticalDatum: 'GAGE_DATUM',
        provider: 'USGS',
      });
    }
    if (!out.length) throw new Error('USGS OGC returned no usable observations');
    return out;
  } finally {
    clearTimeout(timer);
  }
}
