export interface OsrmCoordinate {
  readonly longitude: number;
  readonly latitude: number;
}
export interface OsrmRouteRequest {
  readonly coordinates: readonly OsrmCoordinate[];
  readonly alternatives?: boolean;
  readonly steps?: boolean;
  readonly overview?: 'false' | 'simplified' | 'full';
}
export interface OsrmRouteResponse {
  readonly provider: 'osrm';
  readonly profile: string;
  readonly authority_class: 'DERIVED';
  readonly source_uri: string;
  readonly route: readonly unknown[];
  readonly waypoints: readonly unknown[];
}
function assertCoordinate(coordinate: OsrmCoordinate): void {
  if (!Number.isFinite(coordinate.longitude) || !Number.isFinite(coordinate.latitude)) throw new TypeError('OSRM coordinates must be finite');
  if (coordinate.longitude < -180 || coordinate.longitude > 180 || coordinate.latitude < -90 || coordinate.latitude > 90) throw new RangeError('OSRM coordinate outside WGS84 bounds');
}
export async function requestOsrmRoute(request: OsrmRouteRequest, signal?: AbortSignal): Promise<OsrmRouteResponse> {
  if (request.coordinates.length < 2 || request.coordinates.length > 25) throw new RangeError('OSRM route requires 2-25 coordinates');
  request.coordinates.forEach(assertCoordinate);
  const url = new URL('/api/routing/route', window.location.origin);
  url.searchParams.set('coordinates', request.coordinates.map((point) => `${point.longitude},${point.latitude}`).join(';'));
  url.searchParams.set('alternatives', String(Boolean(request.alternatives)));
  url.searchParams.set('steps', String(Boolean(request.steps)));
  url.searchParams.set('overview', request.overview || 'false');
  const response = await fetch(url, { signal, credentials: 'same-origin', headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`TSM routing request failed: HTTP ${response.status}`);
  return response.json() as Promise<OsrmRouteResponse>;
}
