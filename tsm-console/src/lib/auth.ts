/**
 * Tri-State Systems Manager OIDC authentication.
 *
 * Provider: self-hosted Keycloak.
 * Flow: Authorization Code + PKCE using a public browser client.
 *
 * No client secret is stored in the browser, repository, or build artifacts.
 * The authorization server is responsible for authentication and token issuance.
 */

import { redirect } from 'react-router';
import type { AuthContext } from '../types/loaders';

export type IdPProvider = 'keycloak' | 'mock';

export interface IdPConfig {
  provider: IdPProvider;
  authority?: string;
  clientId?: string;
  redirectUri?: string;
  scopes?: string;
  sessionMaxAgeSec?: number;
}

interface OidcTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  id_token?: string;
  scope?: string;
}

interface OidcUserInfo {
  sub: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  [claim: string]: unknown;
}

function readEnv(): Record<string, unknown> {
  if (typeof import.meta === 'undefined') return {};
  return ((import.meta as ImportMeta & { env?: Record<string, unknown> }).env ?? {});
}

function envString(key: string): string | undefined {
  const value = readEnv()[key];
  return typeof value === 'string' ? value : undefined;
}

const DEFAULT_CONFIG: IdPConfig = {
  provider: envString('VITE_IDP_PROVIDER') === 'keycloak' ? 'keycloak' : 'mock',
  authority: envString('VITE_IDP_AUTHORITY'),
  clientId: envString('VITE_IDP_CLIENT_ID'),
  redirectUri:
    envString('VITE_IDP_REDIRECT_URI') ??
    (typeof window !== 'undefined' ? `${window.location.origin}/login/callback` : undefined),
  scopes: envString('VITE_IDP_SCOPES') ?? 'openid profile email',
  sessionMaxAgeSec: 8 * 60 * 60,
};

let config: IdPConfig = { ...DEFAULT_CONFIG };

export function configureIdP(partial: Partial<IdPConfig>): void {
  config = { ...config, ...partial };
}

export function getIdPConfig(): IdPConfig {
  return { ...config };
}

const SESSION_KEY = 'tsm_auth_session_v2';
const ACCESS_TOKEN_KEY = 'tsm_oidc_access_token_v1';
const REFRESH_TOKEN_KEY = 'tsm_oidc_refresh_token_v1';
const STATE_KEY = 'tsm_oidc_state_v1';
const VERIFIER_KEY = 'tsm_oidc_verifier_v1';
const RETURN_KEY = 'tsm_oidc_return_v1';

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64UrlEncode(randomBytes(32));
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return {
    verifier,
    challenge: base64UrlEncode(new Uint8Array(digest)),
  };
}

function loadSession(): AuthContext | null {
  const storage = browserStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthContext & { exp?: number };
    if (typeof parsed.exp === 'number' && Date.now() > parsed.exp) {
      storage.removeItem(SESSION_KEY);
      storage.removeItem(ACCESS_TOKEN_KEY);
      storage.removeItem(REFRESH_TOKEN_KEY);
      return null;
    }
    if (!parsed.uid || !parsed.tenantId || !parsed.authenticatedAt) return null;
    return {
      uid: parsed.uid,
      tenantId: parsed.tenantId,
      roles: Array.isArray(parsed.roles) ? parsed.roles : [],
      classificationMax: parsed.classificationMax || 'public',
      authenticatedAt: parsed.authenticatedAt,
    };
  } catch {
    return null;
  }
}

function persistSession(session: AuthContext | null, maxAgeSec?: number): void {
  const storage = browserStorage();
  if (!storage) return;

  if (!session) {
    storage.removeItem(SESSION_KEY);
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }

  const age = maxAgeSec ?? config.sessionMaxAgeSec ?? 28800;
  storage.setItem(
    SESSION_KEY,
    JSON.stringify({ ...session, exp: Date.now() + age * 1000 }),
  );
}

let currentSession: AuthContext | null = null;

export function getSession(): AuthContext | null {
  if (currentSession) return currentSession;
  currentSession = loadSession();
  return currentSession;
}

export function setSession(session: AuthContext | null): void {
  currentSession = session;
  persistSession(session);
}

function assertKeycloakConfig(): Required<Pick<IdPConfig, 'authority' | 'clientId' | 'redirectUri'>> {
  if (!config.authority || !config.clientId || !config.redirectUri) {
    throw new Error(
      'Keycloak is not configured: set VITE_IDP_AUTHORITY, VITE_IDP_CLIENT_ID, and VITE_IDP_REDIRECT_URI',
    );
  }
  return {
    authority: config.authority.replace(/\/$/, ''),
    clientId: config.clientId,
    redirectUri: config.redirectUri,
  };
}

function keycloakEndpoint(path: string): string {
  const { authority } = assertKeycloakConfig();
  return `${authority}/protocol/openid-connect/${path}`;
}

function persistOidcState(state: string, verifier: string, returnTo: string): void {
  const storage = browserStorage();
  if (!storage) return;
  storage.setItem(STATE_KEY, state);
  storage.setItem(VERIFIER_KEY, verifier);
  storage.setItem(RETURN_KEY, returnTo);
}

function clearOidcState(): void {
  const storage = browserStorage();
  if (!storage) return;
  storage.removeItem(STATE_KEY);
  storage.removeItem(VERIFIER_KEY);
  storage.removeItem(RETURN_KEY);
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid OIDC ID token');
  const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const json = atob(padded);
  return JSON.parse(json) as Record<string, unknown>;
}

function mapClaimsToAuthContext(claims: Record<string, unknown>): AuthContext {
  const uid = typeof claims.sub === 'string' ? claims.sub : '';
  if (!uid) throw new Error('OIDC response did not contain a subject claim');

  const roles = Array.isArray(claims.roles)
    ? claims.roles.filter((role): role is string => typeof role === 'string')
    : [];

  const realmAccess = claims.realm_access;
  if (realmAccess && typeof realmAccess === 'object' && realmAccess !== null) {
    const realmRoles = (realmAccess as { roles?: unknown }).roles;
    if (Array.isArray(realmRoles)) {
      for (const role of realmRoles) {
        if (typeof role === 'string' && !roles.includes(role)) roles.push(role);
      }
    }
  }

  return {
    uid,
    tenantId: typeof claims.tenant_id === 'string' ? claims.tenant_id : 'tsm',
    roles,
    classificationMax:
      claims.classification_max === 'confidential' ||
      claims.classification_max === 'restricted' ||
      claims.classification_max === 'internal'
        ? claims.classification_max
        : 'public',
    authenticatedAt: new Date().toISOString(),
  };
}

/** Begin Keycloak Authorization Code + PKCE login. */
export async function login(opts?: { returnTo?: string }): Promise<void> {
  if (config.provider === 'mock') {
    const sandbox: AuthContext = {
      uid: 'sandbox-auditor-user-82',
      tenantId: 'tucker-inc-82-regional-os',
      roles: ['auditor', 'viewer'],
      classificationMax: 'restricted',
      authenticatedAt: new Date().toISOString(),
    };
    setSession(sandbox);
    if (typeof window !== 'undefined' && opts?.returnTo) window.location.href = opts.returnTo;
    return;
  }

  const { authority, clientId, redirectUri } = assertKeycloakConfig();
  const { verifier, challenge } = await createPkcePair();
  const state = base64UrlEncode(randomBytes(32));
  const returnTo = opts?.returnTo || '/';

  persistOidcState(state, verifier, returnTo);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes || 'openid profile email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  if (typeof window !== 'undefined') {
    window.location.assign(`${authority}/protocol/openid-connect/auth?${params.toString()}`);
  }
}

/** Exchange the authorization code directly with the public Keycloak client. */
export async function handleOidcCallback(code: string, state: string): Promise<AuthContext> {
  if (!code || !state) throw new Error('Missing OIDC callback parameters');

  const storage = browserStorage();
  const expectedState = storage?.getItem(STATE_KEY);
  const verifier = storage?.getItem(VERIFIER_KEY);

  if (!expectedState || expectedState !== state) throw new Error('OIDC state mismatch');
  if (!verifier) throw new Error('OIDC PKCE verifier missing');

  const { clientId, redirectUri } = assertKeycloakConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const response = await fetch(keycloakEndpoint('token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = (await response.json()) as Partial<OidcTokenResponse> & { error?: string; error_description?: string };
  if (!response.ok || typeof data.access_token !== 'string') {
    throw new Error(data.error_description || data.error || 'Keycloak token exchange failed');
  }

  if (storage) {
    storage.setItem(ACCESS_TOKEN_KEY, data.access_token);
    if (typeof data.refresh_token === 'string') storage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
  }

  let claims: Record<string, unknown>;
  if (typeof data.id_token === 'string') {
    claims = decodeJwtPayload(data.id_token);
  } else {
    const userInfoResponse = await fetch(keycloakEndpoint('userinfo'), {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (!userInfoResponse.ok) throw new Error('Keycloak userinfo request failed');
    claims = (await userInfoResponse.json()) as OidcUserInfo;
  }

  const auth = mapClaimsToAuthContext(claims);
  setSession(auth);
  clearOidcState();
  return auth;
}

export function logout(): void {
  const storage = browserStorage();
  const idTokenHint = storage?.getItem('tsm_oidc_id_token');
  setSession(null);
  clearOidcState();

  if (config.provider !== 'keycloak' || typeof window === 'undefined') return;

  try {
    const { clientId, redirectUri } = assertKeycloakConfig();
    const params = new URLSearchParams({ client_id: clientId, post_logout_redirect_uri: redirectUri });
    if (idTokenHint) params.set('id_token_hint', idTokenHint);
    window.location.assign(`${keycloakEndpoint('logout')}?${params.toString()}`);
  } catch {
    // Local session is already cleared; no external redirect is required on configuration failure.
  }
}

export function getAccessToken(): string | null {
  return browserStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

/** Parent route auth loader. */
export async function authLoader({ request }: { request?: Request } = {}): Promise<AuthContext> {
  const session = getSession();
  if (session) return session;

  if (config.provider === 'mock') {
    const sandbox: AuthContext = {
      uid: 'sandbox-auditor-user-82',
      tenantId: 'tucker-inc-82-regional-os',
      roles: ['auditor', 'viewer'],
      classificationMax: 'restricted',
      authenticatedAt: new Date().toISOString(),
    };
    setSession(sandbox);
    return sandbox;
  }

  const returnTo =
    request && typeof URL !== 'undefined'
      ? new URL(request.url).pathname + new URL(request.url).search
      : '/';
  throw redirect(`/login?from=${encodeURIComponent(returnTo)}`);
}

export function requireClassification(
  auth: AuthContext,
  required: AuthContext['classificationMax'],
): void {
  const order = ['public', 'internal', 'restricted', 'confidential'] as const;
  if (order.indexOf(auth.classificationMax) < order.indexOf(required)) {
    throw new Response('Insufficient classification clearance', { status: 403 });
  }
}

export function requireRole(auth: AuthContext, roles: string[]): void {
  if (!roles.some((role) => auth.roles.includes(role))) {
    throw new Response('Insufficient role', { status: 403 });
  }
}
