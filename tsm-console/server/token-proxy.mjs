import http from 'node:http';
import { appendArtifact, listArtifacts, getArtifact, verifyProvenance, recordVerification, sha256Hex } from './store/evidence-store.mjs';
import { runHydrologicBatch, ingestUsgsNode, ingestNwpsGauge } from './ingestion/workers.mjs';
import { fetchUsgsInstantaneousValues } from './ingestion/usgs-nwis.mjs';
import { fetchNoaaStageFlow } from './ingestion/noaa-nwps.mjs';
import { listSourceHealth } from './ingestion/source-health.mjs';
import { listUpstreamCircuitHealth } from './ingestion/http-client.mjs';
import { evaluatePolicies, POLICIES } from './policy/jurisdiction-engine.mjs';
import { evaluateCompensatoryStorage, buildCompensatoryStorageCanonical } from './engineering/compensatory-storage.mjs';
import { servePoseyAsset } from './geospatial/posey-assets.mjs';
import { handleFirmRoute } from './geospatial/firm-routes.mjs';

const PORT = Number(process.env.PORT || 8787);
const BUILD_SHA = process.env.GITHUB_SHA || process.env.TSM_BUILD_SHA || 'local';
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'http://localhost:5173', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
  res.end(JSON.stringify(body));
}
function readBodyFixed(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (chunk) => { size += chunk.length; if (size > 1_000_000) { req.destroy(); reject(new Error('request body exceeds 1 MB')); return; } chunks.push(chunk); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (error) { reject(error); } });
    req.on('error', reject);
  });
}
const healthBody = () => ({ ok: true, service: 'tsm-api', build_sha: BUILD_SHA, node: process.version, uptime_s: Math.round(process.uptime()), planes: ['EVIDENCE', 'GOVERNANCE', 'ENGINEERING', 'GEOSPATIAL', 'DATA_FABRIC'] });

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  try {
    if (handleFirmRoute(req, res, url, json)) return;
    if (req.method === 'GET' && url.pathname === '/api/auth/health') return json(res, 200, { ...healthBody(), auth_model: 'keycloak_public_client_pkce', client_secret_required: false, token_proxy_path: null });
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, healthBody());
    if (req.method === 'GET' && url.pathname === '/ready') return json(res, 200, { ...healthBody(), ready: true, required_internal_dependencies: { authority_registry: true, evidence_store: true } });
    if (req.method === 'GET' && url.pathname === '/api/hydrologic/live') {
      const usgsId = url.searchParams.get('usgs_id') || '03378500';
      const nwsId = url.searchParams.get('nws_id') || 'UNWK2';
      const source = url.searchParams.get('source') || 'usgs';
      const records = source === 'noaa' ? await fetchNoaaStageFlow({ identifier: nwsId, product: 'observed' }) : await fetchUsgsInstantaneousValues({ stationIds: [usgsId], parameterCodes: ['00065'] });
      const latest = records.at(-1);
      if (!latest) return json(res, 503, { ok: false, status: 'unavailable', sourceId: source === 'noaa' ? `NOAA-NWPS-${nwsId}-observed` : `USGS-NWIS-${usgsId}-00065` });
      return json(res, 200, { ok: true, ...latest, source: source.toUpperCase(), freshness: { observedAt: latest.observedAt, retrievedAt: latest.retrievedAt } });
    }
    if (req.method === 'GET' && url.pathname === '/api/data-sources/health') return json(res, 200, { build_sha: BUILD_SHA, sources: listSourceHealth(), circuits: listUpstreamCircuitHealth() });
    if (req.method === 'GET' && url.pathname === '/api/geospatial/posey/site') return json(res, 200, { ok: true, site_id: 'posey-point-township-bonebank-5000ft', horizontal_crs: 'EPSG:2966', horizontal_crs_name: 'NAD83 / Indiana West (ftUS)', vertical_datum: 'NAVD88', bounds: { minX: 2680000, minY: 940000, maxX: 2685000, maxY: 945000 }, terrain: { source_uri: 'https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_2016_2020_DEM/ImageServer', acquisition_year: 2020, authority_class: 'OBSERVATION', derivation_class: 'RAW' }, orthophoto: { source_uri: 'https://imagery.geoplatform.gov/iipp/rest/services/NAIP/NAIP2020_CONUS/ImageServer', acquisition_year: 2020, authority_class: 'OBSERVATION', derivation_class: 'RAW' } });
    if (req.method === 'GET' && url.pathname === '/api/geospatial/posey/raster') { try { return await servePoseyAsset(req, res); } catch (error) { return json(res, error instanceof RangeError ? 400 : 502, { error: error.message, code: error instanceof RangeError ? 'GEOSPATIAL_REQUEST_INVALID' : 'GEOSPATIAL_SOURCE_UNAVAILABLE' }); } }
    if (req.method === 'GET' && url.pathname === '/api/evidence') { const authority_class = url.searchParams.get('authority_class') || undefined; const demo = url.searchParams.get('is_simulation_demo'); return json(res, 200, { artifacts: listArtifacts({ limit: 100, authority_class, is_simulation_demo: demo === null ? undefined : demo === 'true' }) }); }
    if (req.method === 'GET' && url.pathname.startsWith('/api/evidence/') && url.pathname !== '/api/evidence/verify') { const id = url.pathname.split('/').pop(); const artifact = getArtifact(id); return artifact ? json(res, 200, artifact) : json(res, 404, { error: 'not found' }); }
    if (req.method === 'POST' && url.pathname === '/api/evidence') { try { return json(res, 201, appendArtifact(await readBodyFixed(req))); } catch (error) { return json(res, error.code === 'FAIL_CLOSED' ? 422 : 500, { error: error.message, code: error.code }); } }
    if (req.method === 'POST' && url.pathname === '/api/evidence/verify') { const body = await readBodyFixed(req); const artifact = getArtifact(body.artifact_id); if (!artifact) return json(res, 404, { error: 'artifact not found' }); const result = verifyProvenance(artifact, body.canonical || artifact.payload); recordVerification(body.artifact_id, result.expected, result.computed, 'api/evidence/verify'); return json(res, result.ok ? 200 : 422, result); }
    if (req.method === 'POST' && url.pathname === '/api/v1/engineering/compensatory-storage') { const body = await readBodyFixed(req); try { const result = evaluateCompensatoryStorage(body); const canonical = `TSM_ENGINE_LEAF:${buildCompensatoryStorageCanonical(body)}`; const artifact = appendArtifact({ artifact_type: 'engineering_compensatory_storage', source_authority: 'TSM Engineering Solver', source_uri: 'internal://tsm/engineering/compensatory-storage', source_identifier: body.plan_id, retrieved_at: new Date().toISOString(), horizontal_crs: body.horizontal_crs || 'EPSG:2966', horizontal_crs_name: body.horizontal_crs_name || 'NAD83 / Indiana West (ftUS)', vertical_datum: body.vertical_datum || 'NAVD88', content_hash_sha256: result.evidence_artifact_hash.slice('sha256:'.length), validation_status: 'provisional', authority_class: 'MODEL_OUTPUT', derivation_class: 'DERIVED', software_version: 'tsm-engineering@0.1.0', operator_or_service_identity: 'compensatory-storage-api', governance_status: 'human_review_required', is_simulation_demo: false, human_review_status: 'pending', transformation_chain: [], payload: result, _canonical_for_verify: canonical, notes: 'Configurable storage-ratio analysis. Not a regulatory determination; verify governing permit criteria and engineering basis.' }); return json(res, 200, { ...result, evidence_artifact_id: artifact.artifact_id }); } catch (error) { return json(res, error instanceof TypeError || error instanceof RangeError ? 400 : 422, { error: error.message, code: error.code || 'ENGINEERING_VALIDATION_ERROR' }); } }
    if (req.method === 'POST' && url.pathname === '/api/ingest/hydrologic') return json(res, 200, { results: await runHydrologicBatch(), note: 'Fail-closed per node; check each result.ok' });
    if (req.method === 'POST' && url.pathname === '/api/ingest/usgs') { const body = await readBodyFixed(req); if (!body.usgs_id) return json(res, 400, { error: 'usgs_id required' }); return json(res, 200, await ingestUsgsNode(body.usgs_id)); }
    if (req.method === 'POST' && url.pathname === '/api/ingest/nwps') { const body = await readBodyFixed(req); if (!body.nws_id) return json(res, 400, { error: 'nws_id required' }); return json(res, 200, await ingestNwpsGauge(body.nws_id, { product: body.product })); }
    if (req.method === 'GET' && url.pathname === '/api/policies') return json(res, 200, { policies: POLICIES });
    if (req.method === 'POST' && url.pathname === '/api/policies/evaluate') return json(res, 200, evaluatePolicies(await readBodyFixed(req)));
    if (req.method === 'POST' && url.pathname === '/api/ledger/append') { const body = await readBodyFixed(req); const content = JSON.stringify(body); const hash = sha256Hex(`TSM_LEAF:${content}`); try { return json(res, 201, appendArtifact({ artifact_type: 'evidence_block', source_authority: body.source_org || 'unknown', source_uri: body.source_uri || 'urn:tsm:manual', retrieved_at: new Date().toISOString(), horizontal_crs: 'EPSG:2966', vertical_datum: 'NAVD88', content_hash_sha256: hash, authority_class: body.is_simulation_demo ? 'SIMULATION_DEMO' : 'OBSERVATION', derivation_class: 'RAW', validation_status: 'pending', governance_status: 'human_review_required', is_simulation_demo: Boolean(body.is_simulation_demo), transformation_chain: body.transformation_chain || [], payload: body, _canonical_for_verify: `TSM_LEAF:${content}` })); } catch (error) { return json(res, 422, { error: error.message, code: error.code }); } }
    return json(res, 404, { error: 'not found' });
  } catch (error) { return json(res, error instanceof Error && error.code === 'CIRCUIT_OPEN' ? 503 : 502, { error: error.message || 'upstream source unavailable', code: error.code || 'SOURCE_UNAVAILABLE' }); }
});
server.listen(PORT, () => console.log(`TSM API on http://localhost:${PORT}`));
