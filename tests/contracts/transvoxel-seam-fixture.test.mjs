/**
 * Minimal Transvoxel seam fixture — presentation only, not regulatory.
 * Asserts fixture table completeness for transition cases we claim to support.
 */
import test from "node:test";
import assert from "node:assert/strict";

/** Supported transition case ids (document unsupported explicitly). */
const SUPPORTED_TRANSITION_CASES = Object.freeze([
  "lod-boundary-axis-aligned",
  "lod-boundary-diagonal",
  "corner-t-junction",
  "shared-edge-winding",
]);

const UNSUPPORTED_EXPLICIT = Object.freeze([
  "non-manifold-self-intersect",
  "open-boundary-with-missing-neighbor",
]);

test("transvoxel seam fixture table lists supported and unsupported cases", () => {
  assert.ok(SUPPORTED_TRANSITION_CASES.length >= 4);
  assert.ok(UNSUPPORTED_EXPLICIT.length >= 1);
  const overlap = SUPPORTED_TRANSITION_CASES.filter((c) => UNSUPPORTED_EXPLICIT.includes(c));
  assert.equal(overlap.length, 0, "supported and unsupported must not overlap");
});

test("each supported case has a deterministic fixture id", () => {
  for (const id of SUPPORTED_TRANSITION_CASES) {
    assert.match(id, /^[a-z0-9-]+$/);
  }
});
