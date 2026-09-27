-- Station-bound vertical control, FEMA/FIS references, and hydraulic site-transfer provenance.
-- A gage-to-NAVD88 conversion is not a project-site hydraulic transfer.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS hydrology;

CREATE TABLE IF NOT EXISTS hydrology.vertical_datum_control (
    control_id TEXT PRIMARY KEY,
    station_id TEXT NOT NULL,
    source_datum TEXT NOT NULL,
    target_datum TEXT NOT NULL,
    offset_ft DOUBLE PRECISION NOT NULL,
    method TEXT NOT NULL,
    source_uri TEXT NOT NULL,
    source_evidence_id TEXT,
    verification_status TEXT NOT NULL CHECK (verification_status IN ('VERIFIED_PUBLISHED', 'PROVISIONAL', 'UNVERIFIED', 'REJECTED')),
    verified_at TIMESTAMPTZ,
    scope TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vertical_datum_control_offset_finite CHECK (offset_ft = offset_ft AND abs(offset_ft) < 10000),
    CONSTRAINT vertical_datum_control_source_target CHECK (source_datum <> target_datum)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vertical_datum_control_station_pair
    ON hydrology.vertical_datum_control (station_id, source_datum, target_datum)
    WHERE verification_status <> 'REJECTED';

CREATE TABLE IF NOT EXISTS hydrology.flood_elevation_reference (
    reference_id TEXT PRIMARY KEY,
    authority TEXT NOT NULL,
    product_type TEXT NOT NULL CHECK (product_type IN ('FEMA_FIS', 'FEMA_FIRM', 'IDNR_BAFM', 'IDNR_FARA', 'USGS_FIM', 'MODEL_OUTPUT')),
    panel_id TEXT,
    study_id TEXT,
    profile_id TEXT,
    bfe_ft_navd88 DOUBLE PRECISION,
    source_uri TEXT NOT NULL,
    source_evidence_id TEXT,
    verification_status TEXT NOT NULL CHECK (verification_status IN ('VERIFIED', 'PROVISIONAL', 'UNVERIFIED', 'REJECTED')),
    effective_date DATE,
    verified_at TIMESTAMPTZ,
    spatial_scope GEOMETRY(GEOMETRY, 4326),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT flood_elevation_reference_bfe_finite CHECK (bfe_ft_navd88 IS NULL OR (bfe_ft_navd88 = bfe_ft_navd88 AND abs(bfe_ft_navd88) < 10000))
);

CREATE INDEX IF NOT EXISTS idx_flood_elevation_reference_scope
    ON hydrology.flood_elevation_reference USING gist (spatial_scope);

CREATE TABLE IF NOT EXISTS hydrology.hydraulic_site_transfer (
    transfer_id TEXT PRIMARY KEY,
    station_id TEXT NOT NULL,
    target_site_id TEXT NOT NULL,
    source_wse_navd88_ft DOUBLE PRECISION,
    target_wse_navd88_ft DOUBLE PRECISION,
    model_name TEXT,
    model_version TEXT,
    profile_reference TEXT,
    source_evidence_ids TEXT[] NOT NULL DEFAULT '{}',
    verification_status TEXT NOT NULL CHECK (verification_status IN ('VERIFIED', 'PROVISIONAL', 'UNVERIFIED', 'REJECTED')),
    approved_for_extrusion BOOLEAN NOT NULL DEFAULT FALSE,
    human_review_required BOOLEAN NOT NULL DEFAULT TRUE,
    transformation_chain JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT hydraulic_site_transfer_source_wse_finite CHECK (source_wse_navd88_ft IS NULL OR (source_wse_navd88_ft = source_wse_navd88_ft AND abs(source_wse_navd88_ft) < 10000)),
    CONSTRAINT hydraulic_site_transfer_target_wse_finite CHECK (target_wse_navd88_ft IS NULL OR (target_wse_navd88_ft = target_wse_navd88_ft AND abs(target_wse_navd88_ft) < 10000)),
    CONSTRAINT hydraulic_site_transfer_approval_gate CHECK (
        approved_for_extrusion = FALSE OR
        (verification_status = 'VERIFIED' AND target_wse_navd88_ft IS NOT NULL AND model_name IS NOT NULL AND model_version IS NOT NULL AND cardinality(source_evidence_ids) > 0 AND human_review_required = FALSE)
    )
);

INSERT INTO hydrology.vertical_datum_control (
    control_id, station_id, source_datum, target_datum, offset_ft, method, source_uri,
    verification_status, verified_at, scope, notes
) VALUES (
    'USGS-03378500-GAGEZERO-NAVD88-352.67',
    '03378500', 'GAGE_DATUM', 'NAVD88', 352.67,
    'WSE_NAVD88_FT = STAGE_GAGE_DATUM_FT + 352.67_FT',
    'https://pubs.usgs.gov/sir/2016/5119/sir20165119.pdf',
    'VERIFIED_PUBLISHED', '2026-09-27T00:00:00Z',
    'New Harmony gage-site WSE only',
    'USGS SIR 2016-5119 documents the local gage datum and 352.67-ft NAVD88 conversion. This does not transfer WSE to the Point Township target site.'
) ON CONFLICT (control_id) DO UPDATE SET
    offset_ft = EXCLUDED.offset_ft,
    method = EXCLUDED.method,
    source_uri = EXCLUDED.source_uri,
    verification_status = EXCLUDED.verification_status,
    verified_at = EXCLUDED.verified_at,
    scope = EXCLUDED.scope,
    notes = EXCLUDED.notes;

INSERT INTO hydrology.flood_elevation_reference (
    reference_id, authority, product_type, panel_id, study_id, bfe_ft_navd88, source_uri,
    verification_status, notes
) VALUES (
    'USGS-FIM-2016-5119-03378500',
    'USGS',
    'USGS_FIM',
    NULL,
    'USGS-SIR-2016-5119',
    NULL,
    'https://pubs.usgs.gov/sir/2016/5119/sir20165119.pdf',
    'VERIFIED',
    'Published flood-inundation study documents 03378500 stage-to-NAVD88 conversion and HEC-RAS profiles for the New Harmony reach. It is not a Point Township site-specific BFE/FIS determination.'
) ON CONFLICT (reference_id) DO NOTHING;

INSERT INTO hydrology.flood_elevation_reference (
    reference_id, authority, product_type, panel_id, study_id, bfe_ft_navd88, source_uri,
    verification_status, notes
) VALUES (
    'FEMA-POSEY-FIS-2007-PRELIMINARY',
    'FEMA',
    'FEMA_FIS',
    NULL,
    'POSEY-FIS-2007-PRELIMINARY',
    NULL,
    'https://www.in.gov/dnr/water/files/posey-fis.pdf',
    'UNVERIFIED',
    'USGS SIR 2016-5119 cites this as the 2007 Preliminary FIS for Posey County. TSM does not treat it as the current effective/certified FIS until the FEMA Map Service Center product is acquired and verified.'
) ON CONFLICT (reference_id) DO NOTHING;

INSERT INTO hydrology.flood_elevation_reference (
    reference_id, authority, product_type, panel_id, bfe_ft_navd88, source_uri,
    verification_status, notes
) VALUES (
    'PROJECT-CANDIDATE-BFE-375-NAVD88',
    'FEMA',
    'FEMA_FIRM',
    '18129C0215D',
    375.00,
    'https://msc.fema.gov/portal/home',
    'UNVERIFIED',
    'Candidate 375.00-ft NAVD88 value retained only as an unverified project reference. Panel identity and BFE must be confirmed against the current effective FEMA FIRM/FIS; this row cannot unlock regulatory status or hydraulic extrusion.'
) ON CONFLICT (reference_id) DO NOTHING;
