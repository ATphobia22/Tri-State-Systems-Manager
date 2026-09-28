#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "../..");
const manifestPath = path.join(root, "data/acquisitions/tsm-authoritative-source-manifest-v1.json");
const outputPath = path.join(root, "data/acquisitions/verified-source-snapshot.json");

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const retrievedAt = new Date().toISOString();

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function metadataUrl(source) {
  if (source.kind === "arcgis-mapserver" || source.kind === "arcgis-featureserver") {
    return source.url.includes("?") ? source.url + "&f=json" : source.url + "?f=json";
  }
  return source.url;
}

async function fetchSource(source) {
  const url = metadataUrl(source);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "TSM-authoritative-source-verifier/1.0",
      "Accept": "application/json,text/plain,*/*"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30000)
  });

  const body = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const record = {
    id: source.id,
    authority: source.authority,
    authorityClass: source.authorityClass,
    sourceUrl: source.url,
    metadataUrl: url,
    retrievedAt,
    httpStatus: response.status,
    ok: response.ok,
    contentType,
    sha256: sha256(body),
    bytes: Buffer.byteLength(body)
  };

  if (response.ok && contentType.toLowerCase().includes("json")) {
    try {
      const parsed = JSON.parse(body);
      record.serviceMetadata = {
        currentVersion: parsed.currentVersion ?? null,
        serviceDescription: parsed.serviceDescription ?? null,
        spatialReference: parsed.spatialReference ?? null,
        layers: Array.isArray(parsed.layers) ? parsed.layers.map(({id, name}) => ({id, name})) : [],
        tables: Array.isArray(parsed.tables) ? parsed.tables.map(({id, name}) => ({id, name})) : []
      };
    } catch {
      record.parseWarning = "Response declared JSON but could not be parsed.";
    }
  } else if (!response.ok) {
    record.error = body.slice(0, 500);
  }

  return record;
}

const results = [];
for (const source of manifest.sources) {
  try {
    results.push(await fetchSource(source));
  } catch (error) {
    results.push({
      id: source.id,
      authority: source.authority,
      authorityClass: source.authorityClass,
      sourceUrl: source.url,
      metadataUrl: metadataUrl(source),
      retrievedAt,
      httpStatus: 0,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

const snapshot = {
  schemaVersion: "1.0.0",
  retrievedAt,
  manifestSha256: sha256(JSON.stringify(manifest)),
  results
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

const failures = results.filter((r) => !r.ok);
console.log(JSON.stringify({ outputPath, retrievedAt, sources: results.length, failures: failures.length }, null, 2));

if (failures.length > 0) {
  console.error("Authoritative-source verification failed for:");
  for (const failure of failures) console.error(`- ${failure.id}: ${failure.error || failure.httpStatus}`);
  process.exitCode = 1;
}
