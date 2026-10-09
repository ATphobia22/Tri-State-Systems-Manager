-- Grant intelligence tracking only. TSM does not auto-submit applications.
CREATE TABLE IF NOT EXISTS tsm_grant_program (
  program_id         TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  agency             TEXT NOT NULL,
  flood_water_relevant BOOLEAN NOT NULL DEFAULT FALSE,
  deadline_at        TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'tracked',
  evidence_packet_refs TEXT[] NOT NULL DEFAULT '{}',
  checklist_path     TEXT,
  notes              TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tsm_grant_deadline_calendar (
  id                 BIGSERIAL PRIMARY KEY,
  program_id         TEXT REFERENCES tsm_grant_program(program_id),
  window_label       TEXT NOT NULL, -- 30d | 60d | 90d | other
  due_at             TIMESTAMPTZ NOT NULL,
  human_action_required BOOLEAN NOT NULL DEFAULT TRUE
);
