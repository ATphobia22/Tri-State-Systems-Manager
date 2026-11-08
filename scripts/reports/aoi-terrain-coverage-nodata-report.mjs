#!/usr/bin/env node
/**
 * AOI terrain coverage / nodata report.
 * Pins 3DEP + NFHL manifests; fail-closed when required pins or SHA-256 are missing.
 * Labels DERIVED / non-FIRM. Does not invent tiles or elevations.
 *
 * Usage:
 *   node scripts/reports/aoi-terrain-coverage-nodata-report.mjs [--json-out path]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const PINNED = [
  {
    id: "terrain-aoi-coverage-manifest",
    path: "contracts/registries/tsm-terrain-aoi-coverage-manifest-v1.json",
    role: "AOI_GEOMETRY_AND_PROVIDERS",
    required: true,
  },
  {
    id: "usgs-3dep-terrain-manifest",
    path: "data-sources/manifests/usgs-3dep-terrain.json",
    role: "3DEP_SOURCE_PIN",
    required: true,
  },
  {
    id: "fema-nfhl-firm-manifest",
    path: "data-sources/manifests/fema-nfhl-firm.json",
    role: "NFHL_SOURCE_PIN",
    required: true,
  },
  {
    id: "cs-coverage-nodata-prior",
    path: "docs/validation/cs-coverage/coverage-nodata-report-2026-10-23.json",
    role: "PRIOR_COVERAGE_EVIDENCE",
    required: false,
  },
  {
    id: "terrain-rgb-pipeline-evidence",
    path: "artifacts/tsm-terrain-rgb-3dep-pipeline-v1.json",
    role: "DERIVED_TILE_PIPELINE",
    required: false,
  },
];

function sha256File(abs) {
  const buf = readFileSync(abs);
  return createHash("sha256").update(buf).digest("hex");
}

const assets = [];
const failures = [];
const warnings = [];

for (const pin of PINNED) {
  const abs = join(root, pin.path);
  if (!existsSync(abs)) {
    const row = {
      ...pin,
      present: false,
      sha256: null,
      authority_class: pin.role.includes("NFHL") ? "REGULATORY_REFERENCE" : "DERIVED_OR_FEDERAL_ELEVATION",
    };
    assets.push(row);
    if (pin.required) failures.push(`MISSING_REQUIRED_PIN:${pin.id}`);
    else warnings.push(`OPTIONAL_PIN_MISSING:${pin.id}`);
    continue;
  }
  let parsed = null;
  try {
    parsed = JSON.parse(readFileSync(abs, "utf8"));
  } catch {
    failures.push(`INVALID_JSON:${pin.id}`);
  }
  const hash = sha256File(abs);
  assets.push({
    ...pin,
    present: true,
    sha256: hash,
    bytes: readFileSync(abs).length,
    authority_class: pin.role.includes("NFHL") ? "REGULATORY_REFERENCE" : "DERIVED_OR_FEDERAL_ELEVATION",
    label: "DERIVED_OR_REFERENCE_NOT_FIRM_SURVEY",
    snippet: parsed && typeof parsed === "object" ? Object.keys(parsed).slice(0, 8) : [],
  });
}

// Fail-closed: Terrain-RGB / 3DEP screening must never be labelled survey/FIRM
const aoiManifestPath = join(root, "contracts/registries/tsm-terrain-aoi-coverage-manifest-v1.json");
let aoi = null;
if (existsSync(aoiManifestPath)) {
  aoi = JSON.parse(readFileSync(aoiManifestPath, "utf8"));
  if (aoi.verification?.state === "PROVISIONAL") {
    warnings.push("AOI_VERIFICATION_PROVISIONAL");
  }
  for (const p of aoi.providers || []) {
    if (p.status === "PROGRAM_PENDING") warnings.push(`PROVIDER_PROGRAM_PENDING:${p.id}`);
    if (!p.sourceUri) warnings.push(`PROVIDER_SOURCE_URI_NULL:${p.id}`);
  }
}

const report = {
  schema_version: "1.0.0",
  report_id: "aoi-terrain-coverage-nodata",
  generated_at: new Date().toISOString(),
  policy: "Technology informs people; it does not silently govern people. Human authority remains final.",
  labels: {
    terrain_rgb: "DERIVED_SCREENING_NOT_SURVEY",
    nfhl: "REGULATORY_REFERENCE_NOT_PROJECT_SURVEY",
    firm: "OFFICIAL_SFHA_VIA_HARDCOPY_FIRM_FIS",
  },
  aoi: aoi
    ? {
        aoi_id: aoi.aoi_id,
        name: aoi.name,
        bbox: aoi.bbox,
        horizontal_crs: aoi.horizontal_crs,
        vertical_datum: aoi.vertical_datum,
        site_anchor: aoi.site_anchor,
        verification_state: aoi.verification?.state ?? "UNKNOWN",
      }
    : null,
  assets,
  nodata: {
    required_pins_missing: failures.filter((f) => f.startsWith("MISSING_REQUIRED_PIN")),
    program_pending_providers: (aoi?.providers || [])
      .filter((p) => p.status === "PROGRAM_PENDING")
      .map((p) => p.id),
    note: "Absent required pins or PROGRAM_PENDING providers are treated as coverage gaps (fail-closed for engineering promotion).",
  },
  failures,
  warnings,
  status: failures.length === 0 ? "PASS_PINS_PRESENT" : "FAIL_CLOSED_GAPS",
};

const idx = process.argv.indexOf("--json-out");
if (idx >= 0 && process.argv[idx + 1]) {
  writeFileSync(process.argv[idx + 1], JSON.stringify(report, null, 2) + "\n");
  console.error(`Wrote ${process.argv[idx + 1]}`);
}
console.log(JSON.stringify(report, null, 2));
process.exit(failures.length === 0 ? 0 : 1);
