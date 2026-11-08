#!/usr/bin/env node
/**
 * Whole-catalog CRS / vertical datum / epoch accuracy report.
 * Fail-closed: only reports registry contents; never invents EPSG or geoid coverage.
 * Usage: node scripts/reports/crs-vertical-datum-catalog-report.mjs [--json-out path]
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");

// Inline bounded registries (mirrors packages/geo — keep in sync with EpsgRegistry + GeoidModel)
const EPSG = [
  { code: 4326, name: "WGS 84 geographic 2D", horizontalDatum: "WGS84", kind: "GEOGRAPHIC_2D", suitability: "ENGINEERING" },
  { code: 4979, name: "WGS 84 geographic 3D", horizontalDatum: "WGS84", kind: "GEOGRAPHIC_3D", suitability: "ENGINEERING" },
  { code: 4269, name: "NAD83 geographic 2D", horizontalDatum: "NAD83", kind: "GEOGRAPHIC_2D", suitability: "ENGINEERING" },
  { code: 4267, name: "NAD27 geographic 2D", horizontalDatum: "NAD27", kind: "GEOGRAPHIC_2D", suitability: "ENGINEERING" },
  { code: 6318, name: "NAD83(2011) geographic 2D", horizontalDatum: "NAD83_2011", kind: "GEOGRAPHIC_2D", suitability: "ENGINEERING" },
  { code: 26915, name: "NAD83 / UTM zone 15N", horizontalDatum: "NAD83", kind: "PROJECTED", suitability: "ENGINEERING" },
  { code: 26916, name: "NAD83 / UTM zone 16N", horizontalDatum: "NAD83", kind: "PROJECTED", suitability: "ENGINEERING" },
  { code: 2966, name: "NAD83 / Indiana West (ftUS)", horizontalDatum: "NAD83", kind: "PROJECTED", suitability: "ENGINEERING" },
  { code: 5070, name: "NAD83 / Conus Albers", horizontalDatum: "NAD83", kind: "PROJECTED", suitability: "ENGINEERING" },
  { code: 3857, name: "WGS 84 / Pseudo-Mercator", horizontalDatum: "WGS84", kind: "PROJECTED", suitability: "DISPLAY_ONLY" },
];

const GEOID = [
  {
    id: "GEOID18",
    compatibleHorizontalDatum: "NAD83_2011",
    compatibleEpoch: "2010.0",
    vertical: "NAVD88",
    coverage: "CONUS, PR, VI",
    sourceUrl: "https://www.ngs.noaa.gov/GEOID/GEOID18/geoid18_tech_details.shtml",
  },
  {
    id: "GEOID12B",
    compatibleHorizontalDatum: "NAD83_2011",
    compatibleEpoch: "2010.0",
    vertical: "NAVD88",
    coverage: "CONUS (legacy; superseded for new work)",
    sourceUrl: "https://www.ngs.noaa.gov/GEOID/GEOID12B/g2012Brme.txt",
  },
];

const CLIENTS = [
  { id: "ncat", path: "packages/geo/src/geodesy/NcatClient.ts", endpoint: "https://geodesy.noaa.gov/api/ncat/llh" },
  { id: "vdatum", path: "packages/geo/src/geodesy/VDatumClient.ts", endpoint: "https://vdatum.noaa.gov/vdatumweb/api/convert" },
];

const failures = [];
const warnings = [];

for (const row of EPSG) {
  if (!Number.isFinite(row.code) || row.code <= 0) failures.push(`INVALID_EPSG:${row.code}`);
  if (row.suitability === "DISPLAY_ONLY") warnings.push(`DISPLAY_ONLY_CRS:${row.code}`);
}

for (const g of GEOID) {
  if (g.compatibleHorizontalDatum !== "NAD83_2011") failures.push(`GEOID_DATUM:${g.id}`);
  if (g.compatibleEpoch !== "2010.0") failures.push(`GEOID_EPOCH:${g.id}`);
}

const report = {
  schema_version: "1.0.0",
  report_id: "crs-vertical-datum-epoch-accuracy-catalog",
  generated_at: new Date().toISOString(),
  policy: "Technology informs people; it does not silently govern people. Human authority remains final.",
  denominator: {
    epsg_entries: EPSG.length,
    geoid_models: GEOID.length,
    live_clients: CLIENTS.length,
  },
  epsg_catalog: EPSG,
  geoid_models: GEOID,
  live_clients: CLIENTS,
  failures,
  warnings,
  gaps: [
    "Registry is bounded TSM contract set, not full EPSG dataset.",
    "AOI source-by-source provenance inventory still required for each terrain/flood layer.",
    "Live NCAT/VDatum success not asserted by this offline report (see contract tests).",
  ],
  status: failures.length === 0 ? "PASS_BOUNDED_CATALOG" : "FAIL",
};

const jsonOutIdx = process.argv.indexOf("--json-out");
if (jsonOutIdx >= 0 && process.argv[jsonOutIdx + 1]) {
  const out = process.argv[jsonOutIdx + 1];
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.error(`Wrote ${out}`);
}

console.log(JSON.stringify(report, null, 2));
process.exit(failures.length === 0 ? 0 : 1);
