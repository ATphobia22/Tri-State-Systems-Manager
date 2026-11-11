#!/usr/bin/env node
/**
 * Milestone A helper: emit a public evidence validation report from the immutable source manifest.
 * Does not require Unreal or Windows.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = join(root, "integrations/registry/tsm-immutable-source-manifest-v1.json");
const outDir = join(root, "artifacts/public-evidence");
const outReport = join(outDir, "validation-report-v1.json");

if (!existsSync(manifestPath)) {
  console.error("manifest missing:", manifestPath);
  process.exit(1);
}

const raw = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(raw);
const manifestSha = createHash("sha256").update(raw).digest("hex");

const sources = manifest.sources || [];
const byState = {};
for (const s of sources) {
  const st = s.verification_state || "UNKNOWN";
  byState[st] = (byState[st] || 0) + 1;
}

const report = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString(),
  milestone: "A_SCIENTIFIC_PUBLIC_INTEREST",
  manifest_id: manifest.manifest_id,
  manifest_sha256: manifestSha,
  source_count: sources.length,
  verification_state_counts: byState,
  sources: sources.map((s) => ({
    id: s.id,
    agency: s.agency,
    title: s.title,
    url: s.url,
    verification_state: s.verification_state,
    sha256: s.sha256,
    vertical_datum: s.vertical_datum ?? null,
  })),
  limitations: [
    "Manifest registration is not full binary hash verification of multi-GB products",
    "Assembling sources does not validate engineering conclusions",
    "HEC-RAS entries are read-only import contracts",
    "Milestone B (UE Shipping offline) is separate",
  ],
  policy: manifest.policy,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outReport, JSON.stringify(report, null, 2));
console.log("wrote", outReport);
console.log("manifest_sha256", manifestSha);
console.log("sources", sources.length, byState);
