-- Seed river-data sources (NWPS + NWIS) into the government source registry.
-- Live fetches remain user-initiated per the river-data policy; the fabric
-- serves pinned, hash-verified snapshots by default (packages/government/snapshots/).
INSERT INTO government_sources(source_id,source_name,agency,authority_level,endpoint,update_frequency,citation_required,geometry_enabled,provenance_required)
VALUES
('noaa.nwps','National Water Prediction Service gauges','NOAA','AUTHORITATIVE','https://api.water.noaa.gov/nwps/v1/gauges','Operational gauge updates',TRUE,TRUE,TRUE),
('usgs.nwis','NWIS instantaneous values','USGS','AUTHORITATIVE','https://waterservices.usgs.gov/nwis','Operational gauge updates',TRUE,TRUE,TRUE)
ON CONFLICT(source_id) DO UPDATE SET source_name=EXCLUDED.source_name,agency=EXCLUDED.agency,authority_level=EXCLUDED.authority_level,endpoint=EXCLUDED.endpoint,update_frequency=EXCLUDED.update_frequency,citation_required=EXCLUDED.citation_required,geometry_enabled=EXCLUDED.geometry_enabled,provenance_required=EXCLUDED.provenance_required,updated_at=now();
