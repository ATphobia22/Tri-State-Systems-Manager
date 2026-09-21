import { redirect } from 'react-router';
import type { AuthContext } from '../types/loaders';

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
  apiBaseUrl: envString('VITE_TSM_API_BASE_URL') ?? '',
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

export async function getSessionFromServer(): Promise<AuthContext | null> {
  const response = await fetch(apiUrl('/api/auth/session'), {
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
