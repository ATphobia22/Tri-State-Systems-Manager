import { useCallback, useEffect, useMemo, useState } from 'react';

interface EvidenceArtifact {
  readonly artifact_id: string;
  readonly artifact_type: string;
  readonly source_authority: string;
  readonly governance_status: 'human_review_required';
  readonly content_hash_sha256: string;
  readonly authority_class?: string;
  readonly validation_status?: string;
  readonly payload?: Record<string, unknown>;
}

interface PublicationResult {
  readonly publication_id: string;
  readonly artifact_id: string;
  readonly content_hash_sha256: string;
  readonly published_at: string;
  readonly status: 'MERKLE_APPEND_COMPLETE';
  readonly merkle_sequence: number;
  readonly merkle_leaf_hash: string;
  readonly merkle_root: string;
}

interface ReviewPayload {
  readonly reviewer_identity: string;
  readonly review_reason: string;
  readonly reviewed_at: string;
  readonly reviewed_artifact_hash: string;
}

interface HumanSignGatePanelProps {
  readonly apiBaseUrl?: string;
  readonly onAuthorizationComplete?: (publication: PublicationResult) => void;
}

const MIN_REASON_LENGTH = 10;

function apiOrigin(explicit?: string): string {
  return explicit?.trim() || import.meta.env.VITE_TSM_API_BASE_URL?.trim() || '';
}

export function HumanSignGatePanel({
  apiBaseUrl,
  onAuthorizationComplete,
}: HumanSignGatePanelProps) {
  const [artifacts, setArtifacts] = useState<readonly EvidenceArtifact[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState('');
  const [reviewerIdentity, setReviewerIdentity] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publication, setPublication] = useState<PublicationResult | null>(null);

  const selectedArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.artifact_id === selectedArtifactId) ?? null,
    [artifacts, selectedArtifactId],
  );

  const loadArtifacts = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `\${apiOrigin(apiBaseUrl)}/api/evidence?is_simulation_demo=false`,
        { headers: { Accept: 'application/json' }, cache: 'no-store' },
      );
      if (!response.ok) {
        throw new Error(`Evidence API returned HTTP \${response.status}.`);
      }
      const body = (await response.json()) as { artifacts?: EvidenceArtifact[] };
      const pending = (body.artifacts ?? []).filter(
        (artifact) => artifact.governance_status === 'human_review_required',
      );
      setArtifacts(pending);
      setSelectedArtifactId((current) =>
        pending.some((artifact) => artifact.artifact_id === current)
          ? current
          : pending[0]?.artifact_id ?? '',
      );
    } catch (error) {
      setArtifacts([]);
      setSelectedArtifactId('');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load review queue.');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void loadArtifacts();
  }, [loadArtifacts]);

  const formValid =
    selectedArtifact !== null &&
    reviewerIdentity.trim().length >= 3 &&
    reviewReason.trim().length >= MIN_REASON_LENGTH;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedArtifact || !formValid || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);
    setPublication(null);

    const review: ReviewPayload = {
      reviewer_identity: reviewerIdentity.trim(),
      review_reason: reviewReason.trim(),
      reviewed_at: new Date().toISOString(),
      reviewed_artifact_hash: selectedArtifact.content_hash_sha256,
    };

    try {
      const response = await fetch(`\${apiOrigin(apiBaseUrl)}/api/ledger/append`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          artifact_id: selectedArtifact.artifact_id,
          human_authorization: review,
        }),
      });

      const body = (await response.json()) as PublicationResult & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || `Governance transition returned HTTP \${response.status}.`);
      }

      setPublication(body);
      setArtifacts((current) =>
        current.filter((artifact) => artifact.artifact_id !== selectedArtifact.artifact_id),
      );
      setSelectedArtifactId('');
      onAuthorizationComplete?.(body);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Human authorization transition failed.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetReview = () => {
    setPublication(null);
    setReviewerIdentity('');
    setReviewReason('');
    setErrorMessage(null);
  };

  return (
    <section
      aria-labelledby="human-sign-gate-title"
      style={{
        padding: '1.25rem',
        background: '#0f172a',
        color: '#e2e8f0',
        border: '1px solid #334155',
        borderRadius: 14,
      }}
    >
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ color: '#fbbf24', fontSize: '0.7rem', fontWeight: 700 }}>
          TSM CONTROL 4 · HUMAN AUTHORITY SIGN GATE
        </div>
        <h2 id="human-sign-gate-title" style={{ margin: '0.35rem 0', fontSize: '1.15rem' }}>
          Evidence publication authorization
        </h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.5 }}>
          Only server-side governance transitions may create a human-authorized artifact or
          append the Merkle ledger. The browser never generates an authoritative fallback.
        </p>
      </div>

      {loading && <p style={{ color: '#94a3b8' }}>Loading human-review queue…</p>}

      {errorMessage && (
        <div
          role="alert"
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            borderLeft: '4px solid #ef4444',
            background: '#450a0a',
            color: '#fecaca',
            fontSize: '0.78rem',
          }}
        >
          {errorMessage}
        </div>
      )}

      {publication ? (
        <div
          role="status"
          style={{
            padding: '1rem',
            background: '#052e16',
            border: '1px solid #16a34a',
            borderRadius: 10,
          }}
        >
          <strong style={{ color: '#86efac' }}>MERKLE_APPEND_COMPLETE</strong>
          <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: '0.7rem' }}>
            <div>Artifact: {publication.artifact_id}</div>
            <div>Publication: {publication.publication_id}</div>
            <div>Sequence: {publication.merkle_sequence}</div>
            <div>Leaf: {publication.merkle_leaf_hash}</div>
            <div>Root: {publication.merkle_root}</div>
          </div>
          <button
            type="button"
            onClick={resetReview}
            style={{ marginTop: 12, padding: '0.5rem 0.75rem' }}
          >
            Review another artifact
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <label style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            Pending evidence artifact
            <select
              required
              value={selectedArtifactId}
              onChange={(event) => setSelectedArtifactId(event.target.value)}
              disabled={loading || submitting || artifacts.length === 0}
              style={inputStyle}
            >
              {artifacts.length === 0 && <option value="">No pending artifacts</option>}
              {artifacts.map((artifact) => (
                <option key={artifact.artifact_id} value={artifact.artifact_id}>
                  {artifact.artifact_id} · {artifact.artifact_type}
                </option>
              ))}
            </select>
          </label>

          {selectedArtifact && (
            <div
              style={{
                padding: '0.75rem',
                background: '#020617',
                border: '1px solid #1e293b',
                borderRadius: 8,
                fontFamily: 'monospace',
                fontSize: '0.68rem',
                overflowWrap: 'anywhere',
              }}
            >
              <div>Authority: {selectedArtifact.source_authority}</div>
              <div>Class: {selectedArtifact.authority_class ?? 'unspecified'}</div>
              <div>Validation: {selectedArtifact.validation_status ?? 'unspecified'}</div>
              <div style={{ marginTop: 6 }}>
                Raw SHA-256: {selectedArtifact.content_hash_sha256}
              </div>
            </div>
          )}

          <label style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            Reviewer identity
            <input
              required
              minLength={3}
              value={reviewerIdentity}
              onChange={(event) => setReviewerIdentity(event.target.value)}
              disabled={submitting}
              autoComplete="off"
              style={inputStyle}
            />
          </label>

          <label style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            Engineering review reason
            <textarea
              required
              minLength={MIN_REASON_LENGTH}
              value={reviewReason}
              onChange={(event) => setReviewReason(event.target.value)}
              disabled={submitting}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </label>

          <label
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              fontSize: '0.75rem',
              color: '#f8fafc',
            }}
          >
            <input type="checkbox" required disabled={submitting} />
            I have reviewed the selected source artifact and authorize this server-side
            governance transition.
          </label>

          <button
            type="submit"
            disabled={!formValid || submitting || loading}
            style={{
              padding: '0.65rem 0.85rem',
              border: 0,
              borderRadius: 8,
              background: formValid && !submitting ? '#0284c7' : '#334155',
              color: '#fff',
              fontWeight: 700,
              cursor: formValid && !submitting ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Submitting governance transition…' : 'Sign & append to server ledger'}
          </button>
        </form>
      )}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 5,
  padding: '0.55rem 0.65rem',
  boxSizing: 'border-box',
  background: '#020617',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: '0.8rem',
};
