/**
 * Persistent Merkle store for Evidence Ledger
 *
 * CLIENT-SIDE LEDGER IS NOT AUTHORITATIVE.
 * Production authoritative state lives on the Evidence & Data Governance Plane
 * (server API / PostgreSQL). Browser store is a local cache + demo only.
 * Math.random is forbidden for evidence IDs; use crypto.randomUUID.
 *
 * Phase 1 (browser): IndexedDB via idb-keyval-style thin wrapper (localStorage fallback).
 * Production: replace storage backend with server API (POST /api/ledger/append).
 *
 * Security:
 * - Domain separation LEAF_PREFIX / NODE_PREFIX (second-preimage resistance)
 * - Root never accepted from client
 * - Append is append-only; no delete/edit of sealed leaves
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
  version: number;
}

const LEAF_PREFIX = 'TSM_LEAF:';
const NODE_PREFIX = 'TSM_NODE:';
const STORAGE_KEY = 'tsm_merkle_ledger_v1';

async function sha256(message: string): Promise<string> {
  const buf = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Persistence layer
// ---------------------------------------------------------------------------

function loadState(): MerkleState {
  if (typeof window === 'undefined') {
    return { leaves: [], root: null, version: 1 };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { leaves: [], root: null, version: 1 };
    const parsed = JSON.parse(raw) as MerkleState;
    if (!Array.isArray(parsed.leaves)) return { leaves: [], root: null, version: 1 };
    return { leaves: parsed.leaves, root: parsed.root ?? null, version: parsed.version ?? 1 };
  } catch {
    return { leaves: [], root: null, version: 1 };
  }
}

function saveState(state: MerkleState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Merkle persist failed (quota?)', e);
  }
}

let state: MerkleState = loadState();

export function getMerkleState(): MerkleState {
  // Rehydrate on each read in case another tab updated
  state = loadState();
  return { leaves: [...state.leaves], root: state.root, version: state.version };
}

export async function appendEvidence(payload: {
  source_org: string;
  source_uri: string;
  tier: number;
}): Promise<{ evidence_id: string; sha256_hash: string; merkleRoot: string }> {
  state = loadState();

  const evidence_id = `EV-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const canonical = JSON.stringify({
    ...payload,
    evidence_id,
    ts: Date.now(),
  });
  const leafHash = await sha256(LEAF_PREFIX + canonical);

  const leaf: MerkleLeaf = {
    id: evidence_id,
    hash: leafHash,
    payload: {
      ...payload,
      evidence_id,
      sha256_hash: leafHash,
      validation_status: 'pending',
      state: 'OBSERVED',
    },
    createdAt: new Date().toISOString(),
  };

  // Append-only: newest first for UI, but root computed over ordered history
  const orderedForRoot = [...state.leaves].reverse().concat(leaf); // oldest → newest
  const root = await computeRoot(orderedForRoot.map((l) => l.hash));

  state = {
    leaves: [leaf, ...state.leaves],
    root,
    version: state.version + 1,
  };
  saveState(state);

  // Production hook: also POST to server for authoritative root
  // await fetch('/api/ledger/append', { method: 'POST', body: JSON.stringify({ leaf, root }) });

  return {
    evidence_id,
    sha256_hash: leafHash,
    merkleRoot: root,
  };
}

async function computeRoot(hashes: string[]): Promise<string> {
  if (hashes.length === 0) return await sha256(NODE_PREFIX + 'EMPTY');
  let level = [...hashes];
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      next.push(await sha256(NODE_PREFIX + left + right));
    }
    level = next;
  }
  return level[0];
}

/**
 * Export full ledger for audit / Daubert package (human download).
 */
export function exportLedgerJson(): string {
  const s = getMerkleState();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      version: s.version,
      merkleRoot: s.root,
      leafCount: s.leaves.length,
      leaves: s.leaves,
    },
    null,
    2
  );
}

/**
 * Clear ledger (DEV / test only). Forbidden in production builds.
 */
export function clearLedgerForTests(): void {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD) {
    throw new Error('clearLedgerForTests is disabled in production');
  }
  state = { leaves: [], root: null, version: 1 };
  saveState(state);
}
