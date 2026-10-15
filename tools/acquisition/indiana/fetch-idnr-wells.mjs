#!/usr/bin/env node
/**
 * fetch-idnr-wells.mjs — Indiana DNR Water Wells acquisition (Posey County, IN)
 *
 * Queries the Indiana DNR Water Wells ArcGIS REST FeatureServer, pages through
 * all results (fail-closed), classifies each record's location quality from the
 * service's own fields, and writes a GeoJSON bundle with SHA-256 and a
 * validation receipt.
 *
 * Node stdlib only (ESM). Do NOT invent field names: the location-quality
 * classifier is built from the service's real `loc_type` field, observed in
 * ~/workspace/tsm-indiana-harvest/samples/waterwells_posey_sample.json.
 *
 * Observed `loc_type` values in the sample:
 *   "Field Located"            -> field-located
 *   "Office Located/Geocoded"  -> geocoded
 * PLSS context fields present on every record: strrng1 (range), strtwn1
 * (township), dblsec1 (section). The service does not expose a separate
 * accuracy-distance field in the sample; records whose loc_type indicates
 * PLSS/section-derived placement (or is blank/other) classify as
 * plss-estimated / unknown respectively.
 *
 * Location-quality classes (stable, lowercase, kebab-case):
 *   field-located   - survey/GPS field-located well head ("Field Located")
 *   geocoded        - office geocoded from address or other source
 *   plss-estimated  - estimated from PLSS section/township/range, not surveyed
 *   unknown         - no usable location-method information
 *
 * WARNING: estimated/PLSS-derived locations are NOT survey-grade geometry and
 * must be labeled as such wherever displayed (see PROVENANCE.md).
 *
 * Usage:
 *   node fetch-idnr-wells.mjs [--bbox xmin,ymin,xmax,ymax] [--out <path>] [--page-size <n>]
 *
 * Defaults:
 *   --bbox      -88.15,37.75,-87.85,38.05   (Posey County, EPSG:4326)
 *   --out       data/indiana-dnr/water-wells/idnr-water-wells-posey-v1.geojson
 *   --page-size 1000
 */

import { get } from 'node:https';
import { URL, URLSearchParams } from 'node:url';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';

const SERVICE_BASE = 'https://gisdata.in.gov/server/rest/services/Hosted/WaterWells_DNR_Water_IN_1/FeatureServer/0';
const DEFAULT_BBOX = '-88.15,37.75,-87.85,38.05';
const DEFAULT_PAGE_SIZE = 1000;

// ---------------------------------------------------------------------------
// Location-quality classifier — built ONLY from real service field names.
// `loc_type` is the service's own location-method field (verified against the
// local sample fixture). Never invent new loc_type spellings; unknown values
// fall through to 'unknown' and are reported so a human can extend the map.
// ---------------------------------------------------------------------------

export const LOCATION_QUALITY = ['field-located', 'geocoded', 'plss-estimated', 'unknown'];

/**
 * Classify a well record's location quality from service attribute fields.
 * @param {object} attrs - the record's `attributes` object from the service
 * @returns {string} one of LOCATION_QUALITY
 */
export function classifyLocationQuality(attrs = {}) {
  const raw = (attrs.loc_type ?? '').toString().trim();
  const v = raw.toLowerCase();

  if (!v) return 'unknown';
  if (v.includes('field located')) return 'field-located';
  if (v.includes('geocod')) return 'geocoded';
  if (v.includes('plss') || v.includes('section') || v.includes('township') || v.includes('range')) {
    return 'plss-estimated';
  }
  return 'unknown';
}

/** Optional: warn about loc_type values the classifier did not recognize. */
export function findUnmappedLocTypes(features) {
  const seen = new Set();
  for (const f of features) {
    const raw = (f?.attributes?.loc_type ?? '').toString().trim();
    if (raw && classifyLocationQuality(f.attributes) === 'unknown') seen.add(raw);
  }
  return [...seen];
}

// ---------------------------------------------------------------------------
// HTTP helpers (node stdlib only, fail-closed)
// ---------------------------------------------------------------------------

function httpGetJson(url) {
  return new Promise((resolveP, reject) => {
    const req = get(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'TSM-acquisition/1.0' } }, (res) => {
      const { statusCode } = res;
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`HTTP ${statusCode} from ${url} — body: ${body.slice(0, 500)}`));
          return;
        }
        let data;
        try {
          data = JSON.parse(body);
        } catch (e) {
          reject(new Error(`Invalid JSON from ${url}: ${e.message}`));
          return;
        }
        resolveP({ status: statusCode, data });
      });
    });
    req.on('error', (e) => reject(new Error(`Request failed for ${url}: ${e.message}`)));
    req.setTimeout(60000, () => req.destroy(new Error(`Request timed out: ${url}`)));
  });
}

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

// ---------------------------------------------------------------------------
// Query + paging (fail-closed). Pages with resultOffset until a short page is
// returned. An `exceededTransferLimit: true` flag on a short page is treated
// as a server-contract violation and throws — never silently drop records.
// ---------------------------------------------------------------------------

export function buildQueryUrl({ bbox, pageSize, offset }) {
  const [xmin, ymin, xmax, ymax] = bbox.split(',').map((s) => s.trim());
  const params = new URLSearchParams({
    where: '1=1',
    geometry: `${xmin},${ymin},${xmax},${ymax}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    f: 'geojson',
    resultRecordCount: String(pageSize),
    resultOffset: String(offset),
  });
  return `${SERVICE_BASE}/query?${params.toString()}`;
}

export async function fetchAllFeatures({ bbox, pageSize }) {
  const features = [];
  const statuses = [];
  let offset = 0;

  for (;;) {
    const url = buildQueryUrl({ bbox, pageSize, offset });
    const { status, data } = await httpGetJson(url);
    statuses.push(status);

    if (data.error) {
      throw new Error(`ArcGIS error on page at offset ${offset}: ${JSON.stringify(data.error).slice(0, 500)}`);
    }
    if (!Array.isArray(data.features)) {
      throw new Error(`Unexpected response shape at offset ${offset}: missing features array`);
    }

    const page = data.features;
    features.push(...page);

    if (page.length < pageSize) {
      // Short page: all records fetched. A true exceededTransferLimit on a
      // short page means the server truncated anyway — fail closed.
      if (data.exceededTransferLimit === true) {
        throw new Error(
          `exceededTransferLimit=true on a short page (${page.length} < ${pageSize}) at offset ${offset}: ` +
          'record set may be truncated; refusing to write a partial result',
        );
      }
      break;
    }
    // Full page: more records remain (server may also set
    // exceededTransferLimit=true — that is the normal signal to keep paging).
    offset += pageSize;

    if (offset > 1_000_000) {
      throw new Error('Paging safety stop: exceeded 1,000,000 records — aborting rather than looping forever');
    }
  }

  return { features, statuses };
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

function buildGeoJson(features) {
  return {
    type: 'FeatureCollection',
    name: 'idnr-water-wells-posey-v1',
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
    features: features.map((f) => {
      const attrs = f.attributes ?? f.properties ?? {};
      const g = f.geometry ?? {};
      const coords = Array.isArray(g.coordinates)
        ? g.coordinates
        : (typeof g.x === 'number' && typeof g.y === 'number' ? [g.x, g.y] : null);
      return {
        type: 'Feature',
        geometry: coords ? { type: 'Point', coordinates: coords } : null,
        properties: {
          ...attrs,
          location_quality: classifyLocationQuality(attrs),
        },
      };
    }),
  };
}

const PROVENANCE_BODY = `# Provenance — Indiana DNR Water Wells (Posey County)

- **Authority:** Indiana Department of Natural Resources (DNR), Division of Water
- **Source service:** Indiana DNR Water Wells FeatureServer (ArcGIS REST)
- **dataClass:** reference/evidence (well logs)
- **Acquisition method:** tools/acquisition/indiana/fetch-idnr-wells.mjs
  (ArcGIS REST \`query\`, envelope + resultOffset paging, fail-closed)

## Location-quality warning (read before displaying this data)

Each record carries a \`location_quality\` property derived from the service's
own \`loc_type\` field:

| location_quality | meaning |
|---|---|
| field-located | GPS/survey field-located well head |
| geocoded | office-geocoded from address or other source |
| plss-estimated | estimated from PLSS section/township/range |
| unknown | no usable location-method information |

**Estimated and PLSS-derived locations are NOT survey-grade geometry.**
They must be labeled as estimated wherever displayed, and must never be
presented as surveyed well-head positions, used as control for engineering
decisions, or silently promoted to authoritative coordinates.

## Standing rules

- Authority class: reference/evidence — well logs inform, they do not certify.
- Provenance, vintage, CRS (EPSG:4326), and SHA-256 are recorded in the
  validation receipt next to the GeoJSON.
- Missing data is recorded as missing — never zero-filled or invented.
`;

function parseArgs(argv) {
  const args = { bbox: DEFAULT_BBOX, out: null, pageSize: DEFAULT_PAGE_SIZE };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--bbox') args.bbox = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--page-size') args.pageSize = Number(argv[++i]);
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node fetch-idnr-wells.mjs [--bbox xmin,ymin,xmax,ymax] [--out <path>] [--page-size <n>]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  const parts = args.bbox.split(',').map((s) => s.trim());
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(Number(p)))) {
    throw new Error(`--bbox must be "xmin,ymin,xmax,ymax" in EPSG:4326, got: ${args.bbox}`);
  }
  if (!Number.isInteger(args.pageSize) || args.pageSize < 1 || args.pageSize > 4000) {
    throw new Error(`--page-size must be an integer 1..4000, got: ${args.pageSize}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '..', '..', '..');
  const outPath = args.out ? resolve(args.out) : join(repoRoot, 'data', 'indiana-dnr', 'water-wells', 'idnr-water-wells-posey-v1.geojson');
  const outDir = dirname(outPath);
  mkdirSync(outDir, { recursive: true });

  const sourceUrl = buildQueryUrl({ bbox: args.bbox, pageSize: args.pageSize, offset: 0 });
  const startedAt = new Date().toISOString();
  const { features, statuses } = await fetchAllFeatures({ bbox: args.bbox, pageSize: args.pageSize });
  const fetchedAt = new Date().toISOString();

  const unmapped = findUnmappedLocTypes(features);
  if (unmapped.length > 0) {
    console.warn(`WARNING: ${unmapped.length} unrecognized loc_type value(s) classified as 'unknown': ${JSON.stringify(unmapped)}`);
  }

  const geojson = buildGeoJson(features);
  const geojsonText = JSON.stringify(geojson);
  const digest = sha256Hex(Buffer.from(geojsonText, 'utf8'));

  writeFileSync(outPath, geojsonText, 'utf8');
  writeFileSync(`${outPath}.sha256`, `${digest}  ${outPath.split('/').pop()}\n`, 'utf8');

  const receipt = {
    script: 'tools/acquisition/indiana/fetch-idnr-wells.mjs',
    source_url: sourceUrl,
    service: SERVICE_BASE,
    query: { where: '1=1', bbox_epsg4326: args.bbox, inSR: 4326, outSR: 4326, outFields: '*', page_size: args.pageSize },
    http_statuses: statuses,
    http_ok: statuses.every((s) => s >= 200 && s < 300),
    acquired_started_at: startedAt,
    acquired_finished_at: fetchedAt,
    feature_count: features.length,
    sha256: digest,
    crs: 'EPSG:4326 (urn:ogc:def:crs:OGC:1.3:CRS84)',
    authority: 'Indiana DNR',
    data_class: 'reference/evidence (well logs)',
    location_quality_values: [...new Set(geojson.features.map((f) => f.properties.location_quality))],
    unmapped_loc_type_values: unmapped,
    warning: 'Estimated/PLSS-derived locations are NOT survey-grade geometry and must be labeled as such wherever displayed.',
  };
  writeFileSync(join(outDir, 'idnr-water-wells-posey-v1.receipt.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  writeFileSync(join(outDir, 'PROVENANCE.md'), PROVENANCE_BODY, 'utf8');

  console.log(`Wrote ${outPath} (${features.length} features, sha256 ${digest.slice(0, 16)}…)`);
  console.log(`Receipt: ${join(outDir, 'idnr-water-wells-posey-v1.receipt.json')}`);
  console.log(`Provenance: ${join(outDir, 'PROVENANCE.md')}`);
}

// Run main() only when executed directly (not when imported for tests).
const invokedAs = process.argv[1] ? resolve(process.argv[1]) : null;
const thisFile = new URL(import.meta.url).pathname;
if (invokedAs === thisFile) {
  main().catch((e) => { console.error(`FATAL: ${e.message}`); process.exit(1); });
}
