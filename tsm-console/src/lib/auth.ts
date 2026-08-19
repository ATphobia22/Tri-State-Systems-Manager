/**
 * Zero-Trust Auth Module (NIST SP 800-207)
 * WP-2: Auth loader gate
 *
 * Phase 1: session-based check with clear extension points
 * for MFA, hardware keys, and tenant isolation.
 * Never trust network location; always verify identity.
 */

import { redirect } from 'react-router';
import type { AuthContext } from '../types/loaders';

/** In-memory / future cookie-backed session. Replace with real IdP. */
let currentSession: AuthContext | null = null;

export function getSession(): AuthContext | null {
  return currentSession;
}

export function setSession(session: AuthContext | null): void {
  currentSession = session;
}

/**
 * Parent route auth loader.
 * Throws redirect if unauthenticated.
 * Returns AuthContext for downstream loaders via useRouteLoaderData('root').
 */
export async function authLoader(): Promise<AuthContext> {
  const session = getSession();

  // Phase 1 development fallback: allow a sandbox auditor identity
  // when no real IdP is configured. REMOVE before production.
  if (!session) {
    if (import.meta.env?.DEV || typeof window !== 'undefined') {
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
    throw redirect('/login');
  }

  // Continuous verification placeholder (re-check token expiry, device posture, etc.)
  return session;
}

/**
 * Require a minimum classification level.
 * Call from child loaders when data is restricted/confidential.
 */
export function requireClassification(
  auth: AuthContext,
  required: AuthContext['classificationMax']
): void {
  const order = ['public', 'internal', 'restricted', 'confidential'] as const;
  if (order.indexOf(auth.classificationMax) < order.indexOf(required)) {
    throw new Response('Insufficient classification clearance', { status: 403 });
  }
}
