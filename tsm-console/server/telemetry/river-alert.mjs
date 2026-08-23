const USGS_ENDPOINT = 'https://waterservices.usgs.gov/nwis/iv/';
const DEFAULT_GAUGES = ['03378500', '03322000'];

function parseStageSeries(payload) {
  const series = payload?.value?.timeSeries ?? [];
  for (const item of series) {
    const value = item?.values?.[0]?.value?.[0];
    const stage = Number(value?.value);
    if (Number.isFinite(stage)) return { stageFt: stage, timestamp: value.dateTime ?? null };
  }
  return null;
}

export async function fetchUsGsStage(gaugeId, fetchImpl = fetch) {
  const url = `${USGS_ENDPOINT}?format=json&sites=${encodeURIComponent(gaugeId)}&parameterCd=00065&siteStatus=all`;
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(5000), headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`USGS ${gaugeId} returned HTTP ${response.status}`);
  const result = parseStageSeries(await response.json());
  if (!result) throw new Error(`USGS ${gaugeId} returned no valid stage observation`);
  return { gaugeId, ...result, source: 'USGS-NWIS', verifiedLive: true };
}

export async function evaluateStructureStageAlert({
  gauges = DEFAULT_GAUGES,
  baselineFt = Number(process.env.TSM_STRUCTURE_BASELINE_FT ?? NaN),
  fetchImpl = fetch,
} = {}) {
  if (!Number.isFinite(baselineFt)) {
    return { status: 'CONFIGURATION_REQUIRED', alert: false, baselineFt: null, observations: [] };
  }
  const settled = await Promise.allSettled(gauges.map((gaugeId) => fetchUsGsStage(gaugeId, fetchImpl)));
  const observations = settled.filter((result) => result.status === 'fulfilled').map((result) => result.value);
  const failures = settled.filter((result) => result.status === 'rejected').map((result) => String(result.reason?.message ?? result.reason));
  const alert = observations.some((observation) => observation.stageFt >= baselineFt);
  return {
    status: observations.length > 0 ? 'LIVE' : 'UNAVAILABLE',
    alert,
    baselineFt,
    observations,
    failures,
    evaluatedAt: new Date().toISOString(),
    evidenceClass: 'LIVE_OBSERVATION',
  };
}
