/**
 * TSM Backend API — Token Proxy + Evidence + Ingestion + Policy + Engineering
 * Port 8787. Fail-closed evidence writes.
 */

import http from 'node:http';
import { appendArtifact, listArtifacts, getArtifact, verifyProvenance, recordVerification, sha256Hex } from './store/evidence-store.mjs';
import { runHydrologicBatch, ingestUsgsNode, ingestNwpsGauge } from './ingestion/workers.mjs';
import { evaluatePolicies, POLICIES } from './policy/jurisdiction-engine.mjs';
import { evaluateCompensatoryStorage, buildCompensatoryStorageCanonical } from './engineering/compensatory-storage.mjs';
import { servePoseyAsset } from './geospatial/posey-assets.mjs';
import { handleFirmRoute } from './geospatial/firm-routes.mjs';

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

function readBodyFixed(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  try {
    if (handleFirmRoute(req, res, url, json)) return;

    if (req.method === 'GET' && url.pathname === '/api/auth/health') {
      return json(res, 200, {
        ok: true,
        service: 'tsm-api',
        idp_configured: Boolean(TOKEN_URL && CLIENT_ID && CLIENT_SECRET),
        planes: ['EVIDENCE', 'GOVERNANCE', 'AUTH', 'ENGINEERING'],
      });
    }

    // --- Geospatial asset plane ---
    if (req.method === 'GET' && url.pathname === '/api/geospatial/posey/site') {
      return json(res, 200, {
        ok: true,
        site_id: 'posey-point-township-bonebank-5000ft',
        horizontal_crs: 'EPSG:2966',
        horizontal_crs_name: 'NAD83 / Indiana West (ftUS)',
        vertical_datum: 'NAVD88',
        bounds: { minX: 2680000, minY: 940000, maxX: 2685000, maxY: 945000 },
        terrain: {
          source_uri: 'https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_2016_2020_DEM/ImageServer',
          reference_lidar_uri: 'https://lidar.digitalforestry.org/QL2_3DEP_LiDAR_IN_2017_2019/Posey_Co_2020_3DEP/Elev20_LAS1.4SPW_IN/IN2020_26800940_12.las',
          acquisition_year: 2020,
          authority_class: 'OBSERVATION',
          derivation_class: 'RAW',
        },
        orthophoto: {
          source_uri: 'https://imagery.geoplatform.gov/iipp/rest/services/NAIP/NAIP2020_CONUS/ImageServer',
          acquisition_year: 2020,
          authority_class: 'OBSERVATION',
          derivation_class: 'RAW',
        },
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/geospatial/posey/raster') {
      try {
        return await servePoseyAsset(req, res);
      } catch (error) {
        const status = error instanceof RangeError ? 400 : 502;
        return json(res, status, { error: error.message, code: status === 400 ? 'GEOSPATIAL_REQUEST_INVALID' : 'GEOSPATIAL_SOURCE_UNAVAILABLE' });
      }
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
      const artifact = getArtifact(id);
      if (!artifact) return json(res, 404, { error: 'not found' });
      return json(res, 200, artifact);
    }

    if (req.method === 'POST' && url.pathname === '/api/evidence') {
      const body = await readBodyFixed(req);
      try {
        return json(res, 201, appendArtifact(body));
      } catch (error) {
        return json(res, error.code === 'FAIL_CLOSED' ? 422 : 500, { error: error.message, code: error.code });
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/evidence/verify') {
      const body = await readBodyFixed(req);
      const { artifact_id, canonical } = body;
      const artifact = getArtifact(artifact_id);
      if (!artifact) return json(res, 404, { error: 'artifact not found' });
      const result = verifyProvenance(artifact, canonical || artifact.payload);
      recordVerification(artifact_id, result.expected, result.computed, 'api/evidence/verify');
      return json(res, result.ok ? 200 : 422, result);
    }

    // --- Engineering solver ---
    if (req.method === 'POST' && url.pathname === '/api/v1/engineering/compensatory-storage') {
      const body = await readBodyFixed(req);
      try {
        const result = evaluateCompensatoryStorage(body);
        const canonical = `TSM_ENGINE_LEAF:${buildCompensatoryStorageCanonical(body)}`;
        const artifact = appendArtifact({
          artifact_type: 'engineering_compensatory_storage',
          source_authority: 'TSM Engineering Solver',
          source_uri: 'internal://tsm/engineering/compensatory-storage',
          source_identifier: body.plan_id,
          retrieved_at: new Date().toISOString(),
          horizontal_crs: body.horizontal_crs || 'EPSG:2966',
          horizontal_crs_name: body.horizontal_crs_name || 'NAD83 / Indiana West (ftUS)',
          vertical_datum: body.vertical_datum || 'NAVD88',
          content_hash_sha256: result.evidence_artifact_hash.slice('sha256:'.length),
          validation_status: 'provisional',
          authority_class: 'MODEL_OUTPUT',
          derivation_class: 'DERIVED',
          software_version: 'tsm-engineering@0.1.0',
          operator_or_service_identity: 'compensatory-storage-api',
          governance_status: 'human_review_required',
          is_simulation_demo: false,
          human_review_status: 'pending',
          transformation_chain: [],
          payload: result,
          _canonical_for_verify: canonical,
          notes: 'Configurable storage-ratio analysis. Not a regulatory determination; verify governing permit criteria and engineering basis.',
        });
        return json(res, 200, { ...result, evidence_artifact_id: artifact.artifact_id });
      } catch (error) {
        const status = error instanceof TypeError || error instanceof RangeError ? 400 : 422;
        return json(res, status, { error: error.message, code: error.code || 'ENGINEERING_VALIDATION_ERROR' });
      }
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
      const hash = sha256Hex(`TSM_LEAF:${content}`);
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
          _canonical_for_verify: `TSM_LEAF:${content}`,
        });
        return json(res, 201, artifact);
      } catch (error) {
        return json(res, 422, { error: error.message, code: error.code });
      }
    }

    return json(res, 404, { error: 'not found' });
  } catch (error) {
    return json(res, 500, { error: error.message || 'internal error' });
  }
});

server.listen(PORT, () => {
  console.log(`TSM API on http://localhost:${PORT}`);
  console.log('  Evidence: GET/POST /api/evidence  POST /api/evidence/verify');
  console.log('  Geospatial: GET /api/geospatial/posey/site  GET /api/geospatial/posey/raster');
  console.log('  FIRM: GET /api/geospatial/firm/panels/:panelId  GET /api/geospatial/firm/panels/:panelId/layers');
  console.log('  Engineering: POST /api/v1/engineering/compensatory-storage');
  console.log('  Ingest:   POST /api/ingest/hydrologic | usgs | nwps');
  console.log('  Policy:   GET /api/policies  POST /api/policies/evaluate');
});
