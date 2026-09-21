-- TSM engineering spatial topology registry.
-- Privacy-reduced parcel/zone geometry for engineering calculations.
-- No owner names, APNs, addresses, or direct cadastral identities are stored here.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS engineering;

CREATE TABLE IF NOT EXISTS engineering.zones (
    zone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_name TEXT NOT NULL,
    hydraulic_model_id TEXT NOT NULL,
    geom_boundary geometry(Polygon, 2966) NOT NULL,
    source_uri TEXT,
    source_content_sha256 CHAR(64),
    source_retrieved_at TIMESTAMPTZ,
    source_record_id TEXT,
    review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT zones_name_nonempty CHECK (length(trim(zone_name)) > 0),
    CONSTRAINT zones_model_nonempty CHECK (length(trim(hydraulic_model_id)) > 0),
    CONSTRAINT zones_geom_valid CHECK (NOT ST_IsEmpty(geom_boundary) AND ST_IsValid(geom_boundary)),
    CONSTRAINT zones_area_positive CHECK (ST_Area(geom_boundary) > 0),
    CONSTRAINT zones_hash_valid CHECK (source_content_sha256 IS NULL OR source_content_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT zones_review_status CHECK (review_status IN ('PENDING_REVIEW','VERIFIED','REJECTED'))
);
CREATE INDEX IF NOT EXISTS zones_geom_gist ON engineering.zones USING GIST (geom_boundary);

CREATE TABLE IF NOT EXISTS engineering.parcel_footprints (
    footprint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engineering_reference_token TEXT NOT NULL,
    zone_id UUID REFERENCES engineering.zones(zone_id) ON DELETE CASCADE,
    geom_parcel geometry(MultiPolygon, 2966) NOT NULL,
    calculated_area_sq_feet NUMERIC(20,2) GENERATED ALWAYS AS (ST_Area(geom_parcel)) STORED,
    source_uri TEXT,
    source_content_sha256 CHAR(64),
    source_retrieved_at TIMESTAMPTZ,
    source_record_id TEXT,
    review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT parcel_token_nonempty CHECK (length(trim(engineering_reference_token)) >= 16),
    CONSTRAINT parcel_geom_valid CHECK (NOT ST_IsEmpty(geom_parcel) AND ST_IsValid(geom_parcel)),
    CONSTRAINT parcel_area_positive CHECK (ST_Area(geom_parcel) > 0),
    CONSTRAINT parcel_hash_valid CHECK (source_content_sha256 IS NULL OR source_content_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT parcel_review_status CHECK (review_status IN ('PENDING_REVIEW','VERIFIED','REJECTED')),
    CONSTRAINT parcel_token_unique UNIQUE (engineering_reference_token)
);
CREATE INDEX IF NOT EXISTS parcel_footprints_geom_gist ON engineering.parcel_footprints USING GIST (geom_parcel);
CREATE INDEX IF NOT EXISTS parcel_footprints_zone_idx ON engineering.parcel_footprints (zone_id);

CREATE OR REPLACE FUNCTION engineering.calculate_zone_intersection_metrics(target_zone_id UUID)
RETURNS TABLE (total_intersecting_parcels BIGINT, combined_intersecting_area_sq_feet NUMERIC)
LANGUAGE plpgsql STABLE AS $$
BEGIN
    IF target_zone_id IS NULL THEN RAISE EXCEPTION 'target_zone_id is required'; END IF;
    IF NOT EXISTS (SELECT 1 FROM engineering.zones z WHERE z.zone_id = target_zone_id)
        THEN RAISE EXCEPTION 'engineering zone % does not exist', target_zone_id; END IF;
    RETURN QUERY
    SELECT COUNT(p.footprint_id)::BIGINT,
           COALESCE(SUM(ST_Area(ST_Intersection(p.geom_parcel, z.geom_boundary))), 0)::NUMERIC
      FROM engineering.zones z
      JOIN engineering.parcel_footprints p ON ST_Intersects(p.geom_parcel, z.geom_boundary)
     WHERE z.zone_id = target_zone_id
       AND p.review_status = 'VERIFIED'
       AND z.review_status = 'VERIFIED';
END;
$$;

COMMENT ON SCHEMA engineering IS 'Privacy-reduced engineering geometry. Direct cadastral identity is intentionally outside this schema.';
COMMENT ON TABLE engineering.parcel_footprints IS 'Engineering parcel footprints only. engineering_reference_token is a privacy-control identifier, not an APN or owner identifier.';
COMMENT ON FUNCTION engineering.calculate_zone_intersection_metrics(UUID) IS 'Verified parcel count and planar EPSG:2966 intersection area in square feet; not a cut/fill, storage, regulatory, or cadastral determination.';
