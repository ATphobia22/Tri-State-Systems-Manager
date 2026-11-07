import test from "node:test";
import assert from "node:assert/strict";
import {
  LIDAR_CLASS,
  lidarClassDefinition,
  isGroundClass,
  isVegetationClass,
  isNoiseClass,
  qualityLevelDefinition,
  rmseVNonVegetatedM,
  markIgnoredGroundNearBreaklines,
  classifyVegetationByHag,
  DEFAULT_VEGETATION_BANDS,
  validateMonotonicRiver,
  assertMonotonicRiver,
  buildHydroFlattenConstraints,
  buildHydroEnforceConstraints,
  MIN_FLATTENED_WATERBODY_AREA_HA,
  MIN_FLATTENED_STREAM_WIDTH_M,
  MIN_DELINEATED_ISLAND_AREA_HA,
  MAX_IGNORED_GROUND_BUFFER_ANPS_MULTIPLE,
  type LidarPoint,
  type Breakline,
} from "../../packages/geo/src/lidar/index.ts";

// --- ASPRS / LBS class codes (verified against USGS LBS Table 5, 2025 rev. A) ---

test("verified class codes: ground is 2, ignored ground is 20, noise is 7 and 18", () => {
  assert.equal(LIDAR_CLASS.GROUND, 2);
  assert.equal(LIDAR_CLASS.IGNORED_GROUND, 20);
  assert.equal(LIDAR_CLASS.LOW_NOISE, 7);
  assert.equal(LIDAR_CLASS.HIGH_NOISE, 18);
  assert.equal(LIDAR_CLASS.WATER, 9);
  assert.equal(LIDAR_CLASS.BRIDGE_DECK, 17);
  assert.equal(LIDAR_CLASS.UNASSIGNED, 1);
  assert.equal(LIDAR_CLASS.NEVER_CLASSIFIED, 0);
  assert.equal(LIDAR_CLASS.LOW_VEGETATION, 3);
  assert.equal(LIDAR_CLASS.MEDIUM_VEGETATION, 4);
  assert.equal(LIDAR_CLASS.HIGH_VEGETATION, 5);
  assert.equal(LIDAR_CLASS.BUILDING, 6);
});

test("class definitions carry both ASPRS and LBS wording where they differ", () => {
  const one = lidarClassDefinition(1);
  assert.equal(one?.asprsLabel, "Unassigned");
  assert.equal(one?.lbsLabel, "Processed, but unclassified");
  const seven = lidarClassDefinition(7);
  assert.equal(seven?.asprsLabel, "Low Point");
  assert.equal(seven?.lbsLabel, "Low noise");
  const two = lidarClassDefinition(2);
  assert.equal(two?.asprsLabel, "Ground");
  assert.equal(two?.lbsLabel, "Bare earth");
});

test("unknown class codes return null, never a guessed definition", () => {
  assert.equal(lidarClassDefinition(8), null);
  assert.equal(lidarClassDefinition(99), null);
  assert.equal(lidarClassDefinition(-1), null);
});

test("class predicates: ground, vegetation, noise", () => {
  assert.equal(isGroundClass(2), true);
  assert.equal(isGroundClass(20), false);
  assert.equal(isVegetationClass(3), true);
  assert.equal(isVegetationClass(4), true);
  assert.equal(isVegetationClass(5), true);
  assert.equal(isVegetationClass(6), false);
  assert.equal(isNoiseClass(7), true);
  assert.equal(isNoiseClass(18), true);
  assert.equal(isNoiseClass(1), false);
});

// --- Quality levels (verified against USGS LBS Table 4 / QL page) ---

test("QL table: QL0 5 cm, QL1/QL2 10 cm, QL3 20 cm non-vegetated RMSEv", () => {
  assert.equal(rmseVNonVegetatedM("QL0"), 0.05);
  assert.equal(rmseVNonVegetatedM("QL1"), 0.1);
  assert.equal(rmseVNonVegetatedM("QL2"), 0.1);
  assert.equal(rmseVNonVegetatedM("QL3"), 0.2);
});

test("QL definitions carry pulse density, spacing, NVA and VVA", () => {
  const ql2 = qualityLevelDefinition("QL2");
  assert.equal(ql2?.minNominalPulseDensityPerSqM, 2);
  assert.equal(ql2?.maxNominalPulseSpacingM, 0.71);
  assert.equal(ql2?.demCellSizeM, 1.0);
  assert.equal(ql2?.nva95M, 0.196);
  assert.equal(ql2?.vvaM, 0.3);
  const ql0 = qualityLevelDefinition("QL0");
  assert.equal(ql0?.minNominalPulseDensityPerSqM, 8);
  assert.equal(ql0?.maxNominalPulseSpacingM, 0.35);
  assert.equal(ql0?.demCellSizeM, 0.5);
  const ql3 = qualityLevelDefinition("QL3");
  assert.equal(ql3?.minNominalPulseDensityPerSqM, 0.5);
  assert.equal(ql3?.maxNominalPulseSpacingM, 1.41);
  assert.equal(ql3?.demCellSizeM, 2.0);
});

test("unknown quality levels return null, never a guessed level", () => {
  assert.equal(qualityLevelDefinition("QL4"), null);
  assert.equal(qualityLevelDefinition("QL5"), null);
  assert.equal(qualityLevelDefinition("QL9"), null);
  assert.equal(rmseVNonVegetatedM("QL4"), null);
});

// --- Ignored ground near breaklines ---

const pts: LidarPoint[] = [
  { x: 0, y: 0, z: 100, classification: 2 },
  { x: 1, y: 0, z: 101, classification: 2 },
  { x: 2, y: 0, z: 102, classification: 6 },
  { x: 3, y: 0, z: 103, classification: 1 },
];

test("ground within the threshold becomes class 20; building and unclassified are untouched", () => {
  const out = markIgnoredGroundNearBreaklines(pts, 1.5, (p) => p.x);
  assert.equal(out[0].classification, 20);
  assert.equal(out[1].classification, 20);
  assert.equal(out[2].classification, 6);
  assert.equal(out[3].classification, 1);
});

test("boundary: a point exactly at the threshold is reclassed; beyond it is not", () => {
  const out = markIgnoredGroundNearBreaklines(pts, 1.0, (p) => p.x);
  assert.equal(out[0].classification, 20);
  assert.equal(out[1].classification, 20);
  const out2 = markIgnoredGroundNearBreaklines(pts, 0.5, (p) => p.x);
  assert.equal(out2[1].classification, 2);
});

test("inputs are not mutated by ignored-ground marking", () => {
  const before = pts.map((p) => p.classification);
  markIgnoredGroundNearBreaklines(pts, 5, () => 0);
  assert.deepEqual(pts.map((p) => p.classification), before);
});

test("invalid max distance throws instead of silently applying a bad threshold", () => {
  assert.throws(() => markIgnoredGroundNearBreaklines(pts, -1, () => 0), RangeError);
  assert.throws(() => markIgnoredGroundNearBreaklines(pts, Number.NaN, () => 0), RangeError);
});

// --- Vegetation banding by height above ground (corrected bands) ---

const vegPts: LidarPoint[] = [
  { x: 0, y: 0, z: 100.0, classification: 1 }, // HAG 0.0 — below low floor
  { x: 1, y: 0, z: 100.4, classification: 1 }, // HAG 0.4 — below low floor
  { x: 2, y: 0, z: 100.5, classification: 1 }, // HAG 0.5 — low
  { x: 3, y: 0, z: 101.5, classification: 1 }, // HAG 1.5 — low
  { x: 4, y: 0, z: 102.0, classification: 1 }, // HAG 2.0 — medium
  { x: 5, y: 0, z: 105.9, classification: 1 }, // HAG 5.9 — medium
  { x: 6, y: 0, z: 106.0, classification: 1 }, // HAG 6.0 — high
  { x: 7, y: 0, z: 120.0, classification: 1 }, // HAG 20.0 — high
  { x: 8, y: 0, z: 110.0, classification: 2 }, // ground — unchanged
  { x: 9, y: 0, z: 110.0, classification: 1 }, // no ground elevation — unchanged
];
const groundZ = (p: LidarPoint): number | null => (p.x === 9 ? null : 100);

test("default bands are the common metric convention: low 0.5–2, medium 2–6, high 6+ metres", () => {
  assert.deepEqual(DEFAULT_VEGETATION_BANDS, { lowMinM: 0.5, lowMaxM: 2.0, mediumMaxM: 6.0 });
});

test("HAG banding uses the corrected bands — 0.5–2 m is low, not medium; 2–6 m is medium, not high", () => {
  const out = classifyVegetationByHag(vegPts, groundZ);
  assert.equal(out[0].classification, 1); // HAG 0.0, below floor
  assert.equal(out[1].classification, 1); // HAG 0.4, below floor
  assert.equal(out[2].classification, 3); // HAG 0.5, low
  assert.equal(out[3].classification, 3); // HAG 1.5, low
  assert.equal(out[4].classification, 4); // HAG 2.0, medium
  assert.equal(out[5].classification, 4); // HAG 5.9, medium
  assert.equal(out[6].classification, 5); // HAG 6.0, high
  assert.equal(out[7].classification, 5); // HAG 20.0, high
  assert.equal(out[8].classification, 2); // ground untouched
  assert.equal(out[9].classification, 1); // no ground elevation, untouched
});

test("custom bands are honoured — the 2–5 m variant bands medium up to 5 m", () => {
  const out = classifyVegetationByHag(vegPts, groundZ, { lowMinM: 0.5, lowMaxM: 2.0, mediumMaxM: 5.0 });
  assert.equal(out[5].classification, 5); // HAG 5.9, high under the 5 m variant
  assert.equal(out[4].classification, 4); // HAG 2.0, medium under both
});

test("invalid bands throw instead of silently misbanding", () => {
  assert.throws(
    () => classifyVegetationByHag(vegPts, groundZ, { lowMinM: 2.0, lowMaxM: 0.5, mediumMaxM: 6.0 }),
    RangeError,
  );
  assert.throws(
    () => classifyVegetationByHag(vegPts, groundZ, { lowMinM: 0.5, lowMaxM: 2.0, mediumMaxM: 2.0 }),
    RangeError,
  );
});

test("inputs are not mutated by vegetation banding", () => {
  const before = vegPts.map((p) => p.classification);
  classifyVegetationByHag(vegPts, groundZ);
  assert.deepEqual(vegPts.map((p) => p.classification), before);
});

// --- Hydro treatment ---

test("LBS hydroflattening thresholds: ponds 0.8 ha, streams 30 m, islands 0.4 ha, buffer bound 2x ANPS", () => {
  assert.equal(MIN_FLATTENED_WATERBODY_AREA_HA, 0.8);
  assert.equal(MIN_FLATTENED_STREAM_WIDTH_M, 30);
  assert.equal(MIN_DELINEATED_ISLAND_AREA_HA, 0.4);
  assert.equal(MAX_IGNORED_GROUND_BUFFER_ANPS_MULTIPLE, 2);
});

const downhill: Breakline = {
  id: "r1",
  kind: "river",
  vertices: [
    { x: 0, y: 0, z: 110 },
    { x: 1, y: 0, z: 109 },
    { x: 2, y: 0, z: 109 },
  ],
};
const uphill: Breakline = {
  id: "r2",
  kind: "river",
  vertices: [
    { x: 0, y: 0, z: 110 },
    { x: 1, y: 0, z: 111 },
  ],
};
const lake: Breakline = {
  id: "l1",
  kind: "lake",
  vertices: [
    { x: 0, y: 0, z: 100 },
    { x: 1, y: 0, z: 100 },
  ],
};
const bridge: Breakline = { id: "b1", kind: "bridge", vertices: [{ x: 0, y: 0, z: 120 }] };
const culvert: Breakline = { id: "c1", kind: "culvert_cut", vertices: [{ x: 0, y: 0, z: 105 }] };

test("monotonic river validation passes downhill and flat, fails uphill", () => {
  assert.equal(validateMonotonicRiver(downhill).valid, true);
  const bad = validateMonotonicRiver(uphill);
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.some((e) => e.startsWith("RIVER_NOT_DOWNHILL:r2")));
  assert.equal(validateMonotonicRiver(lake).valid, true);
  assert.equal(validateMonotonicRiver(bridge).valid, true);
});

test("assertMonotonicRiver throws on an uphill river and passes a downhill one", () => {
  assert.doesNotThrow(() => assertMonotonicRiver(downhill));
  assert.throws(() => assertMonotonicRiver(uphill), /not downhill/);
});

test("flatten constraints keep lakes and rivers only, and reject an uphill river", () => {
  const out = buildHydroFlattenConstraints([lake, downhill, bridge, culvert]);
  assert.deepEqual(out.map((b) => b.id), ["l1", "r1"]);
  assert.throws(() => buildHydroFlattenConstraints([uphill]), /not downhill/);
});

test("enforce constraints keep culvert cuts, rivers and lakes — not bridges", () => {
  const out = buildHydroEnforceConstraints([lake, downhill, bridge, culvert]);
  assert.deepEqual(out.map((b) => b.id), ["l1", "r1", "c1"]);
});
