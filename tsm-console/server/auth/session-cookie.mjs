import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = '__Host-tsm_session';
const TRANSACTION_COOKIE = '__Host-tsm_oidc_tx';
const COOKIE_MAX_BYTES = 3800;

function secretKey() {
  const value = String(process.env.TSM_SESSION_SECRET || '');
  if (value.length < 32) throw new Error('TSM_SESSION_SECRET must contain at least 32 characters.');
  return createHash('sha256').update(value, 'utf8').digest();
}

function encode(value) { return Buffer.from(value).toString('base64url'); }
function decode(value) { return Buffer.from(value, 'base64url').toString('utf8'); }

function seal(payload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const value = encode(Buffer.concat([iv, tag, ciphertext]));
  if (Buffer.byteLength(value, 'ascii') > COOKIE_MAX_BYTES) throw new Error('OIDC session cookie exceeds safe size.');
  return value;
}

function unseal(value) {
  try {
    const raw = Buffer.from(value, 'base64url');
    if (raw.length < 29) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', secretKey(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key && value) cookies[key] = value;
  }
  return cookies;
}

function cookiePolicy() {
  const sameSite = String(process.env.TSM_COOKIE_SAMESITE || 'Lax');
  if (!['Strict', 'Lax', 'None'].includes(sameSite)) throw new Error('TSM_COOKIE_SAMESITE must be Strict, Lax, or None.');
  const secure = process.env.TSM_AUTH_MODE !== 'disabled' || process.env.TSM_COOKIE_SECURE === 'true';
  if (sameSite === 'None' && !secure) throw new Error('SameSite=None requires a Secure cookie.');
  return { sameSite, secure };
}

function cookieHeader(name, value, { maxAge = null, httpOnly = true } = {}) {
  const { sameSite, secure } = cookiePolicy();
  const parts = [
    `${name}=${value}`,
    'Path=/',
    `SameSite=${sameSite}`,
  ];
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (maxAge !== null) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  return parts.join('; ');
}

export function setTransactionCookie(res, payload) {
  res.setHeader('Set-Cookie', cookieHeader(TRANSACTION_COOKIE, seal(payload), { maxAge: 600 }));
}

export function readTransactionCookie(req) {
  const value = parseCookies(req.headers.cookie)[TRANSACTION_COOKIE];
  return value ? unseal(value) : null;
}

export function clearTransactionCookie(res) {
  res.setHeader('Set-Cookie', cookieHeader(TRANSACTION_COOKIE, '', { maxAge: 0 }));
}

export function setSessionCookie(res, payload, maxAgeSeconds) {
  res.setHeader('Set-Cookie', cookieHeader(SESSION_COOKIE, seal(payload), { maxAge: maxAgeSeconds }));
}

export function readSessionCookie(req) {
  const value = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  return value ? unseal(value) : null;
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', cookieHeader(SESSION_COOKIE, '', { maxAge: 0 }));
}

export function cookieNames() {
  return { session: SESSION_COOKIE, transaction: TRANSACTION_COOKIE };
}

export function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}
