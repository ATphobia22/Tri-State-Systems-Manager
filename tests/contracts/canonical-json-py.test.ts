import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { canonicalJsonPy, hashCanonicalPayload } from "../../packages/evidence/src/canonicalJsonPy.ts";
import { stableJson, hashEvidencePayload } from "../../packages/evidence/src/index.ts";

// Vectors from backend/tests/test_engineering_trust.py (Python side) —
// expected strings/hashes below were produced by running
// backend.evidence.canonical_hash in python3, not hand-written.
test("canonicalJsonPy reproduces the Python nested-key-sort vector", () => {
  assert.equal(canonicalJsonPy({ b: { d: 1, c: 2 }, a: 1 }), '{"a":1,"b":{"c":2,"d":1}}');
  assert.equal(canonicalJsonPy([{ z: 1, a: 2 }]), '[{"a":2,"z":1}]');
  assert.equal(hashCanonicalPayload({ b: { d: 1, c: 2 }, a: 1 }), "0372c09046efb505e3dea21aff53286f19f693aebe8caea1e66781674cce3c8e");
});

test("canonicalJsonPy reproduces Python float formatting", () => {
  // Each expected string is python3 repr/canonical_json output for the
  // same double (verified 2026-11-07 against backend.evidence.canonical_hash).
  const cases: [number, string][] = [
    [1.5, "1.5"],
    [-0.0, "-0.0"],
    [1e21, "1e+21"],
    [1e16, "1e+16"],
    [1e-5, "1e-05"],
    [1e-7, "1e-07"],
    [123456.789, "123456.789"],
    [0.1, "0.1"],
    [0.30000000000000004, "0.30000000000000004"],
    [3.141592653589793, "3.141592653589793"],
    [2.5e-10, "2.5e-10"],
    [1.7976931348623157e308, "1.7976931348623157e+308"],
    [5e-324, "5e-324"],
    [1e100, "1e+100"],
    [0.0001, "0.0001"],
    [-1.5, "-1.5"],
  ];
  for (const [value, expected] of cases) {
    assert.equal(canonicalJsonPy(value), expected, `canonicalJsonPy(${value})`);
  }
});

test("hashCanonicalPayload matches Python hashes for float payloads", () => {
  assert.equal(hashCanonicalPayload(-0.0), "c26617c7ccbcaa6631b45d851b8cf56e21d2ca624bdb1193afdbd4b560702cec");
  assert.equal(hashCanonicalPayload(1.5), "9f29a130438b81170b92a42650f9a94291ecad60bd47af2a3886e75f7f728725");
  assert.equal(
    canonicalJsonPy({ b: { d: 2.5, c: 2.5 }, a: 1e21 }),
    '{"a":1e+21,"b":{"c":2.5,"d":2.5}}',
  );
  assert.equal(
    hashCanonicalPayload({ b: { d: 2.5, c: 2.5 }, a: 1e21 }),
    "5817f9fefcaf0fccfa6dd296f0415db4076b65a6cc3a6a7b0d7d0a2ad9ee089a",
  );
  assert.equal(canonicalJsonPy([1.5, -0.0, 1e21, "x", true, null]), '[1.5,-0.0,1e+21,"x",true,null]');
  assert.equal(hashCanonicalPayload([1.5, -0.0, 1e21]), "cbdeb2794e41ec9b9d866c1cf73cdbacae5e0a7fa938ff3b86681da08f1b9f94");
});

test("canonicalJsonPy matches Python string, bool, and null encoding", () => {
  assert.equal(canonicalJsonPy({ a: "café → λ" }), '{"a":"café → λ"}');
  assert.equal(canonicalJsonPy({ a: 'tab\tnl\nquote"back\\slash' }), '{"a":"tab\\tnl\\nquote\\"back\\\\slash"}');
  assert.equal(canonicalJsonPy({ t: true, f: false, n: null }), '{"f":false,"n":null,"t":true}');
});

test("canonicalJsonPy diverges from stableJson exactly where Python diverges from JSON.stringify", () => {
  assert.equal(stableJson(-0), "0");
  assert.equal(canonicalJsonPy(-0), "-0.0");
  assert.equal(stableJson(1e21), "1e+21");
  assert.equal(canonicalJsonPy(1e21), "1e+21");
});

test("existing stableJson/hashEvidencePayload behaviour is unchanged", () => {
  const payload = { b: { d: 1, c: 2 }, a: 1 };
  assert.equal(stableJson(payload), '{"a":1,"b":{"c":2,"d":1}}');
  assert.equal(
    hashEvidencePayload(payload),
    createHash("sha256").update('{"a":1,"b":{"c":2,"d":1}}').digest("hex"),
  );
});

test("canonicalJsonPy throws TypeError for values Python cannot encode", () => {
  assert.throws(() => canonicalJsonPy(undefined), TypeError);
  assert.throws(() => canonicalJsonPy(() => 1), TypeError);
  assert.throws(() => canonicalJsonPy({ a: undefined }), TypeError);
});
