import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { appendArtifact, listArtifacts, getArtifact, verifyProvenance, recordVerification, sha256Hex } from './store/evidence-store.mjs';
import { runHydrologicBatch, ingestUsgsNode, ingestNwpsGauge } from './ingestion/workers.mjs';
import { fetchUsgsInstantaneousValues } from './ingestion/usgs-nwis.mjs';
import { fetchNoaaStageFlow } from './ingestion/noaa-nwps.mjs';
import { listSourceHealth } from './ingestion/source-health.mjs';
import { listUpstreamCircuitHealth } from './ingestion/http-client.mjs';
import { getStaleCache, putStaleCache } from './reliability/stale-cache.mjs';
import { listAuthoritativeSources, fetchAuthoritativeJson } from './ingestion/source-fabric.mjs';
import { fetchRiverNetwork } from './ingestion/river-network-api.mjs';
import { evaluatePolicies, POLICIES } from './policy/jurisdiction-engine.mjs';
import { evaluateCompensatoryStorage, buildCompensatoryStorageCanonical } from './engineering/compensatory-storage.mjs';
import { servePoseyAsset } from './geospatial/posey-assets.mjs';
import { handleFirmRoute } from './geospatial/firm-routes.mjs';
import { normalizeTelemetryEvent, validateTelemetryIngress } from './telemetry/inbound.mjs';
import { authorizeAndPublishArtifact } from './ingestion/governance-transition.mjs';
import { authenticateRequest, requireRoles, requireAuthenticatedSubject } from './auth/oidc-auth.mjs';

const PORT = Number(process.env.PORT || 8787);
const BUILD_SHA = process.env.GITHUB_SHA || process.env.TSM_BUILD_SHA || 'local';
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
function json(res, status, body, requestId) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-TSM-Request-ID': requestId || 'unknown', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-TSM-Request-ID', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
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
const latestRecord = (records, parameterCode = null) => records.filter((record) => parameterCode === null || record.provenance?.parameterCode === parameterCode).sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)).at(-1) || null;
const acceptedTelemetryEvents = new Map();
function hasTelemetryEvent(eventId) { return acceptedTelemetryEvents.has(eventId); }
function rememberTelemetryEvent(eventId, now = Date.now()) {
  acceptedTelemetryEvents.set(eventId, now);
  while (acceptedTelemetryEvents.size > 4096) acceptedTelemetryEvents.delete(acceptedTelemetryEvents.keys().next().value);
}

const server = http.createServer(async (req, res) => {
  const requestId = req.headers['x-tsm-request-id'] || randomUUID();
  if (req.method === 'OPTIONS') return json(res, 204, {}, requestId);
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  try {
    const protectedMutation = req.method === 'POST' && (
      url.pathname === '/api/evidence' ||
      url.pathname === '/api/evidence/verify' ||
      url.pathname === '/api/v1/engineering/compensatory-storage' ||
      url.pathname === '/api/ingest/hydrologic' ||
      url.pathname === '/api/ingest/usgs' ||
      url.pathname === '/api/ingest/nwps' ||
      url.pathname === '/api/ledger/append'
    );
    let requestAuth = null;
    if (protectedMutation) {
      try {
        requestAuth = await authenticateRequest(req);
      } catch (error) {
        return json(res, error.status || 401, { ok: false, code: error.code || 'AUTHENTICATION_REQUIRED', error: error.message }, requestId);
      }
      if (url.pathname === '/api/ledger/append') {
        try {
          requireRoles(requestAuth, String(process.env.TSM_REVIEWER_ROLE || 'tsm-reviewer'));
        } catch (error) {
          return json(res, error.status || 403, { ok: false, code: error.code || 'AUTHORIZATION_FORBIDDEN', error: error.message }, requestId);
        }
      } else if (!requestAuth.developmentBypass) {
        try {
          requireRoles(requestAuth, String(process.env.TSM_OPERATOR_ROLE || 'tsm-operator'));
        } catch (error) {
          return json(res, error.status || 403, { ok: false, code: error.code || 'AUTHORIZATION_FORBIDDEN', error: error.message }, requestId);
        }
      }
    }
    if (handleFirmRoute(req, res, url, (response, status, body) => json(response, status, body, requestId))) return;
    if (req.method === 'GET' && url.pathname === '/api/auth/health') return json(res, 200, { ...healthBody(), auth_model: 'keycloak_public_client_pkce', client_secret_required: false, token_proxy_path: null }, requestId);
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, healthBody(), requestId);
    if (req.method === 'GET' && url.pathname === '/ready') return json(res, 200, { ...healthBody(), ready: true, required_internal_dependencies: { authority_registry: true, evidence_store: true } }, requestId);
    if (req.method === 'GET' && url.pathname === '/api/data-sources/catalog') return json(res, 200, { build_sha: BUILD_SHA, sources: listAuthoritativeSources(), health: listSourceHealth(), circuits: listUpstreamCircuitHealth(), authority_boundary: 'Catalog metadata does not confer regulatory authority; source products retain their published status.' }, requestId);
    if (req.method === 'GET' && url.pathname === '/api/data-sources/fetch') {
      const sourceId = url.searchParams.get('source_id');
      const sourceUrl = url.searchParams.get('url');
      if (!sourceId || !sourceUrl) return json(res, 400, { error: 'source_id and url are required' }, requestId);
      const result = await fetchAuthoritativeJson(sourceId, sourceUrl, { requestId });
      return json(res, 200, { ...result, data_authority: 'authoritative-source-response', regulatory_determination: false }, requestId);
    }
    if (req.method === 'POST' && url.pathname === '/api/telemetry/events') {
      const auth = validateTelemetryIngress(req);
      if (!auth.ok) return json(res, auth.status, { ok: false, code: auth.code }, requestId);
      try {
        const event = normalizeTelemetryEvent(await readBodyFixed(req));
        if (hasTelemetryEvent(event.event_id)) return json(res, 200, { ok: true, duplicate: true, event_id: event.event_id }, requestId);
        const artifact = appendArtifact({
          artifact_type: 'telemetry_event',
          source_authority: event.source_id,
          source_uri: 'kafka://tsm.telemetry.v1',
          source_identifier: event.event_id,
          retrieved_at: event.received_at,
          observation_time: event.observed_at,
          horizontal_crs: 'SOURCE_DECLARED',
          vertical_datum: 'SOURCE_DECLARED',
          content_hash_sha256: sha256Hex(JSON.stringify(event)),
          authority_class: 'OBSERVATION',
          derivation_class: 'RAW',
          validation_status: 'accepted',
          governance_status: 'human_review_required',
          is_simulation_demo: false,
          human_review_status: 'pending',
          payload: event,
          notes: 'Event-driven telemetry ingress. Source authority and regulatory meaning remain source-defined; TSM does not certify incoming sensor/radar products.',
        });
        rememberTelemetryEvent(event.event_id);
        return json(res, 202, { ok: true, accepted: true, event_id: event.event_id, artifact_id: artifact.artifact_id }, requestId);
      } catch (error) {
        return json(res, error instanceof TypeError ? 400 : 422, { ok: false, code: error.code || 'TELEMETRY_EVENT_INVALID', error: error.message }, requestId);
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/hydrologic/community') {
      const stationIds = url.searchParams.getAll('station_id');
      const network = await fetchRiverNetwork({ stationIds: stationIds.length ? stationIds : null, includeNoaa: true });
      return json(res, 200, { ok: true, ...network, requestId }, requestId);
    }
    if (req.method === 'GET' && url.pathname === '/api/hydrologic/live') {
      const usgsId = url.searchParams.get('usgs_id') || '03378500';
      const nwsId = url.searchParams.get('nws_id') || 'NHRI3';
      const source = url.searchParams.get('source') || 'auto';
      const cacheKey = `hydro:${usgsId}:${nwsId}`;
      let records;
      let selectedSource;
      try {
        if (source === 'noaa') {
          records = await fetchNoaaStageFlow({ identifier: nwsId, product: 'observed' });
          selectedSource = 'NOAA';
        } else if (source === 'usgs') {
          records = await fetchUsgsInstantaneousValues({ stationIds: [usgsId], parameterCodes: ['00065', '00060'] });
          selectedSource = 'USGS';
        } else if (source === 'auto') {
          try {
            records = await fetchNoaaStageFlow({ identifier: nwsId, product: 'observed' });
            selectedSource = 'NOAA';
          } catch (noaaError) {
            void noaaError;
            records = await fetchUsgsInstantaneousValues({ stationIds: [usgsId], parameterCodes: ['00065', '00060'] });
            selectedSource = 'USGS';
          }
        } else {
          return json(res, 400, { error: 'source must be auto, noaa, or usgs' }, requestId);
        }

        const stage = selectedSource === 'USGS' ? latestRecord(records, '00065') : latestRecord(records);
        const discharge = selectedSource === 'USGS' ? latestRecord(records, '00060') : null;
        if (!stage) throw Object.assign(new Error('no stage observation returned'), { code: 'HYDRO_NO_STAGE' });
        const payload = {
          ok: true,
          ...stage,
          source: selectedSource,
          gaugeId: selectedSource === 'NOAA' ? nwsId : usgsId,
          qualifier: stage.provenance?.qualifier || (stage.status === 'provisional' ? 'P' : null),
          discharge_cfs: discharge?.value ?? null,
          discharge_observedAt: discharge?.observedAt ?? null,
          discharge_status: discharge?.status ?? null,
          freshness: { observedAt: stage.observedAt, retrievedAt: stage.retrievedAt },
          requestId,
        };
        putStaleCache(cacheKey, payload);
        return json(res, 200, payload, requestId);
      } catch (error) {
        const stale = getStaleCache(cacheKey);
        if (stale) {
          return json(res, 200, {
            ...stale.value,
            ok: true,
            status: 'stale',
            freshness: { ...stale.value.freshness, staleSince: stale.cachedAt, staleAgeMs: stale.ageMs },
            source_status: 'UPSTREAM_UNAVAILABLE_LAST_KNOWN_GOOD',
            requestId,
          }, requestId);
        }
        return json(res, 503, { ok: false, status: 'unavailable', code: error?.code || 'HYDRO_SOURCE_UNAVAILABLE', sourceId: `NOAA-NWPS-${nwsId}-observed / USGS-NWIS-${usgsId}-00065`, requestId }, requestId);
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/data-sources/health') return json(res, 200, { build_sha: BUILD_SHA, sources: listSourceHealth(), circuits: listUpstreamCircuitHealth() }, requestId);
    if (req.method === 'GET' && url.pathname === '/api/geospatial/posey/site') return json(res, 200, { ok: true, site_id: 'posey-lower-wabash-ohio-community', horizontal_crs: 'EPSG:2966', horizontal_crs_name: 'NAD83 / Indiana West (ftUS)', vertical_datum: null, vertical_datum_verified: false, bounds: { minX: 2680000, minY: 940000, maxX: 2685000, maxY: 945000 }, terrain: { source_uri: 'https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_2016_2020_DEM/ImageServer', acquisition_year: 2020, authority_class: 'OBSERVATION', derivation_class: 'RAW', vertical_datum: null, vertical_datum_verified: false }, orthophoto: { source_uri: 'https://imagery.geoplatform.gov/iipp/rest/services/NAIP/NAIP2020_CONUS/ImageServer', acquisition_year: 2020, authority_class: 'OBSERVATION', derivation_class: 'RAW' } }, requestId);
    if (req.method === 'GET' && url.pathname === '/api/geospatial/posey/raster') { try { return await servePoseyAsset(req, res); } catch (error) { return json(res, error instanceof RangeError ? 400 : 502, { error: error.message, code: error instanceof RangeError ? 'GEOSPATIAL_REQUEST_INVALID' : 'GEOSPATIAL_SOURCE_UNAVAILABLE' }, requestId); } }
    if (req.method === 'GET' && url.pathname === '/api/evidence') { const authority_class = url.searchParams.get('authority_class') || undefined; const demo = url.searchParams.get('is_simulation_demo'); return json(res, 200, { artifacts: listArtifacts({ limit: 100, authority_class, is_simulation_demo: demo === null ? undefined : demo === 'true' }) }, requestId); }
    if (req.method === 'GET' && url.pathname.startsWith('/api/evidence/') && url.pathname !== '/api/evidence/verify') { const id = url.pathname.split('/').pop(); const artifact = getArtifact(id); return artifact ? json(res, 200, artifact, requestId) : json(res, 404, { error: 'not found' }, requestId); }
    if (req.method === 'POST' && url.pathname === '/api/evidence') { try { return json(res, 201, appendArtifact(await readBodyFixed(req)), requestId); } catch (error) { return json(res, error.code === 'FAIL_CLOSED' ? 422 : 500, { error: error.message, code: error.code }, requestId); } }
    if (req.method === 'POST' && url.pathname === '/api/evidence/verify') { const body = await readBodyFixed(req); const artifact = getArtifact(body.artifact_id); if (!artifact) return json(res, 404, { error: 'artifact not found' }, requestId); const result = verifyProvenance(artifact, body.canonical || artifact.payload); recordVerification(body.artifact_id, result.expected, result.computed, 'api/evidence/verify'); return json(res, result.ok ? 200 : 422, result, requestId); }
    if (req.method === 'POST' && url.pathname === '/api/v1/engineering/compensatory-storage') { const body = await readBodyFixed(req); try { const result = evaluateCompensatoryStorage(body); const canonical = `TSM_ENGINE_LEAF:${buildCompensatoryStorageCanonical(body)}`; const artifact = appendArtifact({ artifact_type: 'engineering_compensatory_storage', source_authority: 'TSM Engineering Solver', source_uri: 'internal://tsm/engineering/compensatory-storage', source_identifier: body.plan_id, retrieved_at: new Date().toISOString(), horizontal_crs: body.horizontal_crs || 'EPSG:2966', horizontal_crs_name: body.horizontal_crs_name || 'NAD83 / Indiana West (ftUS)', vertical_datum: body.vertical_datum || 'NAVD88', content_hash_sha256: result.evidence_artifact_hash.slice('sha256:'.length), validation_status: 'provisional', authority_class: 'MODEL_OUTPUT', derivation_class: 'DERIVED', software_version: 'tsm-engineering@0.1.0', operator_or_service_identity: 'compensatory-storage-api', governance_status: 'human_review_required', is_simulation_demo: false, human_review_status: 'pending', transformation_chain: [], payload: result, _canonical_for_verify: canonical, notes: 'Configurable storage-ratio analysis. Not a regulatory determination; verify governing permit criteria and engineering basis.' }); return json(res, 200, { ...result, evidence_artifact_id: artifact.artifact_id }, requestId); } catch (error) { return json(res, error instanceof TypeError || error instanceof RangeError ? 400 : 422, { error: error.message, code: error.code || 'ENGINEERING_VALIDATION_ERROR' }, requestId); } }
    if (req.method === 'POST' && url.pathname === '/api/ingest/hydrologic') return json(res, 200, { results: await runHydrologicBatch(), note: 'Fail-closed per node; check each result.ok' }, requestId);
    if (req.method === 'POST' && url.pathname === '/api/ingest/usgs') { const body = await readBodyFixed(req); if (!body.usgs_id) return json(res, 400, { error: 'usgs_id required' }, requestId); return json(res, 200, await ingestUsgsNode(body.usgs_id), requestId); }
    if (req.method === 'POST' && url.pathname === '/api/ingest/nwps') { const body = await readBodyFixed(req); if (!body.nws_id) return json(res, 400, { error: 'nws_id required' }, requestId); return json(res, 200, await ingestNwpsGauge(body.nws_id, { product: body.product }), requestId); }
    if (req.method === 'GET' && url.pathname === '/api/policies') return json(res, 200, { policies: POLICIES }, requestId);
    if (req.method === 'POST' && url.pathname === '/api/policies/evaluate') return json(res, 200, evaluatePolicies(await readBodyFixed(req)), requestId);
    if (req.method === 'POST' && url.pathname === '/api/ledger/append') {
      const body = await readBodyFixed(req);
      if (!body.artifact_id) return json(res, 400, { error: 'artifact_id is required; raw artifacts must be ingested before authorization' }, requestId);
      if (!body.human_authorization || typeof body.human_authorization !== 'object') return json(res, 400, { error: 'human_authorization is required' }, requestId);
      try {
        requireAuthenticatedSubject(requestAuth, body.human_authorization.reviewer_identity);
        const publication = await authorizeAndPublishArtifact(body.artifact_id, {
          ...body.human_authorization,
          reviewer_identity: requestAuth.subject,
        });
        return json(res, 201, publication, requestId);
      } catch (error) {
        return json(res, error.status || (error.code === 'NOT_FOUND' ? 404 : 422), { error: error.message, code: error.code || 'GOVERNANCE_FAULT' }, requestId);
      }
    }
    return json(res, 404, { error: 'not found' }, requestId);
  } catch (error) { return json(res, error instanceof Error && error.code === 'CIRCUIT_OPEN' ? 503 : 502, { error: error.message || 'upstream source unavailable', code: error.code || 'SOURCE_UNAVAILABLE', requestId }, requestId); }
});
server.listen(PORT, () => console.log(`TSM API on http://localhost:${PORT}`));
