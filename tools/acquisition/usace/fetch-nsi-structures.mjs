#!/usr/bin/env node
/**
 * fetch-nsi-structures.mjs
 *
 * Acquires National Structure Inventory (NSI) structure points from the USACE
 * NSI API for one county FIPS and stores them with provenance.
 *
 * Source: USACE National Structure Inventory API
 *   https://nsi.sec.usace.army.mil/nsiapi/structures?fips=<FIPS>&fmt=fc
 *
 * Fail-closed: the script throws (and writes nothing) when the HTTP status is
 * not 2xx, the body is not valid JSON, the payload is not a FeatureCollection
 * with a features array, or when any feature is missing a required NSI key
 * field. Never writes partial or placeholder output.
 *
 * Node standard library only (https, fs, crypto). ESM.
 *
 * Usage:
 *   node tools/acquisition/usace/fetch-nsi-structures.mjs [--fips 18129] [--out data/usace-nsi/nsi-posey-in-18129-v1.geojson]
 *   node tools/acquisition/usace/fetch-nsi-structures.mjs --dry-run --fixture /path/to/local.geojson
 */

import { get } from 'node:https';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, basename } from 'node:path';

const REPO_ROOT = new URL('../../..', import.meta.url);
const NSI_BASE = 'https://nsi.sec.usace.army.mil/nsiapi/structures';
const TIMEOUT_MS = 120_000;
const MAX_BYTES = 50 * 1024 * 1024;

// NSI attributes that must be present (as keys) on every feature's
// properties. Ground elevations are modeled estimates per USACE docs —
// they are NOT survey truth and NOT regulatory. See data/usace-nsi/PROVENANCE.md.
const REQUIRED_PROP_KEYS = [
  'bid',
  'bldgtype',
  'firmzone',
  'ground_elv',
  'grnd_elv_m',
  'occtype',
  'sqft',
  'val_struct',
  'x',
  'y',
];

function parseArgs(argv) {
  const args = { fips: '18129', out: null, dryRun: false, fixture: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fips') args.fips = argv[++i];
    else if (a.startsWith('--fips=')) args.fips = a.slice('--fips='.length);
    else if (a === '--out') args.out = argv[++i];
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length);
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--fixture') args.fixture = argv[++i];
    else if (a.startsWith('--fixture=')) args.fixture = a.slice('--fixture='.length);
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!/^\d{5}$/.test(args.fips)) throw new Error(`--fips must be a 5-digit county FIPS, got: ${args.fips}`);
  if (!args.out) args.out = `data/usace-nsi/nsi-posey-in-${args.fips}-v1.geojson`;
  return args;
}

function sourceUrlFor(fips) {
  return `${NSI_BASE}?fips=${encodeURIComponent(fips)}&fmt=fc`;
}

/**
 * Fetch the URL with a generous timeout and a hard byte cap.
 * Streams chunks so large county files (~13.8 MB) do not require
 * buffering heuristics; aborts cleanly above MAX_BYTES.
 * Returns { statusCode, contentType, body } — throws on non-2xx or on
 * transport/timeout errors.
 */
function fetchBytes(url) {
  return new Promise((resolve, reject) => {
    const req = get(
      url,
      { headers: { 'User-Agent': 'TSM-NSI-Acquisition/1.0', Accept: 'application/geo+json, application/json' } },
      (res) => {
        const statusCode = res.statusCode ?? 0;
        const contentType = res.headers['content-type'] ?? 'unknown';
        const chunks = [];
        let bytes = 0;
        let failed = false;
        const fail = (err) => {
          if (!failed) {
            failed = true;
            req.destroy();
            reject(err);
          }
        };
        res.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > MAX_BYTES) {
            fail(new Error(`NSI response exceeded maxBytes (${MAX_BYTES} bytes); aborting`));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          if (failed) return;
          const body = Buffer.concat(chunks, bytes);
          if (statusCode < 200 || statusCode >= 300) {
            const snippet = body.toString('utf8', 0, 500);
            reject(
              new Error(
                `NSI API returned HTTP ${statusCode} (fail-closed); ` +
                  `content-type: ${contentType}; body excerpt: ${JSON.stringify(snippet)}`,
              ),
            );
            return;
          }
          resolve({ statusCode, contentType, body });
        });
        res.on('error', fail);
      },
    );
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy(new Error(`NSI request timed out after ${TIMEOUT_MS} ms (fail-closed)`));
    });
    req.on('error', (err) => reject(new Error(`NSI request failed: ${err.message}`)));
  });
}

/**
 * Fail-closed validation of the parsed payload. Returns a stats object.
 * Throws on: non-object payload, missing/non-array features, empty features,
 * malformed feature/geometry entries, missing required property keys,
 * or coordinates outside WGS84 ranges.
 */
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('NSI payload is not a JSON object (fail-closed)');
  }
  if (!Array.isArray(payload.features)) {
    throw new Error('NSI payload is missing the "features" array (fail-closed)');
  }
  if (payload.features.length === 0) {
    throw new Error('NSI payload has an empty features array (fail-closed)');
  }

  const stats = {
    featureCount: payload.features.length,
    collectionType: payload.type ?? 'unknown',
    checked: 0,
    featuresMissingKeys: 0,
    missingKeyCounts: Object.fromEntries(REQUIRED_PROP_KEYS.map((k) => [k, 0])),
    badGeometry: 0,
  };
  const examples = [];

  for (const [i, feature] of payload.features.entries()) {
    stats.checked++;
    if (!feature || feature.type !== 'Feature' || !feature.properties || typeof feature.properties !== 'object') {
      stats.badGeometry++;
      if (examples.length < 5) examples.push({ index: i, problem: 'not a GeoJSON Feature with properties object' });
      continue;
    }
    const missing = REQUIRED_PROP_KEYS.filter((k) => !Object.prototype.hasOwnProperty.call(feature.properties, k));
    if (missing.length > 0) {
      stats.featuresMissingKeys++;
      for (const k of missing) stats.missingKeyCounts[k]++;
      if (examples.length < 5) examples.push({ index: i, problem: `missing property keys: ${missing.join(', ')}` });
    }
    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2 || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) {
      stats.badGeometry++;
      if (examples.length < 5) examples.push({ index: i, problem: 'missing or non-numeric geometry coordinates' });
    } else if (coords[0] < -180 || coords[0] > 180 || coords[1] < -90 || coords[1] > 90) {
      stats.badGeometry++;
      if (examples.length < 5) examples.push({ index: i, problem: `coordinates out of WGS84 range: [${coords[0]}, ${coords[1]}]` });
    }
  }

  if (stats.featuresMissingKeys > 0 || stats.badGeometry > 0) {
    throw new Error(
      `NSI validation failed (fail-closed): ${stats.featuresMissingKeys} feature(s) missing required property keys ` +
        `(${JSON.stringify(stats.missingKeyCounts)}), ${stats.badGeometry} malformed geometry/entries. ` +
        `Examples: ${JSON.stringify(examples)}`,
    );
  }
  return stats;
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let body, statusCode, contentType, sourceUrl;
  if (args.dryRun) {
    if (!args.fixture) throw new Error('--dry-run requires --fixture <path>');
    const { readFile } = await import('node:fs/promises');
    body = await readFile(args.fixture);
    statusCode = 'dry-run (no HTTP request)';
    contentType = 'dry-run (local file)';
    sourceUrl = `file:${args.fixture}`;
  } else {
    sourceUrl = sourceUrlFor(args.fips);
    console.log(`Fetching NSI structures for FIPS ${args.fips} ...`);
    ({ statusCode, contentType, body } = await fetchBytes(sourceUrl));
    console.log(`Received HTTP ${statusCode}, ${body.length} bytes, content-type: ${contentType}`);
  }

  // Parse AFTER download: invalid JSON is a hard fail, nothing is written.
  let payload;
  try {
    payload = JSON.parse(body.toString('utf8'));
  } catch (err) {
    throw new Error(`NSI response is not valid JSON (fail-closed): ${err.message}`);
  }

  const stats = validatePayload(payload);
  console.log(
    `Validated ${stats.featureCount} features (${stats.collectionType}); ` +
      `all required property keys present: ${REQUIRED_PROP_KEYS.join(', ')}`,
  );

  const hash = sha256Hex(body);
  const retrievedAt = new Date().toISOString();

  if (args.dryRun) {
    console.log('Dry run: no files written.');
    console.log(JSON.stringify({ sourceUrl, statusCode, retrievedAt, contentType, bytes: body.length, featureCount: stats.featureCount, sha256: hash }, null, 2));
    return;
  }

  const outUrl = new URL(args.out, REPO_ROOT);
  const outPath = outUrl.pathname;
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, body);

  const sidecarName = `${basename(outPath)}.sha256`;
  await writeFile(`${outPath}.sha256`, `${hash}  ${basename(outPath)}\n`);

  const receipt = {
    source: 'USACE National Structure Inventory API',
    sourceUrl,
    httpStatus: statusCode,
    retrievedAt,
    contentType,
    bytes: body.length,
    featureCount: stats.featureCount,
    collectionType: stats.collectionType,
    sha256: hash,
    sha256Sidecar: sidecarName,
    requiredPropertyKeys: REQUIRED_PROP_KEYS,
    crs: 'EPSG:4326 (WGS 84 longitude/latitude) per NSI API GeoJSON output',
    datumNotes:
      'ground_elv (feet) / grnd_elv_m (meters) are NSI-modeled ground elevation estimates ' +
      'derived by USACE from national elevation datasets. They are NOT survey truth, NOT regulatory, ' +
      'and must never be substituted for a licensed survey (e.g. an Elevation Certificate) or for ' +
      'FEMA FIRM / BFE determinations. Coordinate datum: WGS 84.',
    dataClass: 'reference',
    warnings: [
      'NSI attributes (structure values, building types, occupancy, ground elevations, population estimates) are modeled/estimated per USACE NSI documentation — NOT field-verified survey truth.',
      'Not a regulatory product: NSI data does not establish flood zones, BFEs, or insurance ratings.',
      'Do not merge NSI ground elevations with authoritative terrain (USGS 3DEP) or certified survey data without labeling the authority class of each source.',
    ],
  };
  await writeFile(outPath.replace(/\.geojson$/, '.receipt.json'), JSON.stringify(receipt, null, 2) + '\n');

  console.log(`Wrote ${args.out}`);
  console.log(`SHA-256: ${hash}`);
}

await main();
