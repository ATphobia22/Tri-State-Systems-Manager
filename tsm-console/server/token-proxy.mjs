/**
 * Backend Token Proxy — OIDC Authorization Code → Tokens
 *
 * Runs separately from the SPA (port 8787 by default).
 * Holds client_secret; never exposes it to the browser.
 *
 * Endpoints:
 *   POST /api/auth/token     { code, code_verifier, redirect_uri } → tokens + AuthContext claims
 *   GET  /api/auth/health
 *   POST /api/ledger/append  (optional authoritative Merkle append stub)
 *
 * NIST SP 800-207: continuous verification happens at the SPA + this proxy.
 */

import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT || 8787);
const TOKEN_URL = process.env.IDP_TOKEN_URL || '';
const CLIENT_ID = process.env.VITE_IDP_CLIENT_ID || process.env.IDP_CLIENT_ID || '';
const CLIENT_SECRET = process.env.IDP_CLIENT_SECRET || '';
const AUDIENCE = process.env.IDP_AUDIENCE || '';

// In-memory authoritative ledger (replace with DB in production)
const ledger = { leaves: [], root: null };

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'http://localhost:5173',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function exchangeCode({ code, code_verifier, redirect_uri }) {
  if (!TOKEN_URL || !CLIENT_ID || !CLIENT_SECRET) {
    const err = new Error(
      'Token proxy not configured. Set IDP_TOKEN_URL, IDP_CLIENT_ID (or VITE_IDP_CLIENT_ID), IDP_CLIENT_SECRET.'
    );
    err.status = 503;
    throw err;
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: redirect_uri || process.env.VITE_IDP_REDIRECT_URI || '',
  });
  if (code_verifier) body.set('code_verifier', code_verifier);
  if (AUDIENCE) body.set('audience', AUDIENCE);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || 'Token exchange failed');
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

/** Map IdP token response → TSM AuthContext (customize claim paths per IdP) */
function mapClaims(tokenResponse) {
  // Prefer decoding id_token payload (base64url) without verification here —
  // production should verify signature via jwks.
  let claims = {};
  if (tokenResponse.id_token) {
    try {
      const payload = tokenResponse.id_token.split('.')[1];
      const jsonStr = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
      claims = JSON.parse(jsonStr);
    } catch {
      claims = {};
    }
  }

  const uid = claims.sub || claims.oid || 'unknown';
  const roles = claims.roles || claims['https://tuckerinc82.org/roles'] || ['viewer'];
  const tenantId = claims.tenant_id || claims['https://tuckerinc82.org/tenant'] || 'tucker-inc-82-regional-os';
  const classificationMax =
    claims.clearance || claims['https://tuckerinc82.org/clearance'] || 'internal';

  return {
    auth: {
      uid,
      tenantId,
      roles: Array.isArray(roles) ? roles : [roles],
      classificationMax,
      authenticatedAt: new Date().toISOString(),
    },
    tokens: {
      access_token: tokenResponse.access_token,
      expires_in: tokenResponse.expires_in,
      token_type: tokenResponse.token_type,
      // refresh_token only if offline_access requested and trusted storage
    },
  };
}

async function sha256(msg) {
  return createHash('sha256').update(msg).digest('hex');
}

async function appendLedger(payload) {
  const evidence_id = `EV-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const canonical = JSON.stringify({ ...payload, evidence_id, ts: Date.now() });
  const leafHash = await sha256('TSM_LEAF:' + canonical);
  const leaf = {
    id: evidence_id,
    hash: leafHash,
    payload: { ...payload, evidence_id, sha256_hash: leafHash },
    createdAt: new Date().toISOString(),
  };
  ledger.leaves.unshift(leaf);
  // Simplified root: hash of all leaf hashes concatenated (full tree in SPA)
  const all = ledger.leaves.map((l) => l.hash).reverse().join('');
  ledger.root = await sha256('TSM_NODE:' + (all || 'EMPTY'));
  return { evidence_id, sha256_hash: leafHash, merkleRoot: ledger.root };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return json(res, 204, {});
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/auth/health') {
      return json(res, 200, {
        ok: true,
        configured: Boolean(TOKEN_URL && CLIENT_ID && CLIENT_SECRET),
        service: 'tsm-token-proxy',
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/token') {
      const body = await readBody(req);
      if (!body.code) return json(res, 400, { error: 'code required' });
      const tokens = await exchangeCode(body);
      const mapped = mapClaims(tokens);
      return json(res, 200, mapped);
    }

    if (req.method === 'POST' && url.pathname === '/api/ledger/append') {
      const body = await readBody(req);
      if (!body.source_org || !body.source_uri) {
        return json(res, 400, { error: 'source_org and source_uri required' });
      }
      const result = await appendLedger({
        source_org: body.source_org,
        source_uri: body.source_uri,
        tier: Number(body.tier) || 1,
      });
      return json(res, 201, result);
    }

    if (req.method === 'GET' && url.pathname === '/api/ledger') {
      return json(res, 200, { leaves: ledger.leaves, root: ledger.root, totalCount: ledger.leaves.length });
    }

    json(res, 404, { error: 'not found' });
  } catch (e) {
    const status = e.status || 500;
    json(res, status, { error: e.message || 'internal error', details: e.details });
  }
});

server.listen(PORT, () => {
  console.log(`TSM token proxy listening on http://localhost:${PORT}`);
  console.log(`  POST /api/auth/token`);
  console.log(`  GET  /api/auth/health`);
  console.log(`  POST /api/ledger/append`);
  if (!TOKEN_URL || !CLIENT_SECRET) {
    console.warn('  WARNING: IdP secrets not set — /api/auth/token will return 503');
  }
});
