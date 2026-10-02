import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { appendArtifact, listArtifacts, getArtifact, verifyProvenance, recordVerification, sha256Hex } from './store/evidence-store.mjs';
import { listSourceHealth } from './ingestion/source-health.mjs';
import { listUpstreamCircuitHealth } from './ingestion/http-client.mjs';
import { incrementTelemetryCounter, observeTelemetryDuration, observeTelemetryMetric, observeSlo, renderPrometheusMetrics } from './telemetry/prometheus-exporter.mjs';
import { listAuthoritativeSources, fetchAuthoritativeJson } from './ingestion/source-fabric.mjs';
import { evaluatePolicies, POLICIES } from './policy/jurisdiction-engine.mjs';
import { evaluateCompensatoryStorage, buildCompensatoryStorageCanonical } from './engineering/compensatory-storage.mjs';
import { validateRasResultsPayload, buildRasResultsArtifact } from './engineering/ras-results.mjs';
import { servePoseyAsset, getPoseyAssetManifest } from './geospatial/posey-assets.mjs';
import { handleFirmRoute } from './geospatial/firm-routes.mjs';
import { normalizeTelemetryEvent, validateTelemetryIngress } from './telemetry/inbound.mjs';
import { authorizeAndPublishArtifact } from './ingestion/governance-transition.mjs';
import { authenticateRequest, requireRoles, requireAuthenticatedSubject } from './auth/oidc-auth.mjs';
import { submitCommunityObservation } from './ingestion/community-submissions.mjs';
import { beginOidcLogin, finishOidcLogin, getBrowserSession, logoutOidc } from './auth/oidc-bff.mjs';
import { bootstrapOidc } from './auth/oidc-bootstrap.mjs';
import { calculateGaugeWseNavd88, getHydrologicNode } from './ingestion/hydraulic-calibration.mjs';
import { evaluateLevel5, listLevel5Proposals, approveLevel5Proposal, executeLevel5Proposal, autonomyStatus } from './autonomy/level5-orchestrator.mjs';
import { calculateLocalProfileWSE } from './engineering/hydraulic-transfer.mjs';
import { acceptSyslog } from './alerts/syslog.mjs';
import { detectTelemetrySourceFailures } from './alerts/telemetry-status.mjs';
import { createRateLimiter } from './reliability/rate-limiter.mjs';
import { routeOsrm } from './routing/osrm-client.mjs';
import { handleH3QueryRoute } from './geospatial/h3-routes.mjs';

const PORT = Number(process.env.PORT || 8787);
/**
 * Bind host. The desktop/offline app sets TSM_HOST=127.0.0.1 so the API is
 * loopback-only. Default preserves the historical all-interfaces bind for
 * reverse-proxied deployments.
 */
const HOST = String(process.env.TSM_HOST || '0.0.0.0');
const BUILD_SHA = process.env.TSM_BUILD_SHA || process.env.GITHUB_SHA || 'local';
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
if (ALLOWED_ORIGIN === '*') throw new Error('CORS_ORIGIN must be an exact trusted origin; wildcard CORS is prohibited.');
// TSM_AUTH_MODE=disabled: login is dropped. The API serves public/read-only
// routes and local mutations without OIDC; auth endpoints report AUTH_DISABLED.
// TSM_OFFLINE=1: air-gapped mode. Upstream river-data fetches are short-circuited
// to fail-closed OFFLINE_MODE instead of attempting network access.
const AUTH_DISABLED = String(process.env.TSM_AUTH_MODE || 'disabled').toLowerCase() === 'disabled';
const OFFLINE_MODE = ['1', 'true', 'yes'].includes(String(process.env.TSM_OFFLINE || '').toLowerCase());
function authDisabledJson(res, requestId) {
  return json(res, 503, { ok: false, code: 'AUTH_DISABLED', note: 'Login is disabled in this deployment (TSM_AUTH_MODE=disabled).' }, requestId);
}
// Owner decision 2026-09-29: live river telemetry is retired. These routes fail
// closed with 410 Gone regardless of TSM_OFFLINE; no request here may reach
// USGS/NOAA upstream endpoints.
const RETIRED_TELEMETRY_ROUTES = new Set([
  '/api/hydrologic/community',
  '/api/hydrologic/live',
  '/api/hydrologic/alerts',
  '/api/ingest/hydrologic',
  '/api/ingest/usgs',
  '/api/ingest/nwps',
]);
function retiredTelemetryJson(res, requestId) {
  return json(res, 410, { ok: false, code: 'RIVER_TELEMETRY_RETIRED', note: 'Live river telemetry was retired by owner decision 2026-09-29. This route no longer reaches USGS/NOAA upstream endpoints.' }, requestId);
}
const RUNTIME_BROWSER_METRICS = new Set(['tsm_browser_route_load_seconds', 'tsm_browser_js_chunk_bytes', 'tsm_browser_frame_time_seconds', 'tsm_browser_tile_request_latency_seconds', 'tsm_browser_tile_requests_total', 'tsm_browser_tile_failures_total', 'tsm_browser_memory_pressure_ratio', 'tsm_browser_webgpu_available', 'tsm_browser_webgl_available']);
const RUNTIME_METRIC_LIMIT = 32;
const runtimeRate = new Map();
function allowRuntimeMetrics(clientKey, now = Date.now()) {
  const previous = runtimeRate.get(clientKey) || { windowStartedAt: now, count: 0 };
  if (now - previous.windowStartedAt >= 60_000) { previous.windowStartedAt = now; previous.count = 0; }
  if (previous.count >= 120) return false;
  previous.count += 1;
  runtimeRate.set(clientKey, previous);
  while (runtimeRate.size > 2048) runtimeRate.delete(runtimeRate.keys().next().value);
  return true;
}
function metricRoute(pathname) {
  if (pathname.startsWith('/api/geospatial')) return 'geospatial';
  if (pathname.startsWith('/api/v1/engineering') || pathname.startsWith('/api/engineering') || pathname.startsWith('/api/ingest')) return 'engineering';
  if (pathname.startsWith('/api/evidence') || pathname.startsWith('/api/ledger')) return 'evidence';
  if (pathname.startsWith('/api/hydrologic')) return 'hydrologic';
  if (pathname.startsWith('/api/data-sources')) return 'data_fabric';
  if (pathname.startsWith('/api/runtime')) return 'runtime';
  if (pathname.startsWith('/api/auth')) return 'auth';
  return pathname === '/health' || pathname === '/ready' ? 'health' : 'other';
}
function recordHttpPerformance(method, pathname, status, durationMs) {
  const route = metricRoute(pathname);
  const labels = { method, route };
  observeTelemetryDuration('tsm_http_request_latency_seconds', durationMs / 1000, labels);
  incrementTelemetryCounter('tsm_http_requests_total', labels);
  if (status >= 500) incrementTelemetryCounter('tsm_http_errors_total', { route });
  observeSlo('api_availability', status < 500, { route });
  observeSlo('api_latency_p95', durationMs <= 750, { route });
  if (route === 'geospatial') observeTelemetryDuration('tsm_geospatial_query_latency_seconds', durationMs / 1000, { method });
  if (route === 'engineering') observeTelemetryDuration('tsm_hydraulic_job_latency_seconds', durationMs / 1000, { method });
  if (route === 'evidence') {
    observeTelemetryDuration('tsm_evidence_processing_latency_seconds', durationMs / 1000, { method });
    incrementTelemetryCounter('tsm_evidence_processing_total', { method, outcome: status < 500 ? 'success' : 'error' });
  }
  const memory = process.memoryUsage();
  observeTelemetryMetric('tsm_server_memory_rss_bytes', memory.rss);
  observeTelemetryMetric('tsm_server_memory_heap_used_bytes', memory.heapUsed);
}
function productionAuthReady() { return REQUIRED_BROWSER_AUTH_ENV.every((name) => String(process.env[name] || '').trim() !== '') && String(process.env.TSM_SESSION_SECRET || '').length >= 32; }
const REQUIRED_BROWSER_AUTH_ENV = ['OIDC_ISSUER', 'OIDC_AUDIENCE', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'OIDC_REDIRECT_URI', 'TSM_SESSION_SECRET', 'CORS_ORIGIN'];
function json(res, status, body, requestId) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-TSM-Request-ID': requestId || 'unknown', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "frame-ancestors 'none'", 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()', ...(String(process.env.CORS_ORIGIN || '').startsWith('https://') ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}), 'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-TSM-Request-ID, X-TSM-CSRF', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Vary': 'Origin' });
  res.end(JSON.stringify(body));
}

// Per-route rate limiters for the most expensive upstream-fan-out routes.
// Keys are route + client IP; denials answer 429 with Retry-After.
const dataSourcesFetchLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 60 });
const hydrologicLiveLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 120 });
const poseyRasterLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30 });
const osrmRouteLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 60 });
const routeLimiters = [
  ['/api/data-sources/fetch', dataSourcesFetchLimiter],
  ['/api/hydrologic/live', hydrologicLiveLimiter],
  ['/api/geospatial/posey/raster', poseyRasterLimiter],
  ['/api/routing/route', osrmRouteLimiter],
];
setInterval(() => { for (const [, limiter] of routeLimiters) limiter.prune(); }, 60_000).unref();

function checkRouteRateLimit(req, res, requestId) {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  const entry = routeLimiters.find(([route]) => route === pathname);
  if (!entry) return true;
  const [route, limiter] = entry;
  const key = `${route}:${String(req.socket?.remoteAddress || 'anonymous')}`;
  const decision = limiter.consume(key);
  if (decision.allowed) return true;
  const retryAfterSeconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
  incrementTelemetryCounter('tsm_http_rate_limited_total', { route });
  res.writeHead(429, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Retry-After': String(retryAfterSeconds),
    'X-TSM-Request-ID': requestId || 'unknown',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  });
  res.end(JSON.stringify({ ok: false, code: 'RATE_LIMITED', error: `Rate limit exceeded for ${route}; retry after ${retryAfterSeconds} second(s).`, retry_after_seconds: retryAfterSeconds }));
  return false;
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
const acceptedTelemetryEvents = new Map();
function hasTelemetryEvent(eventId) { return acceptedTelemetryEvents.has(eventId); }
function rememberTelemetryEvent(eventId, now = Date.now()) {
  acceptedTelemetryEvents.set(eventId, now);
  while (acceptedTelemetryEvents.size > 4096) acceptedTelemetryEvents.delete(acceptedTelemetryEvents.keys().next().value);
}

const server = http.createServer(async (req, res) => {
  const requestStartedAt = performance.now();
  const eventLoopStartedAt = performance.eventLoopUtilization();
  const requestId = req.headers['x-tsm-request-id'] || randomUUID();
  if (req.method === 'OPTIONS') return json(res, 204, {}, requestId);
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  if (RETIRED_TELEMETRY_ROUTES.has(url.pathname)) return retiredTelemetryJson(res, requestId);
  try {
    const protectedMutation = req.method === 'POST' && (
      url.pathname === '/api/evidence' ||
      url.pathname === '/api/evidence/verify' ||
      url.pathname === '/api/v1/engineering/compensatory-storage' ||
      url.pathname === '/api/engineering/ras-results' ||
      url.pathname === '/api/ledger/append' ||
      url.pathname === '/api/autonomy/evaluate' ||
      url.pathname === '/api/hydraulic/transfer' ||
      url.pathname.startsWith('/api/autonomy/proposals/')
    );
    let requestAuth = null;
    if (protectedMutation) {
      try {
        requestAuth = await authenticateRequest(req);
        if (requestAuth.browserSession) {
          const origin = String(req.headers.origin || '');
          const expectedOrigin = new URL(ALLOWED_ORIGIN).origin;
          if (origin !== expectedOrigin || req.headers['x-tsm-csrf'] !== '1') {
            return json(res, 403, { ok: false, code: 'CSRF_ORIGIN_REJECTED', error: 'Authenticated browser mutations require the configured origin and X-TSM-CSRF header.' }, requestId);
          }
        }
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
    if (req.method === 'POST' && url.pathname === '/api/hydrologic/query') {
      try {
        const body = await readBodyFixed(req);
        return await handleH3QueryRoute({
          method: req.method,
          pathname: url.pathname,
          body,
          json: (status, payload) => json(res, status, payload, requestId),
        });
      } catch (error) {
        console.error('[TSM H3 spatial query] unexpected failure', {
          code: error?.code,
          message: error?.message,
        });
        return json(res, 500, {
          ok: false,
          status: 'UNAVAILABLE',
          code: 'SPATIAL_QUERY_FAILED',
          error: 'Spatial indexing execution failed.',
        }, requestId);
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/auth/health') return json(res, 200, { ...healthBody(), auth_model: AUTH_DISABLED ? 'disabled_local' : 'server_managed_oidc_pkce_session', auth_disabled: AUTH_DISABLED, browser_tokens_exposed: false, oidc_configured: Boolean(process.env.OIDC_ISSUER && process.env.OIDC_AUDIENCE && process.env.OIDC_CLIENT_ID && process.env.OIDC_REDIRECT_URI && process.env.TSM_SESSION_SECRET) }, requestId);
    if (req.method === 'GET' && url.pathname === '/api/auth/login') {
      if (AUTH_DISABLED) return authDisabledJson(res, requestId);
      return await beginOidcLogin(req, res);
    }
    if (req.method === 'GET' && url.pathname === '/api/auth/callback') {
      if (AUTH_DISABLED) return authDisabledJson(res, requestId);
      try { return await finishOidcLogin(req, res); }
      catch (error) { return json(res, error.status || 502, { ok: false, code: error.code || 'OIDC_CALLBACK_FAILED', error: error.message }, requestId); }
    }
    if (req.method === 'GET' && url.pathname === '/api/auth/session') {
      if (AUTH_DISABLED) return json(res, 200, { authenticated: false, auth_disabled: true }, requestId);
      try {
        const session = await getBrowserSession(req);
        return json(res, 200, session ? { authenticated: true, subject: session.subject, roles: session.roles } : { authenticated: false }, requestId);
      } catch (error) { return json(res, 401, { authenticated: false, code: error.code || 'SESSION_INVALID' }, requestId); }
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      if (AUTH_DISABLED) return authDisabledJson(res, requestId);
      const origin = String(req.headers.origin || '');
      if (origin !== new URL(ALLOWED_ORIGIN).origin || req.headers['x-tsm-csrf'] !== '1') return json(res, 403, { ok: false, code: 'CSRF_ORIGIN_REJECTED' }, requestId);
      return logoutOidc(res);
    }
    if (req.method === 'GET' && url.pathname === '/metrics') { res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(renderPrometheusMetrics()); }
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, healthBody(), requestId);
    if (req.method === 'GET' && url.pathname === '/ready') {
      const authReady = AUTH_DISABLED || productionAuthReady();
      const oidcConfigured = productionAuthReady();
      let authorityRegistryReady = false;
      try {
        authorityRegistryReady = Boolean(getHydrologicNode('03378500'));
      } catch (error) {
        authorityRegistryReady = false;
        console.error('[TSM readiness] authority registry unavailable', { code: error?.code, message: error?.message });
      }
      const ready = authorityRegistryReady && authReady;
      const localMode = ['1', 'true', 'yes'].includes(String(process.env.TSM_LOCAL_MODE || '').toLowerCase());
      return json(res, ready ? 200 : 503, {
        ...healthBody(),
        ready,
        auth_ready: authReady,
        auth_disabled: AUTH_DISABLED,
        local_mode: localMode,
        bind_host: HOST,
        offline_mode: OFFLINE_MODE,
        required_internal_dependencies: { authority_registry: authorityRegistryReady, evidence_store: true, oidc: oidcConfigured },
        ...(authReady ? {} : {
          code: 'AUTH_CONFIGURATION_INCOMPLETE',
          note: 'Runtime is healthy for public/read-only routes; authenticated mutations remain fail-closed until OIDC is configured.',
        }),
      }, requestId);
    }
    if (req.method === 'POST' && url.pathname === '/api/runtime/metrics') {
      if (!allowRuntimeMetrics(String(req.socket.remoteAddress || 'anonymous'))) return json(res, 429, { ok: false, code: 'RUNTIME_METRIC_RATE_LIMIT' }, requestId);
      try {
        const body = await readBodyFixed(req);
        if (!Array.isArray(body.metrics) || body.metrics.length < 1 || body.metrics.length > RUNTIME_METRIC_LIMIT) return json(res, 400, { ok: false, code: 'RUNTIME_METRIC_BATCH_INVALID' }, requestId);
        for (const metric of body.metrics) {
          if (!RUNTIME_BROWSER_METRICS.has(metric?.name) || !Number.isFinite(metric?.value) || Math.abs(metric.value) > 1e12) return json(res, 422, { ok: false, code: 'RUNTIME_METRIC_INVALID' }, requestId);
          const labels = {};
          for (const [key, value] of Object.entries(metric.labels || {})) {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) || String(value).length > 64) return json(res, 422, { ok: false, code: 'RUNTIME_METRIC_LABEL_INVALID' }, requestId);
            if (Object.keys(labels).length >= 4) return json(res, 422, { ok: false, code: 'RUNTIME_METRIC_LABEL_LIMIT' }, requestId);
            labels[key] = String(value);
          }
          if (metric.name.endsWith('_total')) incrementTelemetryCounter(metric.name, labels, metric.value);
          else observeTelemetryMetric(metric.name, metric.value, labels);
          if (metric.name === 'tsm_browser_route_load_seconds') observeSlo('browser_route_load_p95', metric.value <= 3, labels);
          if (metric.name === 'tsm_browser_tile_request_latency_seconds') observeSlo('tile_request_p95', metric.value <= 1.5, labels);
        }
        return json(res, 202, { ok: true, accepted: body.metrics.length }, requestId);
      } catch (error) { return json(res, 400, { ok: false, code: 'RUNTIME_METRIC_PARSE_ERROR', error: error.message }, requestId); }
    }
    if (req.method === 'GET' && url.pathname === '/api/routing/route') {
      if (!checkRouteRateLimit(req, res, requestId)) return;
      try {
        const rawCoordinates = String(url.searchParams.get('coordinates') || '');
        if (!rawCoordinates) return json(res, 400, { ok: false, code: 'ROUTING_COORDINATES_REQUIRED' }, requestId);
        const coordinates = rawCoordinates.split(';').map((pair) => {
          const [longitude, latitude] = pair.split(',').map(Number);
          return [longitude, latitude];
        });
        const result = await routeOsrm({
          coordinates,
          alternatives: url.searchParams.get('alternatives') === 'true',
          steps: url.searchParams.get('steps') === 'true',
          overview: url.searchParams.get('overview') || 'false',
        });
        return json(res, 200, { ok: true, ...result }, requestId);
      } catch (error) {
        return json(res, error.name === 'RangeError' || error.name === 'TypeError' ? 422 : 502, { ok: false, code: 'OSRM_ROUTE_FAILED', error: error.message }, requestId);
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/data-sources/catalog') return json(res, 200, { build_sha: BUILD_SHA, sources: listAuthoritativeSources(), health: listSourceHealth(), circuits: listUpstreamCircuitHealth(), authority_boundary: 'Catalog metadata does not confer regulatory authority; source products retain their published status.' }, requestId);
    if (req.method === 'POST' && url.pathname === '/api/community/observations') {
      try {
        const clientKey = String(req.socket.remoteAddress || 'anonymous').trim();
        const artifact = await submitCommunityObservation(await readBodyFixed(req), Date.now(), clientKey);
        return json(res, 202, { ok: true, accepted: true, status: 'quarantine', artifact_id: artifact.artifact_id, authority_class: 'OBSERVATION', note: 'Community observations are not authoritative until authorized human review.' }, requestId);
      } catch (error) {
        return json(res, error.status || 422, { ok: false, code: error.code || 'COMMUNITY_SUBMISSION_INVALID', error: error.message }, requestId);
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/data-sources/fetch') {
      if (!checkRouteRateLimit(req, res, requestId)) return;
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
        const telemetryAlerts = detectTelemetrySourceFailures(event);
        if (telemetryAlerts.length > 0) {
          incrementTelemetryCounter('tsm_telemetry_source_unavailable_total', { source_id: event.source_id });
          console.error('[TSM telemetry] SOURCE_UNAVAILABLE fail-closed alert', {
            request_id: requestId,
            event_id: event.event_id,
            source_id: event.source_id,
            alerts: telemetryAlerts,
          });
        }
        const artifact = await appendArtifact({
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
        return json(res, telemetryAlerts.length > 0 ? 207 : 202, {
          ok: true,
          accepted: true,
          event_id: event.event_id,
          artifact_id: artifact.artifact_id,
          telemetry_alerts: telemetryAlerts,
        }, requestId);
      } catch (error) {
        return json(res, error instanceof TypeError ? 400 : 422, { ok: false, code: error.code || 'TELEMETRY_EVENT_INVALID', error: error.message }, requestId);
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/hydraulic/transfer') {
      try {
        const body = await readBodyFixed(req);
        const profile = body?.profile;
        if (!profile || profile.validation_status !== 'validated' || !profile.evidence_artifact_id || !profile.source_uri) {
          return json(res, 422, { ok: false, code: 'HYDRAULIC_PROFILE_NOT_VALIDATED', error: 'A validated, provenance-linked hydraulic profile is required.' }, requestId);
        }
        const evidence = await getArtifact(profile.evidence_artifact_id);
        if (!evidence || evidence.validation_status !== 'validated') {
          return json(res, 422, { ok: false, code: 'HYDRAULIC_PROFILE_EVIDENCE_INVALID', error: 'Referenced hydraulic evidence artifact is not validated.' }, requestId);
        }
        const station = calculateGaugeWseNavd88({
          stationId: String(body.station_id || '03378500'),
          stageFt: Number(body.stage_ft_gage_datum),
        });
        if (!station.ok) {
          return json(res, 200, { ok: true, provisional: true, code: 'STATION_WSE_UNVERIFIED', station }, requestId);
        }
        const result = calculateLocalProfileWSE({
          stationWseNavd88Ft: station.wse_navd88_ft,
          ohioWseNavd88Ft: Number(body.ohio_wse_navd88_ft),
          distanceDownstreamFt: Number(body.distance_downstream_ft),
          dischargeCfs: Number(body.discharge_cfs),
          invertNavd88Ft: Number(body.invert_navd88_ft),
          profile,
          segments: body.segments,
        });
        return json(res, 200, { ok: true, ...result, station_wse: station }, requestId);
      } catch (error) {
        return json(res, error.status || 422, { ok: false, code: error.code || 'HYDRAULIC_TRANSFER_FAILED', error: error.message }, requestId);
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/alerts/syslog-receiver') {
      try {
        const raw = await new Promise((resolve, reject) => {
          const chunks = [];
          let size = 0;
          req.on('data', (chunk) => {
            size += chunk.length;
            if (size > 64_000) { req.destroy(); reject(new Error('syslog payload exceeds 64 KB')); return; }
            chunks.push(chunk);
          });
          req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
          req.on('error', reject);
        });
        const signature = String(req.headers['x-tsm-alert-signature'] || '');
        const result = acceptSyslog(raw, signature);
        if (result.duplicate) return json(res, 200, { ok: true, duplicate: true, event_id: result.event_id }, requestId);
        incrementTelemetryCounter('tsm_alerts_received_total', { severity: result.severity });
        return json(res, 202, {
          ok: true,
          event_id: result.event_id,
          severity: result.severity,
          facility: result.facility,
          hostname: result.hostname,
          message: result.message,
          governance_status: 'human_review_required',
        }, requestId);
      } catch (error) {
        return json(res, error.status || 422, { ok: false, code: error.code || 'SYSLOG_RECEIVER_FAILED', error: error.message }, requestId);
      }
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/hydro/calculate-wse/')) {
      const stageValue = Number(decodeURIComponent(url.pathname.slice('/api/hydro/calculate-wse/'.length)));
      const stationId = url.searchParams.get('station_id') || '03378500';
      try {
        const result = calculateGaugeWseNavd88({ stationId, stageFt: stageValue });
        return json(res, result.ok ? 200 : 422, { ...result, requestId }, requestId);
      } catch (error) {
        console.error('[TSM hydro calibration] calculate-wse failed', { stationId, code: error?.code, message: error?.message });
        return json(res, error.status || 422, { ok: false, code: error.code || 'HYDRO_CALIBRATION_ERROR', error: error.message }, requestId);
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/hydrologic/calibration') {
      const stationId = url.searchParams.get('station_id') || '03378500';
      try {
        const node = getHydrologicNode(stationId);
        return json(res, 200, {
          ok: true,
          station_id: stationId,
          station_name: node.name,
          gage_zero_navd88_ft: Number.isFinite(Number(node.gage_zero_navd88_ft)) ? Number(node.gage_zero_navd88_ft) : null,
          gage_site_altitude_navd88_ft: Number.isFinite(Number(node.gage_site_altitude_navd88_ft)) ? Number(node.gage_site_altitude_navd88_ft) : null,
          flood_thresholds_ft: node.flood_thresholds_ft || null,
          flood_threshold_source: node.flood_threshold_source_uri || null,
          vertical_conversion_status: node.vertical_conversion_status || 'UNVERIFIED_CONVERSION',
          vertical_conversion_source: node.vertical_conversion_source_uri || null,
          site_transfer_status: node.site_transfer_required ? 'REQUIRES_VALIDATED_HYDRAULIC_PROFILE' : 'NOT_REQUIRED',
          hydraulic_extrusion_eligibility: node.site_transfer_required ? 'BLOCKED_UNTIL_SITE_WSE_TRANSFER_VALIDATED' : 'REVIEW_REQUIRED',
          requestId,
        }, requestId);
      } catch (error) {
        return json(res, error.status || 422, { ok: false, code: error.code || 'HYDRO_CALIBRATION_ERROR', error: error.message }, requestId);
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/autonomy/status') return json(res, 200, autonomyStatus(), requestId);
    if (req.method === 'GET' && url.pathname === '/api/autonomy/proposals') {
      try {
        const auth = await authenticateRequest(req);
        requireRoles(auth, String(process.env.TSM_OPERATOR_ROLE || 'tsm-operator'));
        return json(res, 200, { proposals: listLevel5Proposals() }, requestId);
      } catch (error) {
        return json(res, error.status || 401, { ok: false, code: error.code || 'AUTHENTICATION_REQUIRED', error: error.message }, requestId);
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/autonomy/evaluate') {
      try { return json(res, 201, evaluateLevel5(await readBodyFixed(req)), requestId); }
      catch (error) { return json(res, error.status || 422, { ok: false, code: error.code || 'AUTONOMY_EVALUATION_FAILED', error: error.message }, requestId); }
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/autonomy/proposals/') && url.pathname.endsWith('/approve')) {
      try {
        const proposalId = url.pathname.split('/')[4];
        const body = await readBodyFixed(req);
        const approval = approveLevel5Proposal(proposalId, requestAuth.subject, body.reason);
        return json(res, 200, approval, requestId);
      } catch (error) { return json(res, error.status || 422, { ok: false, code: error.code || 'AUTONOMY_APPROVAL_FAILED', error: error.message }, requestId); }
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/autonomy/proposals/') && url.pathname.endsWith('/execute')) {
      try {
        const proposalId = url.pathname.split('/')[4];
        return json(res, 200, await executeLevel5Proposal(proposalId, requestAuth.subject), requestId);
      } catch (error) { return json(res, error.status || 422, { ok: false, code: error.code || 'AUTONOMY_EXECUTION_FAILED', error: error.message }, requestId); }
    }
    if (req.method === 'GET' && url.pathname === '/api/data-sources/health') return json(res, 200, { build_sha: BUILD_SHA, sources: listSourceHealth(), circuits: listUpstreamCircuitHealth() }, requestId);
    if (req.method === 'GET' && url.pathname === '/api/geospatial/posey/site') { const assets = getPoseyAssetManifest(); return json(res, 200, { ok: true, site_id: 'posey-lower-wabash-ohio-community', horizontal_crs: 'EPSG:2966', horizontal_crs_name: 'NAD83 / Indiana West (ftUS)', vertical_datum: null, vertical_datum_verified: false, bounds: assets.bounds, terrain: assets.terrain, orthophoto: assets.orthophoto }, requestId); }
    if (req.method === 'GET' && url.pathname === '/api/geospatial/posey/raster') { if (!checkRouteRateLimit(req, res, requestId)) return; try { return await servePoseyAsset(req, res); } catch (error) { return json(res, error instanceof RangeError ? 400 : 502, { error: error.message, code: error instanceof RangeError ? 'GEOSPATIAL_REQUEST_INVALID' : 'GEOSPATIAL_SOURCE_UNAVAILABLE' }, requestId); } }
    if (req.method === 'GET' && url.pathname === '/api/evidence') { const authority_class = url.searchParams.get('authority_class') || undefined; const demo = url.searchParams.get('is_simulation_demo'); return json(res, 200, { artifacts: await listArtifacts({ limit: 100, authority_class, is_simulation_demo: demo === null ? undefined : demo === 'true' }) }, requestId); }
    if (req.method === 'GET' && url.pathname.startsWith('/api/evidence/') && url.pathname !== '/api/evidence/verify') { const id = url.pathname.split('/').pop(); const artifact = await getArtifact(id); return artifact ? json(res, 200, artifact, requestId) : json(res, 404, { error: 'not found' }, requestId); }
    if (req.method === 'POST' && url.pathname === '/api/evidence') { try { return json(res, 201, await appendArtifact(await readBodyFixed(req)), requestId); } catch (error) { return json(res, error.code === 'FAIL_CLOSED' ? 422 : 500, { error: error.message, code: error.code }, requestId); } }
    if (req.method === 'POST' && url.pathname === '/api/evidence/verify') { const body = await readBodyFixed(req); const artifact = await getArtifact(body.artifact_id); if (!artifact) return json(res, 404, { error: 'artifact not found' }, requestId); const result = verifyProvenance(artifact, body.canonical || artifact.payload); await recordVerification(body.artifact_id, result.expected, result.computed, 'api/evidence/verify'); return json(res, result.ok ? 200 : 422, result, requestId); }
    if (req.method === 'POST' && url.pathname === '/api/v1/engineering/compensatory-storage') { const body = await readBodyFixed(req); try { const result = evaluateCompensatoryStorage(body); const canonical = `TSM_ENGINE_LEAF:${buildCompensatoryStorageCanonical(body)}`; const artifact = await appendArtifact({ artifact_type: 'engineering_compensatory_storage', source_authority: 'TSM Engineering Solver', source_uri: 'internal://tsm/engineering/compensatory-storage', source_identifier: body.plan_id, retrieved_at: new Date().toISOString(), horizontal_crs: body.horizontal_crs || 'EPSG:2966', horizontal_crs_name: body.horizontal_crs_name || 'NAD83 / Indiana West (ftUS)', vertical_datum: body.vertical_datum || 'NAVD88', content_hash_sha256: String(result.evidence_artifact_hash).replace(/^sha256:/i, ''), validation_status: 'provisional', authority_class: 'MODEL_OUTPUT', derivation_class: 'DERIVED', software_version: 'tsm-engineering@0.1.0', operator_or_service_identity: 'compensatory-storage-api', governance_status: 'human_review_required', is_simulation_demo: false, human_review_status: 'pending', transformation_chain: [], payload: result, _canonical_for_verify: canonical, notes: 'Configurable storage-ratio analysis. Not a regulatory determination; verify governing permit criteria and engineering basis.' }); return json(res, 200, { ...result, evidence_artifact_id: artifact.artifact_id }, requestId); } catch (error) { return json(res, error instanceof TypeError || error instanceof RangeError ? 400 : 422, { error: error.message, code: error.code || 'ENGINEERING_VALIDATION_ERROR' }, requestId); } }
    if (req.method === 'POST' && url.pathname === '/api/engineering/ras-results') { const body = await readBodyFixed(req); try { const summary = validateRasResultsPayload(body); const artifact = await appendArtifact(buildRasResultsArtifact(summary, body)); return json(res, 201, { ok: true, plan_id: summary.plan_id, cells_accepted: summary.cell_count, content_hash_sha256: summary.content_hash_sha256, evidence_artifact_id: artifact.artifact_id, authority_class: 'MODEL_OUTPUT', governance_status: 'human_review_required', note: 'Downsampled HEC-RAS depth raster stored. Not a regulatory determination.' }, requestId); } catch (error) { return json(res, 422, { ok: false, error: error.message, code: error.code || 'RAS_RESULTS_INVALID' }, requestId); } }
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
        }, requestAuth.subject);
        return json(res, 201, publication, requestId);
      } catch (error) {
        return json(res, error.status || (error.code === 'NOT_FOUND' ? 404 : 422), { error: error.message, code: error.code || 'GOVERNANCE_FAULT' }, requestId);
      }
    }
    return json(res, 404, { error: 'not found' }, requestId);
  } catch (error) { return json(res, error instanceof Error && error.code === 'CIRCUIT_OPEN' ? 503 : 502, { error: error.message || 'upstream source unavailable', code: error.code || 'SOURCE_UNAVAILABLE', requestId }, requestId); }
  finally {
    const durationMs = performance.now() - requestStartedAt;
    recordHttpPerformance(req.method || 'UNKNOWN', url.pathname, res.statusCode || 500, durationMs);
    const elu = performance.eventLoopUtilization(eventLoopStartedAt);
    observeTelemetryMetric('tsm_server_event_loop_utilization_ratio', elu.utilization, { route: metricRoute(url.pathname) });
  }
});
if (AUTH_DISABLED) {
  console.log('TSM auth disabled (TSM_AUTH_MODE=disabled); skipping OIDC/Keycloak bootstrap. Auth endpoints report AUTH_DISABLED.');
} else {
  await bootstrapOidc();
}
server.listen(PORT, HOST, () => console.log(`TSM API on http://${HOST}:${PORT}`));
