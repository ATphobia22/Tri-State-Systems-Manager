#!/usr/bin/env node
/**
 * Probe registered real-world data fabric endpoints.
 * Usage: node scripts/geospatial/probe-data-fabrics.mjs
 * Exit 0 if all LIVE; 1 if any DEGRADED.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");
const registryPath = join(
  root,
  "contracts/registries/tsm-real-world-data-fabric-registry-v1.json",
);

const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const UA = {
  "User-Agent": "TSM-DataFabric-Probe/1.0",
  Accept: "application/json,application/geo+json,*/*",
};

async function probe(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal });
    await res.arrayBuffer();
    return { ok: res.ok, http_status: res.status, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: String(e?.message || e), ms: Date.now() - t0 };
  } finally {
    clearTimeout(t);
  }
}

let degraded = 0;
for (const f of registry.fabrics) {
  const p = await probe(f.endpoint);
  const status = p.ok ? "LIVE" : "DEGRADED";
  if (!p.ok) degraded += 1;
  console.log(`${status.padEnd(8)} ${f.id.padEnd(32)} ${p.http_status ?? p.error} (${p.ms}ms)`);
  f.probe = p;
  f.status = status;
}

registry.generated_at = new Date().toISOString();
registry.summary = {
  total: registry.fabrics.length,
  live: registry.fabrics.length - degraded,
  degraded,
};
writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
console.log(`\nsummary live=${registry.summary.live}/${registry.summary.total}`);
process.exit(degraded > 0 ? 1 : 0);
