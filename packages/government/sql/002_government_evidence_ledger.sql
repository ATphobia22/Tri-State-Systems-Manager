-- Append-only event stream; separate from source snapshots and human review decisions.
CREATE TABLE IF NOT EXISTS government.evidence_event (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 dataset_id text NOT NULL REFERENCES government.dataset(dataset_id),
 event_type text NOT NULL CHECK(event_type IN (
  'SOURCE_IMPORTED','VALIDATION_RECORDED','MODEL_OUTPUT_RECORDED','HUMAN_REVIEW_RECORDED','TILE_PUBLISHED'
 )),
 event_at timestamptz NOT NULL DEFAULT now(),
 actor_type text NOT NULL CHECK(actor_type IN ('SYSTEM','HUMAN')),
 actor_id text NOT NULL,
 artifact_sha256 char(64) NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
 parent_event_id uuid REFERENCES government.evidence_event(event_id),
 data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS government_evidence_dataset_event_idx
 ON government.evidence_event(dataset_id,event_at,event_id);
CREATE OR REPLACE FUNCTION government.reject_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'EVIDENCE_EVENTS_ARE_APPEND_ONLY';
END; $$;
DROP TRIGGER IF EXISTS reject_evidence_update ON government.evidence_event;
CREATE TRIGGER reject_evidence_update
 BEFORE UPDATE OR DELETE ON government.evidence_event
 FOR EACH ROW EXECUTE FUNCTION government.reject_evidence_mutation();

-- Review record is not itself a permit, LOMA/LOMR letter or survey certification.
-- The reviewer's authenticated identity and jurisdiction must be proven upstream.
CREATE TABLE IF NOT EXISTS government.human_review (
 review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 dataset_id text NOT NULL REFERENCES government.dataset(dataset_id),
 reviewer_subject text NOT NULL CHECK(length(btrim(reviewer_subject))>0),
 reviewer_identity_proof_sha256 char(64) NOT NULL
  CHECK(reviewer_identity_proof_sha256 ~ '^[0-9a-f]{64}$'),
 decision text NOT NULL CHECK(decision IN ('APPROVED_FOR_VIEW','REJECTED','NEEDS_EVIDENCE')),
 scope text NOT NULL CHECK(length(btrim(scope))>0),
 rationale text NOT NULL CHECK(length(btrim(rationale))>0),
 event_id uuid UNIQUE NOT NULL REFERENCES government.evidence_event(event_id),
 reviewed_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS reject_review_update ON government.human_review;
CREATE TRIGGER reject_review_update
 BEFORE UPDATE OR DELETE ON government.human_review
 FOR EACH ROW EXECUTE FUNCTION government.reject_evidence_mutation();
