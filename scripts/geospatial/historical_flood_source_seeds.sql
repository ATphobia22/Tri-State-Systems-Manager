-- GENERATED companion seed for data/historical-floods/tri-state-catalog-v1.json.
-- Reproducible discovery scope, not proof of geographic coverage, agency map use,
-- retrieved FEMA panels, historic structures, or regulatory BFE.
-- Apply AFTER scripts/geospatial/historical_flood_evidence_schema.sql.
CREATE TABLE IF NOT EXISTS tsm_flood_history.source_county_scope (
    source_id text NOT NULL REFERENCES tsm_flood_history.sources(source_id),
    county_fips char(5) NOT NULL REFERENCES tsm_flood_history.counties(county_fips),
    scope_status text NOT NULL DEFAULT 'DISCOVERY_SCOPE_ONLY'
      CHECK (scope_status IN ('DISCOVERY_SCOPE_ONLY','TILE_COVERAGE_VERIFIED')),
    county_source_product_id text,
    review_evidence_uri text,
    PRIMARY KEY(source_id,county_fips),
    CHECK(scope_status <> 'TILE_COVERAGE_VERIFIED'
          OR (county_source_product_id IS NOT NULL AND review_evidence_uri IS NOT NULL))
);
INSERT INTO tsm_flood_history.sources
(source_id,agency,product_kind,source_url,construction_method,quality_basis)
VALUES
 ('fema_msc','FEMA','HISTORIC_FHBM_FIRM_FIS_LOMC','https://msc.fema.gov/','Agency Flood Insurance Study, panel revisions and effective map editions; retrieve panel-specific engineering source documentation','Panel effective date, map scale, FIS hydrology/hydraulics, flood zone, BFE, datum, PMR/LOMC and FIRM revision chronology need product-specific review'),
 ('fema_nfhl','FEMA','EFFECTIVE_FLOOD_HAZARD_GEOMETRY','https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer','Digital effective FIRM database and map revisions; current service is not an archive of past effective states','Product-specific FIRM panel, DFIRM_ID, zone, SFHA, FIS, source_date, BFE and revision'),
 ('openfema_nfip','FEMA OpenFEMA','REDACTED_NFIP_POLICIES_CLAIMS','https://www.fema.gov/api/open/v3/NfipClaims','Redacted policy/claims administrative records; use bounded existing TSM OpenFEMA v3 adapter and aggregate allowed geography/time','Record coverage, loss-date, source refresh, suppression, aggregation and redaction; NOT a regulatory map'),
 ('openfema_declarations','FEMA OpenFEMA','DISASTER_DECLARATIONS','https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries','Federal administrative incident/declaration summaries; incident time and declaration time must be distinguished','Disaster identifier, affected designated area, declaration/incident dates and FEMA query receipts'),
 ('usgs_wsp838','USGS','1937_FLOOD_PUBLICATION','https://pubs.usgs.gov/publication/wsp838','1937 flood documentation: stage/discharge records, peak measurements and hydrologic reporting','Gage identifiers, historical records, publication date, original measurement method and uncertainty'),
 ('usgs_fev','USGS','EVENT_BASED_HIGH_WATER_MARKS','https://apps.usgs.gov/fev/data-download-portal','USGS event-related high-water marks, instruments, surveys and sensors','Event and survey identifiers, survey methods, HWM quality, dates, coordinates, vertical datum and uncertainty'),
 ('usgs_fim_backwater','USGS','HYDRAULIC_FLOOD_INUNDATION_STUDY','https://pubs.usgs.gov/sir/2012/5212/','2012 USGS Ohio River backwater flood inundation analysis for Saline and Wabash Rivers in southern Illinois; stage-conditioned mapped simulations','Study gage 03381700, simulated stages, hydraulic model inputs, DEM/bathymetry, model calibration and 2014 revised publication'),
 ('usgs_gage','USGS','GAGE_HISTORICAL_OBSERVATION','https://api.waterdata.usgs.gov/docs/ogcapi/migration/','USGS water observations including stage and discharge; preserve site, time, parameter, approval status and gauge datum','Site ID, USGS parameter/statistic, QA approval, stage datum correction and observation temporal coverage'),
 ('noaa_nwps','NOAA/NWS','CURRENT_FORECAST_AND_CREST_HISTORY','https://water.noaa.gov/about/api','NWS forecast, observations, crest history and flood impact information; NOT general historical daily time series','Station ID, forecast issuance, observation time, rating/categorical thresholds; historic crest only'),
 ('in_gio_elevation','Indiana GIO','LIDAR_DEM_DSM_NDHM','https://www.in.gov/gis/geoinsights/posts/how-to-access-indianas-imagery-and-elevation-raster-datasets/','Indiana lidar classifications and derivative DEM, DSM, NDHM; public AWS bucket giselevationingov; capture tile-level metadata','LiDAR collection date, QL, point density, vertical RMSEz, LAS class, raster resolution, datum and geoid'),
 ('in_gio_lidar_dates','Indiana GIO','LIDAR_ACQUISITION_DATES','https://gisdata.in.gov/server/rest/services/Indiana_Statewide_3DEP_Lidar_Dates/MapServer','Published service maps statewide individual lidar collection dates and tile grids','Tile id, GPS acquisition date, county-year aggregation and quality context'),
 ('in_dnr_floodplain','Indiana DNR','STATE_BAFL_AND_FLOODPLAIN_PORTAL','https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/','State Best Available Floodplain and site-specific floodplain information; distinguish planning product from effective NFHL','Study/model origin, mapping version, data date, BFE/vertical datum and source authority'),
 ('ky_from_above','Kentucky DGI','LIDAR_DEM_ORTHO_STAC','https://kygeonet.ky.gov/catalogexplorer/','KyFromAbove catalog STAC tile references for point clouds, bare earth DEM and orthophotography','STAC asset ID, acquisition phase/date, LiDAR QL, contractor QA, CRS, datum, resolution and vertical RMSEz'),
 ('ky_geonet','Kentucky DGI','STATE_GEOSPATIAL_GIS_PORTAL','https://kygeonet.ky.gov/','State source discovery for statewide parcel, structures, hydrography and imagery layers','Individual service/item metadata, data steward, vintage, classification accuracy and identifiers'),
 ('il_isgs_lidar','Illinois State Geological Survey','LIDAR_ELEVATION_ARCHIVE','https://clearinghouse.isgs.illinois.edu/data/elevation/lidar/','Illinois geospatial LiDAR tile products with acquisition and local metadata','Tile collection year, density, horizontal and vertical accuracy, vertical units/datum'),
 ('il_isws_buildings','Illinois State Water Survey','BUILDING_FOOTPRINTS','https://www.illinoisfloodmaps.org/building-footprints.aspx','Statewide Microsoft/Bing-derived footprints and LiDAR LAS class 6/LP360 derived shapes in selected counties; distinguish methods','Producer/license, imagery versus LiDAR class-6 method, county acquisition date, polygons and topology; Gallatin class-6 2012 documented'),
 ('il_isws_firms','Illinois State Water Survey','FIRM_AND_FIS_DISCOVERY','https://www.illinoisfloodmaps.org/dfirm.aspx','Illinois mapping project, county FEMA effective FIRM and Flood Insurance Study discovery','Panel revision, FEMA MSC link, risk review status and evidence that map was effective for event'),
 ('usgs_floodprone_1975','USGS','1975_INDEX_OF_PRE1975_FLOOD_MAPS','https://pubs.usgs.gov/wri/1974/0048/report.pdf','1975 publication indexing USGS flood-prone area maps prepared through July 1974, listing quadrangle, actual flood year/design frequency, index reliability','Original March 1975 USGS WRI 74-48 index, compiled 1975-01-16; RECON=no detailed surveys/H&H; STANDARD=surveys and detailed H&H; HIGH=surveys/H&H plus observed flood evidence. This is retrospective map quality, not an accurate numerical RMSE or proof the 1975 map existed in 1937.'),
 ('usgs_new_harmony_archive','USGS','NEW_HARMONY_HISTORICAL_GAGE','https://pubs.usgs.gov/wdr/2005/wdr-il-05/data/stag2005/03378500.htm','USGS annual stage tables for 03378500 with historical extremes and site/relocation notes','Site-specific gage datum, observation date, old gage record and unit; remarks record March 1913 and Jan 31 1937, not NAVD88.'),
 ('nws_paducah_flood_events','NOAA/NWS','PADUCAH_REGION_HISTORIC_FLOOD_EVENTS','https://www.weather.gov/pah/events','NWS event descriptions and historical crest comparisons for western Kentucky/southern Illinois and Indiana','Regional flood episode timeline only; flood stage gage and actual county influence must be separately established.')
ON CONFLICT(source_id) DO NOTHING;
INSERT INTO tsm_flood_history.source_county_scope
(source_id,county_fips,scope_status)
VALUES
 ('fema_msc','18129','DISCOVERY_SCOPE_ONLY'),
 ('fema_msc','21101','DISCOVERY_SCOPE_ONLY'),
 ('fema_msc','21225','DISCOVERY_SCOPE_ONLY'),
 ('fema_msc','17059','DISCOVERY_SCOPE_ONLY'),
 ('fema_msc','17185','DISCOVERY_SCOPE_ONLY'),
 ('fema_msc','17193','DISCOVERY_SCOPE_ONLY'),
 ('fema_nfhl','18129','DISCOVERY_SCOPE_ONLY'),
 ('fema_nfhl','21101','DISCOVERY_SCOPE_ONLY'),
 ('fema_nfhl','21225','DISCOVERY_SCOPE_ONLY'),
 ('fema_nfhl','17059','DISCOVERY_SCOPE_ONLY'),
 ('fema_nfhl','17185','DISCOVERY_SCOPE_ONLY'),
 ('fema_nfhl','17193','DISCOVERY_SCOPE_ONLY'),
 ('openfema_nfip','18129','DISCOVERY_SCOPE_ONLY'),
 ('openfema_nfip','21101','DISCOVERY_SCOPE_ONLY'),
 ('openfema_nfip','21225','DISCOVERY_SCOPE_ONLY'),
 ('openfema_nfip','17059','DISCOVERY_SCOPE_ONLY'),
 ('openfema_nfip','17185','DISCOVERY_SCOPE_ONLY'),
 ('openfema_nfip','17193','DISCOVERY_SCOPE_ONLY'),
 ('openfema_declarations','18129','DISCOVERY_SCOPE_ONLY'),
 ('openfema_declarations','21101','DISCOVERY_SCOPE_ONLY'),
 ('openfema_declarations','21225','DISCOVERY_SCOPE_ONLY'),
 ('openfema_declarations','17059','DISCOVERY_SCOPE_ONLY'),
 ('openfema_declarations','17185','DISCOVERY_SCOPE_ONLY'),
 ('openfema_declarations','17193','DISCOVERY_SCOPE_ONLY'),
 ('usgs_wsp838','18129','DISCOVERY_SCOPE_ONLY'),
 ('usgs_wsp838','21101','DISCOVERY_SCOPE_ONLY'),
 ('usgs_wsp838','21225','DISCOVERY_SCOPE_ONLY'),
 ('usgs_wsp838','17059','DISCOVERY_SCOPE_ONLY'),
 ('usgs_wsp838','17185','DISCOVERY_SCOPE_ONLY'),
 ('usgs_wsp838','17193','DISCOVERY_SCOPE_ONLY'),
 ('usgs_fev','18129','DISCOVERY_SCOPE_ONLY'),
 ('usgs_fev','21101','DISCOVERY_SCOPE_ONLY'),
 ('usgs_fev','21225','DISCOVERY_SCOPE_ONLY'),
 ('usgs_fev','17059','DISCOVERY_SCOPE_ONLY'),
 ('usgs_fev','17185','DISCOVERY_SCOPE_ONLY'),
 ('usgs_fev','17193','DISCOVERY_SCOPE_ONLY'),
 ('usgs_fim_backwater','18129','DISCOVERY_SCOPE_ONLY'),
 ('usgs_fim_backwater','21101','DISCOVERY_SCOPE_ONLY'),
 ('usgs_fim_backwater','21225','DISCOVERY_SCOPE_ONLY'),
 ('usgs_fim_backwater','17059','DISCOVERY_SCOPE_ONLY'),
 ('usgs_fim_backwater','17185','DISCOVERY_SCOPE_ONLY'),
 ('usgs_fim_backwater','17193','DISCOVERY_SCOPE_ONLY'),
 ('usgs_gage','18129','DISCOVERY_SCOPE_ONLY'),
 ('usgs_gage','21101','DISCOVERY_SCOPE_ONLY'),
 ('usgs_gage','21225','DISCOVERY_SCOPE_ONLY'),
 ('usgs_gage','17059','DISCOVERY_SCOPE_ONLY'),
 ('usgs_gage','17185','DISCOVERY_SCOPE_ONLY'),
 ('usgs_gage','17193','DISCOVERY_SCOPE_ONLY'),
 ('noaa_nwps','18129','DISCOVERY_SCOPE_ONLY'),
 ('noaa_nwps','21101','DISCOVERY_SCOPE_ONLY'),
 ('noaa_nwps','21225','DISCOVERY_SCOPE_ONLY'),
 ('noaa_nwps','17059','DISCOVERY_SCOPE_ONLY'),
 ('noaa_nwps','17185','DISCOVERY_SCOPE_ONLY'),
 ('noaa_nwps','17193','DISCOVERY_SCOPE_ONLY'),
 ('in_gio_elevation','18129','DISCOVERY_SCOPE_ONLY'),
 ('in_gio_lidar_dates','18129','DISCOVERY_SCOPE_ONLY'),
 ('in_dnr_floodplain','18129','DISCOVERY_SCOPE_ONLY'),
 ('ky_from_above','21101','DISCOVERY_SCOPE_ONLY'),
 ('ky_from_above','21225','DISCOVERY_SCOPE_ONLY'),
 ('ky_geonet','21101','DISCOVERY_SCOPE_ONLY'),
 ('ky_geonet','21225','DISCOVERY_SCOPE_ONLY'),
 ('il_isgs_lidar','17059','DISCOVERY_SCOPE_ONLY'),
 ('il_isgs_lidar','17185','DISCOVERY_SCOPE_ONLY'),
 ('il_isgs_lidar','17193','DISCOVERY_SCOPE_ONLY'),
 ('il_isws_buildings','17059','DISCOVERY_SCOPE_ONLY'),
 ('il_isws_buildings','17185','DISCOVERY_SCOPE_ONLY'),
 ('il_isws_buildings','17193','DISCOVERY_SCOPE_ONLY'),
 ('il_isws_firms','17059','DISCOVERY_SCOPE_ONLY'),
 ('il_isws_firms','17185','DISCOVERY_SCOPE_ONLY'),
 ('il_isws_firms','17193','DISCOVERY_SCOPE_ONLY'),
 ('usgs_floodprone_1975','18129','DISCOVERY_SCOPE_ONLY'),
 ('usgs_new_harmony_archive','18129','DISCOVERY_SCOPE_ONLY'),
 ('usgs_new_harmony_archive','21101','DISCOVERY_SCOPE_ONLY'),
 ('usgs_new_harmony_archive','21225','DISCOVERY_SCOPE_ONLY'),
 ('usgs_new_harmony_archive','17059','DISCOVERY_SCOPE_ONLY'),
 ('usgs_new_harmony_archive','17185','DISCOVERY_SCOPE_ONLY'),
 ('usgs_new_harmony_archive','17193','DISCOVERY_SCOPE_ONLY'),
 ('nws_paducah_flood_events','18129','DISCOVERY_SCOPE_ONLY'),
 ('nws_paducah_flood_events','21101','DISCOVERY_SCOPE_ONLY'),
 ('nws_paducah_flood_events','21225','DISCOVERY_SCOPE_ONLY'),
 ('nws_paducah_flood_events','17059','DISCOVERY_SCOPE_ONLY'),
 ('nws_paducah_flood_events','17185','DISCOVERY_SCOPE_ONLY'),
 ('nws_paducah_flood_events','17193','DISCOVERY_SCOPE_ONLY')
ON CONFLICT(source_id,county_fips) DO NOTHING;
-- Backfill regional research contexts absent from base migration, keeping coarse dates.
INSERT INTO tsm_flood_history.flood_events
(event_id,event_name,event_start,event_end,date_precision,primary_source_url)
VALUES
 ('1913_wabash','March 1913 Wabash River flood: New Harmony historical record','1913-03-01','1913-03-31','MONTH_RANGE','https://pubs.usgs.gov/wdr/2005/wdr-il-05/data/stag2005/03378500.htm'),
 ('1937_ohio_mississippi','January–February 1937 Ohio–Mississippi River flood','1937-01-01','1937-02-28','MONTH_RANGE','https://pubs.usgs.gov/publication/wsp838'),
 ('2011_ohio_wabash','2011 Ohio–Wabash flood regional research context','2011-01-01','2011-12-31','YEAR_WINDOW_NOT_EVENT_START_END','https://apps.usgs.gov/fev/data-download-portal'),
 ('2005_lower_wabash_ohio','January 2005 Wabash and lower Ohio River flooding','2005-01-01','2005-01-31','MONTH_RANGE','https://www.weather.gov/pah/events')
ON CONFLICT(event_id) DO NOTHING;
INSERT INTO tsm_flood_history.event_county_context (event_id,county_fips)
SELECT e.event_id,c.county_fips
FROM tsm_flood_history.flood_events e CROSS JOIN tsm_flood_history.counties c
ON CONFLICT DO NOTHING;

-- An index entry is an interpretation of a historic flood map, not the map.
-- USGS WRI 74-48 was published March 1975, compiled January 16, 1975.
-- Posey rows include seven 1937 observed-event and four 100-year design maps.
CREATE TABLE IF NOT EXISTS tsm_flood_history.historical_map_index (
    county_fips char(5) NOT NULL REFERENCES tsm_flood_history.counties(county_fips),
    source_id text NOT NULL REFERENCES tsm_flood_history.sources(source_id),
    document_id text NOT NULL,
    quadrangle_name text NOT NULL,
    flood_area_delineated text NOT NULL,
    qualitative_reliability text NOT NULL CHECK
      (qualitative_reliability IN ('RECON','STANDARD','HIGH')),
    publication_date_text text,
    index_compilation_date_text text,
    primary_report_url text NOT NULL,
    mapped_flood_event_year integer,
    original_map_asset_verified boolean NOT NULL DEFAULT false,
    map_available_during_flood boolean NOT NULL DEFAULT false,
    agency_use_during_flood_verified boolean NOT NULL DEFAULT false,
    PRIMARY KEY (county_fips,source_id,document_id,quadrangle_name,flood_area_delineated),
    CHECK (map_available_during_flood = false OR agency_use_during_flood_verified = true)
);
INSERT INTO tsm_flood_history.historical_map_index
(county_fips,source_id,document_id,quadrangle_name,flood_area_delineated,
 qualitative_reliability,publication_date_text,index_compilation_date_text,
 primary_report_url,mapped_flood_event_year)
VALUES
 ('18129','usgs_floodprone_1975','USGS_WRI_74_48_MARCH_1975','UNIONTOWN, IN-KY','1937','RECON','1975-03','1975-01-16','https://pubs.usgs.gov/wri/1974/0048/report.pdf','1937'),
 ('18129','usgs_floodprone_1975','USGS_WRI_74_48_MARCH_1975','WABASH, IN','1937','HIGH','1975-03','1975-01-16','https://pubs.usgs.gov/wri/1974/0048/report.pdf','1937'),
 ('18129','usgs_floodprone_1975','USGS_WRI_74_48_MARCH_1975','WEST FRANKLIN, IN-KY','1937','HIGH','1975-03','1975-01-16','https://pubs.usgs.gov/wri/1974/0048/report.pdf','1937'),
 ('18129','usgs_floodprone_1975','USGS_WRI_74_48_MARCH_1975','CATHRYN, IN-KY','1937','HIGH','1975-03','1975-01-16','https://pubs.usgs.gov/wri/1974/0048/report.pdf','1937'),
 ('18129','usgs_floodprone_1975','USGS_WRI_74_48_MARCH_1975','MOUNT VERNON, IN-KY','1937','HIGH','1975-03','1975-01-16','https://pubs.usgs.gov/wri/1974/0048/report.pdf','1937'),
 ('18129','usgs_floodprone_1975','USGS_WRI_74_48_MARCH_1975','EVANSVILLE, IN','1937','RECON','1975-03','1975-01-16','https://pubs.usgs.gov/wri/1974/0048/report.pdf','1937'),
 ('18129','usgs_floodprone_1975','USGS_WRI_74_48_MARCH_1975','KASSON, IN','100-YR','HIGH','1975-03','1975-01-16','https://pubs.usgs.gov/wri/1974/0048/report.pdf',NULL),
 ('18129','usgs_floodprone_1975','USGS_WRI_74_48_MARCH_1975','SOLITUDE, IN-IL','1937','RECON','1975-03','1975-01-16','https://pubs.usgs.gov/wri/1974/0048/report.pdf','1937'),
 ('18129','usgs_floodprone_1975','USGS_WRI_74_48_MARCH_1975','CARMEL, IN','100-YR','RECON','1975-03','1975-01-16','https://pubs.usgs.gov/wri/1974/0048/report.pdf',NULL),
 ('18129','usgs_floodprone_1975','USGS_WRI_74_48_MARCH_1975','POSEYVILLE, IN','100-YR','RECON','1975-03','1975-01-16','https://pubs.usgs.gov/wri/1974/0048/report.pdf',NULL),
 ('18129','usgs_floodprone_1975','USGS_WRI_74_48_MARCH_1975','NEW HARMONY, IN-IL','100-YR','RECON','1975-03','1975-01-16','https://pubs.usgs.gov/wri/1974/0048/report.pdf',NULL)
ON CONFLICT DO NOTHING;

-- Source registry rows: 20; county source discovery scopes: 83;
-- regional event context rows: 4 events x 6 counties;
-- indexed original USGS flood-map quadrangle records: 11.
-- All numeric map accuracy, structure footprint vintage, BFE, and surveying remain
-- unknown until tile assets and original agency methods have been obtained.
