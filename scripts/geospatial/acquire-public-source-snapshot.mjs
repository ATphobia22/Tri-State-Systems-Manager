#!/usr/bin/env node
/**
 * Fetch small public API/service metadata snapshots and write a SHA-256 manifest.
 * Large scientific datasets should use the project's specialized acquisition
 * workflows; this utility is deliberately capped and never accepts arbitrary hosts.
 *
 * Usage:
 *   node scripts/geospatial/acquire-public-source-snapshot.mjs --source usgs-api-index --out data/acquisitions/snapshots
 *   node scripts/geospatial/acquire-public-source-snapshot.mjs --source fema-nfhl-service --out data/acquisitions/snapshots
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCES = {
  "usgs-api-index": {
    url: "https://api.waterdata.usgs.gov/ogcapi/v1/?f=json",
    file: "usgs-water-data-api-landing.json",
    purpose: "Public USGS Water Data OGC API landing metadata"
  },
  "usgs-monitoring-collections": {
    url: "https://api.waterdata.usgs.gov/ogcapi/v1/collections/monitoring-locations?f=json",
    file: "usgs-monitoring-location-collection-metadata.json",
    purpose: "USGS monitoring-location collection metadata; not a selected AOI data extract"
  },
  "fema-nfhl-service": {
    url: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer?f=pjson",
    file: "fema-nfhl-effective-service-metadata.json",
    purpose: "FEMA NFHL effective service metadata; not a flood-zone determination"
  }
};

const args = process.argv.slice(2);
function arg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
const sourceKey = arg("--source");
const outArg = arg("--out");
if (!sourceKey || !outArg || args.includes("--help")) {
  console.error("Usage: node acquire-public-source-snapshot.mjs --source <usgs-api-index|usgs-monitoring-collections|fema-nfhl-service> --out <directory>");
  process.exit(args.includes("--help") ? 0 : 2);
}
const source = SOURCES[sourceKey];
if (!source) {
  console.error(`Unsupported source key: ${sourceKey}`);
  process.exit(2);
}
const url = new URL(source.url);
if (url.protocol !== "https:" || !["api.waterdata.usgs.gov", "hazards.fema.gov"].includes(url.hostname)) {
  throw new Error("Source URL is not in the explicit HTTPS host allowlist");
}

const response = await fetch(url, {
  headers: { "accept": "application/json", "user-agent": "TSM-public-source-snapshot/1.0 (+https://github.com/ATphobia22/Tri-State-Systems-Manager)" },
  signal: AbortSignal.timeout(30_000)
});
if (!response.ok) throw new Error(`Source request failed: HTTP ${response.status} ${response.statusText}`);
const contentType = response.headers.get("content-type") ?? "";
if (!/(json|text\/plain|text\/html)/i.test(contentType)) throw new Error(`Unexpected content type: ${contentType}`);
const bytes = Buffer.from(await response.arrayBuffer());
const maxBytes = 5 * 1024 * 1024;
if (bytes.length > maxBytes) throw new Error(`Response exceeds safety limit of ${maxBytes} bytes; use a bounded specialized acquisition`);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const retrievedAt = new Date().toISOString();
const outDir = resolve(outArg);
await mkdir(outDir, { recursive: true });
const dataPath = resolve(outDir, source.file);
await writeFile(dataPath, bytes);
const manifest = {
  manifest_version: "1.0.0",
  source_key: sourceKey,
  purpose: source.purpose,
  source_url: response.url,
  retrieved_at: retrievedAt,
  http_status: response.status,
  content_type: contentType,
  content_length_bytes: bytes.length,
  etag: response.headers.get("etag"),
  last_modified: response.headers.get("last-modified"),
  sha256,
  snapshot_file: basename(dataPath),
  scope_note: "Snapshot of public API/service metadata only. This does not establish source currency, data suitability, or engineering authority."
};
const manifestPath = resolve(outDir, source.file.replace(/\.json$/, ".manifest.json"));
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ snapshot: dataPath, manifest: manifestPath, sha256, bytes: bytes.length, retrievedAt }, null, 2));
