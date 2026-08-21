/**
 * TSM Backend API — Token Proxy + Evidence + Ingestion + Policy
 * Port 8787. Fail-closed evidence writes.
 */

import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { appendArtifact, listArtifacts, getArtifact, verifyProvenance, recordVerification, sha256Hex } from './store/evidence-store.mjs';
import { runHydrologicBatch, ingestUsgsNode, ingestNwpsGauge } from './ingestion/workers.mjs';
import { evaluatePolicies, getPolicy, POLICIES } from './policy/jurisdiction-engine.mjs';

const PORT = Number(process.env.PORT || 8787);
const TOKEN_URL = process.env.IDP_TOKEN_URL || '';
const CLIENT_ID = process.env.VITE_IDP_CLIENT_ID || process.env.IDP_CLIENT_ID || '';
const CLIENT_SECRET = process.env.IDP_CLIENT_SECRET || '';

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
        resolve(Buffer.concat(chunks).toString('utf8') ? JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') : {});
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// Fix readBody - need to accumulate properly
function readBodyFixed(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/auth/health') {
      return json(res, 200, {
        ok: true,
        service: 'tsm-api',
        idp_configured: Boolean(TOKEN_URL && CLIENT_ID && CLIENT_SECRET),
        planes: ['EVIDENCE', 'GOVERNANCE', 'AUTH'],
      });
    }

    // --- Evidence store ---
    if (req.method === 'GET' && url.pathname === '/api/evidence') {
      const authority_class = url.searchParams.get('authority_class') || undefined;
      const demo = url.searchParams.get('is_simulation_demo');
      const is_simulation_demo = demo === null ? undefined : demo === 'true';
      return json(res, 200, {
        artifacts: listArtifacts({ limit: 100, authority_class, is_simulation_demo }),
      });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/evidence/') && url.pathname !== '/api/evidence/verify') {
      const id = url.pathname.split('/').pop();
      const a = getArtifact(id);
      if (!a) return json(res, 404, { error: 'not found' });
      return json(res, 200, a);
    }

    if (req.method === 'POST' && url.pathname === '/api/evidence') {
      const body = await readBodyFixed(req);
      try {
        const artifact = appendArtifact(body);
        return json(res, 201, artifact);
      } catch (e) {
        return json(res, e.code === 'FAIL_CLOSED' ? 422 : 500, { error: e.message, code: e.code });
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/evidence/verify') {
      const body = await readBodyFixed(req);
      const { artifact_id, canonical } = body;
      const a = getArtifact(artifact_id);
      if (!a) return json(res, 404, { error: 'artifact not found' });
      const result = verifyProvenance(a, canonical || a.payload);
      recordVerification(artifact_id, result.expected, result.computed, 'api/evidence/verify');
      return json(res, result.ok ? 200 : 422, result);
    }

    // --- Ingestion ---
    if (req.method === 'POST' && url.pathname === '/api/ingest/hydrologic') {
      const results = await runHydrologicBatch();
      return json(res, 200, { results, note: 'Fail-closed per node; check each result.ok' });
    }

    if (req.method === 'POST' && url.pathname === '/api/ingest/usgs') {
      const body = await readBodyFixed(req);
      if (!body.usgs_id) return json(res, 400, { error: 'usgs_id required' });
      return json(res, 200, await ingestUsgsNode(body.usgs_id));
    }

    if (req.method === 'POST' && url.pathname === '/api/ingest/nwps') {
      const body = await readBodyFixed(req);
      if (!body.nws_id) return json(res, 400, { error: 'nws_id required' });
      return json(res, 200, await ingestNwpsGauge(body.nws_id, { product: body.product }));
    }

    // --- Policy ---
    if (req.method === 'GET' && url.pathname === '/api/policies') {
      return json(res, 200, { policies: POLICIES });
    }

    if (req.method === 'POST' && url.pathname === '/api/policies/evaluate') {
      const body = await readBodyFixed(req);
      return json(res, 200, evaluatePolicies(body));
    }

    // --- Legacy token + ledger stubs ---
    if (req.method === 'POST' && url.pathname === '/api/auth/token') {
      return json(res, 503, { error: 'Configure IDP_TOKEN_URL and IDP_CLIENT_SECRET for OIDC exchange' });
    }

    if (req.method === 'POST' && url.pathname === '/api/ledger/append') {
      const body = await readBodyFixed(req);
      const content = JSON.stringify(body);
      const hash = sha256Hex('TSM_LEAF:' + content);
      try {
        const artifact = appendArtifact({
          artifact_type: 'evidence_block',
          source_authority: body.source_org || 'unknown',
          source_uri: body.source_uri || 'urn:tsm:manual',
          retrieved_at: new Date().toISOString(),
          horizontal_crs: 'EPSG:2966',
          vertical_datum: 'NAVD88',
          content_hash_sha256: hash,
          authority_class: body.is_simulation_demo ? 'SIMULATION_DEMO' : 'OBSERVATION',
          derivation_class: 'RAW',
          validation_status: 'pending',
          governance_status: 'human_review_required',
          is_simulation_demo: Boolean(body.is_simulation_demo),
          transformation_chain: body.transformation_chain || [],
          payload: body,
          _canonical_for_verify: 'TSM_LEAF:' + content,
        });
        return json(res, 201, artifact);
      } catch (e) {
        return json(res, 422, { error: e.message, code: e.code });
      }
    }

    json(res, 404, { error: 'not found' });
  } catch (e) {
    json(res, 500, { error: e.message || 'internal error' });
  }
});

server.listen(PORT, () => {
  console.log(`TSM API on http://localhost:${PORT}`);
  console.log('  Evidence: GET/POST /api/evidence  POST /api/evidence/verify');
  console.log('  Ingest:   POST /api/ingest/hydrologic | usgs | nwps');
  console.log('  Policy:   GET /api/policies  POST /api/policies/evaluate');
});
