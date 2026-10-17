-- FEMA NFHL canonical layer metadata for TSM geospatial fabric
-- Source: public/NFHL MapServer geometry inventory 2026-10-17

CREATE TABLE IF NOT EXISTS nfhl_layers (
    layer_id INTEGER PRIMARY KEY,
    layer_name TEXT NOT NULL,
    geometry_type TEXT NOT NULL CHECK (geometry_type IN ('POINT', 'POLYLINE', 'POLYGON')),
    authoritative BOOLEAN DEFAULT TRUE,
    authority_class TEXT NOT NULL DEFAULT 'REGULATORY_DISPLAY',
    priority_operational BOOLEAN DEFAULT FALSE,
    source_url TEXT DEFAULT 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
    maplibre_type TEXT,
    ingested_at TIMESTAMPTZ DEFAULT now()
);

TRUNCATE nfhl_layers;

INSERT INTO nfhl_layers (layer_id, layer_name, geometry_type, authority_class, priority_operational, maplibre_type) VALUES
(0,  'NFHL Availability',                 'POLYGON',  'CONTEXT',            FALSE, NULL),
(1,  'LOMRs',                             'POLYGON',  'REGULATORY_DISPLAY', FALSE, 'fill'),
(3,  'FIRM Panels',                       'POLYGON',  'REGULATORY_DISPLAY', TRUE,  'line'),
(4,  'Base Index',                        'POLYGON',  'CONTEXT',            FALSE, NULL),
(5,  'PLSS',                              'POLYGON',  'CONTEXT',            FALSE, NULL),
(6,  'Topographic Low Confidence Areas',  'POLYGON',  'CONTEXT',            FALSE, NULL),
(7,  'River Mile Markers',                'POINT',    'CONTEXT',            FALSE, 'circle'),
(8,  'Datum Conversion Points',           'POINT',    'CONTEXT',            FALSE, 'circle'),
(9,  'Coastal Gages',                     'POINT',    'CONTEXT',            FALSE, 'circle'),
(10, 'Gages',                             'POINT',    'CONTEXT',            FALSE, 'circle'),
(11, 'Nodes',                             'POINT',    'CONTEXT',            FALSE, 'circle'),
(12, 'High Water Marks',                  'POINT',    'CONTEXT',            FALSE, 'circle'),
(13, 'Station Start Points',              'POINT',    'CONTEXT',            FALSE, 'circle'),
(14, 'Cross-Sections',                    'POLYLINE', 'CONTEXT',            FALSE, 'line'),
(15, 'Coastal Transects',                 'POLYLINE', 'CONTEXT',            FALSE, 'line'),
(16, 'Base Flood Elevations',             'POLYLINE', 'REGULATORY_DISPLAY', TRUE,  'line'),
(17, 'Profile Baselines',                 'POLYLINE', 'CONTEXT',            FALSE, 'line'),
(18, 'Transect Baselines',                'POLYLINE', 'CONTEXT',            FALSE, 'line'),
(19, 'Limit of Moderate Wave Action',     'POLYLINE', 'REGULATORY_DISPLAY', FALSE, 'line'),
(20, 'Water Lines',                       'POLYLINE', 'CONTEXT',            FALSE, 'line'),
(22, 'Political Jurisdictions',           'POLYGON',  'CONTEXT',            TRUE,  NULL),
(23, 'Levees',                            'POLYLINE', 'REGULATORY_DISPLAY', TRUE,  'line'),
(24, 'General Structures',                'POLYLINE', 'CONTEXT',            FALSE, 'line'),
(25, 'Primary Frontal Dunes',             'POLYLINE', 'CONTEXT',            FALSE, 'line'),
(26, 'Hydrologic Reaches',                'POLYLINE', 'CONTEXT',            FALSE, 'line'),
(27, 'Flood Hazard Boundaries',           'POLYLINE', 'REGULATORY_DISPLAY', TRUE,  'line'),
(28, 'Flood Hazard Zones',                'POLYGON',  'REGULATORY_DISPLAY', TRUE,  'fill'),
(29, 'Seclusion Boundaries',              'POLYGON',  'CONTEXT',            FALSE, NULL),
(30, 'Alluvial Fans',                     'POLYGON',  'REGULATORY_DISPLAY', FALSE, 'fill'),
(31, 'Subbasins',                         'POLYGON',  'CONTEXT',            FALSE, NULL),
(32, 'Water Areas',                       'POLYGON',  'CONTEXT',            TRUE,  'fill'),
(34, 'LOMAs',                             'POINT',    'REGULATORY_DISPLAY', TRUE,  'circle');

COMMENT ON TABLE nfhl_layers IS 'Canonical FEMA NFHL layer registry for TSM/UACF — geometry-aware ingestion path to MapLibre and Unreal';
