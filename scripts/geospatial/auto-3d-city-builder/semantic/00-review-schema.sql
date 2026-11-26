-- PostgreSQL 14+ / PostGIS. Run in the same database as the selected CityDB.
-- This schema is a separate TSM review boundary, not an alteration of CityDB.
BEGIN;
CREATE SCHEMA IF NOT EXISTS tsm_city;
CREATE TABLE IF NOT EXISTS tsm_city.posey_identity (
    citydb_major smallint NOT NULL CHECK (citydb_major IN (4,5)),
    cityobject_id bigint NOT NULL,
    tsm_id varchar NOT NULL CHECK (tsm_id ~ '^IGIO:building:[0-9]+$'),
    source_feature_sha256 varchar(64) NOT NULL CHECK (source_feature_sha256 ~ '^[0-9a-f]{64}$'),
    county_fips varchar(5) NOT NULL CHECK (county_fips = '18129'),
    county_parcel_id varchar,
    height_p90_m double precision CHECK (height_p90_m > 0 AND height_p90_m <= 100),
    PRIMARY KEY (citydb_major,cityobject_id),
    UNIQUE (citydb_major,tsm_id)
);
-- Populate only after matching official source IDs and geometry; never infer
-- a parcel join or percentile height from a missing attribute.
CREATE TABLE IF NOT EXISTS tsm_city.reviewed_geometry (
    citydb_major smallint NOT NULL CHECK (citydb_major IN (4,5)),
    cityobject_id bigint NOT NULL,
    geometry_id bigint NOT NULL,
    lod smallint NOT NULL CHECK (lod BETWEEN 1 AND 3),
    native_geometry_sha256 varchar(64) NOT NULL CHECK (native_geometry_sha256 ~ '^[0-9a-f]{64}$'),
    source_feature_sha256 varchar(64) NOT NULL CHECK (source_feature_sha256 ~ '^[0-9a-f]{64}$'),
    transform_receipt_sha256 varchar(64) NOT NULL CHECK (transform_receipt_sha256 ~ '^[0-9a-f]{64}$'),
    review_receipt_sha256 varchar(64) NOT NULL CHECK (review_receipt_sha256 ~ '^[0-9a-f]{64}$'),
    reviewer varchar NOT NULL CHECK (length(trim(reviewer))>0),
    reviewed_at timestamptz NOT NULL,
    geom geometry(GeometryZ,4979) NOT NULL,
    CHECK (NOT ST_IsEmpty(geom) AND ST_Zmflag(geom)=2
           AND ST_GeometryType(geom) IN ('ST_Polygon','ST_MultiPolygon','ST_PolyhedralSurface','ST_Tin')),
    CHECK (ST_XMin(Box3D(geom)) >= -180 AND ST_XMax(Box3D(geom)) <= 180
           AND ST_YMin(Box3D(geom)) >= -90 AND ST_YMax(Box3D(geom)) <= 90),
    PRIMARY KEY (citydb_major,cityobject_id,geometry_id,lod),
    FOREIGN KEY (citydb_major,cityobject_id) REFERENCES tsm_city.posey_identity(citydb_major,cityobject_id)
);
CREATE INDEX IF NOT EXISTS posey_reviewed_geom_gix ON tsm_city.reviewed_geometry USING gist (geom);
COMMIT;
