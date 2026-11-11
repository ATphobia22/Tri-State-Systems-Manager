import test from "node:test";
import assert from "node:assert/strict";
import { createMetricsHandlers, resetMetricsStoreForTests } from "../../tsm-console/server/metrics-api.mjs";
import {
  invokeExternalAdapter,
  listExternalAdapterStatus,
} from "../../integrations/adapters/external-presentation-adapters.mjs";

test("metrics API defaults to simulation demo and blocks OBSERVATION", async () => {
  resetMetricsStoreForTests();
  const h = createMetricsHandlers();
  const created = await h.postCreate({ title: "demo", metricValue: "1" });
  assert.equal(created.status, 201);
  assert.equal(created.body.is_simulation_demo, true);
  assert.equal(created.body.authority_class, "PRESENTATION");
  const blocked = await h.postCreate({ title: "bad", authority_class: "OBSERVATION" });
  assert.equal(blocked.status, 403);
});


test("metrics auto IDs are unique and numeric input is validated", async () => {
  resetMetricsStoreForTests();
  const h = createMetricsHandlers();
  const a = await h.postCreate({ title: "A" });
  const b = await h.postCreate({ title: "B" });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.notEqual(a.body.id, b.body.id);
  assert.equal((await h.getAll()).body.length, 2);
  assert.equal((await h.postCreate({ title: "invalid", trendPercentage: "NaN" })).status, 422);
  assert.equal((await h.postCreate({ title: "infinite", trendPercentage: "Infinity" })).status, 422);
  assert.equal((await h.postCreate(null)).status, 422);
  assert.equal((await h.postCreate({ id: 42, trendPercentage: 0 })).body.id, "42");
  assert.equal((await h.getById("42")).status, 200);
});

test("external adapters remain fail-closed BOUNDARY_READY", () => {
  const status = listExternalAdapterStatus();
  assert.equal(status.length, 4);
  for (const row of status) {
    assert.equal(row.mode, "BOUNDARY_READY");
    assert.equal(row.last_probe.ok, false);
  }
  assert.equal(invokeExternalAdapter("no-such").ok, false);
});
