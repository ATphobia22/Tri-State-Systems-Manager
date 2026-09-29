import { redirect } from 'react-router';
import type { AuthContext } from '../types/loaders';
import { resolveApiBaseUrl } from './api-base';

export type IdPProvider = 'keycloak';
export interface IdPConfig {
  provider: IdPProvider;
  apiBaseUrl?: string;
  sessionMaxAgeSec?: number;
}

const env = ((import.meta as ImportMeta & { env?: Record<string, unknown> }).env ?? {}) as Record<string, unknown>;
const envString = (key: string): string | undefined => typeof env[key] === 'string' ? env[key] as string : undefined;

const DEFAULT_CONFIG: IdPConfig = {
  provider: 'keycloak',
  apiBaseUrl: envString('VITE_TSM_API_BASE_URL') ?? resolveApiBaseUrl(),
  sessionMaxAgeSec: 3600,
};
let config: IdPConfig = { ...DEFAULT_CONFIG };
let currentSession: AuthContext | null = null;

export function configureIdP(partial: Partial<IdPConfig>): void {
  config = { ...config, ...partial };
}

export function getIdPConfig(): IdPConfig {
  return { ...config };
}

function apiUrl(path: string): string {
  const base = String(config.apiBaseUrl || '').replace(/\/$/, '');
  return `${base}${path}`;
}

function toAuthContext(payload: { subject?: unknown; roles?: unknown }): AuthContext {
  const uid = typeof payload.subject === 'string' ? payload.subject : '';
  if (!uid) throw new Error('Authenticated OIDC session did not contain a subject.');
  const roles = Array.isArray(payload.roles)
    ? payload.roles.filter((role): role is string => typeof role === 'string')
    : [];
  return {
    uid,
    tenantId: 'tsm',
    roles,
    classificationMax: roles.includes('tsm-reviewer') || roles.includes('tsm-operator') ? 'internal' : 'public',
    authenticatedAt: new Date().toISOString(),
  };
}

let authDisabledCache: boolean | null = null;

/**
 * True when the API reports login disabled (TSM_AUTH_MODE=disabled) or has no
 * OIDC configured. Result is cached for the page lifetime; call
 * resetAuthDisabledCache() to re-probe.
 */
export async function isAuthDisabled(): Promise<boolean> {
  if (authDisabledCache !== null) return authDisabledCache;
  try {
    const response = await fetch(apiUrl('/api/auth/health'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      authDisabledCache = false;
      return false;
    }
    const payload = (await response.json()) as { auth_disabled?: boolean; oidc_configured?: boolean };
    authDisabledCache = payload.auth_disabled === true || payload.oidc_configured === false;
  } catch {
    authDisabledCache = false;
  }
  return authDisabledCache;
}

export function resetAuthDisabledCache(): void {
  authDisabledCache = null;
}

export async function getSessionFromServer(): Promise<AuthContext | null> {  const response = await fetch(apiUrl('/api/auth/session'), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    currentSession = null;
    return null;
  }
  const payload = await response.json() as { authenticated?: boolean; subject?: unknown; roles?: unknown };
  currentSession = payload.authenticated ? toAuthContext(payload) : null;
  return currentSession;
}

export async function login(opts?: { returnTo?: string }): Promise<void> {
  const returnTo = String(opts?.returnTo || '/');
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) throw new Error('Invalid return path.');
  if (await isAuthDisabled()) throw new Error('Sign-in is disabled in this deployment. The console runs in local mode.');
  window.location.assign(apiUrl(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`));
}

export async function handleOidcCallback(_code?: string, _state?: string): Promise<AuthContext> {
  const session = await getSessionFromServer();
  if (!session) throw new Error('OIDC browser session was not established.');
  return session;
}

export async function logout(): Promise<void> {
  const response = await fetch(apiUrl('/api/auth/logout'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-TSM-CSRF': '1' },
    cache: 'no-store',
  });
  currentSession = null;
  if (!response.ok) throw new Error('OIDC logout failed.');
  window.location.assign('/');
}

export function getSession(): AuthContext | null {
  return currentSession;
}

/** Access tokens are intentionally unavailable to browser code. */
export function getAccessToken(): null {
  return null;
}

export async function authLoader({ request }: { request?: Request } = {}): Promise<AuthContext> {
  const session = await getSessionFromServer();
  if (session) return session;
  const returnTo = request && typeof URL !== 'undefined'
    ? new URL(request.url).pathname + new URL(request.url).search
    : '/';
  throw redirect(`/login?from=${encodeURIComponent(returnTo)}`);
}

/** Public read access is intentional. Mutations remain authenticated and human-authorized. */
export function requireAuthenticatedMutation(request?: Request): AuthContext {
  const session = getSession();
  if (session) return session;
  const returnTo = request && typeof URL !== 'undefined'
    ? new URL(request.url).pathname + new URL(request.url).search
    : '/';
  throw redirect(`/login?from=${encodeURIComponent(returnTo)}`);
}

export function requireClassification(auth: AuthContext, required: AuthContext['classificationMax']): void {
  const order = ['public', 'internal', 'restricted', 'confidential'] as const;
  if (order.indexOf(auth.classificationMax) < order.indexOf(required)) {
    throw new Response('Insufficient classification clearance', { status: 403 });
  }
}

export function requireRole(auth: AuthContext, roles: string[]): void {
  if (!roles.some((role) => auth.roles.includes(role))) throw new Response('Insufficient role', { status: 403 });
}
