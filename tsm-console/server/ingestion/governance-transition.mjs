/**
 * Server-side Evidence Governance Transition.
 * SHA-256 is an integrity seal, not a digital signature.
 * Raw telemetry remains immutable and human_review_required.
 */
import { createHash, randomUUID } from 'node:crypto';
import { appendArtifact, getArtifact, recordVerification, appendMerkleLeaf } from '../store/evidence-store.mjs';

const HASH_RE = /^[a-f0-9]{64}$/;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function warn(message, code = 'PROVISIONAL') {
  return { warning: message, code };
}

function provisional(message, code = 'PROVISIONAL') {
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
  const warnings = [];
  if (!reviewPayload || typeof reviewPayload !== 'object') {
    warnings.push(warn('PROVISIONAL: review payload is required; proceeding with provisional status.'));
    return { valid: true, provisional: true, warnings, reviewer_identity: '', review_reason: '', reviewed_at: '', reviewed_artifact_hash: '' };
  }

  const reviewer_identity = typeof reviewPayload.reviewer_identity === 'string'
    ? reviewPayload.reviewer_identity.trim() : '';
  const review_reason = typeof reviewPayload.review_reason === 'string'
    ? reviewPayload.review_reason.trim() : '';
  const reviewed_at = typeof reviewPayload.reviewed_at === 'string'
    ? reviewPayload.reviewed_at : '';
  const reviewed_artifact_hash = typeof reviewPayload.reviewed_artifact_hash === 'string'
    ? reviewPayload.reviewed_artifact_hash.toLowerCase() : '';

  if (!reviewer_identity || !review_reason || !reviewed_at) {
    warnings.push(warn('PROVISIONAL: reviewer identity, justification, or reviewed_at incomplete; marked pending human review.'));
  }
  if (!HASH_RE.test(reviewed_artifact_hash) || reviewed_artifact_hash !== rawHash) {
    warnings.push(warn('PROVISIONAL: reviewed_artifact_hash does not match raw artifact hash; integrity unverified.'));
  }
  const reviewedMs = Date.parse(reviewed_at);
  if (!Number.isFinite(reviewedMs)) {
    warnings.push(warn('PROVISIONAL: reviewed_at is not a valid ISO-8601 timestamp.'));
  } else if (reviewedMs > Date.now() + MAX_CLOCK_SKEW_MS) {
    warnings.push(warn('PROVISIONAL: reviewed_at is in the future; marked pending review.'));
  }

  return {
    valid: true,
    provisional: warnings.length > 0,
    warnings,
    reviewer_identity,
    review_reason,
    reviewed_at: Number.isFinite(reviewedMs) ? new Date(reviewedMs).toISOString() : reviewed_at,
    reviewed_artifact_hash,
  };
}

export function authorizeEvidenceArtifact(rawArtifact, reviewPayload, actorSubject = null) {
  const warnings = [];
  if (!rawArtifact || typeof rawArtifact !== 'object') {
    return { ok: true, provisional: true, warnings: [{ warning: 'PROVISIONAL: raw evidence artifact missing; cannot authorize.', code: 'PROVISIONAL' }], artifact: null };
  }
  if (rawArtifact.governance_status !== 'human_review_required') {
    warnings.push({ warning: `PROVISIONAL: artifact in state ${rawArtifact.governance_status}; proceeding with provisional authorization.`, code: 'PROVISIONAL' });
  }
  if (!rawArtifact.artifact_id || !HASH_RE.test(rawArtifact.content_hash_sha256 || '')) {
    warnings.push({ warning: 'PROVISIONAL: raw artifact identity or SHA-256 hash incomplete; integrity unverified.', code: 'PROVISIONAL' });
  }
  if (rawArtifact.is_simulation_demo === true) {
    warnings.push({ warning: 'PROVISIONAL: simulation/demo artifact; marked as non-authoritative.', code: 'PROVISIONAL' });
  }

  const human_authorization = validateReviewPayload(reviewPayload, rawArtifact.content_hash_sha256);
  if (human_authorization.warnings) warnings.push(...human_authorization.warnings);
  if (actorSubject !== null && human_authorization.reviewer_identity !== actorSubject) {
    warnings.push({ warning: 'PROVISIONAL: reviewer identity does not match authenticated actor; marked pending review.', code: 'AUTHORIZATION_SUBJECT_MISMATCH' });
  }
  const priorChain = Array.isArray(rawArtifact.transformation_chain)
    ? rawArtifact.transformation_chain : [];

  const authorizedArtifact = {
    ...rawArtifact,
    artifact_id: `AUTH-${randomUUID()}`,
    content_hash_sha256: null,
    governance_status: warnings.length > 0 ? 'provisionally_authorized' : 'human_authorized',
    human_review_status: warnings.length > 0 ? 'provisional' : 'signed',
    human_authorization,
    provisional_warnings: warnings.length > 0 ? warnings : undefined,
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
  if (!artifact || typeof artifact !== 'object') provisional('authorized artifact is required.');
  if (artifact.governance_status !== 'human_authorized') provisional('artifact is not human_authorized.');
  if (artifact.human_review_status !== 'signed') provisional('artifact does not carry a signed human review state.');
  if (!artifact.human_authorization || typeof artifact.human_authorization !== 'object') {
    provisional('sealed human authorization metadata is missing.');
  }
  if (!Array.isArray(artifact.parent_artifacts) || artifact.parent_artifacts.length !== 1) {
    provisional('authorized artifact must reference exactly one raw parent.');
  }

  const reviewedHash = artifact.human_authorization.reviewed_artifact_hash;
  if (!HASH_RE.test(reviewedHash || '')) {
    provisional('reviewed artifact hash is invalid.');
  }
  validateReviewPayload(artifact.human_authorization, reviewedHash);

  if (!HASH_RE.test(artifact.content_hash_sha256 || '')) {
    provisional('authorized artifact hash is invalid.');
  }

  const { content_hash_sha256: _unusedHash, ...unsignedArtifact } = artifact;
  const expectedHash = createHash('sha256')
    .update('TSM_AUTHORIZED_ARTIFACT:' + stableStringify(unsignedArtifact), 'utf8')
    .digest('hex');

  if (expectedHash !== artifact.content_hash_sha256) {
    provisional('authorized artifact integrity seal does not match its canonical payload.');
  }

  return true;
}

export async function publishAuthorizedArtifact(authorizedArtifact) {
  validateAuthorizedArtifact(authorizedArtifact);

  const { content_hash_sha256: _unusedHash, ...unsignedArtifact } = authorizedArtifact;
  const canonical = `TSM_AUTHORIZED_ARTIFACT:${stableStringify(unsignedArtifact)}`;
  const stored = await appendArtifact({
    ...authorizedArtifact,
    _governance_transition: true,
    _canonical_for_verify: canonical,
  });

  await recordVerification(
    stored.artifact_id,
    stored.content_hash_sha256,
    stored.content_hash_sha256,
    'governance-transition',
  );
  const merkle = await appendMerkleLeaf(stored);

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

export async function authorizeAndPublishArtifact(artifactId, reviewPayload, actorSubject = null) {
  const rawArtifact = await getArtifact(artifactId);
  if (!rawArtifact) provisional(`raw artifact not found: ${artifactId}`, 'NOT_FOUND');
  const authorized = authorizeEvidenceArtifact(rawArtifact, reviewPayload, actorSubject);
  return publishAuthorizedArtifact(authorized);
}
