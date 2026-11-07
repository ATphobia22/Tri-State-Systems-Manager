CREATE INDEX IF NOT EXISTS idx_assets_type ON imported_assets (asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_sha ON imported_assets (sha256);
CREATE INDEX IF NOT EXISTS idx_ingestion_status ON ingestion_runs (status);
CREATE INDEX IF NOT EXISTS idx_evidence_asset ON evidence_bundles (asset_id);
