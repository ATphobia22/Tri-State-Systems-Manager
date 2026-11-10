#!/usr/bin/env node
/**
 * Offline source-byte verification for TSM evidence-to-cinema shot manifests.
 * No network calls, automatic regulatory approval, or claim of a rendered movie.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import { pathToFileURL } from "node:url";

const SHA = /^[a-f0-9]{64}$/i;
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_CATALOG_BYTES = 1024 * 1024;
const MAX_STORYBOARD_BYTES = 1024 * 1024;
const MAX_ASSET_BYTES = 1024 * 1024 * 1024;

function check(condition, reason) {
  if (!condition) throw new Error(reason);
}

function digestFile(file) {
  const sha = crypto.createHash("sha256");
  const fd = fs.openSync(file, "r");
  try {
    const block = Buffer.alloc(1024 * 1024);
    let n;
    while ((n = fs.readSync(fd, block, 0, block.length, null)) > 0) sha.update(block.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return sha.digest("hex");
}

function loadJson(file, limit) {
  check(fs.statSync(file).size <= limit, "JSON evidence exceeds byte budget");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function safeLocalFile(root, relative) {
  check(typeof relative === "string" && relative.length > 0 && relative.length <= 240
    && !relative.includes("\\") && !relative.includes(":") && !path.posix.isAbsolute(relative),
    "Unsafe local relative source path");
  const parts = relative.split("/");
  check(parts.every(p => p && p !== "." && p !== ".."), "Source traversal forbidden");
  const rootReal = fs.realpathSync(root);
  let current = rootReal;
  for (const part of parts) {
    current = path.join(current, part);
    check(!fs.lstatSync(current).isSymbolicLink(), "Symlinked evidence forbidden");
  }
  const real = fs.realpathSync(current);
  check(real.startsWith(rootReal + path.sep), "Evidence escapes data root");
  const stat = fs.statSync(real);
  check(stat.isFile() && stat.size > 0 && stat.size <= MAX_ASSET_BYTES,
    "Source must be nonempty regular file within bounded budget");
  return real;
}

const iso = value => typeof value === "string" &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
  Number.isFinite(Date.parse(value));

export function verifyStoryboard({ storyboard, catalog, dataRoot }) {
  const board = loadJson(storyboard, MAX_STORYBOARD_BYTES);
  const sourceCatalog = loadJson(catalog, MAX_CATALOG_BYTES);
  check(board.schema === "tsm.native.evidence-storyboard.v1" &&
    board.state === "REVIEW_REQUIRED_NOT_RENDERED" &&
    board.regulatoryDetermination === false && board.modelOutputAltered === false,
    "Storyboard provenance/disclosure contract invalid");
  check(SAFE_ID.test(board.storyboardId) && Array.isArray(board.shots) &&
    board.shots.length >= 1 && board.shots.length <= 64, "Storyboard ID or size invalid");
  check(sourceCatalog.schema === "tsm.native.reviewed-source-catalog.v1" &&
    Array.isArray(sourceCatalog.sources) && sourceCatalog.sources.length <= 5000,
    "Source catalog contract invalid");
  const sources = new Map();
  for (const src of sourceCatalog.sources) {
    check(src && SAFE_ID.test(src.sourceId) && !sources.has(src.sourceId), "Invalid/duplicate catalog source");
    sources.set(src.sourceId, src);
  }
  const usedShotIds = new Set();
  const verifiedAssets = new Map();
  const evaluatedShots = [];
  for (const shot of board.shots) {
    check(shot && SAFE_ID.test(shot.shotId) && !usedShotIds.has(shot.shotId),
      "Invalid or duplicate storyboard shot");
    usedShotIds.add(shot.shotId);
    check(shot.sourceContentVerifiedByThisOperation === false &&
      shot.agencyApproved === false && typeof shot.cinematicOnly === "boolean",
      "Shot may not self-certify source bytes or approvals");
    if (shot.cinematicOnly) {
      check(!shot.sourceId && !shot.sourceSha256 && !shot.authorityClass,
        "Cinematic-only shot may not imply sourced observation");
      evaluatedShots.push({ shotId: shot.shotId, classification: "CINEMATIC_ONLY_NOT_OBSERVED" });
      continue;
    }
    check(typeof shot.sourceId === "string" && sources.has(shot.sourceId),
      "Unregistered source ID");
    const src = sources.get(shot.sourceId);
    check(src.approvedForDisplay === true && src.licenseReviewed === true,
      "Human approval/license review absent");
    check(SHA.test(src.sha256) && SHA.test(shot.sourceSha256) &&
      src.sha256.toLowerCase() === shot.sourceSha256.toLowerCase(),
      "Catalog and storyboard SHA-256 mismatch");
    check(shot.authorityClass === src.authorityClass &&
      ["OBSERVATION","MODEL_OUTPUT","PLANNING","REGULATORY_REFERENCE","CONTEXT"].includes(src.authorityClass),
      "Unverified authority promotion");
    check(iso(src.acquisitionUtc) && shot.acquisitionUtc === src.acquisitionUtc,
      "Acquisition timestamp mismatch or invalid");
    check(typeof src.horizontalCrs === "string" && src.horizontalCrs.length > 0 &&
      typeof src.verticalDatum === "string" && src.verticalDatum.length > 0,
      "Explicit CRS and datum state required (use NONE_2D if not applicable)");
    const local = safeLocalFile(dataRoot, src.relativePath);
    let actual = verifiedAssets.get(src.sourceId);
    if (!actual) {
      actual = digestFile(local);
      verifiedAssets.set(src.sourceId, actual);
    }
    check(actual === src.sha256.toLowerCase(),
      "Local source SHA-256 mismatch for " + src.sourceId);
    evaluatedShots.push({
      shotId: shot.shotId, classification: "LOCAL_SOURCE_BYTES_VERIFIED_REVIEW_PENDING",
      sourceId: src.sourceId, sha256: actual, authorityClass: src.authorityClass,
      acquisitionUtc: src.acquisitionUtc, horizontalCrs: src.horizontalCrs,
      verticalDatum: src.verticalDatum
    });
  }
  return {
    schema: "tsm.native.storyboard-local-verification.v1",
    status: "LOCAL_SOURCE_BYTES_VERIFIED_STORYBOARD_REVIEW_PENDING",
    storyboardSha256: digestFile(storyboard),
    sourceCatalogSha256: digestFile(catalog),
    uniqueSourceFilesVerified: verifiedAssets.size,
    shots: evaluatedShots,
    engineeringCertified: false, modelCalibratedByThisOperation: false,
    renderedFilmVerified: false, offlineWindowsShippingVerified: false,
    notice: "File hashes and metadata consistency verified only. Spatial accuracy, model calibration, regulatory authority and rendered imagery require separate evidence."
  };
}

function main(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    check(argv[i]?.startsWith("--") && argv[i + 1], "Expected --storyboard --catalog --data-root [--report]");
    options[argv[i].slice(2)] = argv[i + 1];
  }
  check(options.storyboard && options.catalog && options["data-root"],
    "Required --storyboard --catalog --data-root");
  const result = verifyStoryboard({
    storyboard: options.storyboard, catalog: options.catalog, dataRoot: options["data-root"]
  });
  const serialized = JSON.stringify(result, null, 2) + "\n";
  if (options.report) {
    fs.writeFileSync(options.report, serialized, { flag: "wx" });
  }
  process.stdout.write(serialized);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); }
  catch (e) { console.error("Storyboard evidence unavailable:", e.message); process.exitCode = 2; }
}
