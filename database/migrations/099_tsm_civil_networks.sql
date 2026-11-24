-- 099: Civil infrastructure candidate topology.
-- This is a PostGIS physical profile inspired by OGC MUDDI conceptual model
-- and IEC CIM asset identifiers; NOT certification of either standard.
-- Zero asset records are imported and NO read policies are created.
-- All actual underground/electric assets require legal permission and human QA.
BEGIN;
CREATE SCHEMA IF NOT EXISTS tsm_restricted;
REVOKE ALL ON SCHEMA tsm_restricted FROM PUBLIC;

CREATE TABLE IF NOT EXISTS tsm.utility_network_nodes (
    node_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    network_kind text NOT NULL CHECK (network_kind IN
        ('water','sanitary','stormwater','gas','liquid-pipeline','other')),
    jurisdiction char(2) NOT NULL CHECK (jurisdiction IN ('IN','IL','KY')),
    geometry_xy geometry(Point,26916) NOT NULL,
    height_m_navd88 double precision,
    vertical_datum text,
    quality_level text NOT NULL CHECK (quality_level IN ('QL-A','QL-B','QL-C','QL-D')),
    depth_status text NOT NULL DEFAULT 'NOT_VERIFIED'
        CHECK (depth_status IN ('NOT_VERIFIED','INDEPENDENTLY_VERIFIED')),
    depth_receipt_sha256 text CHECK (depth_receipt_sha256 ~ '^[a-f0-9]{64}$'),
    source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
    source_authority text,
    source_timestamp timestamptz,
    authority_class text NOT NULL DEFAULT 'DERIVED'
        CHECK (authority_class IN ('OBSERVED','DERIVED','INTERPOLATED')),
    human_review_status text NOT NULL DEFAULT 'human_review_required'
        CHECK (human_review_status IN ('human_review_required','reviewed')),
    public_export_allowed boolean NOT NULL DEFAULT false
        CHECK (public_export_allowed = false),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT utility_node_vertical_evidence CHECK (
        height_m_navd88 IS NULL OR (
          quality_level IN ('QL-A','QL-B') AND
          depth_status='INDEPENDENTLY_VERIFIED' AND
          depth_receipt_sha256 IS NOT NULL AND
          vertical_datum='NAVD88'
        )
    ),
    CONSTRAINT utility_node_xy_valid CHECK (
        NOT ST_IsEmpty(geometry_xy) AND ST_IsValid(geometry_xy)
    )
);

CREATE TABLE IF NOT EXISTS tsm.utility_network_assets (
    asset_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    network_kind text NOT NULL CHECK (network_kind IN
        ('water','sanitary','stormwater','gas','liquid-pipeline','other')),
    jurisdiction char(2) NOT NULL CHECK (jurisdiction IN ('IN','IL','KY')),
    asset_role text,
    muddi_feature_id text,
    ifc_global_id text,
    quality_level text NOT NULL CHECK (quality_level IN ('QL-A','QL-B','QL-C','QL-D')),
    start_node_id uuid REFERENCES tsm.utility_network_nodes(node_id) ON DELETE RESTRICT,
    end_node_id uuid REFERENCES tsm.utility_network_nodes(node_id) ON DELETE RESTRICT,
    geometry_xy geometry(LineString,26916) NOT NULL,
    geometry_xyz geometry(LineStringZ,26916),
    vertical_datum text,
    depth_status text NOT NULL DEFAULT 'NOT_VERIFIED'
        CHECK (depth_status IN ('NOT_VERIFIED','INDEPENDENTLY_VERIFIED')),
    depth_receipt_sha256 text CHECK (depth_receipt_sha256 ~ '^[a-f0-9]{64}$'),
    source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
    source_authority text,
    source_timestamp timestamptz,
    source_license_status text NOT NULL DEFAULT 'NOT_VERIFIED'
        CHECK (source_license_status IN ('NOT_VERIFIED','VERIFIED_FOR_INTERNAL_USE')),
    authority_class text NOT NULL DEFAULT 'DERIVED'
        CHECK (authority_class IN ('OBSERVED','DERIVED','INTERPOLATED')),
    human_review_status text NOT NULL DEFAULT 'human_review_required'
        CHECK (human_review_status IN ('human_review_required','reviewed')),
    public_export_allowed boolean NOT NULL DEFAULT false
        CHECK (public_export_allowed = false),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT utility_asset_depth_evidence CHECK (
        geometry_xyz IS NULL OR (
          quality_level IN ('QL-A','QL-B') AND
          depth_status='INDEPENDENTLY_VERIFIED' AND
          depth_receipt_sha256 IS NOT NULL AND
          vertical_datum='NAVD88'
        )
    ),
    CONSTRAINT utility_asset_xy_valid CHECK (
        NOT ST_IsEmpty(geometry_xy) AND ST_IsValid(geometry_xy)
    ),
    CONSTRAINT utility_asset_xyz_valid CHECK (
        geometry_xyz IS NULL OR
        (NOT ST_IsEmpty(geometry_xyz) AND ST_IsValid(geometry_xyz))
    ),
    CONSTRAINT utility_asset_distinct_nodes CHECK (
        start_node_id IS NULL OR end_node_id IS NULL OR start_node_id<>end_node_id
    )
);

-- CEII-grade information is not part of a public viewer or offline data pack.
-- This schema records CIM-inspired identifiers ONLY after actual legal access.
CREATE TABLE IF NOT EXISTS tsm_restricted.power_cim_assets (
    asset_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cim_mrid text NOT NULL UNIQUE,
    cim_profile text NOT NULL,
    asset_class text NOT NULL CHECK (asset_class IN
        ('Substation','PowerTransformer','ACLineSegment','Terminal',
         'ConnectivityNode','Breaker','Other')),
    jurisdiction char(2) NOT NULL CHECK (jurisdiction IN ('IN','IL','KY')),
    geometry_xy geometry(Geometry,26916),
    source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
    ceii_permission_reference text NOT NULL,
    utility_release_reference text NOT NULL,
    governance_status text NOT NULL DEFAULT 'human_review_required'
        CHECK (governance_status IN ('human_review_required','restricted_reviewed')),
    public_export_allowed boolean NOT NULL DEFAULT false
        CHECK (public_export_allowed = false),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS utility_nodes_xy_gix
 ON tsm.utility_network_nodes USING gist (geometry_xy);
CREATE INDEX IF NOT EXISTS utility_assets_xy_gix
 ON tsm.utility_network_assets USING gist (geometry_xy);
CREATE INDEX IF NOT EXISTS utility_assets_xyz_gix
 ON tsm.utility_network_assets USING gist (geometry_xyz);
CREATE INDEX IF NOT EXISTS utility_assets_connectivity_idx
 ON tsm.utility_network_assets(start_node_id,end_node_id);

-- Default-deny RLS: no policies grant ingestion/viewing, even to table owners.
-- An independent, credentialed operator policy must be designed before
-- any restricted network dataset is loaded or surfaced.
ALTER TABLE tsm.utility_network_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tsm.utility_network_nodes FORCE ROW LEVEL SECURITY;
ALTER TABLE tsm.utility_network_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tsm.utility_network_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE tsm_restricted.power_cim_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tsm_restricted.power_cim_assets FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tsm.utility_network_nodes FROM PUBLIC;
REVOKE ALL ON tsm.utility_network_assets FROM PUBLIC;
REVOKE ALL ON tsm_restricted.power_cim_assets FROM PUBLIC;

INSERT INTO tsm.schema_migrations(version)
VALUES ('099_tsm_civil_networks')
ON CONFLICT DO NOTHING;
COMMIT;
