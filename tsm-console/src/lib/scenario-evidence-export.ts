/**
 * Merkle-stamped Scenario Studio export (SCENARIO / SIMULATION_DEMO).
 * Client ledger is local cache — not server-authoritative.
 * Does not claim OBSERVED or REGULATORY.
 */

import { getMerkleState, exportLedgerJson } from './merkle';
import type { ScenarioStudioResult } from './scenario-studio';

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

export type ScenarioEvidenceExport = {
  evidence_id: string;
  sha256_hash: string;
  merkleRoot: string;
  authorityClass: 'SCENARIO';
  label: 'SIMULATION_DEMO';
  package: Record<string, unknown>;
};

/**
 * Append a SCENARIO leaf and return a downloadable evidence package.
 * Optional reviewer fields stamp intent without elevating to REGULATORY.
 */
export async function exportScenarioStudioEvidence(
  result: ScenarioStudioResult,
  opts?: { reviewer_identity?: string; review_reason?: string },
): Promise<ScenarioEvidenceExport> {
  const evidence_id = `SCN-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const body = {
    kind: 'scenario_studio_cascade',
    authorityClass: 'SCENARIO' as const,
    label: 'SIMULATION_DEMO' as const,
    evidence_id,
    result,
    reviewer_identity: opts?.reviewer_identity?.trim() || null,
    review_reason: opts?.review_reason?.trim() || null,
    stamped_at: new Date().toISOString(),
    disclaimer:
      'SCENARIO / SIMULATION_DEMO Merkle stamp only. Not OBSERVED, not REGULATORY, not a warning. Client ledger is non-authoritative.',
  };
  const canonical = JSON.stringify(body);
  const leafHash = await sha256(LEAF_PREFIX + canonical);

  let leaves: Array<{ id: string; hash: string; payload: unknown; createdAt: string }> = [];
  let version = 1;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { leaves?: typeof leaves; version?: number };
      if (Array.isArray(parsed.leaves)) leaves = parsed.leaves;
      version = parsed.version ?? 1;
    }
  } catch {
    /* empty */
  }

  const leaf = {
    id: evidence_id,
    hash: leafHash,
    payload: {
      ...body,
      sha256_hash: leafHash,
      validation_status: 'pending',
      state: 'MODELED',
      governance_status: 'scenario_export',
    },
    createdAt: new Date().toISOString(),
  };
  const orderedForRoot = [...leaves].reverse().concat(leaf);
  const merkleRoot = await computeRoot(orderedForRoot.map((l) => l.hash));
  const next = {
    leaves: [leaf, ...leaves],
    root: merkleRoot,
    version: version + 1,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('Scenario evidence persist failed', e);
  }

  const pkg = {
    exportedAt: new Date().toISOString(),
    authorityClass: 'SCENARIO',
    label: 'SIMULATION_DEMO',
    evidence_id,
    sha256_hash: leafHash,
    merkleRoot,
    scenario: result,
    ledgerSnapshot: {
      version: next.version,
      leafCount: next.leaves.length,
      merkleRoot,
    },
    disclaimer: body.disclaimer,
  };

  return {
    evidence_id,
    sha256_hash: leafHash,
    merkleRoot,
    authorityClass: 'SCENARIO',
    label: 'SIMULATION_DEMO',
    package: pkg,
  };
}

export function downloadEvidencePackage(pkg: Record<string, unknown>, filename: string): void {
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadFullLedger(): void {
  downloadEvidencePackage(JSON.parse(exportLedgerJson()) as Record<string, unknown>, `tsm-ledger-${Date.now()}.json`);
  void getMerkleState();
}
