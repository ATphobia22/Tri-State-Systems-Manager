-- Panel verification audit log (append-only).
--
-- Complements firm_panel (009_firm_assets.sql): firm_panel holds the *current*
-- validation state of a FIRM panel; this log records every verification event
-- (panel file hash checks, LAG/BFE assertions against a panel) as an immutable,
-- timestamped row. Corrections are new rows, never edits.
--
-- Fail-closed: consumers treat a panel with no 'verified' row as unverified.
-- This table never determines regulatory effectiveness, SFHA status, LOMA
-- status, or any FEMA regulatory outcome.

CREATE TABLE IF NOT EXISTS firm_panel_verification_log (
  id                        BIGSERIAL PRIMARY KEY,
  panel_id                  TEXT NOT NULL REFERENCES firm_panel(panel_id),
  verified_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  verifier                  TEXT NOT NULL,
  source_dataset            TEXT NOT NULL,
  panel_file_sha256         CHAR(64) NOT NULL
                              CHECK (panel_file_sha256 ~ '^[0-9a-f]{64}$'),
  computed_lag_navd88_ft    NUMERIC(7,2),
  effective_bfe_navd88_ft   NUMERIC(7,2),
  outcome                   TEXT NOT NULL
                              CHECK (outcome IN ('verified','mismatch','unverifiable')),
  notes                     TEXT NOT NULL DEFAULT '',
  CONSTRAINT no_future_verification
      CHECK (verified_at <= now() + interval '5 minutes')
);

CREATE INDEX IF NOT EXISTS idx_panel_verif_panel_time
  ON firm_panel_verification_log (panel_id, verified_at DESC);

-- Append-only: forbid UPDATE and DELETE so the audit trail cannot be rewritten.
CREATE OR REPLACE FUNCTION forbid_panel_verification_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'firm_panel_verification_log is append-only: insert a new row to correct';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_panel_verif_no_update ON firm_panel_verification_log;
CREATE TRIGGER trg_panel_verif_no_update
  BEFORE UPDATE OR DELETE ON firm_panel_verification_log
  FOR EACH ROW EXECUTE FUNCTION forbid_panel_verification_mutation();
