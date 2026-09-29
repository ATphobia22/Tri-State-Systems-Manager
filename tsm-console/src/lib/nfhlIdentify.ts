/**
 * FEMA NFHL MapServer point identify (presentation + insurance context).
 *
 * Source: https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer
 *
 * Fail-closed: any transport or parse failure returns SOFT_FAIL with a reason,
 * never an empty "OK". A regulatory LOMA still requires a sealed survey and
 * the FARA path — this overlay alone is not a determination.
 */

export interface NfhlIdentifyResult {
  status: 'OK' | 'SOFT_FAIL';
  reason?: string;
  results: unknown[];
  requestUrl: string;
}

const NFHL_IDENTIFY =
  'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/identify';

/** lon/lat WGS84; mapExtent is [minx, miny, maxx, maxy] around the pin. */
export async function identifyNfhlAtPoint(
  lon: number,
  lat: number,
  mapExtent?: [number, number, number, number],
): Promise<NfhlIdentifyResult> {
  const pad = 0.01;
  const extent: [number, number, number, number] = mapExtent ?? [
    lon - pad,
    lat - pad,
    lon + pad,
    lat + pad,
  ];

  const params = new URLSearchParams({
    f: 'json',
    geometry: JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    sr: '4326',
    layers: 'all',
    tolerance: '3',
    mapExtent: extent.join(','),
    imageDisplay: '800,600,96',
    returnGeometry: 'false',
  });

  const requestUrl = `${NFHL_IDENTIFY}?${params.toString()}`;

  try {
    const res = await fetch(requestUrl);
    if (!res.ok) {
      return { status: 'SOFT_FAIL', reason: `HTTP ${res.status}`, results: [], requestUrl };
    }
    const body = (await res.json()) as { results?: unknown[] };
    return { status: 'OK', results: body.results ?? [], requestUrl };
  } catch (error) {
    return {
      status: 'SOFT_FAIL',
      reason: error instanceof Error ? error.message : 'identify failed',
      results: [],
      requestUrl,
    };
  }
}
