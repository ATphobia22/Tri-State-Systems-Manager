-- FEMA NFHL canonical registry + feature storage for TSM/UACF
-- Live MapServer layer IDs validated 2026-10-17

CREATE TABLE IF NOT EXISTS nfhl_layer_registry (
    layer_id INTEGER PRIMARY KEY,
    layer_name TEXT NOT NULL,
    geometry_type TEXT NOT NULL CHECK (geometry_type IN ('POINT', 'POLYLINE', 'POLYGON')),
    category TEXT NOT NULL,
    authoritative BOOLEAN DEFAULT TRUE,
    source_url TEXT NOT NULL DEFAULT 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
    active BOOLEAN DEFAULT TRUE,
    priority_operational BOOLEAN DEFAULT FALSE,
    maplibre_source_layer TEXT,
    ingested_at TIMESTAMPTZ DEFAULT now()
);

TRUNCATE nfhl_layer_registry;

INSERT INTO nfhl_layer_registry (
    layer_id, layer_name, geometry_type, category, priority_operational, maplibre_source_layer
) VALUES
(0,  'NFHL Availability',                'POLYGON',  'Reference',      FALSE, NULL),
(1,  'LOMRs',                            'POLYGON',  'Regulatory',     FALSE, 'lomrs'),
(3,  'FIRM Panels',                      'POLYGON',  'Regulatory',     TRUE,  'firm_panels'),
(4,  'Base Index',                       'POLYGON',  'Reference',      FALSE, NULL),
(5,  'PLSS',                             'POLYGON',  'Reference',      FALSE, NULL),
(6,  'Topographic Low Confidence Areas', 'POLYGON',  'Reference',      FALSE, NULL),
(7,  'River Mile Markers',               'POINT',    'Reference',      FALSE, NULL),
(8,  'Datum Conversion Points',          'POINT',    'Engineering',    FALSE, NULL),
(9,  'Coastal Gages',                    'POINT',    'Hydrology',      FALSE, NULL),
(10, 'Gages',                            'POINT',    'Hydrology',      FALSE, NULL),
(11, 'Nodes',                            'POINT',    'Engineering',    FALSE, NULL),
(12, 'High Water Marks',                 'POINT',    'Engineering',    FALSE, NULL),
(13, 'Station Start Points',             'POINT',    'Engineering',    FALSE, NULL),
(14, 'Cross-Sections',                   'POLYLINE', 'Engineering',    FALSE, NULL),
(15, 'Coastal Transects',                'POLYLINE', 'Engineering',    FALSE, NULL),
(16, 'Base Flood Elevations',            'POLYLINE', 'Engineering',    TRUE,  'base_flood_elevations'),
(17, 'Profile Baselines',                'POLYLINE', 'Engineering',    FALSE, NULL),
(18, 'Transect Baselines',               'POLYLINE', 'Engineering',    FALSE, NULL),
(19, 'Limit of Moderate Wave Action',    'POLYLINE', 'Risk',           FALSE, NULL),
(20, 'Water Lines',                      'POLYLINE', 'Hydrology',      FALSE, NULL),
(22, 'Political Jurisdictions',          'POLYGON',  'Reference',      TRUE,  'political_jurisdictions'),
(23, 'Levees',                           'POLYLINE', 'Infrastructure', TRUE,  'levees'),
(24, 'General Structures',               'POLYLINE', 'Infrastructure', FALSE, NULL),
(25, 'Primary Frontal Dunes',            'POLYLINE', 'Reference',      FALSE, NULL),
(26, 'Hydrologic Reaches',               'POLYLINE', 'Hydrology',      FALSE, NULL),
(27, 'Flood Hazard Boundaries',          'POLYLINE', 'Boundary',       TRUE,  'flood_hazard_boundaries'),
(28, 'Flood Hazard Zones',               'POLYGON',  'Risk',           TRUE,  'flood_hazard_zones'),
(29, 'Seclusion Boundaries',             'POLYGON',  'Reference',      FALSE, NULL),
(30, 'Alluvial Fans',                    'POLYGON',  'Risk',           FALSE, NULL),
(31, 'Subbasins',                        'POLYGON',  'Hydrology',      FALSE, NULL),
(32, 'Water Areas',                      'POLYGON',  'Hydrology',      TRUE,  'water_areas'),
(34, 'LOMAs',                            'POINT',    'Regulatory',     TRUE,  'lomas');

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
CREATE INDEX IF NOT EXISTS idx_nfhl_features_dfirm ON nfhl_features (dfirm_id);

CREATE OR REPLACE VIEW nfhl_active_layers AS
SELECT layer_id, layer_name, geometry_type, category, priority_operational, maplibre_source_layer
FROM nfhl_layer_registry
WHERE active = true;

CREATE OR REPLACE VIEW nfhl_priority_layers AS
SELECT layer_id, layer_name, geometry_type, category, maplibre_source_layer
FROM nfhl_layer_registry
WHERE active = true AND priority_operational = true
ORDER BY array_position(ARRAY[28,27,16,23,34,3,22,32], layer_id);

COMMENT ON TABLE nfhl_layer_registry IS 'Canonical FEMA NFHL layer registry — live IDs validated 2026-10-17';
COMMENT ON TABLE nfhl_features IS 'Ingested NFHL geometries; REGULATORY_DISPLAY only; hardcopy FIRM+FIS control conflicts';
