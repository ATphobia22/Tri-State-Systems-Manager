import { describe, expect, it } from 'vitest';
import { fetchNwsForecastHourly, fetchNwsObservation, fetchNwsPoint } from './nws-weather.mjs';

describe('NWS weather fabric', () => {
  it('resolves official NWS point metadata', async () => {
    const result = await fetchNwsPoint({
      latitude: 37.99, longitude: -87.76,
      request: async () => ({ properties: {
        forecastHourly: 'https://api.weather.gov/gridpoints/PAH/1,2/forecast/hourly',
        observationStations: 'https://api.weather.gov/gridpoints/PAH/1,2/stations',
        radarStation: 'KPAH', gridId: 'PAH', gridX: 1, gridY: 2,
      }}),
    });
    expect(result.radarStation).toBe('KPAH');
  });

  it('normalizes hourly forecast data without inventing values', async () => {
    const result = await fetchNwsForecastHourly({
      forecastUrl: 'https://api.weather.gov/gridpoints/PAH/1,2/forecast/hourly',
      request: async () => ({ properties: { periods: [{
        number: 1, startTime: '2026-09-19T12:00:00-05:00', endTime: '2026-09-19T13:00:00-05:00',
        isDaytime: true, temperature: 78, temperatureUnit: 'F', windSpeed: '8 mph',
        windDirection: 'SW', probabilityOfPrecipitation: { value: 30 }, shortForecast: 'Chance Showers',
      }]}}),
    });
    expect(result.periods[0].temperature).toBe(78);
    expect(result.periods[0].probabilityOfPrecipitation).toBe(30);
  });

  it('normalizes latest station observations', async () => {
    const result = await fetchNwsObservation({
      stationId: 'KPAH',
      request: async () => ({ properties: {
        '@id': 'https://api.weather.gov/stations/KPAH/observations/1',
        timestamp: '2026-09-19T16:00:00Z', stationIdentifier: 'KPAH',
        temperature: { value: 24 }, windSpeed: '5 mph', barometricPressure: { value: 101325 },
      }}),
    });
    expect(result.stationId).toBe('KPAH');
    expect(result.temperatureC).toBe(24);
  });

  it('rejects non-NWS forecast endpoints', async () => {
    await expect(fetchNwsForecastHourly({ forecastUrl: 'https://example.com/weather', request: async () => ({}) })).rejects.toThrow();
  });
});
