#!/usr/bin/env node
/**
 * Whole-catalog CRS provenance: attach NCAT / VDatum / GEOID evidence metadata
 * to each flood/terrain source pin. Offline; does not call live APIs.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const SOURCES = [
  {
    sourceId: "usgs-3dep-terrain",
    path: "data-sources/manifests/usgs-3dep-terrain.json",
    domain: "TERRAIN",
    expectedHorizontal: ["EPSG:4326", "EPSG:3857"],
    expectedVertical: ["NAVD88"],
    geoidModel: "GEOID18_OR_SOURCE_NATIVE",
    ncatRole: "OPTIONAL_DISPLAY_TRANSFORM",
    vdatumRole: "NOT_REQUIRED_FOR_SCREENING_TILES",
  },
  {
    sourceId: "fema-nfhl-firm",
    path: "data-sources/manifests/fema-nfhl-firm.json",
    domain: "FLOOD",
    expectedHorizontal: ["NAD83", "EPSG:4326", "SOURCE_NATIVE"],
    expectedVertical: ["NAVD88"],
    geoidModel: "GEOID18_WHEN_ELLIPSOIDAL_INPUT",
    ncatRole: "SPC_UTM_LLH_WHEN_NEEDED",
    vdatumRole: "TIDAL_ONLY_IF_COASTAL_LAYER",
  },
  {
    sourceId: "terrain-aoi-coverage",
    path: "contracts/registries/tsm-terrain-aoi-coverage-manifest-v1.json",
    domain: "AOI",
    expectedHorizontal: ["EPSG:4326"],
    expectedVertical: ["NAVD88"],
    geoidModel: "GEOID18",
    ncatRole: "SITE_ANCHOR_LLH",
    vdatumRole: "POINT_CHECK_ONLY",
  },
];

const CLIENT_EVIDENCE = {
  ncat: {
    path: "packages/geo/src/geodesy/NcatClient.ts",
    endpoint: "https://geodesy.noaa.gov/api/ncat/llh",
    test: "tests/contracts/ncat-live-client.test.ts",
  },
  vdatum: {
    path: "packages/geo/src/geodesy/VDatumClient.ts",
    endpoint: "https://vdatum.noaa.gov/vdatumweb/api/convert",
    test: "tests/contracts/vdatum-live-client.test.ts",
  },
  geoid: {
    path: "packages/geo/src/geodesy/GeoidModel.ts",
    models: ["GEOID18", "GEOID12B"],
    epoch: "2010.0",
    horizontal: "NAD83_2011",
  },
};

const rows = [];
const failures = [];

for (const s of SOURCES) {
  const abs = join(root, s.path);
  const present = existsSync(abs);
  if (!present) failures.push(`SOURCE_MANIFEST_MISSING:${s.sourceId}`);
  let declared = {};
  if (present) {
    try {
      declared = JSON.parse(readFileSync(abs, "utf8"));
    } catch {
      failures.push(`SOURCE_MANIFEST_INVALID_JSON:${s.sourceId}`);
    }
  }
  rows.push({
    sourceId: s.sourceId,
    domain: s.domain,
    manifest_present: present,
    expectedHorizontal: s.expectedHorizontal,
    expectedVertical: s.expectedVertical,
    geoidModel: s.geoidModel,
    ncatRole: s.ncatRole,
    vdatumRole: s.vdatumRole,
    client_evidence: CLIENT_EVIDENCE,
    authority: "Presentation and screening transforms must not be promoted to survey or FIRM authority.",
    declared_keys: present ? Object.keys(declared).slice(0, 12) : [],
  });
}

const report = {
  schema_version: "1.0.0",
  report_id: "crs-provenance-per-source",
  generated_at: new Date().toISOString(),
  policy: "Technology informs people; it does not silently govern people. Human authority remains final.",
  closes_capability_gap: "crs-vertical-datum-epoch-accuracy-catalog",
  sources: rows,
  clients: CLIENT_EVIDENCE,
  failures,
  status: failures.length === 0 ? "PASS_PROVENANCE_ATTACHED" : "FAIL",
};

const idx = process.argv.indexOf("--json-out");
if (idx >= 0 && process.argv[idx + 1]) {
  writeFileSync(process.argv[idx + 1], JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
process.exit(failures.length === 0 ? 0 : 1);
