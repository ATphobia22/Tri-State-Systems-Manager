-- Requires legacy 3DCityDB 4.x, NOT v5, and 00-review-schema.sql.
-- One building-level LoD per source: prefer LoD2, then LoD1; omit interior geometry.
BEGIN;
CREATE OR REPLACE VIEW tsm_city.posey_v4_native AS
WITH roots AS (
  SELECT b.id AS cityobject_id, c.gmlid, choice.geometry_id, choice.lod
  FROM citydb.building b
  JOIN citydb.cityobject c ON c.id=b.id
  JOIN tsm_city.posey_identity i ON i.citydb_major=4 AND i.cityobject_id=b.id
  CROSS JOIN LATERAL (
    SELECT t.geometry_id,t.lod FROM (VALUES
      (b.lod2_solid_id,2,1),(b.lod2_multi_surface_id,2,2),
      (b.lod1_solid_id,1,3),(b.lod1_multi_surface_id,1,4)
    ) t(geometry_id,lod,priority)
    WHERE t.geometry_id IS NOT NULL ORDER BY priority LIMIT 1
  ) choice
)
SELECT r.cityobject_id,r.gmlid,r.geometry_id,r.lod,
       i.tsm_id,i.source_feature_sha256,i.county_fips,
       i.county_parcel_id,i.height_p90_m,
       a.imported_parcel_id,a.imported_height_p90_m,
       s.geom,
       encode(sha256(ST_AsEWKB(s.geom,'NDR')),'hex') AS native_geometry_sha256
FROM roots r
JOIN tsm_city.posey_identity i ON i.citydb_major=4 AND i.cityobject_id=r.cityobject_id
CROSS JOIN LATERAL (
  SELECT ST_Collect(g.geometry ORDER BY g.id) AS geom
  FROM citydb.surface_geometry g
  WHERE g.root_id=r.geometry_id AND g.geometry IS NOT NULL
    AND ST_GeometryType(g.geometry)='ST_Polygon' AND ST_Zmflag(g.geometry)=2
) s
LEFT JOIN LATERAL (
  SELECT
    CASE WHEN count(DISTINCT strval) FILTER(WHERE attrname='county_parcel_id' AND datatype=1)=1
         THEN min(strval) FILTER(WHERE attrname='county_parcel_id' AND datatype=1) END AS imported_parcel_id,
    CASE WHEN count(DISTINCT realval) FILTER(WHERE attrname='height_p90_m' AND datatype=3)=1
         THEN min(realval) FILTER(WHERE attrname='height_p90_m' AND datatype=3) END AS imported_height_p90_m
  FROM citydb.cityobject_genericattrib WHERE cityobject_id=r.cityobject_id
) a ON true
WHERE s.geom IS NOT NULL AND NOT ST_IsEmpty(s.geom);

-- The transformed geometry is supplied by a separately verified worker,
-- not ST_SetSRID or an XY-only ST_Transform of NAVD88 elevations.
CREATE OR REPLACE VIEW tsm_city.posey_v4_tiles AS
SELECT n.cityobject_id,n.geometry_id,n.tsm_id,n.county_fips,n.county_parcel_id,
       n.height_p90_m,n.lod,n.source_feature_sha256,
       g.transform_receipt_sha256,g.review_receipt_sha256,g.geom,
       false AS engineering_approved
FROM tsm_city.posey_v4_native n
JOIN tsm_city.reviewed_geometry g ON g.citydb_major=4
 AND g.cityobject_id=n.cityobject_id AND g.geometry_id=n.geometry_id AND g.lod=n.lod
 AND g.native_geometry_sha256=n.native_geometry_sha256
 AND g.source_feature_sha256=n.source_feature_sha256;
COMMIT;
