-- Registry seed generated from data/historical-floods/tri-state-catalog-v1.json.
-- Run AFTER historical_flood_evidence_schema.sql on reviewed PostGIS database.
-- Discovery scope means only that an agency portal is relevant to the county.
-- It does NOT establish asset download, county coverage, QA, past map use, or impact.
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
 ('il_isws_firms','Illinois State Water Survey','FIRM_AND_FIS_DISCOVERY','https://www.illinoisfloodmaps.org/dfirm.aspx','Illinois mapping project, county FEMA effective FIRM and Flood Insurance Study discovery','Panel revision, FEMA MSC link, risk review status and evidence that map was effective for event')
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
 ('il_isws_firms','17193','DISCOVERY_SCOPE_ONLY')
ON CONFLICT(source_id,county_fips) DO NOTHING;
-- 17 portal/product categories scoped to 6 counties.
-- All source/asset quality, actual map-use attribution and vertical datum remain
-- unset until primary-source metadata and file receipts have been reviewed.
