-- 097 TSM ingestion gaps: secondary indexes for the government evidence
-- fabric tables created by packages/government/migrations/
-- 001_government_evidence_fabric.sql.
--
-- ingestion_runs is queried by source_id / status in any real ingestion use
-- but ships with zero indexes; provenance_records has only a dataset_hash
-- index and no source_id index. This migration adds exactly those three
-- indexes, all IF NOT EXISTS. It redefines no table and touches no other
-- migration. Tables are indexed exactly as named in the fabric migration
-- (default schema).
BEGIN;
CREATE INDEX IF NOT EXISTS ingestion_runs_source_id_idx ON ingestion_runs(source_id);
CREATE INDEX IF NOT EXISTS ingestion_runs_status_idx ON ingestion_runs(status);
CREATE INDEX IF NOT EXISTS provenance_records_source_id_idx ON provenance_records(source_id);
INSERT INTO tsm.schema_migrations(version) VALUES ('097_tsm_ingestion_gaps') ON CONFLICT DO NOTHING;
COMMIT;
