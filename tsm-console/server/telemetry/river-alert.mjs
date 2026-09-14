import { fetchUsgsInstantaneousValues } from '../ingestion/usgs-nwis.mjs';

const DEFAULT_GAUGES = ['03378500', '03322000'];

export async function fetchUsGsStage(gaugeId) {
  const records = await fetchUsgsInstantaneousValues({ stationIds: [gaugeId], parameterCodes: ['00065'] });
  const latest = records.filter((record) => record.provenance.stationId === gaugeId).at(-1);
  if (!latest) throw new Error(`USGS ${gaugeId} returned no valid stage observation`);
  return {
    gaugeId,
    stageFt: latest.value,
    timestamp: latest.observedAt,
    source: 'USGS-WATER-DATA-API',
    verifiedLive: true,
    quality: latest.status,
    gageDatum: latest.verticalDatum,
  };
}

export async function evaluateStructureStageAlert({ gauges = DEFAULT_GAUGES, baselineFt = Number(process.env.TSM_STRUCTURE_BASELINE_FT ?? NaN) } = {}) {
  if (!Number.isFinite(baselineFt)) return { status: 'CONFIGURATION_REQUIRED', alert: false, baselineFt: null, observations: [] };
  const settled = await Promise.allSettled(gauges.map(fetchUsGsStage));
  const observations = settled.filter((result) => result.status === 'fulfilled').map((result) => result.value);
  const failures = settled.filter((result) => result.status === 'rejected').map((result) => String(result.reason?.message ?? result.reason));
  return {
    status: observations.length > 0 ? 'LIVE' : 'UNAVAILABLE',
    alert: observations.some((observation) => observation.stageFt >= baselineFt),
    baselineFt,
    observations,
    failures,
    evaluatedAt: new Date().toISOString(),
    evidenceClass: 'LIVE_OBSERVATION',
  };
}
