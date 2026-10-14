#!/usr/bin/env node
/**
 * Fetch small public JSON metadata snapshots with bounded memory and SHA-256.
 * Redirects are rejected: the allowlist applies to the actual request host.
 * Large scientific datasets must use the project's specialized acquisition tools.
 */
import { createHash } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_HOSTS = new Set(["api.waterdata.usgs.gov", "hazards.fema.gov"]);
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

export async function readBoundedBody(response, maxBytes = MAX_BYTES) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("maxBytes must be a positive safe integer");
  }
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (Number.isFinite(length) && length > maxBytes) {
      await response.body?.cancel();
      throw new Error(`Response exceeds safety limit of ${maxBytes} bytes`);
    }
  }
  if (!response.body) throw new Error("Response body is empty");

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("Response size limit exceeded");
        throw new Error(`Response exceeds safety limit of ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

export async function fetchBoundedJson(urlInput, fetchImpl = fetch, maxBytes = MAX_BYTES) {
  const url = new URL(urlInput);
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error("Source URL is not in the explicit HTTPS host allowlist");
  }

  const response = await fetchImpl(url, {
    redirect: "error",
    headers: {
      accept: "application/json",
      "user-agent": "TSM-public-source-snapshot/1.1 (+https://github.com/ATphobia22/Tri-State-Systems-Manager)"
    },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`Source request failed: HTTP ${response.status} ${response.statusText}`);
  if (response.url) {
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== "https:" || !ALLOWED_HOSTS.has(finalUrl.hostname) || finalUrl.hostname !== url.hostname) {
      throw new Error("Response URL escaped the explicit source host allowlist");
    }
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^application\/(?:[a-z0-9.+-]*\+)?json(?:\s*;|\s*$)/i.test(contentType)) {
    throw new Error(`Unexpected content type; expected JSON, received ${contentType || "missing"}`);
  }

  const bytes = await readBoundedBody(response, maxBytes);
  let document;
  try {
    document = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Source response was not valid JSON");
  }
  return { response, bytes, document, contentType };
}

function parseArgs(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (key === "--help") return { help: true };
    if (!["--source", "--out"].includes(key) || !args[index + 1] || args[index + 1].startsWith("--")) {
      throw new Error(`Invalid or incomplete argument: ${key}`);
    }
    if (values.has(key)) throw new Error(`Duplicate argument: ${key}`);
    values.set(key, args[++index]);
  }
  return { sourceKey: values.get("--source"), outArg: values.get("--out") };
}

export async function main(args = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs(args);
  } catch (error) {
    console.error(error.message);
    console.error("Usage: node acquire-public-source-snapshot.mjs --source <source-key> --out <directory>");
    process.exitCode = 2;
    return;
  }
  if (parsed.help) {
    console.log("Usage: node acquire-public-source-snapshot.mjs --source <usgs-api-index|usgs-monitoring-collections|fema-nfhl-service> --out <directory>");
    return;
  }
  const { sourceKey, outArg } = parsed;
  if (!sourceKey || !outArg) {
    console.error("Both --source and --out are required.");
    process.exitCode = 2;
    return;
  }
  const source = SOURCES[sourceKey];
  if (!source) {
    console.error(`Unsupported source key: ${sourceKey}`);
    process.exitCode = 2;
    return;
  }

  const { response, bytes, contentType } = await fetchBoundedJson(source.url);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const retrievedAt = new Date().toISOString();
  const outDir = resolve(outArg);
  await mkdir(outDir, { recursive: true });
  const dataPath = resolve(outDir, source.file);
  const manifestPath = resolve(outDir, source.file.replace(/\.json$/, ".manifest.json"));
  const temporaryDataPath = `${dataPath}.tmp-${process.pid}`;
  const temporaryManifestPath = `${manifestPath}.tmp-${process.pid}`;
  const manifest = {
    manifest_version: "1.1.0",
    source_key: sourceKey,
    purpose: source.purpose,
    source_url: response.url || source.url,
    retrieved_at: retrievedAt,
    http_status: response.status,
    content_type: contentType,
    content_length_bytes: bytes.length,
    etag: response.headers.get("etag"),
    last_modified: response.headers.get("last-modified"),
    sha256,
    snapshot_file: basename(dataPath),
    scope_note: "Snapshot of public API/service JSON metadata only. This does not establish source currency, data suitability, or engineering authority."
  };

  try {
    await writeFile(temporaryDataPath, bytes, { flag: "wx" });
    await writeFile(temporaryManifestPath, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
    await rename(temporaryDataPath, dataPath);
    await rename(temporaryManifestPath, manifestPath);
  } catch (error) {
    await Promise.all([
      rm(temporaryDataPath, { force: true }),
      rm(temporaryManifestPath, { force: true })
    ]);
    throw error;
  }
  console.log(JSON.stringify({ snapshot: dataPath, manifest: manifestPath, sha256, bytes: bytes.length, retrievedAt }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Source snapshot failed: ${error.message}`);
    process.exitCode = 1;
  });
}
