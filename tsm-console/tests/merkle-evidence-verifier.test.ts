import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  encodeMerkleArtifact,
  verifyMerkleArtifactBytes,
  verifyMerkleInclusion,
  type MerkleArtifact,
  type MerkleProof,
} from "../src/lib/merkle-evidence-verifier";

const hash = (...parts: Uint8Array[]): Uint8Array =>
  new Uint8Array(createHash("sha256").update(Buffer.concat(parts.map(x => Buffer.from(x)))).digest());
const utf8 = (s: string) => new TextEncoder().encode(s);
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const leaf = (item: MerkleArtifact): Uint8Array =>
  hash(Uint8Array.from([0]), utf8(JSON.stringify({
    byteLength: item.byteLength,
    path: item.path,
    role: item.role,
    sha256: item.sha256,
  })));
const node = (a: Uint8Array, b: Uint8Array): Uint8Array =>
  hash(Uint8Array.from([1]), a, b);

const items: MerkleArtifact[] = ["gov/source.bin", "survey/control.bin", "model/output.bin"]
  .map((path, i) => ({
    role: i === 0 ? "source" : i === 1 ? "survey" : "solver",
    path,
    sha256: hex(hash(utf8("fixture-" + i))),
    byteLength: ("fixture-" + i).length,
  }));

function inclusion(): MerkleProof {
  const l0 = leaf(items[0]);
  const l1 = leaf(items[1]);
  const l2 = leaf(items[2]);
  return {
    schemaVersion: "tsm.merkle-evidence.v1",
    algorithm: "RFC9162-SHA256",
    leafIndex: 1, treeSize: 3, item: items[1],
    rootSha256: hex(node(node(l0, l1), l2)),
    inclusionPath: [
      { side: "left", sha256: hex(l0) },
      { side: "right", sha256: hex(l2) },
    ],
  };
}

describe("Python-compatible RFC9162 Merkle evidence profile", () => {
  it("verifies a non-power-of-two tree inclusion", async () => {
    const proof = inclusion();
    expect(await verifyMerkleInclusion(proof)).toBe(true);
    expect(new TextDecoder().decode(encodeMerkleArtifact(items[0]))).toContain('"byteLength"');
  });

  it("rejects a forged root or changed evidence leaf", async () => {
    const valid = inclusion();
    expect(await verifyMerkleInclusion({ ...valid, rootSha256: "0".repeat(64) })).toBe(false);
    expect(await verifyMerkleInclusion({
      ...valid, item: { ...valid.item, byteLength: 100 },
    })).toBe(false);
    expect(await verifyMerkleInclusion({
      ...valid, inclusionPath: [
        { side: "right", sha256: valid.inclusionPath[0].sha256 },
        valid.inclusionPath[1],
      ],
    })).toBe(false);
    expect(await verifyMerkleInclusion({
      ...valid, inclusionPath: [],
    })).toBe(false);
  });

  it("checks real source byte digest and byte count", async () => {
    const record = items[0];
    expect(await verifyMerkleArtifactBytes(utf8("fixture-0"), record)).toBe(true);
    expect(await verifyMerkleArtifactBytes(utf8("fixture-X"), record)).toBe(false);
    expect(await verifyMerkleArtifactBytes(utf8("fixture-0a"), record)).toBe(false);
  });

  it("rejects path traversal payloads", async () => {
    const proof = inclusion();
    expect(await verifyMerkleInclusion({
      ...proof, item: { ...proof.item, path: "../source" },
    })).toBe(false);
  });
});
