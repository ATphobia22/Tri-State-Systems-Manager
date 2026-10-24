-- Scientific evidence ledger. Restrict UPDATE/DELETE and configure backups/WORM retention.
CREATE TABLE IF NOT EXISTS solver_evidence_ledger (
 sequence BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, run_id TEXT NOT NULL UNIQUE,
 schema_version TEXT NOT NULL, solver_name TEXT NOT NULL, solver_version TEXT,
 execution_state TEXT NOT NULL CHECK (execution_state IN ('NOT_EVALUATED','VERIFIED','FAILED','TIMEOUT','CANCELLED','NON_CONVERGENT','DATA_ERROR','UNIT_MISMATCH','DATUM_MISMATCH','GATE_BLOCKED_BY_SOLVER_ERROR')),
 evidence_json JSONB NOT NULL, evidence_sha256 CHAR(64) NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
 previous_record_sha256 CHAR(64) CHECK (previous_record_sha256 IS NULL OR previous_record_sha256 ~ '^[0-9a-f]{64}$'),
 record_sha256 CHAR(64) NOT NULL UNIQUE CHECK (record_sha256 ~ '^[0-9a-f]{64}$'), created_at_utc TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS signed_artifacts (
 artifact_id UUID PRIMARY KEY, run_id TEXT NOT NULL REFERENCES solver_evidence_ledger(run_id),
 artifact_sha256 CHAR(64) NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
 signature_algorithm TEXT NOT NULL, signature BYTEA NOT NULL,
 public_key_fingerprint_sha256 CHAR(64) NOT NULL CHECK (public_key_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 signer_identity TEXT NOT NULL, signer_authority_verified BOOLEAN NOT NULL DEFAULT FALSE,
 signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
 approval_state TEXT NOT NULL CHECK (approval_state IN ('GENERATED','VERIFIED','SIGNED','APPROVED','REJECTED','SUPERSEDED')),
 approval_record JSONB, created_at_utc TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (approval_state NOT IN ('SIGNED','APPROVED') OR signature_verified=TRUE),
 CHECK (approval_state<>'APPROVED' OR (signer_authority_verified=TRUE AND approval_record IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS replay_verifications (
 replay_id UUID PRIMARY KEY, original_run_id TEXT NOT NULL REFERENCES solver_evidence_ledger(run_id),
 replay_run_id TEXT NOT NULL REFERENCES solver_evidence_ledger(run_id), equivalent BOOLEAN NOT NULL,
 comparison_method TEXT NOT NULL, comparison_tolerance JSONB, differences JSONB NOT NULL DEFAULT '[]'::jsonb,
 verified_at_utc TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(original_run_id,replay_run_id)
);
-- Database security administration must grant application roles INSERT/SELECT only.
