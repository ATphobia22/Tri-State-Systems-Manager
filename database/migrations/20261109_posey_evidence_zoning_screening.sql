-- TSM evidence-only Posey zoning/building screening; NOT a regulatory determination.
-- All geometries are NAD83 / Indiana West US survey feet (EPSG:2966).
-- Do not publish private parcel owner/address attributes here.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS public.tsm_spatial_source_receipt (
  receipt_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_name text NOT NULL,
  source_url text NOT NULL,
  source_license text NOT NULL,
  license_reviewed boolean NOT NULL DEFAULT false,
  acquisition_utc timestamptz NOT NULL,
  source_published_utc timestamptz,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_crs text NOT NULL,
  horizontal_transform text,
  vertical_datum text,
  vertical_units text,
  methodology text,
  reviewer text,
  approved_for_public_distribution boolean NOT NULL DEFAULT false,
  CONSTRAINT receipt_not_blank CHECK (length(trim(source_name)) > 0 AND length(trim(source_url)) > 0)
);

CREATE TABLE IF NOT EXISTS public.tsm_posey_parcel_screening (
  parcel_key text PRIMARY KEY,
  source_receipt_id bigint NOT NULL REFERENCES public.tsm_spatial_source_receipt(receipt_id),
  geom geometry(MultiPolygon,2966) NOT NULL,
  CONSTRAINT parcel_geometry_valid CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom) AND ST_Area(geom)>0),
  CONSTRAINT parcel_crs_valid CHECK (ST_SRID(geom)=2966)
);
CREATE INDEX IF NOT EXISTS tsm_posey_parcel_geom_gist ON public.tsm_posey_parcel_screening USING gist(geom);

CREATE TABLE IF NOT EXISTS public.tsm_posey_zoning_screening (
  zoning_key text PRIMARY KEY,
  source_receipt_id bigint NOT NULL REFERENCES public.tsm_spatial_source_receipt(receipt_id),
  jurisdiction text NOT NULL,
  ordinance_version text,
  ordinance_effective_date date,
  zone_code text NOT NULL,
  max_height_ft double precision CHECK (max_height_ft > 0),
  -- Bounds are NOT populated from generic defaults.
  geom geometry(MultiPolygon,2966) NOT NULL,
  CONSTRAINT zoning_geometry_valid CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom) AND ST_Area(geom)>0)
);
CREATE INDEX IF NOT EXISTS tsm_posey_zoning_geom_gist ON public.tsm_posey_zoning_screening USING gist(geom);

CREATE TABLE IF NOT EXISTS public.tsm_posey_building_screening (
  building_key text PRIMARY KEY,
  source_receipt_id bigint NOT NULL REFERENCES public.tsm_spatial_source_receipt(receipt_id),
  parcel_key text REFERENCES public.tsm_posey_parcel_screening(parcel_key),
  overture_gers_id text,
  height_evidence text NOT NULL DEFAULT 'PENDING' CHECK (height_evidence IN ('PENDING','OVERTURE_ESTIMATE','LIDAR_QA_REVIEWED','FIELD_SURVEY_REVIEWED')),
  height_ft double precision CHECK (height_ft > 0 AND isfinite(height_ft)),
  roof_elevation_navd88_ft double precision,
  ground_elevation_navd88_ft double precision,
  vertical_evidence_receipt_id bigint REFERENCES public.tsm_spatial_source_receipt(receipt_id),
  -- Only evidence-reviewed values can be used as screening heights.
  CONSTRAINT building_height_evidence_guard CHECK (
    (height_evidence IN ('PENDING','OVERTURE_ESTIMATE') AND (height_ft IS NULL OR height_evidence='OVERTURE_ESTIMATE'))
    OR (height_evidence IN ('LIDAR_QA_REVIEWED','FIELD_SURVEY_REVIEWED') AND height_ft IS NOT NULL AND vertical_evidence_receipt_id IS NOT NULL)
  ),
  geom geometry(MultiPolygon,2966) NOT NULL,
  CONSTRAINT building_geometry_valid CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom) AND ST_Area(geom)>0)
);
CREATE INDEX IF NOT EXISTS tsm_posey_building_geom_gist ON public.tsm_posey_building_screening USING gist(geom);

-- No ST_Distance multiplication: EPSG:2966 already measures in US survey feet.
-- Nearest boundary clearance is only a proximity diagnostic, NEVER a front/rear/side setback.
CREATE OR REPLACE VIEW public.tsm_posey_building_screening_ledger AS
SELECT b.building_key, b.parcel_key, b.height_evidence, b.height_ft,
       z.zoning_key, z.zone_code, z.jurisdiction, z.ordinance_version, z.max_height_ft,
       CASE WHEN p.geom IS NOT NULL THEN ST_Distance(b.geom, ST_Boundary(p.geom)) ELSE NULL END
         AS nearest_parcel_boundary_usft,
       CASE
         WHEN b.height_evidence NOT IN ('LIDAR_QA_REVIEWED','FIELD_SURVEY_REVIEWED')
           OR b.height_ft IS NULL OR z.zoning_key IS NULL
           OR z.max_height_ft IS NULL OR z.ordinance_version IS NULL
           THEN 'PENDING_EVIDENCE'
         WHEN b.height_ft > z.max_height_ft THEN 'SCREENING_CONFLICT'
         ELSE 'SCREENING_PASS'
       END AS height_screening_status,
       'NOT_A_REGULATORY_DETERMINATION'::text AS regulatory_status,
       'FRONT_SIDE_REAR_SETBACK_NOT_EVALUATED'::text AS setback_status
FROM public.tsm_posey_building_screening b
LEFT JOIN public.tsm_posey_parcel_screening p ON p.parcel_key=b.parcel_key
LEFT JOIN LATERAL (
  SELECT z1.* FROM public.tsm_posey_zoning_screening z1
  WHERE ST_Covers(z1.geom, ST_PointOnSurface(b.geom))
  ORDER BY ST_Area(ST_Intersection(z1.geom,b.geom)) DESC, z1.zoning_key
  LIMIT 1
) z ON true;
