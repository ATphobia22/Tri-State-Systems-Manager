#!/usr/bin/env node
/**
 * Production reliability structural gate.
 * Runtime behavior is covered by the reliability test suite; this gate
 * fails closed when required reliability modules or tests are missing.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const requiredFiles = [
  "tsm-console/server/reliability/circuit-breaker.mjs",
  "tsm-console/server/reliability/dead-letter-queue-runtime.mjs",
  "tsm-console/server/reliability/freshness.mjs",
  "tsm-console/server/reliability/retry-policy.mjs",
  "tsm-console/server/reliability/source-policies.mjs",
  "tsm-console/server/reliability/stale-cache.mjs",
  "tsm-console/tests/reliability-primitives.test.mjs",
];

const missing = requiredFiles.filter((relativePath) => {
  const absolutePath = path.join(root, relativePath);
  return !fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile();
});

if (missing.length) {
  console.error(JSON.stringify({ ok: false, gate: "production-reliability", missing }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, gate: "production-reliability", verifiedFiles: requiredFiles }, null, 2));
