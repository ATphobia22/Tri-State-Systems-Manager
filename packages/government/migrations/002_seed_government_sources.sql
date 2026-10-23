-- Seed only catalogue metadata; this does not fetch or ingest datasets.
INSERT INTO government_sources(source_id,source_name,agency,authority_level,endpoint,update_frequency,citation_required,geometry_enabled,provenance_required)
VALUES
('fema.nfhl','National Flood Hazard Layer','FEMA','AUTHORITATIVE','https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer','As FEMA publishes map revisions',TRUE,TRUE,TRUE),
('fema.riskmap','Risk MAP products','FEMA','AUTHORITATIVE','https://hazards.fema.gov/femaportal/resources','By study/product release',TRUE,TRUE,TRUE),
('fema.loma','Letters of Map Amendment','FEMA','AUTHORITATIVE','https://msc.fema.gov/portal/search','By case decision',TRUE,TRUE,TRUE),
('fema.lomr','Letters of Map Revision','FEMA','AUTHORITATIVE','https://msc.fema.gov/portal/search','By case decision',TRUE,TRUE,TRUE),
('usgs.3dep','3D Elevation Program','USGS','AUTHORITATIVE','https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer','By acquisition and publication',TRUE,TRUE,TRUE),
('usgs.3dhp','3D Hydrography Program (3DHP)','USGS','AUTHORITATIVE','https://hydro.nationalmap.gov/arcgis/rest/services/3DHP_all/FeatureServer','By product and coverage release',TRUE,TRUE,TRUE),
('usgs.nhd','National Hydrography Dataset (legacy reference)','USGS','REFERENCE','https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer','Legacy/reference product release',TRUE,TRUE,TRUE),
('usgs.orthoimagery','The National Map orthoimagery','USGS','AUTHORITATIVE','https://www.usgs.gov/the-national-map-data-delivery/gis-data-download','By imagery acquisition',TRUE,TRUE,TRUE),
('noaa.coastal','NOAA Coastal Services','NOAA','AUTHORITATIVE','https://coast.noaa.gov','By product',TRUE,TRUE,TRUE),
('noaa.tides','NOAA CO-OPS tides and water levels','NOAA','AUTHORITATIVE','https://api.tidesandcurrents.noaa.gov/api/prod/datagetter','Near real time / prediction products',TRUE,TRUE,TRUE),
('noaa.weather','National Weather Service API','NOAA','AUTHORITATIVE','https://api.weather.gov','Operational forecast cycle',TRUE,TRUE,TRUE),
('noaa.storm-surge','National Hurricane Center storm-surge products','NOAA','AUTHORITATIVE','https://www.nhc.noaa.gov','Event/advisory dependent',TRUE,TRUE,TRUE),
('census.tiger','TIGER/Line boundaries','US Census Bureau','AUTHORITATIVE','https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html','Annual product release',TRUE,TRUE,TRUE),
('census.places','Census Places and geographies','US Census Bureau','AUTHORITATIVE','https://api.census.gov/data','By Census product release',TRUE,TRUE,TRUE),
('epa.waters','EPA WATERS and water program data','EPA','AUTHORITATIVE','https://www.epa.gov/waterdata','Program dependent',TRUE,TRUE,TRUE),
('epa.facilities','EPA ECHO facilities','EPA','AUTHORITATIVE','https://echo.epa.gov','Program dependent',TRUE,TRUE,TRUE),
('usda.ssurgo','NRCS SSURGO soil surveys','USDA NRCS','AUTHORITATIVE','https://SDMDataAccess.sc.egov.usda.gov','By soil survey update',TRUE,TRUE,TRUE),
('usda.cropland','Cropland Data Layer','USDA NASS','AUTHORITATIVE','https://www.nass.usda.gov/Research_and_Science/Cropland/','Annual',TRUE,TRUE,TRUE),
('usda.forest','Forest and land-cover data','USDA Forest Service','REFERENCE','https://www.fs.usda.gov','Product dependent',TRUE,TRUE,TRUE),
('dot.nbi','National Bridge Inventory','US DOT / FHWA','AUTHORITATIVE','https://www.fhwa.dot.gov/bridge/nbi.cfm','By inventory release',TRUE,TRUE,TRUE),
('army-corps.levees','National Levee Database','US Army Corps of Engineers','AUTHORITATIVE','https://nld.sec.usace.army.mil/data-services/services/','By inventory update',TRUE,TRUE,TRUE)
ON CONFLICT(source_id) DO UPDATE SET source_name=EXCLUDED.source_name,agency=EXCLUDED.agency,authority_level=EXCLUDED.authority_level,endpoint=EXCLUDED.endpoint,update_frequency=EXCLUDED.update_frequency,citation_required=EXCLUDED.citation_required,geometry_enabled=EXCLUDED.geometry_enabled,provenance_required=EXCLUDED.provenance_required,updated_at=now();
