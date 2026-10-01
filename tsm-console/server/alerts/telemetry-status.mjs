export function detectTelemetrySourceFailures(event) {
  const payload = event?.payload && typeof event.payload === 'object'
    ? event.payload
    : event;

  const readings = Array.isArray(payload) ? payload : [payload];
  return readings
    .filter((reading) => reading && typeof reading === 'object' && reading.status === 'SOURCE_UNAVAILABLE')
    .map((reading) => ({
      station_id: typeof reading.station_id === 'string' ? reading.station_id : 'UNKNOWN_ID',
      station_name: typeof reading.station_name === 'string' ? reading.station_name : 'UNKNOWN_STATION',
      observed_at: typeof event?.observed_at === 'string' ? event.observed_at : new Date().toISOString(),
      alert_code: 'STATION_FAIL_CLOSED',
      status: 'SOURCE_UNAVAILABLE',
    }));
}
