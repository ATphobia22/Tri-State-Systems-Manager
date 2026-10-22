import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const evidenceDir = await mkdtemp(path.join(os.tmpdir(), 'tsm-governance-publication-'));
process.env.TSM_EVIDENCE_DIR = evidenceDir;

const { publishAuthorizedArtifact } = await import('../server/ingestion/governance-transition.mjs');
const { appendMerkleLeaf, getArtifact } = await import('../server/store/evidence-store.mjs');

test('provisional evidence is recorded honestly and excluded from the authoritative Merkle ledger', async () => {
  try {
    const publication = await publishAuthorizedArtifact({
      artifact_id: 'RAW-TEST-PROVISIONAL',
      artifact_type: 'test-observation',
      source_authority: 'test-fixture',
      source_uri: 'https://example.invalid/test-observation',
      retrieved_at: new Date().toISOString(),
      horizontal_crs: 'EPSG:2966',
      vertical_datum: 'NAVD88',
      content_hash_sha256: 'not-a-valid-sha256',
      authority_class: 'OBSERVATION',
      derivation_class: 'RAW',
      governance_status: 'human_review_required',
      human_review_status: 'pending',
      parent_artifacts: [],
      transformation_chain: [],
    });

    assert.equal(publication.status, 'PROVISIONAL_RECORDED');
    assert.equal(publication.provisional, true);
    assert.equal(publication.merkle_sequence, null);
    assert.equal(publication.merkle_leaf_hash, null);
    assert.equal(publication.merkle_root, null);
    assert.ok(publication.warnings.length > 0);

    const stored = await getArtifact(publication.artifact_id);
    assert.ok(stored);
    assert.equal(stored.governance_status, 'provisionally_authorized');
    assert.equal(stored.human_review_status, 'provisional');
    assert.equal(stored._provisional, true);
    await assert.rejects(() => appendMerkleLeaf(stored), { code: 'RESILIENT' });
  } finally {
    await rm(evidenceDir, { recursive: true, force: true });
  }
});
