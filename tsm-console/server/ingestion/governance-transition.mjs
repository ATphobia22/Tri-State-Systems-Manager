/**
 * Server-side Evidence Governance Transition.
 * SHA-256 is an integrity seal, not a digital signature.
 * Raw telemetry remains immutable and human_review_required.
 */
import { createHash, randomUUID } from 'node:crypto';
import { appendArtifact, getArtifact, recordVerification, appendMerkleLeaf } from '../store/evidence-store.mjs';

const HASH_RE = /^[a-f0-9]{64}$/;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function fail(message, code = 'FAIL_CLOSED') {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function validateReviewPayload(reviewPayload, rawHash) {
  if (!reviewPayload || typeof reviewPayload !== 'object') fail('FAIL_CLOSED: review payload is required.');

  const reviewer_identity = typeof reviewPayload.reviewer_identity === 'string'
    ? reviewPayload.reviewer_identity.trim() : '';
  const review_reason = typeof reviewPayload.review_reason === 'string'
    ? reviewPayload.review_reason.trim() : '';
  const reviewed_at = typeof reviewPayload.reviewed_at === 'string'
    ? reviewPayload.reviewed_at : '';
  const reviewed_artifact_hash = typeof reviewPayload.reviewed_artifact_hash === 'string'
    ? reviewPayload.reviewed_artifact_hash.toLowerCase() : '';

  if (!reviewer_identity || !review_reason || !reviewed_at) {
    fail('FAIL_CLOSED: reviewer identity, justification, and reviewed_at are required.');
  }
  if (!HASH_RE.test(reviewed_artifact_hash) || reviewed_artifact_hash !== rawHash) {
    fail('FAIL_CLOSED: reviewed_artifact_hash must exactly match the raw artifact hash.');
  }

  const reviewedMs = Date.parse(reviewed_at);
  if (!Number.isFinite(reviewedMs)) fail('FAIL_CLOSED: reviewed_at must be a valid ISO-8601 timestamp.');
  if (reviewedMs > Date.now() + MAX_CLOCK_SKEW_MS) {
    fail('FAIL_CLOSED: reviewed_at cannot be materially in the future.');
  }

  return {
    reviewer_identity,
    review_reason,
    reviewed_at: new Date(reviewedMs).toISOString(),
    reviewed_artifact_hash,
  };
}

export function authorizeEvidenceArtifact(rawArtifact, reviewPayload) {
  if (!rawArtifact || typeof rawArtifact !== 'object') fail('FAIL_CLOSED: raw evidence artifact is required.');
  if (rawArtifact.governance_status !== 'human_review_required') {
    fail(`FAIL_CLOSED: cannot authorize artifact in state: ${rawArtifact.governance_status}`);
  }
  if (!rawArtifact.artifact_id || !HASH_RE.test(rawArtifact.content_hash_sha256 || '')) {
    fail('FAIL_CLOSED: raw artifact identity and SHA-256 hash are required.');
  }
  if (rawArtifact.is_simulation_demo === true) {
    fail('FAIL_CLOSED: simulation/demo artifacts cannot cross the authoritative publication boundary.');
  }

  const human_authorization = validateReviewPayload(reviewPayload, rawArtifact.content_hash_sha256);
  const priorChain = Array.isArray(rawArtifact.transformation_chain)
    ? rawArtifact.transformation_chain : [];

  const authorizedArtifact = {
    ...rawArtifact,
    artifact_id: `AUTH-${randomUUID()}`,
    content_hash_sha256: null,
    governance_status: 'human_authorized',
    human_review_status: 'signed',
    human_authorization,
    parent_artifacts: [rawArtifact.artifact_id],
    transformation_chain: [
      ...priorChain,
      {
        step: priorChain.length + 1,
        operation: 'human_authorization_gate',
        from: 'human_review_required',
        to: 'human_authorized',
        software: 'tsm-governance-transition@1.0.0',
        parameters: { reviewed_artifact_hash: rawArtifact.content_hash_sha256 },
      },
    ],
    validation_status: 'validated',
    created_at: new Date().toISOString(),
  };

  const { content_hash_sha256: _unusedHash, ...unsignedArtifact } = authorizedArtifact;
  const seal = stableStringify(unsignedArtifact);
  authorizedArtifact.content_hash_sha256 = createHash('sha256')
    .update(`TSM_AUTHORIZED_ARTIFACT:${seal}`, 'utf8')
    .digest('hex');

  return authorizedArtifact;
}

export function validateAuthorizedArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') fail('FAIL_CLOSED: authorized artifact is required.');
  if (artifact.governance_status !== 'human_authorized') fail('FAIL_CLOSED: artifact is not human_authorized.');
  if (artifact.human_review_status !== 'signed') fail('FAIL_CLOSED: artifact does not carry a signed human review state.');
  if (!artifact.human_authorization || typeof artifact.human_authorization !== 'object') {
    fail('FAIL_CLOSED: sealed human authorization metadata is missing.');
  }
  if (!HASH_RE.test(artifact.human_authorization.reviewed_artifact_hash || '')) {
    fail('FAIL_CLOSED: reviewed artifact hash is invalid.');
  }
  if (!Array.isArray(artifact.parent_artifacts) || artifact.parent_artifacts.length !== 1) {
    fail('FAIL_CLOSED: authorized artifact must reference exactly one raw parent.');
  }
  if (!HASH_RE.test(artifact.content_hash_sha256 || '')) fail('FAIL_CLOSED: authorized artifact hash is invalid.');
  return true;
}

export async function publishAuthorizedArtifact(authorizedArtifact) {
  validateAuthorizedArtifact(authorizedArtifact);

  const { content_hash_sha256: _unusedHash, ...unsignedArtifact } = authorizedArtifact;
  const canonical = `TSM_AUTHORIZED_ARTIFACT:${stableStringify(unsignedArtifact)}`;
  const stored = appendArtifact({
    ...authorizedArtifact,
    _governance_transition: true,
    _canonical_for_verify: canonical,
  });

  recordVerification(
    stored.artifact_id,
    stored.content_hash_sha256,
    stored.content_hash_sha256,
    'governance-transition',
  );
  const merkle = appendMerkleLeaf(stored);

  return {
    publication_id: stored.artifact_id,
    artifact_id: stored.artifact_id,
    content_hash_sha256: stored.content_hash_sha256,
    published_at: new Date().toISOString(),
    status: 'MERKLE_APPEND_COMPLETE',
    merkle_sequence: merkle.sequence,
    merkle_leaf_hash: merkle.leaf_hash,
    merkle_root: merkle.root_hash,
  };
}

export async function authorizeAndPublishArtifact(artifactId, reviewPayload) {
  const rawArtifact = getArtifact(artifactId);
  if (!rawArtifact) fail(`FAIL_CLOSED: raw artifact not found: ${artifactId}`, 'NOT_FOUND');
  const authorized = authorizeEvidenceArtifact(rawArtifact, reviewPayload);
  return publishAuthorizedArtifact(authorized);
}
