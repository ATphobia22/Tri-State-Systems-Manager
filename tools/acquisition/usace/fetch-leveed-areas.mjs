#!/usr/bin/env node
/**
 * Fetch leveed-area polygons from the USACE National Levee Database API v2.
 *
 * POSTs {"ids":[...]} to /api/system/systems to confirm the requested
 * system IDs exist, then GETs /leveed-areas-{systemId}.geojson for each
 * system and validates the response.
 *
 * Fail-closed: exits non-zero on non-2xx HTTP, invalid JSON, a response
 * that is not a FeatureCollection, or an empty features array.
 *
 * Writes, per system:
 *   <out-stem>-<systemId>.geojson  (the validated polygon payload)
 *   <out-stem>-<systemId>.geojson.sha256
 *   <out-stem>-<systemId>.receipt.json  (validation receipt)
 *
 * With a single --ids value the files are written to exactly the --out
 * path (no suffix), keeping the stored v1 artifact reproducible:
 *
 *   node tools/acquisition/usace/fetch-leveed-areas.mjs \
 *     --ids 270005000005 \
 *     --out data/usace-nld/leveed-areas-wabash-v1.geojson
 *
 * Node stdlib only (no dependencies).
 */

import { get, request } from "node:https";
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API_BASE = "https://levees.sec.usace.army.mil/api";
const USER_AGENT = "TSM-acquisition/1.0 (+tri-state-systems-manager)";
const CRS = "NAD83";
const VERTICAL_DATUM = "NAVD88";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function parseArgs(argv) {
  const args = { ids: null, out: null, timeout: 30000 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--ids" && argv[i + 1]) args.ids = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--out" && argv[i + 1]) args.out = argv[++i];
    else if (a === "--timeout" && argv[i + 1]) args.timeout = Number(argv[++i]) * 1000;
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

function fetchUrl(url, { method = "GET", body = null, timeout } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(body, "utf8") : null;
    const headers = { "User-Agent": USER_AGENT, Accept: "application/json" };
    if (payload) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = payload.length;
    }
    const req = request(url, { method, headers, timeout }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({
          status: res.statusCode,
          contentType: res.headers["content-type"] ?? "",
          body: Buffer.concat(chunks).toString("utf8"),
        }),
      );
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error(`request timed out after ${timeout} ms: ${url}`)));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Preflight: confirm every requested system ID exists via /api/system/systems. */
async function checkSystems(ids, timeout) {
  const url = `${API_BASE}/system/systems`;
  const res = await fetchUrl(url, { method: "POST", body: JSON.stringify({ ids }), timeout });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`system lookup failed: ${url} returned HTTP ${res.status}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(res.body);
  } catch (e) {
    throw new Error(`system lookup failed: invalid JSON from ${url}: ${e.message}`);
  }
  const returned = Array.isArray(parsed) ? parsed : parsed.systems ?? parsed.results ?? [];
  const idsReturned = new Set(
    returned.map((s) => String(s.systemId ?? s.id ?? s.fcSystemId ?? "")),
  );
  for (const id of ids) {
    if (!idsReturned.has(id)) {
      throw new Error(`system lookup failed: requested system ID ${id} not returned by ${url}`);
    }
  }
  return res.status;
}

function validateFeatureCollection(text, sourceUrl) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`invalid JSON from ${sourceUrl}: ${e.message}`);
  }
  if (parsed?.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    throw new Error(
      `unexpected payload from ${sourceUrl}: expected FeatureCollection with features array, got type=${parsed?.type}`,
    );
  }
  if (parsed.features.length === 0) {
    throw new Error(`empty features array from ${sourceUrl}: refusing to write an empty artifact`);
  }
  return parsed;
}

async function fetchOne(systemId, outPath, timeout) {
  const sourceUrl = `${API_BASE}/leveed-areas-${systemId}.geojson`;
  const res = await fetchUrl(sourceUrl, { timeout });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`${sourceUrl} returned HTTP ${res.status}`);
  }
  const parsed = validateFeatureCollection(res.body, sourceUrl);
  const digest = sha256(res.body);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, res.body, "utf8");
  writeFileSync(`${outPath}.sha256`, `${digest}  ${basename(outPath)}\n`, "utf8");

  const receiptPath = outPath.replace(/\.geojson$/, ".receipt.json");
  const receipt = {
    sourceUrl,
    httpStatus: res.status,
    contentType: res.contentType,
    retrievedAt: new Date().toISOString(),
    systemId,
    featureCount: parsed.features.length,
    sha256: digest,
    crs: CRS,
    verticalDatum: VERTICAL_DATUM,
    authority: "USACE National Levee Database",
    dataClass: "evidence",
    script: "tools/acquisition/usace/fetch-leveed-areas.mjs",
  };
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");

  console.log(`ok: system ${systemId} -> ${outPath} (${parsed.features.length} features, sha256 ${digest.slice(0, 12)}...)`);
}

async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    fail(e.message);
  }
  if (args.help || !args.ids || !args.out) {
    console.log(`usage: node tools/acquisition/usace/fetch-leveed-areas.mjs --ids <id[,id...]> --out <path> [--timeout SECONDS]`);
    process.exit(args.help ? 0 : 2);
  }
  if (args.ids.length === 0) fail("--ids must list at least one system ID");

  let outPath = args.out;
  if (!outPath.startsWith("/")) outPath = join(REPO_ROOT, outPath);

  try {
    await checkSystems(args.ids, args.timeout);
    for (const id of args.ids) {
      const per =
        args.ids.length === 1
          ? outPath
          : join(dirname(outPath), `${basename(outPath, extname(outPath))}-${id}${extname(outPath)}`);
      await fetchOne(id, per, args.timeout);
    }
  } catch (e) {
    fail(e.message);
  }
}

main(process.argv.slice(2));
