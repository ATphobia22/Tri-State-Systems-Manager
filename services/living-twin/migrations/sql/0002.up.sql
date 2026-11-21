CREATE SCHEMA read_model;

CREATE TABLE read_model.checkpoint (
    projection text PRIMARY KEY CHECK (projection = 'current'),
    instance_id uuid NOT NULL DEFAULT gen_random_uuid(),
    last_seq bigint NOT NULL CHECK (last_seq >= 0),
    generation bigint NOT NULL CHECK (generation >= 1),
    recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO read_model.checkpoint (projection, last_seq, generation) VALUES ('current', 0, 1);

CREATE TABLE read_model.current_entity (
    matrix text NOT NULL,
    entity_id text NOT NULL,
    event_seq bigint NOT NULL UNIQUE REFERENCES twin.event(seq),
    valid_from timestamptz NOT NULL,
    recorded_at timestamptz NOT NULL,
    retired boolean NOT NULL,
    geom geometry(Geometry,4326),
    body jsonb NOT NULL,
    PRIMARY KEY (matrix, entity_id)
);
CREATE INDEX current_entity_geom ON read_model.current_entity USING gist(geom)
    WHERE NOT retired;

CREATE VIEW read_model.current_hydrology AS
    SELECT entity_id AS reach_id, body->'state'->>'river_name' AS river_name,
           CASE WHEN jsonb_typeof(body->'state'->'stage_ft') = 'number'
                THEN (body->'state'->>'stage_ft')::numeric END AS stage_ft,
           CASE WHEN jsonb_typeof(body->'state'->'discharge_cfs') = 'number'
                THEN (body->'state'->>'discharge_cfs')::numeric END AS discharge_cfs,
           body->'state'->>'vertical_reference' AS vertical_reference,
           valid_from, recorded_at AS updated_at, event_seq, body, geom
    FROM read_model.current_entity WHERE matrix = 'H' AND NOT retired;

CREATE INDEX current_gauge_order ON read_model.current_entity
    ((body->'state'->>'sensor_id'), (body->'state'->>'parameter'),
     (COALESCE(body->'state'->>'time_series_id','')), valid_from DESC, event_seq DESC)
    WHERE matrix='O' AND NOT retired;

CREATE VIEW read_model.current_gauge_observation AS
    SELECT DISTINCT ON (sensor_id, parameter, series)
           entity_id, body->'state'->>'sensor_id' AS sensor_id,
           body->'state'->>'parameter' AS parameter,
           COALESCE(body->'state'->>'time_series_id', '') AS series,
           valid_from, recorded_at, event_seq, body, geom
    FROM read_model.current_entity WHERE matrix = 'O' AND NOT retired
    ORDER BY sensor_id, parameter, series, valid_from DESC, event_seq DESC;

CREATE VIEW read_model.current_buildings AS
    SELECT * FROM read_model.current_entity WHERE matrix = 'B' AND NOT retired;
CREATE VIEW read_model.current_terrain AS
    SELECT * FROM read_model.current_entity WHERE matrix = 'T' AND NOT retired;

CREATE TABLE read_model.rebuild_job (
    job_id uuid PRIMARY KEY,
    target text NOT NULL CHECK (target IN ('projections','stac')),
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','completed','failed')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    finished_at timestamptz,
    watermark bigint,
    affected bigint,
    last_error text
);
CREATE INDEX rebuild_job_queue ON read_model.rebuild_job (available_at, submitted_at, job_id)
    WHERE status = 'queued';
