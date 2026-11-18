-- TSM / FEMA panel 18129C0300C — READ-ONLY PostGIS LOMA review queue.
-- No database writes; NO parcel or structure is certified or declared eligible.
-- Normalize authoritative local snapshots into the following operator-owned views
-- before execution. All geometry must be valid, Polygon/MultiPolygon and share
-- one projected SRID with known units. DO NOT mix BAFL and effective FEMA zones.
--
-- tsm_loma_inputs.fema_panels(firm_pan text,dfirm_id text,geom geometry)
-- tsm_loma_inputs.fema_sfha(dfirm_id text,fld_zone text,sfha_tf text,geom geometry)
-- tsm_loma_inputs.buildings(building_id text PRIMARY KEY,geom geometry)
-- tsm_loma_inputs.parcels(parcel_id text,geom geometry)
-- tsm_loma_inputs.reviewed_bfe(building_id text UNIQUE,bfe_navd88_ft float8,
--                              bfe_source text,bfe_datum text,reviewed boolean)
-- tsm_loma_inputs.dem_review(building_id text UNIQUE,dem_adjacent_min_navd88_ft float8,
--                            dem_datum text,dem_evidence_sha256 text,sampled_cells int)
-- The last view can be populated from posey_panel_loma_prescreen.py CSV and receipt
-- AFTER verifying file hash, DEM native vertical datum, units, CRS and raster age.
-- A DEM minimum adjacent sample is NOT surveyed lowest adjacent grade (LAG).
--
-- Verify exactly one effective panel polygon and complete retrieved FEMA NFHL
-- geometry/metadata first. A missing panel must be treated as a source failure,
-- NOT evidence that structures are outside SFHA.
--
-- Notes: this query is a SQL template; TSM does not automatically have these
-- normalized views or a live PostGIS connection. Do not execute against
-- arbitrary table names or infer BFE from nearest intersecting cross-section.

WITH panel AS (
    SELECT geom
    FROM tsm_loma_inputs.fema_panels
    WHERE firm_pan = '18129C0300C' AND dfirm_id = '18129C'
),
in_panel_sfha AS (
    SELECT b.building_id, b.geom
    FROM tsm_loma_inputs.buildings AS b
    WHERE EXISTS (
        SELECT 1 FROM panel AS f
        WHERE ST_Intersects(b.geom, f.geom)
          AND ST_Area(ST_Intersection(b.geom, f.geom)) > 0
    )
    AND EXISTS (
        SELECT 1 FROM tsm_loma_inputs.fema_sfha AS z
        WHERE z.dfirm_id = '18129C'
          AND z.fld_zone = 'AE'
          AND z.sfha_tf = 'T'
          AND ST_Intersects(b.geom, z.geom)
          AND EXISTS (
              SELECT 1 FROM panel AS f
              WHERE ST_Area(ST_Intersection(ST_Intersection(b.geom, f.geom), z.geom)) > 0
          )
    )
),
parcel_matches AS (
    SELECT
        b.building_id,
        COUNT(DISTINCT p.parcel_id) FILTER (WHERE p.parcel_id IS NOT NULL) AS parcel_matches,
        MIN(p.parcel_id) FILTER (WHERE p.parcel_id IS NOT NULL) AS sole_parcel_id
    FROM in_panel_sfha AS b
    LEFT JOIN tsm_loma_inputs.parcels AS p
      ON ST_Intersects(b.geom, p.geom)
     AND ST_Area(ST_Intersection(b.geom, p.geom)) > 0
    GROUP BY b.building_id
),
review AS (
    SELECT
        b.building_id,
        CASE WHEN p.parcel_matches = 1 THEN p.sole_parcel_id ELSE NULL END AS parcel_id,
        p.parcel_matches,
        CASE WHEN bf.reviewed IS TRUE
                   AND bf.bfe_datum = 'NAVD88'
                   AND bf.bfe_source IS NOT NULL
                   AND bf.bfe_navd88_ft IS NOT NULL
                   AND bf.bfe_navd88_ft NOT IN (-999, -9999, -8888)
             THEN bf.bfe_navd88_ft ELSE NULL END AS reviewed_bfe_navd88_ft,
        CASE WHEN dm.dem_datum = 'NAVD88'
                   AND dm.sampled_cells > 0
                   AND dm.dem_evidence_sha256 IS NOT NULL
                   AND dm.dem_adjacent_min_navd88_ft IS NOT NULL
                   AND dm.dem_adjacent_min_navd88_ft NOT IN (-999, -9999, -8888)
             THEN dm.dem_adjacent_min_navd88_ft ELSE NULL END AS estimated_adjacent_navd88_ft,
        bf.bfe_source,
        dm.dem_evidence_sha256,
        dm.sampled_cells
    FROM in_panel_sfha AS b
    JOIN parcel_matches AS p USING (building_id)
    LEFT JOIN tsm_loma_inputs.reviewed_bfe AS bf USING (building_id)
    LEFT JOIN tsm_loma_inputs.dem_review AS dm USING (building_id)
)
SELECT
    '18129C0300C'::text AS firm_panel,
    building_id,
    parcel_id,
    parcel_matches,
    reviewed_bfe_navd88_ft,
    estimated_adjacent_navd88_ft,
    CASE WHEN reviewed_bfe_navd88_ft IS NOT NULL
              AND estimated_adjacent_navd88_ft IS NOT NULL
         THEN ROUND((estimated_adjacent_navd88_ft - reviewed_bfe_navd88_ft)::numeric, 3)
         ELSE NULL END AS dem_margin_ft,
    CASE
        WHEN parcel_matches <> 1 THEN 'PARCEL_JOIN_REVIEW'
        WHEN reviewed_bfe_navd88_ft IS NULL THEN 'INSUFFICIENT_BFE_EVIDENCE'
        WHEN estimated_adjacent_navd88_ft IS NULL THEN 'INSUFFICIENT_DEM_EVIDENCE'
        WHEN estimated_adjacent_navd88_ft >= reviewed_bfe_navd88_ft
             THEN 'DEM_ABOVE_BFE_REVIEW_SURVEY'
        ELSE 'DEM_BELOW_BFE_REVIEW'
    END AS screening_status,
    NULL::boolean AS official_loma_eligible, -- UNKNOWN, FEMA determination not performed
    bfe_source,
    dem_evidence_sha256,
    sampled_cells
FROM review
ORDER BY screening_status, building_id;

-- FEMA MT-1 needs natural-ground LAG (structure) OR lowest lot elevation
-- (whole lot), compatible NAVD88 BFE and source dates, fill history, and
-- review/decision by FEMA. No numeric margin alone proves LOMA eligibility.
