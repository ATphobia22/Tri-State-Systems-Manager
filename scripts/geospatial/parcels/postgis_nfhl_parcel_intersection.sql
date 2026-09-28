-- =============================================================================
-- Tri-State Digital Twin (TSM) — Parcel × FEMA NFHL Spatial Intersection
-- =============================================================================
-- Intersects verified tri-state parcel polygons (EPSG:2966) against FEMA
-- National Flood Hazard Layer (NFHL) Special Flood Hazard Areas.
--
-- WHAT THIS PRODUCES (screening reference only):
--   1. Per-parcel SFHA zone classification (A, AE, AH, AO, VE, X, ...)
--   2. Inundated square footage and percentage per parcel
--   3. LOMA-candidate freeboard screen: LAG_NAVD88 − BFE_NAVD88
--
-- WHAT THIS DOES NOT PRODUCE:
--   * Not a FEMA determination. Not a survey. Not an elevation certificate.
--   * A parcel intersecting an SFHA is NOT proof it requires flood insurance;
--     a parcel outside is NOT proof it is safe. Human authority (and, where
--     needed, a licensed surveyor / FEMA LOMA process) remains final.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Query 1: Per-parcel SFHA intersection with inundated area
-- -----------------------------------------------------------------------------
-- One row per (parcel, zone) overlap. Parcels with no overlap are excluded;
-- use Query 2 for the full parcel list including non-SFHA parcels.
SELECT
  p.parcel_id,
  p.state_code,
  p.source_agency,
  p.provenance_status,
  n.fld_zone,
  n.zone_subty,
  n.static_bfe AS bfe_navd88_ft,
  -- Inundated area of THIS parcel within THIS zone (US survey feet)
  ROUND(ST_Area(ST_Intersection(p.geom, n.geom))::numeric, 1) AS inundated_sqft,
  ROUND((ST_Area(ST_Intersection(p.geom, n.geom)) / NULLIF(ST_Area(p.geom), 0) * 100)::numeric, 1)
    AS inundated_pct,
  ROUND(ST_Area(p.geom)::numeric, 1) AS parcel_sqft
FROM public.parcel_provenance AS p
JOIN public.nfhl_sfha AS n
  ON ST_Intersects(p.geom, n.geom)
WHERE p.provenance_status IN ('VERIFIED', 'STALE')
  AND n.sfha_tf = 'T'
ORDER BY inundated_pct DESC, p.parcel_id, n.fld_zone;

-- -----------------------------------------------------------------------------
-- Query 2: Worst-zone rollup per parcel (single row per parcel)
-- -----------------------------------------------------------------------------
-- Zone severity ranking for the "worst" classification. VE > A/AE/AH/AO > X.
WITH ranked AS (
  SELECT
    p.parcel_id,
    p.state_code,
    n.fld_zone,
    n.static_bfe,
    ST_Area(ST_Intersection(p.geom, n.geom)) AS iz_area,
    ST_Area(p.geom) AS parcel_area,
    CASE n.fld_zone
      WHEN 'VE' THEN 5
      WHEN 'V'  THEN 5
      WHEN 'AE' THEN 4
      WHEN 'A'  THEN 4
      WHEN 'AH' THEN 3
      WHEN 'AO' THEN 3
      WHEN 'AR' THEN 2
      ELSE 1
    END AS severity
  FROM public.parcel_provenance AS p
  JOIN public.nfhl_sfha AS n ON ST_Intersects(p.geom, n.geom)
  WHERE p.provenance_status IN ('VERIFIED', 'STALE')
    AND n.sfha_tf = 'T'
),
worst AS (
  SELECT DISTINCT ON (parcel_id)
    parcel_id, state_code, fld_zone, static_bfe, iz_area, parcel_area, severity
  FROM ranked
  ORDER BY parcel_id, severity DESC, iz_area DESC
)
SELECT
  parcel_id,
  state_code,
  fld_zone AS worst_sfha_zone,
  static_bfe AS bfe_navd88_ft,
  ROUND(iz_area::numeric, 1) AS inundated_sqft,
  ROUND((iz_area / NULLIF(parcel_area, 0) * 100)::numeric, 1) AS inundated_pct
FROM worst
ORDER BY severity DESC, inundated_pct DESC;

-- -----------------------------------------------------------------------------
-- Query 3: LOMA-candidate freeboard screen
-- -----------------------------------------------------------------------------
-- Flags parcels where the owner-supplied lowest adjacent grade (LAG) exceeds
-- the NFHL base flood elevation (BFE). Positive freeboard suggests the parcel
-- MAY be a LOMA candidate — it does NOT grant a LOMA. An actual LOMA requires
-- FEMA Form MT-1, certified elevation data, and FEMA review.
--
-- LAG values must be loaded into parcel_lag_evidence (owner-supplied,
-- clearly labeled as uncertified until a PE/RLS certifies them).
CREATE TABLE IF NOT EXISTS public.parcel_lag_evidence (
  parcel_id        TEXT PRIMARY KEY REFERENCES public.parcel_provenance (parcel_id),
  lag_navd88_ft    DOUBLE PRECISION NOT NULL,
  lag_source       TEXT NOT NULL DEFAULT 'owner-supplied-uncertified',
  certified_by     TEXT,
  certified_at     TIMESTAMPTZ,
  evidence_sha256  TEXT
);

SELECT
  p.parcel_id,
  p.state_code,
  w.fld_zone AS worst_sfha_zone,
  w.bfe_navd88_ft,
  l.lag_navd88_ft,
  ROUND((l.lag_navd88_ft - w.bfe_navd88_ft)::numeric, 2) AS freeboard_ft,
  CASE
    WHEN (l.lag_navd88_ft - w.bfe_navd88_ft) > 0 THEN 'POSSIBLE_LOMA_CANDIDATE'
    ELSE 'NO_FREEBOARD'
  END AS loma_screen,
  l.lag_source,
  l.certified_by
FROM public.parcel_provenance AS p
JOIN (
  SELECT DISTINCT ON (r.parcel_id)
    r.parcel_id, r.fld_zone, r.static_bfe AS bfe_navd88_ft
  FROM (
    SELECT p2.parcel_id, n2.fld_zone, n2.static_bfe,
           ROW_NUMBER() OVER (PARTITION BY p2.parcel_id ORDER BY n2.static_bfe DESC NULLS LAST) AS rn
    FROM public.parcel_provenance AS p2
    JOIN public.nfhl_sfha AS n2 ON ST_Intersects(p2.geom, n2.geom)
    WHERE p2.provenance_status IN ('VERIFIED', 'STALE') AND n2.sfha_tf = 'T'
  ) AS r
  WHERE r.rn = 1
) AS w ON w.parcel_id = p.parcel_id
JOIN public.parcel_lag_evidence AS l ON l.parcel_id = p.parcel_id
ORDER BY freeboard_ft DESC;

-- -----------------------------------------------------------------------------
-- Query 4: Tri-state SFHA exposure summary (for the digital twin dashboard)
-- -----------------------------------------------------------------------------
SELECT
  p.state_code,
  COUNT(DISTINCT p.parcel_id) AS parcels_total,
  COUNT(DISTINCT CASE WHEN n.ogc_fid IS NOT NULL THEN p.parcel_id END) AS parcels_in_sfha,
  ROUND(SUM(ST_Area(ST_Intersection(p.geom, n.geom)))::numeric, 0) AS total_inundated_sqft,
  ROUND((SUM(ST_Area(ST_Intersection(p.geom, n.geom))) / 43560.0)::numeric, 1) AS total_inundated_acres
FROM public.parcel_provenance AS p
LEFT JOIN public.nfhl_sfha AS n
  ON ST_Intersects(p.geom, n.geom) AND n.sfha_tf = 'T'
WHERE p.provenance_status IN ('VERIFIED', 'STALE')
GROUP BY p.state_code
ORDER BY p.state_code;
