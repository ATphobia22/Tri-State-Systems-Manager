-- OGC MUDDI v1.0 + ASCE 38-22 / 75-22 subsurface utility schema for TSM
-- Canonical horizontal: EPSG:26916 (NAD83 / UTM 16N metres)
-- Vertical: NAVD88 orthometric
-- Quality Levels: QL-A (exposed) > QL-B (geophysical) > QL-C (surveyed surface) > QL-D (records only)
-- QL-D and QL-C must NEVER extrude as solid 3D clash geometry.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE utility_quality_level AS ENUM ('QL-A', 'QL-B', 'QL-C', 'QL-D');
CREATE TYPE utility_domain AS ENUM (
  'potable_water', 'sanitary_sewer', 'stormwater', 'gas', 'liquid_pipeline',
  'electric_duct', 'telecom', 'unknown'
);

CREATE TABLE IF NOT EXISTS muddi_utility_network (
  network_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  domain            utility_domain NOT NULL,
  operator          TEXT,
  source_system     TEXT,
  crs_epsg          INTEGER NOT NULL DEFAULT 26916 CHECK (crs_epsg = 26916),
  vertical_datum    TEXT NOT NULL DEFAULT 'NAVD88',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS muddi_utility_node (
  node_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id        UUID NOT NULL REFERENCES muddi_utility_network(network_id) ON DELETE CASCADE,
  node_type         TEXT NOT NULL,
  quality_level     utility_quality_level NOT NULL,
  geom              geometry(PointZ, 26916) NOT NULL,
  elev_navd88_m     DOUBLE PRECISION,
  asce_75_22_surveyed BOOLEAN NOT NULL DEFAULT FALSE,
  survey_date       DATE,
  source_record     TEXT,
  uncertainty_h_m   DOUBLE PRECISION,
  uncertainty_v_m   DOUBLE PRECISION,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ql_a_requires_elev CHECK (
    quality_level <> 'QL-A' OR elev_navd88_m IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS muddi_utility_segment (
  segment_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id        UUID NOT NULL REFERENCES muddi_utility_network(network_id) ON DELETE CASCADE,
  start_node_id     UUID REFERENCES muddi_utility_node(node_id),
  end_node_id       UUID REFERENCES muddi_utility_node(node_id),
  domain            utility_domain NOT NULL,
  quality_level     utility_quality_level NOT NULL,
  geom              geometry(LineStringZ, 26916),
  diameter_m        DOUBLE PRECISION,
  material          TEXT,
  install_year      INTEGER,
  depth_cover_m     DOUBLE PRECISION,
  elev_invert_navd88_m DOUBLE PRECISION,
  phmsa_npms_id     TEXT,
  one_call_buffer_m DOUBLE PRECISION NOT NULL DEFAULT 0.61,
  allow_3d_clash    BOOLEAN GENERATED ALWAYS AS (
                      quality_level IN ('QL-A', 'QL-B')
                    ) STORED,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_muddi_segment_geom ON muddi_utility_segment USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_muddi_node_geom ON muddi_utility_node USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_muddi_segment_ql ON muddi_utility_segment (quality_level);
CREATE INDEX IF NOT EXISTS idx_muddi_segment_domain ON muddi_utility_segment (domain);

CREATE OR REPLACE VIEW muddi_811_ticket_polygons AS
SELECT
  s.segment_id,
  s.domain,
  s.quality_level,
  ST_Buffer(s.geom::geography, s.one_call_buffer_m)::geometry AS ticket_poly,
  s.phmsa_npms_id,
  s.metadata
FROM muddi_utility_segment s
WHERE s.geom IS NOT NULL;

COMMENT ON TABLE muddi_utility_segment IS
  'OGC MUDDI v1.0 segment with ASCE 38-22 QL. Only QL-A/B may be used for 3D clash solids.';
