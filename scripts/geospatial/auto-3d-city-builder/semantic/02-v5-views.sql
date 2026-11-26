-- Requires 3DCityDB v5 and 00-review-schema.sql.
-- Geometry properties are direct building-level exterior LoD1/2/3 candidates.
-- The explicit property selection avoids semantic child/solid double counting.
BEGIN;
CREATE OR REPLACE VIEW tsm_city.posey_v5_native AS
WITH eligible AS (
    SELECT f.id AS cityobject_id,f.objectid,
           g.id AS geometry_id,p.val_lod::text AS lod_label,g.geometry AS geom,
           CASE p.val_lod::text WHEN '3' THEN 3 WHEN '2' THEN 2 WHEN '1' THEN 1 END AS lod,
           row_number() OVER(PARTITION BY f.id ORDER BY
             CASE p.val_lod::text WHEN '3' THEN 3 WHEN '2' THEN 2 WHEN '1' THEN 1 END DESC,
             CASE WHEN ST_GeometryType(g.geometry)='ST_PolyhedralSurface' THEN 0 ELSE 1 END,
             g.id) AS rn
    FROM citydb.feature f
    JOIN tsm_city.posey_identity i ON i.citydb_major=5 AND i.cityobject_id=f.id
    JOIN citydb.objectclass oc ON oc.id=f.objectclass_id AND oc.classname IN ('Building','BuildingPart')
    JOIN citydb.property p ON p.feature_id=f.id
    JOIN citydb.geometry_data g ON g.id=p.val_geometry_id AND g.feature_id=f.id
    WHERE p.val_lod::text IN ('1','2','3')
      AND p.name IN ('lod1Solid','lod2Solid','lod3Solid','lod1MultiSurface','lod2MultiSurface','lod3MultiSurface')
      AND ST_Zmflag(g.geometry)=2 AND NOT ST_IsEmpty(g.geometry)
      AND ST_GeometryType(g.geometry) IN ('ST_Polygon','ST_MultiPolygon','ST_PolyhedralSurface','ST_Tin')
)
SELECT e.cityobject_id,e.objectid,e.geometry_id,e.lod,i.tsm_id,i.source_feature_sha256,
       i.county_fips,i.county_parcel_id,i.height_p90_m,e.geom,
       encode(sha256(ST_AsEWKB(e.geom,'NDR')),'hex') AS native_geometry_sha256
FROM eligible e JOIN tsm_city.posey_identity i ON i.citydb_major=5 AND i.cityobject_id=e.cityobject_id
WHERE e.rn=1;

CREATE OR REPLACE VIEW tsm_city.posey_v5_tiles AS
SELECT n.cityobject_id,n.geometry_id,n.tsm_id,n.county_fips,n.county_parcel_id,
       n.height_p90_m,n.lod,n.source_feature_sha256,
       g.transform_receipt_sha256,g.review_receipt_sha256,g.geom,
       false AS engineering_approved
FROM tsm_city.posey_v5_native n
JOIN tsm_city.reviewed_geometry g ON g.citydb_major=5
 AND g.cityobject_id=n.cityobject_id AND g.geometry_id=n.geometry_id AND g.lod=n.lod
 AND g.native_geometry_sha256=n.native_geometry_sha256
 AND g.source_feature_sha256=n.source_feature_sha256;
COMMIT;
