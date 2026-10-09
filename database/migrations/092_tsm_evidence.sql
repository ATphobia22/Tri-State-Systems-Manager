-- Evidence ledger (Merkle-ready). Append-only semantic: no UPDATE of hash columns in app layer.
CREATE TABLE IF NOT EXISTS tsm_evidence_artifact (
  evidence_id        TEXT PRIMARY KEY,
  source_org         TEXT NOT NULL,
  source_uri         TEXT NOT NULL,
  tier               SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 4),
  state              TEXT NOT NULL DEFAULT 'OBSERVED',
  sha256_hash        TEXT NOT NULL,
  parent_hash        TEXT,
  merkle_root        TEXT,
  validation_status  TEXT NOT NULL DEFAULT 'pending',
  human_authorized   BOOLEAN NOT NULL DEFAULT FALSE,
  reviewer_identity  TEXT,
  review_reason      TEXT,
  reviewed_at        TIMESTAMPTZ,
  h3_cells           TEXT[] NOT NULL DEFAULT '{}',
  payload_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  acquired_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tsm_evidence_human_auth CHECK (
    human_authorized = FALSE
    OR (reviewer_identity IS NOT NULL AND review_reason IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS tsm_evidence_acquired ON tsm_evidence_artifact (acquired_at DESC);
CREATE INDEX IF NOT EXISTS tsm_evidence_sha ON tsm_evidence_artifact (sha256_hash);
