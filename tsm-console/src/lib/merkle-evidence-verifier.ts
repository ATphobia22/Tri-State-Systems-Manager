/** Read-only RFC 9162-style Merkle evidence verification for the public twin.
 *
 * Input payloads match backend/merkle_evidence.py's compact sorted-key JSON
 * *leaf profile* (not a fully interoperable RFC 8785 number canonicalizer).
 * This verifies inclusion against a supplied root, not root authenticity,
 * agency approval, professional seals or the original data's correctness.
 */

export type MerkleArtifact = Readonly<{
  role: string;
  path: string;
  sha256: string;
  byteLength: number;
}>;

export type MerkleProof = Readonly<{
  schemaVersion: "tsm.merkle-evidence.v1";
  algorithm: "RFC9162-SHA256";
  leafIndex: number;
  treeSize: number;
  item: MerkleArtifact;
  rootSha256: string;
  inclusionPath: ReadonlyArray<Readonly<{ side: "left" | "right"; sha256: string }>>;
}>;

const SHA256_HEX = /^[0-9a-f]{64}$/;
const textEncoder = new TextEncoder();

function hexToBytes(value: string): Uint8Array {
  if (!SHA256_HEX.test(value)) throw new Error("MERKLE_DIGEST_INVALID");
  return Uint8Array.from(value.match(/../g)!.map(chunk => Number.parseInt(chunk, 16)));
}

function toHex(value: Uint8Array): string {
  return Array.from(value, byte => byte.toString(16).padStart(2, "0")).join("");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((acc, item) => acc + item.byteLength, 0);
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.byteLength;
  }
  return combined;
}

async function digest(bytes: Uint8Array): Promise<Uint8Array> {
  // Use an owned ArrayBuffer; works on current TypeScript/WebCrypto types.
  const owned = new Uint8Array(bytes.byteLength);
  owned.set(bytes);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", owned.buffer));
}

function validLeaf(item: MerkleArtifact): boolean {
  return typeof item.role === "string"
    && /^[a-z][a-z0-9_-]{0,63}$/.test(item.role)
    && typeof item.path === "string"
    && item.path.length > 0
    && !item.path.startsWith("/")
    && !item.path.includes("\\")
    && item.path.split("/").every(part => part.length > 0 && part !== "." && part !== "..")
    && SHA256_HEX.test(item.sha256)
    && Number.isSafeInteger(item.byteLength)
    && item.byteLength >= 0;
}

/** Canonical order matches Python json.dumps(sort_keys=True,separators=(',',':')). */
export function encodeMerkleArtifact(item: MerkleArtifact): Uint8Array {
  if (!validLeaf(item)) throw new Error("MERKLE_LEAF_INVALID");
  return textEncoder.encode(JSON.stringify({
    byteLength: item.byteLength,
    path: item.path,
    role: item.role,
    sha256: item.sha256,
  }));
}

function expectedSides(index: number, size: number): Array<"left" | "right"> {
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(size) || size < 1 ||
      size > 10_000_000 || index < 0 || index >= size) {
    throw new Error("MERKLE_TREE_INDEX_INVALID");
  }
  if (size === 1) return [];
  const pivot = 2 ** Math.floor(Math.log2(size - 1));
  return index < pivot
    ? [...expectedSides(index, pivot), "right"]
    : [...expectedSides(index - pivot, size - pivot), "left"];
}

export async function verifyMerkleInclusion(proof: MerkleProof): Promise<boolean> {
  try {
    if (proof.schemaVersion !== "tsm.merkle-evidence.v1" ||
        proof.algorithm !== "RFC9162-SHA256" ||
        !SHA256_HEX.test(proof.rootSha256)) return false;
    const expected = expectedSides(proof.leafIndex, proof.treeSize);
    if (!Array.isArray(proof.inclusionPath) || proof.inclusionPath.length !== expected.length) return false;
    let current = await digest(concat(new Uint8Array([0]), encodeMerkleArtifact(proof.item)));
    for (const [i, element] of proof.inclusionPath.entries()) {
      if (element.side !== expected[i] || !SHA256_HEX.test(element.sha256)) return false;
      const sibling = hexToBytes(element.sha256);
      current = element.side === "left"
        ? await digest(concat(new Uint8Array([1]), sibling, current))
        : await digest(concat(new Uint8Array([1]), current, sibling));
    }
    return toHex(current) === proof.rootSha256;
  } catch {
    return false;
  }
}

/** Check original bytes against a Merkle leaf's raw-file SHA and length. */
export async function verifyMerkleArtifactBytes(
  bytes: Uint8Array,
  item: MerkleArtifact,
): Promise<boolean> {
  if (!validLeaf(item) || bytes.byteLength !== item.byteLength) return false;
  return toHex(await digest(bytes)) === item.sha256;
}
