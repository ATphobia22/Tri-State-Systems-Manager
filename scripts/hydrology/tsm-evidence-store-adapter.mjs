/**
 * TSM Evidence Store Adapter for HEC coupled workflows.
 *
 * Bridges completed HEC-HMS/HEC-RAS runs into the TSM authoritative
 * evidence store (tsm-console/server/store/evidence-store.mjs).
 *
 * Transaction safety:
 *  - Each artifact append goes through the evidence store's serialized
 *    write queue with atomic temp-file + rename persistence.
 *  - Appends are idempotent: the store deduplicates on content_hash_sha256,
 *    so a retried commit cannot create duplicates.
 *  - The run receipt artifact is written LAST and references every
 *    artifact ID; a run is only "committed" once its receipt exists.
 *    A failed commit leaves orphaned (but harmless, deduplicated) blobs
 *    and no receipt — retrying the commit is safe.
 *
 * Resilient, never fail-closed: adapter failures are reported with the
 * run receipt path so the file-backed artifacts remain available.
 */

export const ADAPTER_VERSION = '1.0.0';

import path from 'node:path';
import { pathToFileURL } from 'node:url';

function resolveEvidenceStore() {
  // Resolved relative to the TSM repo root (two levels up from scripts/hydrology).
  const here = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.resolve(here, '..', '..');
  return path.join(repoRoot, 'tsm-console', 'server', 'store', 'evidence-store.mjs');
}

/**
 * Commit a completed HEC run's artifacts to the evidence store.
 *
 * @param {object} args
 * @param {object} args.run       The run record (run_id, artifacts[], finished_at, ...)
 * @param {object} args.manifest  The validated input manifest
 * @param {string} args.workspace Absolute workspace directory
 * @returns {Promise<{artifact_ids: string[], receipt_artifact_id: string}>}
 */
export async function commitRunArtifacts({ run, manifest, workspace }) {
  const storePath = resolveEvidenceStore();
  const store = await import(pathToFileURL(storePath).href);
  if (typeof store.appendArtifact !== 'function') {
    throw new Error('evidence store module does not export appendArtifact');
  }

  const ref = manifest.reference_system || {};
  const retrievedAt = run.finished_at || new Date().toISOString();
  const artifactIds = [];

  for (const art of run.artifacts || []) {
    const record = await store.appendArtifact({
      artifact_type: 'hec-coupled-run-artifact',
      source_authority: 'TSM HEC coupled workflow',
      source_uri: `hec-run://${run.run_id}/${art.label}`,
      source_identifier: run.run_id,
      retrieved_at: retrievedAt,
      horizontal_crs: ref.horizontal_crs || 'EPSG:4326',
      vertical_datum: ref.vertical_datum || 'NAVD88',
      content_hash_sha256: art.sha256,
      authority_class: 'DERIVED',
      derivation_class: 'MODEL',
      model_version: manifest.schema_version || null,
      software_version: [
        manifest.hec_hms?.version,
        manifest.hec_ras?.version,
      ].filter(Boolean).join(' + ') || null,
      governance_status: 'pending',
      human_review_status: 'pending',
      is_simulation_demo: false,
      notes: `HEC-HMS/HEC-RAS coupled run ${run.run_id} (${run.purpose || 'no purpose stated'}). ` +
             `Human review required before engineering or regulatory use. ` +
             `Blob: ${art.storage_uri} (${art.size_bytes} bytes).`,
      payload: {
        run_id: run.run_id,
        label: art.label,
        storage_uri: art.storage_uri,
        size_bytes: art.size_bytes,
      },
    });
    artifactIds.push(record.artifact_id);
  }

  // Run receipt LAST: its presence marks the commit as complete.
  const receipt = await store.appendArtifact({
    artifact_type: 'hec-coupled-run-receipt',
    source_authority: 'TSM HEC coupled workflow',
    source_uri: `hec-run://${run.run_id}/receipt`,
    source_identifier: run.run_id,
    retrieved_at: retrievedAt,
    horizontal_crs: ref.horizontal_crs || 'EPSG:4326',
    vertical_datum: ref.vertical_datum || 'NAVD88',
    content_hash_sha256: run.receipt_sha256 || '0'.repeat(64),
    authority_class: 'DERIVED',
    derivation_class: 'MODEL',
    governance_status: 'pending',
    human_review_status: 'pending',
    is_simulation_demo: false,
    notes: `Run receipt for HEC coupled run ${run.run_id}: ` +
           `${artifactIds.length} artifacts committed. Status at commit: ${run.status}. ` +
           `Human review required before engineering or regulatory use.`,
    payload: {
      run_id: run.run_id,
      status: run.status,
      artifact_ids: artifactIds,
      artifact_count: artifactIds.length,
    },
  });

  return { artifact_ids: artifactIds, receipt_artifact_id: receipt.artifact_id };
}
