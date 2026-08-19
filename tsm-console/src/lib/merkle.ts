/**
 * Server-side Merkle tree helpers for Evidence Ledger
 * Phase 1: in-memory store + SHA-256 leaves. Replace with persistent store.
 *
 * Security: domain separation (leaf vs node prefixes) to mitigate second-preimage.
 * Root is never trusted from the client.
 */

export interface MerkleLeaf {
  id: string;
  hash: string;
  payload: unknown;
  createdAt: string;
}

export interface MerkleState {
  leaves: MerkleLeaf[];
  root: string | null;
}

const LEAF_PREFIX = 'TSM_LEAF:';
const NODE_PREFIX = 'TSM_NODE:';

async function sha256(message: string): Promise<string> {
  const buf = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** In-memory ledger for Phase 1 demo. Production: database + optional public anchor. */
let state: MerkleState = { leaves: [], root: null };

export function getMerkleState(): MerkleState {
  return { leaves: [...state.leaves], root: state.root };
}

export async function appendEvidence(payload: {
  source_org: string;
  source_uri: string;
  tier: number;
}): Promise<{ evidence_id: string; sha256_hash: string; merkleRoot: string }> {
  const evidence_id = `EV-${Date.now()}`;
  const canonical = JSON.stringify({ ...payload, evidence_id, ts: Date.now() });
  const leafHash = await sha256(LEAF_PREFIX + canonical);

  const leaf: MerkleLeaf = {
    id: evidence_id,
    hash: leafHash,
    payload: { ...payload, evidence_id, sha256_hash: leafHash, validation_status: 'pending' },
    createdAt: new Date().toISOString(),
  };

  state.leaves = [leaf, ...state.leaves];
  state.root = await computeRoot(state.leaves.map((l) => l.hash));

  return {
    evidence_id,
    sha256_hash: leafHash,
    merkleRoot: state.root!,
  };
}

async function computeRoot(hashes: string[]): Promise<string> {
  if (hashes.length === 0) return await sha256(NODE_PREFIX + 'EMPTY');
  let level = [...hashes];
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left; // balance by duplicating last
      next.push(await sha256(NODE_PREFIX + left + right));
    }
    level = next;
  }
  return level[0];
}
