import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile, readFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AdapterRegistry } from "../../packages/jobs/src/ingestion/registry.ts";
import { IngestionWorker } from "../../packages/jobs/src/ingestion/worker.ts";
import { GeoJsonAdapter } from "../../packages/jobs/src/ingestion/adapters/geojson.ts";
import { Ogr2OgrAdapter } from "../../packages/jobs/src/ingestion/adapters/ogr2ogr.ts";
import { createJob, toPendingRecord } from "../../packages/jobs/src/index.ts";
import type { AssetAdapter, IngestionInput } from "../../packages/contracts/src/IngestionManifest.ts";

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

function geojsonInput(featureCount = 2): IngestionInput {
  const features = Array.from({ length: featureCount }, (_, i) => ({
    type: "Feature",
    properties: { id: i },
    geometry: { type: "Point", coordinates: [i, i] },
  }));
  const bytes = new TextEncoder().encode(JSON.stringify({ type: "FeatureCollection", features }));
  return { bytes, sourceId: "test-source", sourceUri: "https://example.invalid/data.geojson", assetKind: "geojson" };
}

test("GeoJsonAdapter ingests a valid FeatureCollection and hashes the exact bytes", async () => {
  const adapter = new GeoJsonAdapter();
  const input = geojsonInput(2);
  const result = await adapter.ingest(input);
  assert.equal(result.status, "INGESTED");
  assert.equal(result.manifest?.featureCount, 2);
  assert.equal(result.manifest?.byteSize, input.bytes.length);
  assert.equal(result.manifest?.checksumSha256, sha256(input.bytes));
  assert.match(result.manifest?.checksumSha256 ?? "", /^[a-f0-9]{64}$/);
  assert.equal(result.manifest?.adapterName, "geojson");
  assert.equal(result.manifest?.sourceId, "test-source");
});

test("GeoJsonAdapter reports an empty FeatureCollection honestly (0 features, not an error)", async () => {
  const adapter = new GeoJsonAdapter();
  const result = await adapter.ingest(geojsonInput(0));
  assert.equal(result.status, "INGESTED");
  assert.equal(result.manifest?.featureCount, 0);
});

test("GeoJsonAdapter rejects invalid JSON, non-collections, and non-Feature entries with reasons", async () => {
  const adapter = new GeoJsonAdapter();
  const badJson = await adapter.ingest({ ...geojsonInput(), bytes: new TextEncoder().encode("{not json") });
  assert.equal(badJson.status, "REJECTED");
  assert.match(badJson.reason ?? "", /not valid UTF-8 JSON/);

  const notCollection = await adapter.ingest({
    ...geojsonInput(),
    bytes: new TextEncoder().encode(JSON.stringify({ type: "Feature", properties: {}, geometry: null })),
  });
  assert.equal(notCollection.status, "REJECTED");
  assert.match(notCollection.reason ?? "", /not a FeatureCollection/);

  const badFeature = await adapter.ingest({
    ...geojsonInput(),
    bytes: new TextEncoder().encode(JSON.stringify({
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: null }, { type: "NotAFeature" }],
    })),
  });
  assert.equal(badFeature.status, "REJECTED");
  assert.match(badFeature.reason ?? "", /features\[1\] is not a Feature/);

  const wrongKind = await adapter.ingest({ ...geojsonInput(), assetKind: "geopackage" });
  assert.equal(wrongKind.status, "REJECTED");
  assert.match(wrongKind.reason ?? "", /supports assetKind 'geojson'/);
});

test("AdapterRegistry rejects duplicate registration and reports its contents", () => {
  const registry = new AdapterRegistry();
  registry.register(new GeoJsonAdapter());
  assert.equal(registry.has("geojson"), true);
  assert.deepEqual(registry.names(), ["geojson"]);
  assert.equal(registry.get("missing"), undefined);
  assert.throws(() => registry.register(new GeoJsonAdapter()), /already registered: geojson/);
});

test("IngestionWorker returns UNAVAILABLE for an unknown adapter and for a throwing adapter", async () => {
  const registry = new AdapterRegistry();
  registry.register(new GeoJsonAdapter());
  const worker = new IngestionWorker(registry);

  const unknown = await worker.execute("no-such-adapter", geojsonInput());
  assert.equal(unknown.status, "UNAVAILABLE");
  assert.match(unknown.reason ?? "", /Unknown ingestion adapter: no-such-adapter/);

  const throwing: AssetAdapter = {
    name: "boom",
    supportedKinds: ["geojson"],
    ingest: async () => { throw new Error("kaboom"); },
  };
  registry.register(throwing);
  const caught = await worker.execute("boom", geojsonInput());
  assert.equal(caught.status, "UNAVAILABLE");
  assert.match(caught.reason ?? "", /kaboom/);
});

test("IngestionWorker.runJob wires the outcome into a JobRecord with the checksum as resultRef", async () => {
  const registry = new AdapterRegistry();
  registry.register(new GeoJsonAdapter());
  const worker = new IngestionWorker(registry);
  const input = geojsonInput(3);

  const spec = createJob("ingest_usgs_stage", { adapter: "geojson" });
  const { job, result } = await worker.runJob(toPendingRecord(spec), input);
  assert.equal(result.status, "INGESTED");
  assert.equal(job.status, "succeeded");
  assert.equal(job.resultRef, sha256(input.bytes));
  assert.ok(job.startedAt && job.finishedAt);

  const badSpec = createJob("ingest_nfhl_layer", { adapter: "geojson" });
  const bad = await worker.runJob(toPendingRecord(badSpec), { ...input, bytes: new TextEncoder().encode("nope") });
  assert.equal(bad.job.status, "failed");
  assert.match(bad.job.error ?? "", /not valid UTF-8 JSON/);
  assert.equal(bad.job.resultRef, undefined);
});

/** Stub ogr2ogr: records its argv to a log file and exits with $STUB_EXIT_CODE. */
async function makeStubOgr2ogr(): Promise<{ dir: string; logPath: string; restorePath: () => void }> {
  const dir = await mkdtemp(join(tmpdir(), "tsm-stub-ogr2ogr-"));
  const logPath = join(dir, "argv.log");
  const script = join(dir, "ogr2ogr");
  await writeFile(script, `#!/bin/sh\nprintf '%s\\n' "$@" >> "${logPath}"\nexit "\${STUB_EXIT_CODE:-0}"\n`);
  await chmod(script, 0o755);
  const previousPath = process.env.PATH ?? "";
  process.env.PATH = `${dir}:${previousPath}`;
  return { dir, logPath, restorePath: () => { process.env.PATH = previousPath; } };
}

test("Ogr2OgrAdapter fails loudly at construction when no DSN is configured", () => {
  const saved = process.env.TSM_POSTGRES_DSN;
  delete process.env.TSM_POSTGRES_DSN;
  try {
    assert.throws(() => new Ogr2OgrAdapter(), /TSM_POSTGRES_DSN/);
  } finally {
    if (saved !== undefined) process.env.TSM_POSTGRES_DSN = saved;
  }
});

test("Ogr2OgrAdapter invokes ogr2ogr with the documented argv (stub binary, no real conversion claimed)", async (t) => {
  const stub = await makeStubOgr2ogr();
  t.after(async () => { stub.restorePath(); await rm(stub.dir, { recursive: true, force: true }); });
  const dsn = "postgresql://ogr2ogr-test@127.0.0.1:5432/tsm_test";
  const adapter = new Ogr2OgrAdapter({ dsn });
  const input: IngestionInput = {
    ...geojsonInput(1),
    assetKind: "geopackage",
    targetLayer: "test_layer",
  };
  const result = await adapter.ingest(input);
  assert.equal(result.status, "INGESTED");
  assert.equal(result.manifest?.checksumSha256, sha256(input.bytes));
  const argv = (await readFile(stub.logPath, "utf-8")).trim().split("\n");
  assert.equal(argv[0], "-f");
  assert.equal(argv[1], "PostgreSQL");
  assert.equal(argv[2], dsn);
  assert.match(argv[3], /\.gpkg$/);
  assert.equal(argv[4], "-nln");
  assert.equal(argv[5], "test_layer");
  assert.equal(argv[6], "-append");
  assert.equal(argv[7], "-update");
  assert.equal(argv.length, 8);
});

test("Ogr2OgrAdapter reports a non-zero ogr2ogr exit as REJECTED with the exit code", async (t) => {
  const stub = await makeStubOgr2ogr();
  t.after(async () => { stub.restorePath(); await rm(stub.dir, { recursive: true, force: true }); });
  process.env.STUB_EXIT_CODE = "3";
  t.after(() => { delete process.env.STUB_EXIT_CODE; });
  const adapter = new Ogr2OgrAdapter({ dsn: "postgresql://ogr2ogr-test@127.0.0.1:5432/tsm_test" });
  const result = await adapter.ingest({ ...geojsonInput(1), assetKind: "geojson", targetLayer: "test_layer" });
  assert.equal(result.status, "REJECTED");
  assert.match(result.reason ?? "", /exited with code 3/);
});

test("Ogr2OgrAdapter reports a missing ogr2ogr binary as UNAVAILABLE, never a throw", async () => {
  const adapter = new Ogr2OgrAdapter({ dsn: "postgresql://ogr2ogr-test@127.0.0.1:5432/tsm_test", binary: "ogr2ogr-definitely-not-installed" });
  const result = await adapter.ingest({ ...geojsonInput(1), assetKind: "geojson", targetLayer: "test_layer" });
  assert.equal(result.status, "UNAVAILABLE");
  assert.match(result.reason ?? "", /not found on PATH/);
});

test("Ogr2OgrAdapter rejects a missing targetLayer and unsupported kinds without spawning", async () => {
  const adapter = new Ogr2OgrAdapter({ dsn: "postgresql://ogr2ogr-test@127.0.0.1:5432/tsm_test", binary: "ogr2ogr-definitely-not-installed" });
  const noLayer = await adapter.ingest({ ...geojsonInput(1), assetKind: "geojson" });
  assert.equal(noLayer.status, "REJECTED");
  assert.match(noLayer.reason ?? "", /requires a targetLayer/);
  const badKind = await adapter.ingest({ ...geojsonInput(1), assetKind: "csv", targetLayer: "x" });
  assert.equal(badKind.status, "REJECTED");
  assert.match(badKind.reason ?? "", /supports geojson, geopackage, shapefile/);
});

test("Ogr2OgrAdapter redacts echoed connection credentials from failure diagnostics", async (t) => {
  const stub = await makeStubOgr2ogr();
  t.after(async () => { stub.restorePath(); await rm(stub.dir, { recursive: true, force: true }); });
  await writeFile(join(stub.dir, "ogr2ogr"), `#!/bin/sh\nprintf '%s\\n' "$3" >&2\nprintf '%s\\n' 'password="other secret" postgresql://user:alternate@host/db connection failed' >&2\nexit 9\n`);
  const dsn = "PG:host=localhost user=test password='primary secret' dbname=tsm";
  const result = await new Ogr2OgrAdapter({ dsn }).ingest({ ...geojsonInput(1), targetLayer: "public.test_layer" });
  assert.equal(result.status, "REJECTED");
  assert.match(result.reason ?? "", /exited with code 9/);
  assert.match(result.reason ?? "", /connection failed/);
  for (const secret of [dsn, "primary secret", "other secret", "alternate"]) {
    assert.ok(!result.reason?.includes(secret));
  }
});

test("Ogr2OgrAdapter rejects ambiguous destination identifiers before spawning", async () => {
  const adapter = new Ogr2OgrAdapter({ dsn: "PG:dbname=test", binary: "must-not-spawn" });
  for (const targetLayer of ["x;DROP TABLE y", "-overwrite", "a.b.c", "a b", '"quoted"']) {
    const result = await adapter.ingest({ ...geojsonInput(1), targetLayer });
    assert.equal(result.status, "REJECTED");
    assert.match(result.reason ?? "", /identifier/);
  }
});
