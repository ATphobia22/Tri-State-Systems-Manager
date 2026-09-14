import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchUsgsInstantaneousValues } from './usgs-nwis.mjs';
import { fetchNoaaStageFlow } from './noaa-nwps.mjs';
import { normalizeRiverObservation, classifyFreshness } from './river-network.mjs';

const registryPath = resolve(import.meta.dirname, '../../../artifacts/tsm-river-valley-realtime-stations-v1.json');

export async function loadRiverStationRegistry() {
  return JSON.parse(await readFile(registryPath, 'utf8'));
}

const latest = (records, parameterCode = null) => records
  .filter((record) => parameterCode === null || record.provenance?.parameterCode === parameterCode)
  .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
  .at(-1) || null;

async function fetchUsGsStation(station) {
  const records = await fetchUsgsInstantaneousValues({ stationIds: [station.station_id], parameterCodes: station.variables.filter((code) => code === '00065' || code === '00060') });
  const stage = latest(records, '00065');
  const discharge = latest(records, '00060');
  if (!stage) return { stationId: station.station_id, provider: 'USGS', status: 'unavailable', sourceUri: station.source_uri || null };
  const observation = normalizeRiverObservation({
    stationId: station.station_id,
    provider: 'USGS',
    observedAt: stage.observedAt,
    retrievedAt: stage.retrievedAt,
    value: stage.value,
    unit: 'ft',
    parameterCode: '00065',
    qualifier: stage.provenance?.qualifier || null,
    verticalDatum: station.vertical_datum || null,
    sourceUri: station.source_uri || `https://waterdata.usgs.gov/monitoring-location/USGS-${station.station_id}/`,
  });
  return {
    stationId: station.station_id,
    provider: 'USGS',
    name: station.name,
    observation,
    freshness: classifyFreshness(observation.observedAt, Date.now(), 1800),
    dischargeCfs: discharge?.value ?? null,
    dischargeObservedAt: discharge?.observedAt ?? null,
    status: 'current_or_provisional',
  };
}

async function fetchNoaaGauge(nwsId, station) {
  const records = await fetchNoaaStageFlow({ identifier: nwsId, product: 'observed' });
  const stage = latest(records);
  if (!stage) return { stationId: station.station_id, provider: 'NOAA', status: 'unavailable' };
  const observation = normalizeRiverObservation({
    stationId: station.station_id,
    provider: 'NOAA',
    observedAt: stage.observedAt,
    retrievedAt: stage.retrievedAt,
    value: stage.value,
    unit: 'ft',
    parameterCode: 'NWPS_STAGE',
    qualifier: stage.provenance?.qualifier || null,
    verticalDatum: 'GAGE_DATUM',
    sourceUri: `https://api.water.noaa.gov/nwps/v1/gauges/${encodeURIComponent(nwsId)}/observed`,
  });
  return { stationId: station.station_id, provider: 'NOAA', nwsId, observation, freshness: classifyFreshness(observation.observedAt, Date.now(), 1800), status: 'current_or_provisional' };
}

export async function fetchRiverNetwork({ stationIds = null, includeNoaa = true } = {}) {
  const registry = await loadRiverStationRegistry();
  const selected = registry.verified_observation_stations.filter((station) => !stationIds || stationIds.includes(station.station_id));
  const results = await Promise.all(selected.map(async (station) => {
    try {
      if (includeNoaa && station.nws_location_id) return await fetchNoaaGauge(station.nws_location_id, station);
      return await fetchUsGsStation(station);
    } catch (error) {
      return { stationId: station.station_id, provider: station.provider, name: station.name, status: 'unavailable', error: error instanceof Error ? error.message : String(error) };
    }
  }));
  return {
    generatedAt: new Date().toISOString(),
    registryVersion: registry.version,
    candidateStructures: registry.candidate_structures,
    observations: results,
    authority: 'USGS/NOAA observations; TSM-derived influence only',
  };
}
