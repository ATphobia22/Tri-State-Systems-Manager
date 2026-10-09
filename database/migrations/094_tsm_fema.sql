-- FEMA / NFHL / LOMC tracking. Insurance authority = FEMA; local permit may use Indiana BAFL separately.
CREATE TABLE IF NOT EXISTS tsm_firm_panel (
  panel_id           TEXT PRIMARY KEY, -- e.g. 18129C0300C
  community_number   TEXT NOT NULL,
  effective_date     DATE,
  scale_text         TEXT,
  ssot_status        TEXT NOT NULL DEFAULT 'PENDING_MSC_VERIFY',
  notes              TEXT
);

CREATE TABLE IF NOT EXISTS tsm_lomc_case (
  case_id            TEXT PRIMARY KEY, -- e.g. 26-05-2022A
  case_type          TEXT NOT NULL, -- LOMA | LOMR-F | LOMR | other
  status             TEXT NOT NULL,
  property_apn       TEXT,
  site_label         TEXT,
  lag_ft_navd88      DOUBLE PRECISION,
  bfe_ft_navd88      DOUBLE PRECISION,
  lag_meets_or_exceeds_bfe BOOLEAN GENERATED ALWAYS AS (
    CASE WHEN lag_ft_navd88 IS NULL OR bfe_ft_navd88 IS NULL THEN NULL
         ELSE lag_ft_navd88 >= bfe_ft_navd88 END
  ) STORED,
  auto_file          BOOLEAN NOT NULL DEFAULT FALSE,
  primary_pdf_sha256 TEXT,
  deadline_at        TIMESTAMPTZ,
  payload_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tsm_firm_panel (panel_id, community_number, effective_date, scale_text, ssot_status, notes)
VALUES ('18129C0300C', '180209', DATE '2014-11-05', '1:6000', 'OBSERVED_FIRMETTE', 'FIRMette preferred over case-file 0265C mismatch; verify on MSC')
ON CONFLICT (panel_id) DO NOTHING;

INSERT INTO tsm_lomc_case (case_id, case_type, status, property_apn, site_label, lag_ft_navd88, bfe_ft_navd88, auto_file)
VALUES ('26-05-2022A', 'LOMA', 'ADDITIONAL_INFORMATION_REQUESTED', '65-19-08-100-008.001-010', '13101 Bonebank Rd', 377.2, 375.0, FALSE)
ON CONFLICT (case_id) DO NOTHING;
