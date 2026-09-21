import { createHash, randomBytes } from 'node:crypto';
import { verifyAccessToken, verifyIdToken } from './oidc-auth.mjs';
import { clearSessionCookie, clearTransactionCookie, readTransactionCookie, setSessionCookie, setTransactionCookie, readSessionCookie } from './session-cookie.mjs';

const DISCOVERY_TTL_MS = 300_000;
let discoveryCache = null;

function config() {
  const issuer = String(process.env.OIDC_ISSUER || '').replace(/\/$/, '');
  const clientId = String(process.env.OIDC_CLIENT_ID || '').trim();
  const redirectUri = String(process.env.OIDC_REDIRECT_URI || '').trim();
  const sessionSecret = String(process.env.TSM_SESSION_SECRET || '');
  const clientSecret = String(process.env.OIDC_CLIENT_SECRET || '');
  const audience = String(process.env.OIDC_AUDIENCE || '').trim();
  const maxAge = Number(process.env.TSM_BROWSER_SESSION_MAX_AGE_SEC || 900);
  if (!issuer || !audience || !clientId || !redirectUri || sessionSecret.length < 32 || (String(process.env.TSM_AUTH_MODE || 'required').toLowerCase() !== 'disabled' && clientSecret.length < 16)) {
    throw Object.assign(new Error('OIDC browser session is not configured. Set OIDC_ISSUER, OIDC_AUDIENCE, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI, and TSM_SESSION_SECRET.'), { code: 'AUTH_CONFIGURATION_ERROR', status: 503 });
  }
  if (!/^https:\/\//i.test(issuer) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(issuer)) {
    throw Object.assign(new Error('OIDC_ISSUER must use HTTPS outside local development.'), { code: 'AUTH_CONFIGURATION_ERROR', status: 503 });
  }
  if (!/^https:\/\//i.test(redirectUri) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(redirectUri)) {
    throw Object.assign(new Error('OIDC_REDIRECT_URI must use HTTPS outside local development.'), { code: 'AUTH_CONFIGURATION_ERROR', status: 503 });
  }
  if (!Number.isInteger(maxAge) || maxAge < 300 || maxAge > 3600) throw Object.assign(new Error('TSM_BROWSER_SESSION_MAX_AGE_SEC must be between 300 and 3600 seconds.'), { code: 'AUTH_CONFIGURATION_ERROR', status: 503 });
  return { issuer, audience, clientId, redirectUri, maxAge };
}

async function discovery() {
  const { issuer } = config();
  if (discoveryCache && discoveryCache.expiresAt > Date.now()) return discoveryCache.document;
  const response = await fetch(issuer + '/.well-known/openid-configuration', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw Object.assign(new Error('OIDC discovery endpoint returned HTTP ' + response.status + '.'), { code: 'OIDC_DISCOVERY_UNAVAILABLE', status: 503 });
  const document = await response.json();
  const endpoints = [document.authorization_endpoint, document.token_endpoint, document.jwks_uri];
  const localHttpAllowed = /^(http:\/\/(localhost|127\.0\.0\.1)(:\\d+)?)/i;
  const endpointsValid = endpoints.every((value) => {
    try { const endpoint = new URL(String(value)); return endpoint.protocol === 'https:' || localHttpAllowed.test(endpoint.toString()); }
    catch { return false; }
  });
  if (document.issuer !== issuer || !document.authorization_endpoint || !document.token_endpoint || !document.jwks_uri || !endpointsValid) {
    throw Object.assign(new Error('OIDC discovery metadata is incomplete, issuer-mismatched, or contains insecure endpoints.'), { code: 'OIDC_DISCOVERY_INVALID', status: 503 });
  }
  discoveryCache = { document, expiresAt: Date.now() + DISCOVERY_TTL_MS };
  return document;
}

function safeReturnTo(value) {
  const target = String(value || '/');
  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) return '/';
  return target;
}

function pkceChallenge(verifier) {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

export async function beginOidcLogin(req, res) {
  const { clientId, redirectUri } = config();
  const provider = await discovery();
  const verifier = randomBytes(32).toString('base64url');
  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const returnTo = safeReturnTo(new URL(req.url || '/', 'http://localhost').searchParams.get('returnTo'));
  setTransactionCookie(res, { state, verifier, nonce, returnTo, createdAt: Date.now() });
  const authorization = new URL(provider.authorization_endpoint);
  authorization.searchParams.set('response_type', 'code');
  authorization.searchParams.set('client_id', clientId);
  authorization.searchParams.set('redirect_uri', redirectUri);
  authorization.searchParams.set('scope', String(process.env.OIDC_SCOPES || 'openid profile email roles'));
  authorization.searchParams.set('state', state);
  authorization.searchParams.set('nonce', nonce);
  authorization.searchParams.set('code_challenge', pkceChallenge(verifier));
  authorization.searchParams.set('code_challenge_method', 'S256');
  res.writeHead(302, { Location: authorization.toString(), 'Cache-Control': 'no-store' });
  res.end();
}

export async function finishOidcLogin(req, res) {
  const { clientId, redirectUri, audience, maxAge } = config();
  const url = new URL(req.url || '/', 'http://localhost');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const transaction = readTransactionCookie(req);
  if (!code || !state || !transaction || transaction.state !== state || Date.now() - Number(transaction.createdAt || 0) > 600_000) {
    clearTransactionCookie(res);
    throw Object.assign(new Error('OIDC callback state is invalid or expired.'), { code: 'OIDC_STATE_INVALID', status: 400 });
  }

  const provider = await discovery();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
    code_verifier: transaction.verifier,
  });
  const clientSecret = String(process.env.OIDC_CLIENT_SECRET || '');
  body.set('client_secret', clientSecret);
  const tokenResponse = await fetch(provider.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || typeof token.access_token !== 'string' || typeof token.id_token !== 'string') {
    clearTransactionCookie(res);
    throw Object.assign(new Error(token.error_description || token.error || 'OIDC token exchange failed.'), { code: 'OIDC_TOKEN_EXCHANGE_FAILED', status: 502 });
  }

  const issuer = String(process.env.OIDC_ISSUER || '').replace(/\/$/, '');
  const jwksUrl = String(process.env.OIDC_JWKS_URL || provider.jwks_uri).trim();
  await verifyIdToken(token.id_token, { issuer, clientId, audience, jwksUrl }, transaction.nonce);
  const auth = await verifyAccessToken(token.access_token, { issuer, audience, jwksUrl });
  setSessionCookie(res, {
    v: 1,
    accessToken: token.access_token,
    subject: auth.subject,
    expiresAt: Math.min(
      Date.now() + Math.max(1, Number(token.expires_in || 300)) * 1000,
      Date.now() + maxAge * 1000,
    ),
  }, Math.min(Number(token.expires_in || 300), maxAge));
  clearTransactionCookie(res);
  res.writeHead(302, { Location: safeReturnTo(transaction.returnTo), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  res.end();
}

export async function getBrowserSession(req) {
  const session = readSessionCookie(req);
  if (!session?.accessToken || typeof session.accessToken !== 'string') return null;
  if (typeof session.expiresAt !== 'number' || session.expiresAt <= Date.now()) return null;
  const { issuer, audience } = config();
  const provider = await discovery();
  const auth = await verifyAccessToken(session.accessToken, {
    issuer,
    audience,
    jwksUrl: String(process.env.OIDC_JWKS_URL || provider.jwks_uri).trim(),
  });
  return { ...auth, browserSession: true };
}

export function logoutOidc(res) {
  clearSessionCookie(res);
  clearTransactionCookie(res);
  res.writeHead(302, { Location: '/', 'Cache-Control': 'no-store', 'Clear-Site-Data': '"cache", "cookies", "storage"', 'Referrer-Policy': 'no-referrer' });
  res.end();
}
