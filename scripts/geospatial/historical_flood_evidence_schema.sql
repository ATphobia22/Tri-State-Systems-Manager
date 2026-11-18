-- Historical flood evidence registry for IN/KY/IL. PostGIS-ready, NOT executed by CI.
-- Apply to operator-controlled DB after migration review. No privileged automation.
-- Do not interpret an event/source association as actual county flood damage,
-- FEMA BFE, an NFIP claim assigned to a parcel, or historical agency map use.
CREATE SCHEMA IF NOT EXISTS tsm_flood_history;

CREATE TABLE IF NOT EXISTS tsm_flood_history.counties (
    county_fips char(5) PRIMARY KEY,
    name text NOT NULL,
    state char(2) NOT NULL CHECK (state IN ('IN','KY','IL'))
);
INSERT INTO tsm_flood_history.counties (county_fips,name,state) VALUES
 ('18129','Posey County','IN'),
 ('21101','Henderson County','KY'),
 ('21225','Union County','KY'),
 ('17059','Gallatin County','IL'),
 ('17185','Wabash County','IL'),
 ('17193','White County','IL')
ON CONFLICT (county_fips) DO NOTHING;

CREATE TABLE IF NOT EXISTS tsm_flood_history.flood_events (
    event_id text PRIMARY KEY,
    event_name text NOT NULL,
    event_start date NOT NULL,
    event_end date NOT NULL,
    date_precision text NOT NULL,
    primary_source_url text NOT NULL,
    CHECK (event_end >= event_start)
);
INSERT INTO tsm_flood_history.flood_events VALUES
 ('1913_wabash','March 1913 Wabash River flood: New Harmony historical record',
  '1913-03-01','1913-03-31','MONTH_RANGE',
  'https://pubs.usgs.gov/wdr/2005/wdr-il-05/data/stag2005/03378500.htm'),
 ('1937_ohio_mississippi','1937 Ohio-Mississippi flood','1937-01-01','1937-02-28',
  'MONTH_RANGE','https://pubs.usgs.gov/publication/wsp838'),
 ('2005_lower_wabash_ohio','January 2005 lower Wabash and Ohio flooding',
  '2005-01-01','2005-01-31','MONTH_RANGE','https://www.weather.gov/pah/events'),
 ('2011_ohio_wabash','2011 Ohio-Wabash regional flood context','2011-01-01','2011-12-31',
  'YEAR_WINDOW_NOT_EVENT_START_END','https://apps.usgs.gov/fev/data-download-portal')
ON CONFLICT (event_id) DO NOTHING;

-- A regional research selection is not evidence that any particular parcel flooded.
CREATE TABLE IF NOT EXISTS tsm_flood_history.event_county_context (
    event_id text NOT NULL REFERENCES tsm_flood_history.flood_events(event_id),
    county_fips char(5) NOT NULL REFERENCES tsm_flood_history.counties(county_fips),
    impact_review_state text NOT NULL DEFAULT 'REGIONAL_CONTEXT_NOT_COUNTY_VERIFIED'
       CHECK (impact_review_state IN (
         'REGIONAL_CONTEXT_NOT_COUNTY_VERIFIED', 'DOCUMENTED_COUNTY_IMPACT')),
    impact_evidence_url text,
    PRIMARY KEY (event_id, county_fips),
    CHECK (impact_review_state <> 'DOCUMENTED_COUNTY_IMPACT'
           OR impact_evidence_url IS NOT NULL)
);
INSERT INTO tsm_flood_history.event_county_context (event_id,county_fips)
SELECT e.event_id,c.county_fips
FROM tsm_flood_history.flood_events e
CROSS JOIN tsm_flood_history.counties c
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS tsm_flood_history.sources (
    source_id text PRIMARY KEY,
    agency text NOT NULL,
    product_kind text NOT NULL,
    source_url text NOT NULL,
    construction_method text,
    quality_basis text,
    temporal_scope text NOT NULL DEFAULT 'DISCOVERY_ONLY',
    parcel_level_join_permitted boolean NOT NULL DEFAULT false,
    source_catalog_version text NOT NULL DEFAULT '1.0.0'
);
-- Only exemplar source seeds. The versioned JSON catalog contains all 17 agencies/products.
INSERT INTO tsm_flood_history.sources
(source_id,agency,product_kind,source_url,construction_method,quality_basis)
VALUES
('fema_msc','FEMA','HISTORIC_FHBM_FIRM_FIS_LOMC','https://msc.fema.gov/',
 'FIRM/FIS historic map edition and revisions','Effective dates/BFE/scale/vertical datum require product review'),
('fema_nfhl','FEMA','EFFECTIVE_FLOOD_HAZARD_GEOMETRY',
 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
 'Effective NFHL DFIRM database','Current service not a validated past-time snapshot'),
('openfema_nfip','FEMA OpenFEMA','REDACTED_NFIP_POLICIES_CLAIMS',
 'https://www.fema.gov/api/open/v3/NfipClaims',
 'Redacted administrative insurance records','No per-parcel or per-building matching'),
('openfema_declarations','FEMA OpenFEMA','DISASTER_DECLARATIONS',
 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries',
 'FEMA administrative designations','Incident date distinct from declaration date'),
('usgs_wsp838','USGS','1937_FLOOD_PUBLICATION','https://pubs.usgs.gov/publication/wsp838',
 'Historical gage stages and river discharge','Observational/historical context, not FIRM'),
('usgs_fev','USGS','EVENT_BASED_HIGH_WATER_MARKS',
 'https://apps.usgs.gov/fev/data-download-portal',
 'Surveyed event HWMs and temporary sensors','Datum and uncertainty require point-level review'),
('in_gio_elevation','Indiana GIO','LIDAR_DEM_DSM_NDHM',
 'https://www.in.gov/gis/geoinsights/posts/how-to-access-indianas-imagery-and-elevation-raster-datasets/',
 'Lidar DEM/DSM/NDHM','Tile-specific date and QL required'),
('ky_from_above','Kentucky DGI','LIDAR_DEM_ORTHO_STAC',
 'https://kygeonet.ky.gov/catalogexplorer/',
 'STAC discovery of LiDAR/DEM/orthos','Tile-specific metadata required'),
('il_isws_buildings','Illinois State Water Survey','BUILDING_FOOTPRINTS',
 'https://www.illinoisfloodmaps.org/building-footprints.aspx',
 'Imagery digitization or selected LAS class 6 with LP360',
 'Mixed source vintages; do not assign one accuracy to all counties'),
('il_isgs_lidar','Illinois State Geological Survey','LIDAR_ELEVATION_ARCHIVE',
 'https://clearinghouse.isgs.illinois.edu/data/elevation/lidar/',
 'LiDAR elevation tiles','Acquisition year and quality not assigned until tile inspected')
ON CONFLICT (source_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS tsm_flood_history.map_editions (
    map_edition_id bigserial PRIMARY KEY,
    panel_id text NOT NULL,
    county_fips char(5) NOT NULL REFERENCES tsm_flood_history.counties(county_fips),
    source_id text NOT NULL REFERENCES tsm_flood_history.sources(source_id),
    effective_date date,
    map_type text NOT NULL CHECK(map_type IN ('FIRM','FHBM','FBFM','FIS','LOMC','OTHER')),
    revision_date date,
    fema_product_id text,
    historic_source_evidence text,
    msc_verified boolean NOT NULL DEFAULT false,
    map_scale_denominator integer,
    horizontal_crs text,
    vertical_datum text,
    horizontal_accuracy_m numeric,
    vertical_accuracy_m numeric,
    UNIQUE(panel_id,county_fips,effective_date)
);
-- A user-held photograph documents this label/date; authoritative MSC check remains pending.
INSERT INTO tsm_flood_history.map_editions
(panel_id,county_fips,source_id,effective_date,map_type,
 historic_source_evidence,msc_verified) VALUES
('18129C0300C','18129','fema_msc','2014-11-05','FIRM',
 'docs/evidence/POSEY-POINT-TOWNSHIP-HISTORICAL-SOURCE-RECONCILIATION.md',false)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS tsm_flood_history.source_assets (
    asset_id bigserial PRIMARY KEY,
    county_fips char(5) NOT NULL REFERENCES tsm_flood_history.counties(county_fips),
    event_id text REFERENCES tsm_flood_history.flood_events(event_id),
    source_id text NOT NULL REFERENCES tsm_flood_history.sources(source_id),
    map_edition_id bigint REFERENCES tsm_flood_history.map_editions(map_edition_id),
    service_or_layer_id text,
    original_public_url text,
    acquisition_date date,
    published_date date,
    effective_date date,
    retrieved_at_utc timestamptz,
    horizontal_crs text,
    vertical_datum text,
    geoid_model text,
    horizontal_units text,
    vertical_units text,
    raster_resolution_m numeric CHECK(raster_resolution_m > 0),
    lidar_quality_level text,
    source_geometry_method text,
    horizontal_accuracy_m numeric CHECK(horizontal_accuracy_m >= 0),
    vertical_accuracy_rmse_m numeric CHECK(vertical_accuracy_rmse_m >= 0),
    quality_report_url text,
    sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    byte_count bigint CHECK(byte_count >= 0),
    evidence_status text NOT NULL DEFAULT 'UNREVIEWED'
        CHECK(evidence_status IN ('UNREVIEWED','SOURCE_VERIFIED','QA_REVIEWED','REJECTED')),
    geom geometry(Geometry,4326),
    CHECK (geom IS NULL OR ST_IsValid(geom))
);
CREATE INDEX IF NOT EXISTS idx_flood_source_assets_geo
    ON tsm_flood_history.source_assets USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_flood_source_assets_county_event
    ON tsm_flood_history.source_assets(county_fips,event_id);

-- Actual agency map use must have primary evidence; date compatibility is not proof.
CREATE TABLE IF NOT EXISTS tsm_flood_history.agency_map_use_review (
    map_edition_id bigint NOT NULL REFERENCES tsm_flood_history.map_editions(map_edition_id),
    event_id text NOT NULL REFERENCES tsm_flood_history.flood_events(event_id),
    agency text NOT NULL,
    review_state text NOT NULL DEFAULT 'NOT_VERIFIED'
       CHECK(review_state IN ('NOT_VERIFIED','CANDIDATE_REVIEW','DOCUMENTED_USE')),
    primary_agency_document_url text,
    analyst_note text,
    reviewed_at_utc timestamptz,
    PRIMARY KEY(map_edition_id,event_id,agency),
    CHECK (review_state <> 'DOCUMENTED_USE'
           OR (primary_agency_document_url IS NOT NULL AND reviewed_at_utc IS NOT NULL))
);
CREATE OR REPLACE VIEW tsm_flood_history.map_event_temporal_review AS
SELECT m.panel_id,m.county_fips,m.effective_date,e.event_id,e.event_end,
       CASE WHEN m.effective_date IS NULL THEN 'UNKNOWN_EFFECTIVE_DATE'
            WHEN m.effective_date > e.event_end THEN 'POST_EVENT_NOT_AVAILABLE'
            WHEN m.effective_date > e.event_start THEN 'EFFECTIVE_DURING_INDEX_WINDOW_CHECK_DATE'
            ELSE 'DATE_COMPATIBLE_ACTUAL_USE_NOT_VERIFIED' END AS temporal_status,
       a.agency,a.review_state,a.primary_agency_document_url
FROM tsm_flood_history.map_editions m
JOIN tsm_flood_history.event_county_context c ON c.county_fips=m.county_fips
JOIN tsm_flood_history.flood_events e ON c.event_id=e.event_id
LEFT JOIN tsm_flood_history.agency_map_use_review a
  ON a.map_edition_id=m.map_edition_id AND a.event_id=e.event_id;
-- Consumer rule: POST_EVENT always overrides any erroneous use-review flag.

-- BFE table is separately sourced, never backfilled from an arbitrary flood event.
CREATE TABLE IF NOT EXISTS tsm_flood_history.bfe_evidence (
    bfe_id bigserial PRIMARY KEY,
    asset_id bigint NOT NULL REFERENCES tsm_flood_history.source_assets(asset_id),
    map_edition_id bigint REFERENCES tsm_flood_history.map_editions(map_edition_id),
    reach_or_cross_section text,
    source_bfe_value numeric,
    source_vertical_datum text,
    source_vertical_units text,
    converted_bfe_navd88_ft numeric,
    conversion_method text,
    reviewer_identity_role text,
    reviewed_at_utc timestamptz,
    CHECK(converted_bfe_navd88_ft IS NULL
       OR (source_vertical_datum IS NOT NULL AND conversion_method IS NOT NULL
           AND reviewed_at_utc IS NOT NULL))
);

-- Building footprint geometry is versioned by source/acquisition date, not
-- silently transferred across 1937/2011/future snapshots.
CREATE TABLE IF NOT EXISTS tsm_flood_history.building_footprints (
    footprint_version_id bigserial PRIMARY KEY,
    asset_id bigint NOT NULL REFERENCES tsm_flood_history.source_assets(asset_id),
    source_building_id text NOT NULL,
    source_acquisition_date date,
    extraction_method text NOT NULL,
    method_quality_report_url text,
    footprint geometry(MultiPolygon,4326) NOT NULL,
    UNIQUE(asset_id,source_building_id),
    CHECK(ST_IsValid(footprint))
);
CREATE INDEX IF NOT EXISTS idx_flood_buildings_geo
    ON tsm_flood_history.building_footprints USING gist(footprint);
-- No parcel keys, personal addresses, policy numbers or claim numbers in these tables.

-- USGS WRI 48-74: historic flood-map index compiled Jan 1975, published Mar 1975.
-- A qualitative HIGH rating is NOT a lidar QL, geospatial RMSE or an event-era product.
CREATE TABLE IF NOT EXISTS tsm_flood_history.historical_map_index (
    index_record_id bigserial PRIMARY KEY,
    county_fips char(5) NOT NULL REFERENCES tsm_flood_history.counties(county_fips),
    source_id text NOT NULL REFERENCES tsm_flood_history.sources(source_id),
    original_report_url text NOT NULL,
    quadrangle text NOT NULL,
    mapped_flood_year integer,
    mapping_reliability text NOT NULL
       CHECK(mapping_reliability IN ('RECON','STANDARD','HIGH')),
    index_compiled_on date,
    report_published_month text,
    original_map_geometry_verified boolean NOT NULL DEFAULT false,
    demonstrated_used_in_1937 boolean NOT NULL DEFAULT false,
    exact_source_map_asset_uri text,
    notes text,
    UNIQUE(county_fips,source_id,quadrangle,mapped_flood_year)
);
-- Postgres 15+: the four 100-year design maps have NULL mapped_flood_year.
-- Default UNIQUE treats NULL years as distinct and duplicates on every seed replay.
-- Preserve real event-year distinctions while making NULL design-year rows idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS ux_historical_map_index_nullsafe
    ON tsm_flood_history.historical_map_index
    (county_fips,source_id,quadrangle,mapped_flood_year) NULLS NOT DISTINCT;

-- 1975 retrospective index of flood areas, NOT proof that the delineation
-- existed or was used by an agency during the 1937 emergency.
