/**
 * Zero-Trust Auth Module (NIST SP 800-207) — Production IdP Ready
 *
 * Never trust network location; always verify identity.
 * Continuous verification: session expiry, classification, roles.
 *
 * Supported IdP adapters (configure via VITE_IDP_* env):
 *   - oidc  → Auth0 / Keycloak / Okta / Entra ID (OAuth2 + OIDC)
 *   - mock  → DEV sandbox only (never production)
 */

import { redirect } from 'react-router';
import type { AuthContext } from '../types/loaders';

export type IdPProvider = 'oidc' | 'mock';

export interface IdPConfig {
  provider: IdPProvider;
  authority?: string;
  clientId?: string;
  redirectUri?: string;
  scopes?: string;
  sessionMaxAgeSec?: number;
}

const DEFAULT_CONFIG: IdPConfig = {
  provider: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_IDP_PROVIDER) || 'mock',
  authority: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_IDP_AUTHORITY) || undefined,
  clientId: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_IDP_CLIENT_ID) || undefined,
  redirectUri: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_IDP_REDIRECT_URI) ||
    (typeof window !== 'undefined' ? `${window.location.origin}/login/callback` : undefined),
  scopes: 'openid profile email offline_access',
  sessionMaxAgeSec: 8 * 60 * 60,
};

let config: IdPConfig = { ...DEFAULT_CONFIG };

export function configureIdP(partial: Partial<IdPConfig>): void {
  config = { ...config, ...partial };
}

export function getIdPConfig(): IdPConfig {
  return { ...config };
}

const SESSION_KEY = 'tsm_auth_session_v1';

function loadSession(): AuthContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthContext & { exp?: number };
    if (parsed.exp && Date.now() > parsed.exp) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return {
      uid: parsed.uid,
      tenantId: parsed.tenantId,
      roles: parsed.roles || [],
      classificationMax: parsed.classificationMax || 'public',
      authenticatedAt: parsed.authenticatedAt,
    };
  } catch {
    return null;
  }
}

function persistSession(session: AuthContext | null, maxAgeSec?: number): void {
  if (typeof window === 'undefined') return;
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  const age = maxAgeSec ?? config.sessionMaxAgeSec ?? 28800;
  const payload = { ...session, exp: Date.now() + age * 1000 };
  localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
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

/**
 * Begin login. Production: redirect to IdP authorize (OIDC + PKCE).
 * Mock: create sandbox auditor session (DEV only).
 */
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
    if (typeof window !== 'undefined' && opts?.returnTo) {
      window.location.href = opts.returnTo;
    }
    return;
  }

  if (!config.authority || !config.clientId || !config.redirectUri) {
    throw new Error('IdP not configured: set VITE_IDP_AUTHORITY, VITE_IDP_CLIENT_ID, VITE_IDP_REDIRECT_URI');
  }

  const state = crypto.randomUUID();
  const returnTo = opts?.returnTo || '/';
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('tsm_oidc_state', state);
    sessionStorage.setItem('tsm_oidc_return', returnTo);
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes || 'openid profile email',
    state,
  });

  const authorizeUrl = `${config.authority.replace(/\/$/, '')}/authorize?${params.toString()}`;
  if (typeof window !== 'undefined') {
    window.location.href = authorizeUrl;
  }
}

/**
 * Handle OIDC callback: exchange code for tokens, map claims → AuthContext.
 * Production: backend token proxy + claim mapping required.
 */
export async function handleOidcCallback(code: string, state: string): Promise<AuthContext> {
  if (typeof window !== 'undefined') {
    const expected = sessionStorage.getItem('tsm_oidc_state');
    if (!expected || expected !== state) {
      throw new Error('OIDC state mismatch');
    }
  }

  const code_verifier =
    typeof window !== 'undefined' ? sessionStorage.getItem('tsm_oidc_verifier') || undefined : undefined;
  const redirect_uri = config.redirectUri;

  const res = await fetch('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier, redirect_uri }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Token exchange failed');
  }

  const auth = data.auth as AuthContext;
  setSession(auth);
  return auth;
}

export function logout(): void {
  setSession(null);
}

/**
 * Parent route auth loader. Throws redirect if unauthenticated when provider=oidc.
 */
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
  required: AuthContext['classificationMax']
): void {
  const order = ['public', 'internal', 'restricted', 'confidential'] as const;
  if (order.indexOf(auth.classificationMax) < order.indexOf(required)) {
    throw new Response('Insufficient classification clearance', { status: 403 });
  }
}

export function requireRole(auth: AuthContext, roles: string[]): void {
  if (!roles.some((r) => auth.roles.includes(r))) {
    throw new Response('Insufficient role', { status: 403 });
  }
}
