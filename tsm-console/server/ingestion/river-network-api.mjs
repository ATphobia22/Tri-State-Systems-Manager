import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchUsgsInstantaneousValues, fetchUsgsStationMetadata } from './usgs-nwis.mjs';
import { fetchNoaaStageFlow } from './noaa-nwps.mjs';
import { normalizeRiverObservation, classifyFreshness } from './river-network.mjs';

const registryPath = resolve(import.meta.dirname, '../../../artifacts/tsm-river-valley-realtime-stations-v1.json');
const JT_MYERS_STATION_ID = '03322420';
const DEFAULT_TIMEOUT_MS = 10000;

export async function loadRiverStationRegistry() {
  return JSON.parse(await readFile(registryPath, 'utf8'));
}

const latest = (records, parameterCode = null) => records
  .filter((record) => parameterCode === null || record.provenance?.parameterCode === parameterCode)
  .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
  .at(-1) || null;

function createTimeoutController(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timer };
}

async function loadLastKnownGood(cacheManager, stationId, frame) {
  if (!cacheManager?.loadLastKnownGood) return frame;
  try {
    const cached = await cacheManager.loadLastKnownGood(stationId, frame);
    if (!cached || typeof cached !== 'object') return frame;
    const observedAt = cached.observedAt || cached.timestamp || null;
    const ageSeconds = observedAt ? Math.max(0, (Date.now() - Date.parse(observedAt)) / 1000) : null;
    return {
      ...frame,
      ...cached,
      state: 'STALE_CACHE',
      cacheState: 'LAST_KNOWN_GOOD',
      cacheAgeSeconds: Number.isFinite(ageSeconds) ? Math.floor(ageSeconds) : null,
      liveObservation: false,
    };
  } catch (error) {
    return {
      ...frame,
      state: 'SOURCE_UNAVAILABLE',
      cacheState: 'CACHE_UNAVAILABLE',
      cacheError: error instanceof Error ? error.message : String(error),
      liveObservation: false,
    };
  }
}

async function writeLastKnownGood(cacheManager, stationId, frame) {
  if (cacheManager?.writeCache) await cacheManager.writeCache(stationId, frame);
  return frame;
}

function validateJtMyersMetadata(metadata) {
  const feature = metadata?.payload?.features?.[0];
  const properties = feature?.properties || {};
  const stationNumber = String(
    properties.monitoring_location_number ||
    properties.monitoring_location_id ||
    ''
  ).replace(/^USGS-/, '');
  if (stationNumber && stationNumber !== JT_MYERS_STATION_ID) {
    throw new TypeError(`USGS metadata station mismatch: expected ${JT_MYERS_STATION_ID}, received ${stationNumber}`);
  }
  return {
    sourceId: metadata?.sourceId || null,
    sourceUri: metadata?.sourceUri || null,
    retrievedAt: metadata?.retrievedAt || null,
    monitoringLocationName: properties.monitoring_location_name || null,
    latitude: properties.latitude ?? null,
    longitude: properties.longitude ?? null,
  };
}

/**
 * Active J.T. Myers observation adapter.
 *
 * IMPORTANT: 03322420 is the verified USGS Uniontown Dam/tailwater station
 * associated with John T. Myers Locks and Dam in the TSM registry. 03322000
 * remains the distinct Ohio River at Evansville station and is never relabeled.
 */
export async function ingestJTMyersTelemetry(cacheManager = null) {
  const { controller, timer } = createTimeoutController();
  const telemetryFrame = {
    gauge_id: `USGS-${JT_MYERS_STATION_ID}`,
    infrastructure: 'John T. Myers Locks and Dam',
    timestamp: new Date().toISOString(),
    water_level_stage_ft: null,
    discharge_cfs: null,
    state: 'SOURCE_UNAVAILABLE',
    cacheState: 'NONE',
    liveObservation: false,
    source: 'USGS Water Data API V1',
  };

  try {
    const metadata = await fetchUsgsStationMetadata({
      stationId: JT_MYERS_STATION_ID,
      signal: controller.signal,
    });
    const stationMetadata = validateJtMyersMetadata(metadata);
    const records = await fetchUsgsInstantaneousValues({
      stationIds: [JT_MYERS_STATION_ID],
      parameterCodes: ['00065', '00060'],
      signal: controller.signal,
    });
    const stage = latest(records, '00065');
    const discharge = latest(records, '00060');

    if (!stage) {
      return await loadLastKnownGood(cacheManager, JT_MYERS_STATION_ID, {
        ...telemetryFrame,
        state: 'STALE',
        stationMetadata,
      });
    }

    const observation = normalizeRiverObservation({
      stationId: JT_MYERS_STATION_ID,
      provider: 'USGS',
      observedAt: stage.observedAt,
      retrievedAt: stage.retrievedAt,
      value: stage.value,
      unit: stage.unit || 'ft',
      parameterCode: '00065',
      qualifier: stage.provenance?.qualifier || null,
      verticalDatum: stage.verticalDatum || 'GAGE_DATUM',
      sourceUri: stage.sourceUri,
    });

    const frame = {
      ...telemetryFrame,
      timestamp: observation.observedAt,
      observedAt: observation.observedAt,
      retrievedAt: observation.retrievedAt,
      water_level_stage_ft: observation.value,
      discharge_cfs: discharge?.value ?? null,
      dischargeObservedAt: discharge?.observedAt ?? null,
      verticalDatum: observation.verticalDatum,
      quality: observation.provenance?.qualifier || null,
      observation,
      stationMetadata,
      state: 'LIVE_OBSERVATION',
      cacheState: 'CURRENT',
      liveObservation: true,
      freshness: classifyFreshness(observation.observedAt, Date.now(), 1800),
    };

    return await writeLastKnownGood(cacheManager, JT_MYERS_STATION_ID, frame);
  } catch (error) {
    const fallback = await loadLastKnownGood(cacheManager, JT_MYERS_STATION_ID, telemetryFrame);
    if (fallback.state === 'STALE_CACHE') return fallback;
    return {
      ...fallback,
      state: 'SOURCE_UNAVAILABLE',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

const USGS_BATCH_TIMEOUT_MS = 30000;

async function fetchUsgsBatch(stationIds, signal) {
  return fetchUsgsInstantaneousValues({
    stationIds,
    parameterCodes: ['00065', '00060'],
    signal,
  });
}

/**
 * Build a per-station frame from a batched USGS record set (no per-station
 * fetch — see fetchRiverNetwork).
 */
function usgsStationFrame(station, records) {
  const stationRecords = records.filter((record) => record.provenance?.stationId === station.station_id);
  const stage = latest(stationRecords, '00065');
  const discharge = latest(stationRecords, '00060');
  if (!stage) return { stationId: station.station_id, provider: 'USGS', status: 'unavailable', sourceUri: station.source_uri || null };
  const observation = normalizeRiverObservation({
    stationId: station.station_id,
    provider: 'USGS',
    observedAt: stage.observedAt,
    retrievedAt: stage.retrievedAt,
    value: stage.value,
    unit: stage.unit || 'ft',
    parameterCode: '00065',
    qualifier: stage.provenance?.qualifier || null,
    verticalDatum: stage.verticalDatum || station.vertical_datum || 'GAGE_DATUM',
    sourceUri: station.source_uri || stage.sourceUri,
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
  const { controller, timer } = createTimeoutController();
  try {
    const records = await fetchNoaaStageFlow({ identifier: nwsId, product: 'observed', signal: controller.signal });
    const stage = latest(records);
    if (!stage) return { stationId: station.station_id, provider: 'NOAA', status: 'unavailable' };
    const observation = normalizeRiverObservation({
      stationId: station.station_id,
      provider: 'NOAA',
      observedAt: stage.observedAt,
      retrievedAt: stage.retrievedAt,
      value: stage.value,
      unit: stage.unit || 'ft',
      parameterCode: 'NWPS_STAGE',
      qualifier: stage.provenance?.qualifier || null,
      verticalDatum: 'GAGE_DATUM',
      sourceUri: `https://api.water.noaa.gov/nwps/v1/gauges/${encodeURIComponent(nwsId)}/observed`,
    });
    return {
      stationId: station.station_id,
      provider: 'NOAA',
      nwsId,
      observation,
      freshness: classifyFreshness(observation.observedAt, Date.now(), 1800),
      status: 'current_or_provisional',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRiverNetwork({ stationIds = null, includeNoaa = true } = {}) {
  const registry = await loadRiverStationRegistry();
  const selected = registry.verified_observation_stations.filter((station) => !stationIds || stationIds.includes(station.station_id));

  // Batch every USGS station into ONE latest-continuous request (comma-joined
  // monitoring_location_id) instead of one request per station (N+1 → 1).
  const usgsStationIds = [...new Set(selected.map((station) => station.station_id))];
  let usgsRecords = [];
  let usgsBatchError = null;
  if (usgsStationIds.length > 0) {
    try {
      usgsRecords = await fetchUsgsBatch(usgsStationIds, AbortSignal.timeout(USGS_BATCH_TIMEOUT_MS));
    } catch (error) {
      usgsBatchError = error;
    }
  }
  const usgsErrorMessage = () => (usgsBatchError instanceof Error ? usgsBatchError.message : String(usgsBatchError));

  const results = await Promise.all(selected.map(async (station) => {
    try {
      if (includeNoaa && station.nws_location_id) {
        try {
          return await fetchNoaaGauge(station.nws_location_id, station);
        } catch (noaaError) {
          const upstreamError = noaaError instanceof Error ? noaaError.message : String(noaaError);
          if (usgsBatchError) {
            return {
              stationId: station.station_id,
              provider: 'NOAA/USGS',
              name: station.name,
              status: 'unavailable',
              error: usgsErrorMessage(),
              fallbackFrom: 'NOAA',
              upstreamError,
            };
          }
          return { ...usgsStationFrame(station, usgsRecords), fallbackFrom: 'NOAA', upstreamError };
        }
      }
      if (usgsBatchError) {
        return { stationId: station.station_id, provider: station.provider, name: station.name, status: 'unavailable', error: usgsErrorMessage() };
      }
      return usgsStationFrame(station, usgsRecords);
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
