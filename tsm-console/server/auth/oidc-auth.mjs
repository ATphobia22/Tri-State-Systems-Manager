import { createPublicKey, createVerify } from 'node:crypto';
import { readSessionCookie } from './session-cookie.mjs';

const CLOCK_SKEW_SECONDS = 60;
const JWKS_TIMEOUT_MS = 5000;
let jwksCache = { expiresAt: 0, keys: new Map() };

function authError(message, code = 'AUTHENTICATION_REQUIRED', status = 401) { const error = new Error(message); error.code = code; error.status = status; return error; }
function base64urlDecode(value) { return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='), 'base64'); }
function parseJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw authError('Bearer token must be a compact JWT.', 'INVALID_TOKEN');
  try { return { encodedHeader: parts[0], encodedPayload: parts[1], signature: base64urlDecode(parts[2]), header: JSON.parse(base64urlDecode(parts[0]).toString('utf8')), payload: JSON.parse(base64urlDecode(parts[1]).toString('utf8')) }; }
  catch { throw authError('Bearer token is not valid JWT encoding.', 'INVALID_TOKEN'); }
}
function getConfiguredAuth() {
  const issuer = String(process.env.OIDC_ISSUER || '').replace(/\/$/, '');
  const audience = String(process.env.OIDC_AUDIENCE || '').trim();
  const jwksUrl = String(process.env.OIDC_JWKS_URL || (issuer ? issuer + '/protocol/openid-connect/certs' : '')).trim();
  const mode = String(process.env.TSM_AUTH_MODE || 'required').toLowerCase();
  if (mode === 'disabled') return { mode };
  if (!issuer || !audience || !jwksUrl) throw authError('OIDC server authorization is not configured. Set OIDC_ISSUER, OIDC_AUDIENCE, and OIDC_JWKS_URL.', 'AUTH_CONFIGURATION_ERROR', 503);
  return { mode, issuer, audience, jwksUrl };
}
async function loadJwks(url, forceRefresh = false) {
  if (!forceRefresh && jwksCache.expiresAt > Date.now() && jwksCache.keys.size) return jwksCache.keys;
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), JWKS_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw authError('OIDC JWKS endpoint returned HTTP ' + response.status + '.', 'OIDC_JWKS_UNAVAILABLE', 503);
    const document = await response.json();
    if (!Array.isArray(document.keys)) throw authError('OIDC JWKS document has no keys.', 'OIDC_JWKS_INVALID', 503);
    const keys = new Map(); for (const jwk of document.keys) if (jwk?.kid && jwk.kty === 'RSA' && jwk.n && jwk.e) keys.set(jwk.kid, jwk);
    if (!keys.size) throw authError('OIDC JWKS contains no usable RSA signing keys.', 'OIDC_JWKS_INVALID', 503);
    jwksCache = { keys, expiresAt: Date.now() + 300000 }; return keys;
  } catch (error) { if (error.name === 'AbortError') throw authError('OIDC JWKS request timed out.', 'OIDC_JWKS_TIMEOUT', 503); throw error; }
  finally { clearTimeout(timer); }
}
function claimRoles(payload, audience) {
  const roles = new Set();
  const realmRoles = payload?.realm_access?.roles; if (Array.isArray(realmRoles)) realmRoles.forEach((role) => typeof role === 'string' && roles.add(role));
  const target = payload?.resource_access?.[audience]; if (Array.isArray(target?.roles)) target.roles.forEach((role) => typeof role === 'string' && roles.add(role));
  return [...roles].sort();
}
function hasAudience(payload, expected) { const values = Array.isArray(payload?.aud) ? payload.aud : [payload?.aud]; return values.includes(expected); }
function verifyClaims(payload, config) {
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== config.issuer) throw authError('OIDC issuer mismatch.', 'TOKEN_ISSUER_MISMATCH');
  if (!hasAudience(payload, config.audience)) throw authError('OIDC audience mismatch.', 'TOKEN_AUDIENCE_MISMATCH');
  if (typeof payload.exp !== 'number' || payload.exp <= now - CLOCK_SKEW_SECONDS) throw authError('OIDC access token is expired.', 'TOKEN_EXPIRED');
  if (payload.nbf !== undefined && (typeof payload.nbf !== 'number' || payload.nbf > now + CLOCK_SKEW_SECONDS)) throw authError('OIDC access token is not active.', 'TOKEN_NOT_ACTIVE');
  if (typeof payload.sub !== 'string' || !payload.sub.trim()) throw authError('OIDC subject is missing.', 'TOKEN_SUBJECT_MISSING');
}
export async function verifyAccessToken(token, config) {
  const parsed = parseJwt(token);
  if (parsed.header.alg !== 'RS256') throw authError('Only RS256 OIDC access tokens are accepted.', 'TOKEN_ALGORITHM_UNSUPPORTED');
  if (typeof parsed.header.kid !== 'string') throw authError('OIDC signing key id is missing.', 'TOKEN_KEY_ID_MISSING');
  verifyClaims(parsed.payload, config);
  let keys = await loadJwks(config.jwksUrl); let jwk = keys.get(parsed.header.kid);
  if (!jwk) { keys = await loadJwks(config.jwksUrl, true); jwk = keys.get(parsed.header.kid); }
  if (!jwk) throw authError('OIDC signing key is not trusted.', 'TOKEN_KEY_UNTRUSTED');
  let publicKey; try { publicKey = createPublicKey({ key: jwk, format: 'jwk' }); } catch { throw authError('OIDC signing key is invalid.', 'TOKEN_KEY_INVALID', 503); }
  const verifier = createVerify('RSA-SHA256'); verifier.update(parsed.encodedHeader + '.' + parsed.encodedPayload); verifier.end();
  if (!verifier.verify(publicKey, parsed.signature)) throw authError('OIDC access-token signature is invalid.', 'TOKEN_SIGNATURE_INVALID');
  return { subject: parsed.payload.sub, issuer: parsed.payload.iss, audience: config.audience, roles: claimRoles(parsed.payload, config.audience), claims: parsed.payload };
}
export async function authenticateRequest(req) {
  const config = getConfiguredAuth();
  if (config.mode === 'disabled') return { subject: 'local-development', roles: ['development'], issuer: 'local', audience: 'local', claims: {}, developmentBypass: true };
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !/^Bearer\s+/i.test(header)) throw authError('Bearer access token required.', 'AUTHENTICATION_REQUIRED');
  const token = header.replace(/^Bearer\s+/i, '').trim(); if (!token) throw authError('Bearer access token required.', 'AUTHENTICATION_REQUIRED');
  return verifyAccessToken(token, config);
}
export function requireRoles(auth, requiredRoles) { const allowed = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]; if (!allowed.some((role) => auth.roles.includes(role))) throw authError('Authenticated identity lacks the required authorization role.', 'AUTHORIZATION_FORBIDDEN', 403); return auth; }
export function requireAuthenticatedSubject(auth, subject) { if (!auth || auth.subject !== subject) throw authError('Authenticated identity does not match the requested subject.', 'AUTHORIZATION_SUBJECT_MISMATCH', 403); return auth; }
export function resetJwksCacheForTests() { jwksCache = { expiresAt: 0, keys: new Map() }; }