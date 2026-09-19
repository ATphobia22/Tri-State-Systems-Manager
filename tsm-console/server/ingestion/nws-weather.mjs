import { requestJson } from './http-client.mjs';
import { recordSourceHealth } from './source-health.mjs';

const BASE_URL = 'https://api.weather.gov';

function requireFiniteCoordinate(value, name, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) throw new TypeError(name + ' is out of range');
}

export async function fetchNwsPoint({ latitude, longitude, signal, request = requestJson }) {
  requireFiniteCoordinate(latitude, 'latitude', -90, 90);
  requireFiniteCoordinate(longitude, 'longitude', -180, 180);
  const url = new URL(BASE_URL + '/points/' + latitude + ',' + longitude);
  const retrievedAt = new Date().toISOString();
  const payload = await request(url, {
    signal, timeoutMs: 10000, maxBytes: 1000000,
    headers: { Accept: 'application/geo+json, application/ld+json;q=0.9, application/json;q=0.8', 'User-Agent': 'Tri-State-Systems-Manager/1.0' },
  });
  const properties = payload?.properties;
  if (typeof properties?.forecastHourly !== 'string' || typeof properties?.observationStations !== 'string') {
    throw new TypeError('NWS point response missing forecast or observation station URLs');
  }
  return Object.freeze({
    sourceId: 'NWS-WEATHER-POINT', sourceUri: url.toString(), retrievedAt,
    forecastHourlyUrl: properties.forecastHourly,
    observationStationsUrl: properties.observationStations,
    forecastGridDataUrl: properties.forecastGridData || null,
    radarStation: properties.radarStation || null,
    gridId: properties.gridId || null,
    gridX: Number.isInteger(properties.gridX) ? properties.gridX : null,
    gridY: Number.isInteger(properties.gridY) ? properties.gridY : null,
    provenance: { provider: 'NOAA National Weather Service' },
  });
}

export async function fetchNwsForecastHourly({ forecastUrl, signal, request = requestJson }) {
  if (!/^https:\/\/api\.weather\.gov\//i.test(forecastUrl)) throw new TypeError('forecastUrl must remain inside api.weather.gov');
  const payload = await request(forecastUrl, {
    signal, timeoutMs: 10000, maxBytes: 5000000,
    headers: { Accept: 'application/geo+json, application/ld+json;q=0.9, application/json;q=0.8', 'User-Agent': 'Tri-State-Systems-Manager/1.0' },
  });
  const periods = Array.isArray(payload?.properties?.periods) ? payload.properties.periods : [];
  if (!periods.length) throw new TypeError('NWS hourly forecast contains no periods');
  return Object.freeze({
    sourceId: 'NWS-WEATHER-FORECAST-HOURLY', sourceUri: forecastUrl,
    retrievedAt: new Date().toISOString(),
    periods: periods.map((period) => Object.freeze({
      number: period.number, startTime: period.startTime, endTime: period.endTime,
      isDaytime: Boolean(period.isDaytime), temperature: period.temperature,
      temperatureUnit: period.temperatureUnit, windSpeed: period.windSpeed,
      windDirection: period.windDirection,
      probabilityOfPrecipitation: period.probabilityOfPrecipitation?.value ?? null,
      shortForecast: period.shortForecast || null,
      detailedForecast: period.detailedForecast || null,
    })),
    provenance: { provider: 'NOAA National Weather Service' },
  });
}

export async function fetchNwsObservation({ stationId, signal, request = requestJson }) {
  if (!/^[A-Z0-9-]{1,32}$/i.test(stationId)) throw new TypeError('invalid NWS station identifier');
  const url = BASE_URL + '/stations/' + encodeURIComponent(stationId) + '/observations/latest';
  const payload = await request(url, {
    signal, timeoutMs: 10000, maxBytes: 1000000,
    headers: { Accept: 'application/geo+json, application/ld+json;q=0.9, application/json;q=0.8', 'User-Agent': 'Tri-State-Systems-Manager/1.0' },
  });
  const p = payload?.properties;
  if (!p?.timestamp) throw new TypeError('NWS observation timestamp is required');
  const result = Object.freeze({
    sourceId: 'NWS-WEATHER-OBSERVATION', sourceUri: p['@id'] || url,
    retrievedAt: new Date().toISOString(), observedAt: p.timestamp,
    stationId: p.stationIdentifier || null, textDescription: p.textDescription || null,
    temperatureC: Number.isFinite(p.temperature?.value) ? p.temperature.value : null,
    windSpeed: p.windSpeed || null,
    pressurePa: Number.isFinite(p.barometricPressure?.value) ? p.barometricPressure.value : null,
    provenance: { provider: 'NOAA National Weather Service', station: p.stationIdentifier || null },
  });
  recordSourceHealth('NWS-WEATHER-' + stationId, { ok: true, recordCount: 1 });
  return result;
}
