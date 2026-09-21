import { requestJson } from './http-client.mjs';
import { SOURCE_CATALOG } from './source-contracts.mjs';

const CATALOG = new Map(SOURCE_CATALOG.map((source) => [source.id, source]));

function requireSource(sourceId) {
  const source = CATALOG.get(sourceId);
  if (!source) {
    const error = new Error(`unknown authoritative source: ${sourceId}`);
    error.code = 'UNKNOWN_SOURCE';
    throw error;
  }
  return source;
}

function assertAllowedUrl(source, url) {
  const requested = new URL(url);
  const canonical = new URL(source.endpoint);
  if (requested.origin !== canonical.origin || requested.protocol !== canonical.protocol || requested.username || requested.password || requested.port !== canonical.port) {
    const error = new Error(`source URL authority does not match ${source.id}`);
    error.code = 'SOURCE_ORIGIN_MISMATCH';
    throw error;
  }
  const canonicalPath = canonical.pathname.replace(/\\/$/, '');
  if (!requested.pathname.startsWith(canonicalPath + '/') && requested.pathname !== canonicalPath) {
    const error = new Error(`source URL path is outside the registered endpoint for ${source.id}`);
    error.code = 'SOURCE_PATH_MISMATCH';
    throw error;
  }
}

export async function fetchAuthoritativeJson(sourceId, url, options = {}) {
  const source = requireSource(sourceId);
  assertAllowedUrl(source, url);
  const startedAt = Date.now();
  const payload = await requestJson(url, {
    ...options,
    sourceId,
    onMetrics: (metrics) => options.onMetrics?.({ ...metrics, sourceId, authority: source.authority }),
  });
  return {
    sourceId,
    authority: source.authority,
    sourceUri: url,
    retrievedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    payload,
  };
}

export function getAuthoritativeSource(sourceId) {
  return requireSource(sourceId);
}

export function listAuthoritativeSources() {
  return SOURCE_CATALOG.map((source) => ({ ...source }));
}
