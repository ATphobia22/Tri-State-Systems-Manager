-- 096 NFHL layer registry + feature storage
-- Live MapServer IDs validated 2026-10-17

CREATE TABLE IF NOT EXISTS nfhl_layer_registry (
    layer_id INTEGER PRIMARY KEY,
    layer_name TEXT NOT NULL,
    geometry_type TEXT NOT NULL CHECK (geometry_type IN ('POINT', 'POLYLINE', 'POLYGON')),
    category TEXT NOT NULL DEFAULT 'Reference',
    authoritative BOOLEAN DEFAULT TRUE,
    source_url TEXT NOT NULL DEFAULT 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
    active BOOLEAN DEFAULT TRUE,
    priority_operational BOOLEAN DEFAULT FALSE,
    maplibre_source_layer TEXT,
    ingested_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nfhl_features (
    objectid BIGINT,
    layer_id INTEGER NOT NULL REFERENCES nfhl_layer_registry(layer_id),
    effective_date DATE,
    dfirm_id TEXT,
    attributes JSONB,
    geom geometry(GEOMETRY, 4326),
    imported_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfhl_features_geom ON nfhl_features USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_nfhl_features_layer ON nfhl_features (layer_id);

CREATE OR REPLACE VIEW nfhl_active_layers AS
SELECT layer_id, layer_name, geometry_type, category, priority_operational
FROM nfhl_layer_registry
WHERE active = true;
