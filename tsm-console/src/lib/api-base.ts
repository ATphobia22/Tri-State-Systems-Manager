const configuredBase = String(import.meta.env.VITE_TSM_API_BASE_URL || '').trim();

/**
 * Runtime override for packaged deployments (e.g. the offline desktop app),
 * which inject `window.__TSM_CONFIG__ = { apiBaseUrl }` before the bundle loads.
 * Build-time env wins when set; the runtime override fills the gap otherwise.
 */
function readRuntimeBase(): string {
  try {
    const cfg = (globalThis as unknown as { __TSM_CONFIG__?: { apiBaseUrl?: unknown } }).__TSM_CONFIG__;
    return typeof cfg?.apiBaseUrl === 'string' ? cfg.apiBaseUrl.trim() : '';
  } catch {
    return '';
  }
}

export function resolveApiBaseUrl(): string {
  return (configuredBase || readRuntimeBase()).replace(/\/$/, '');
}

/**
 * API base is intentionally deployment-configurable.
 * Default `/api` assumes a same-origin reverse proxy to the TSM Node service.
 * GitHub Pages cannot execute the Node service itself; production deployments
 * must provide VITE_TSM_API_BASE_URL, a reverse proxy, or the __TSM_CONFIG__
 * runtime override.
 */
export const TSM_API_BASE_URL = resolveApiBaseUrl();

export function tsmApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${TSM_API_BASE_URL}${normalized}`;
}
