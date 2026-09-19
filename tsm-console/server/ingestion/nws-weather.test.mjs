import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchNwsForecastHourly, fetchNwsObservation, fetchNwsPoint } from './nws-weather.mjs';

test('NWS weather fabric resolves official NWS point metadata', async () => {
  const result = await fetchNwsPoint({
    latitude: 37.99,
    longitude: -87.76,
    request: async () => ({
      properties: {
        forecastHourly: 'https://api.weather.gov/gridpoints/PAH/1,2/forecast/hourly',
        observationStations: 'https://api.weather.gov/gridpoints/PAH/1,2/stations',
        radarStation: 'KPAH',
        gridId: 'PAH',
        gridX: 1,
        gridY: 2,
      },
    }),
  });
  assert.equal(result.radarStation, 'KPAH');
});

test('NWS weather fabric normalizes hourly forecast data without inventing values', async () => {
  const result = await fetchNwsForecastHourly({
    forecastUrl: 'https://api.weather.gov/gridpoints/PAH/1,2/forecast/hourly',
    request: async () => ({
      properties: {
        periods: [{
          number: 1,
          startTime: '2026-09-19T12:00:00-05:00',
          endTime: '2026-09-19T13:00:00-05:00',
          isDaytime: true,
          temperature: 78,
          temperatureUnit: 'F',
          windSpeed: '8 mph',
          windDirection: 'SW',
          probabilityOfPrecipitation: { value: 30 },
          shortForecast: 'Chance Showers',
        }],
      },
    }),
  });
  assert.equal(result.periods[0].temperature, 78);
  assert.equal(result.periods[0].probabilityOfPrecipitation, 30);
});

test('NWS weather fabric normalizes latest station observations', async () => {
  const result = await fetchNwsObservation({
    stationId: 'KPAH',
    request: async () => ({
      properties: {
        '@id': 'https://api.weather.gov/stations/KPAH/observations/1',
        timestamp: '2026-09-19T16:00:00Z',
        stationIdentifier: 'KPAH',
        temperature: { value: 24 },
        windSpeed: '5 mph',
        barometricPressure: { value: 101325 },
      },
    }),
  });
  assert.equal(result.stationId, 'KPAH');
  assert.equal(result.temperatureC, 24);
});

test('NWS weather fabric rejects non-NWS forecast endpoints', async () => {
  await assert.rejects(
    fetchNwsForecastHourly({
      forecastUrl: 'https://example.com/weather',
      request: async () => ({}),
    }),
  );
});
