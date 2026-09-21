#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const failures = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const proxy = read('tsm-console/server/token-proxy.mjs');
const auth = read('tsm-console/server/auth/oidc-auth.mjs');
const compose = read('tsm-console/docker-compose.yml');
const browserAuth = read('tsm-console/src/lib/auth.ts');
const bff = read('tsm-console/server/auth/oidc-bff.mjs');
const sessionCookie = read('tsm-console/server/auth/session-cookie.mjs');

for (const route of ['/api/evidence', '/api/evidence/verify', '/api/v1/engineering/compensatory-storage', '/api/ingest/hydrologic', '/api/ingest/usgs', '/api/ingest/nwps', '/api/ledger/append']) {
  if (!proxy.includes(route)) failures.push('protected route missing from server contract: ' + route);
}
if (!proxy.includes('authenticateRequest(req)')) failures.push('mutation authorization middleware is not wired into the API');
if (!proxy.includes('requireAuthenticatedSubject(requestAuth, body.human_authorization.reviewer_identity)')) failures.push('reviewer identity is not bound to authenticated subject');
if (!auth.includes('createPublicKey({ key: jwk, format: \'jwk\' })')) failures.push('OIDC JWKS public-key construction missing');
if (!auth.includes('verifyClaims(parsed.payload, config)')) failures.push('OIDC issuer/audience/time claim validation missing');
if (!auth.includes("parsed.header.alg !== 'RS256'")) failures.push('JWT algorithm allowlist missing');
if (!auth.includes('verifier.verify(publicKey, parsed.signature)')) failures.push('JWT signature verification missing');
if (!auth.includes('readSessionCookie(req)')) failures.push('server-managed browser session is not wired into authentication');
if (!bff.includes('code_challenge_method') || !bff.includes('code_verifier') || !bff.includes("searchParams.set('nonce'")) failures.push('OIDC BFF PKCE/nonce binding missing');
if (!auth.includes('verifyIdToken') || !auth.includes('ID_TOKEN_NONCE_MISMATCH')) failures.push('OIDC ID-token nonce validation missing');
if (!bff.includes('/.well-known/openid-configuration')) failures.push('OIDC discovery metadata is not used');
if (!bff.includes('OIDC_CLIENT_SECRET') || !bff.includes('client_secret')) failures.push('hosted OIDC BFF must use confidential client authentication');
if (!sessionCookie.includes('aes-256-gcm') || !sessionCookie.includes('HttpOnly')) failures.push('OIDC session cookie must be authenticated/encrypted and HttpOnly');
if (/localStorage|sessionStorage|ACCESS_TOKEN_KEY|REFRESH_TOKEN_KEY/.test(browserAuth)) failures.push('browser auth must not persist OIDC tokens');
if (!proxy.includes('CSRF_ORIGIN_REJECTED') || !proxy.includes('X-TSM-CSRF')) failures.push('cookie-authenticated mutation CSRF boundary missing');
if (!proxy.includes('/api/auth/login') || !proxy.includes('/api/auth/callback') || !proxy.includes('/api/auth/session')) failures.push('OIDC BFF endpoints missing');
if (!/TSM_AUTH_MODE:\s*\$\{TSM_AUTH_MODE:-required\}/.test(compose)) failures.push('Compose must default to required authentication');
if (/POSTGRES_PASSWORD:\s*(tsm|sovereign|sovereign_pass)\b/.test(compose)) failures.push('plaintext database credential remains in canonical Compose');
if (/npm ci --no-audit --no-fund/.test(compose)) failures.push('canonical Compose must not install dependencies at container startup');
if (!/USER tsm/.test(read('tsm-console/Dockerfile'))) failures.push('runtime image must run as non-root tsm user');

const forbidden = [
  'POSTGRES_PASSWORD: sovereign_pass',
  'password=sovereign_pass',
  'POSTGRES_PASSWORD: tsm',
];
for (const relative of ['docker-compose.yml', 'tsm-console/docker-compose.yml']) {
  const source = read(relative);
  for (const value of forbidden) if (source.includes(value)) failures.push(relative + ': plaintext credential detected: ' + value);
}

if (failures.length) {
  console.error('[tsm] FAIL-CLOSED security boundary gate');
  failures.forEach((failure) => console.error('- ' + failure));
  process.exit(1);
}
console.log('[tsm] security boundary gate passed');
