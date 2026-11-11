import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { seedMtvi3Timeline } from "../../packages/geo/src/public-interest/EvidenceTimeMachine.ts";
import { defaultPoseyUncertaintyMarkers } from "../../packages/geo/src/public-interest/UncertaintyLens.ts";
import { buildPassport, passportToMarkdown } from "../../packages/geo/src/public-interest/CommunityEvidencePassport.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("immutable source manifest has core federal sources", () => {
  const p = join(root, "integrations/registry/tsm-immutable-source-manifest-v1.json");
  assert.ok(existsSync(p));
  const m = JSON.parse(readFileSync(p, "utf8"));
  const ids = m.sources.map((s) => s.id);
  assert.ok(ids.includes("usgs-water-data-api-v1"));
  assert.ok(ids.includes("noaa-nwps"));
  assert.ok(ids.includes("fema-nfhl-msc"));
  assert.ok(ids.includes("ngs-vdatum"));
  assert.equal(m.policy.human_authority_final, true);
});

test("time machine and uncertainty lens seed data", () => {
  assert.ok(seedMtvi3Timeline().revisions.length >= 1);
  assert.ok(defaultPoseyUncertaintyMarkers().some((u) => u.kind === "unknown_building_height"));
});

test("passport is informational not regulatory determination", () => {
  const p = buildPassport({ parcelId: "demo" });
  assert.match(p.disclaimer, /Not a land survey/);
  assert.match(passportToMarkdown(p), /Community Evidence Passport/);
});
