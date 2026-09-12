const configuredBase = String(import.meta.env.VITE_TSM_API_BASE_URL || '').trim();

/**
 * API base is intentionally deployment-configurable.
 * Default `/api` assumes a same-origin reverse proxy to the TSM Node service.
 * GitHub Pages cannot execute the Node service itself; production deployments
 * must provide VITE_TSM_API_BASE_URL or an equivalent reverse proxy.
 */
export const TSM_API_BASE_URL = configuredBase.replace(/\/$/, '');

export function tsmApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${TSM_API_BASE_URL}${normalized}`;
}
