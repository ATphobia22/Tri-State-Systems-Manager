const DEFAULT_TIMEOUT_MS = 5000;
const MAX_COORDINATES = 25;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function finiteCoordinate(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${name} must be finite`);
  return number;
}
function validateCoordinate([longitude, latitude]) {
  const lon = finiteCoordinate(longitude, 'longitude');
  const lat = finiteCoordinate(latitude, 'latitude');
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) throw new RangeError('coordinate outside WGS84 bounds');
  return [lon, lat];
}
export function getOsrmConfig(env = process.env) {
  const baseUrl = String(env.TSM_OSRM_BASE_URL || 'http://osrm:5000').trim().replace(/\/+$/, '');
  const profile = String(env.TSM_OSRM_PROFILE || 'driving').trim();
  const timeoutMs = Math.min(30000, Math.max(250, Number(env.TSM_OSRM_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)));
  if (!/^https?:\/\//.test(baseUrl)) throw new Error('TSM_OSRM_BASE_URL must use http or https');
  if (!['driving', 'walking', 'cycling'].includes(profile)) throw new Error(`unsupported OSRM profile: ${profile}`);
  return { baseUrl, profile, timeoutMs };
}
export async function routeOsrm({ coordinates, alternatives = false, steps = false, overview = 'false' }, env = process.env) {
  if (!Array.isArray(coordinates) || coordinates.length < 2 || coordinates.length > MAX_COORDINATES) throw new RangeError(`coordinates must contain 2-${MAX_COORDINATES} points`);
  const normalized = coordinates.map(validateCoordinate);
  const config = getOsrmConfig(env);
  const query = new URLSearchParams({ alternatives: String(Boolean(alternatives)), steps: String(Boolean(steps)), overview });
  const coordinatePath = normalized.map(([lon, lat]) => `${lon},${lat}`).join(';');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}/route/v1/${config.profile}/${coordinatePath}?${query}`, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`OSRM returned HTTP ${response.status}`);
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_RESPONSE_BYTES) throw new Error('OSRM response exceeds configured size limit');
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) throw new Error('OSRM response exceeds configured size limit');
    const body = JSON.parse(text);
    if (body?.code !== 'Ok') throw new Error(`OSRM route failed: ${body?.message || body?.code || 'unknown error'}`);
    if (!Array.isArray(body.routes) || body.routes.length > 10) throw new Error('OSRM returned an invalid route collection');
    return { provider: 'osrm', profile: config.profile, authority_class: 'DERIVED', source_uri: `${config.baseUrl}/route/v1/${config.profile}`, route: body.routes, waypoints: body.waypoints };
  } finally { clearTimeout(timer); }
}
