CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA twin;

CREATE TABLE twin.event (
    seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id uuid NOT NULL UNIQUE,
    digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
    matrix text NOT NULL CHECK (matrix IN ('S','O','H','T','I','B','R','M','V','P','U','E','TT','RR','SYNC','D')),
    entity_id text NOT NULL,
    timeline text NOT NULL CHECK (timeline IN ('observed','forecast','scenario')),
    branch text NOT NULL,
    valid_from timestamptz NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    operation text NOT NULL CHECK (operation IN ('upsert','retire')),
    geom geometry(Geometry,4326),
    body jsonb NOT NULL CHECK (jsonb_typeof(body) = 'object'),
    CHECK ((timeline = 'observed') = (branch = 'main')),
    CHECK (timeline <> 'observed' OR valid_from <= recorded_at),
    CHECK (geom IS NULL OR (NOT ST_IsEmpty(geom) AND ST_IsValid(geom)
        AND ST_XMin(geom) >= -180 AND ST_XMax(geom) <= 180
        AND ST_YMin(geom) >= -90 AND ST_YMax(geom) <= 90))
);
CREATE INDEX event_history ON twin.event
    (timeline, branch, matrix, entity_id, valid_from DESC, seq DESC);
CREATE INDEX event_geometry ON twin.event USING gist(geom);
CREATE INDEX event_recorded ON twin.event(recorded_at, seq);

CREATE TABLE twin.evidence_link (
    event_seq bigint NOT NULL REFERENCES twin.event(seq),
    evidence_event_id uuid NOT NULL REFERENCES twin.event(event_id),
    relationship text NOT NULL CHECK (relationship IN ('derived_from','observes','validates','reviewed_by','supersedes')),
    PRIMARY KEY (event_seq, evidence_event_id, relationship)
);
CREATE INDEX evidence_reverse ON twin.evidence_link(evidence_event_id);
CREATE TABLE twin.audit (
    event_seq bigint PRIMARY KEY REFERENCES twin.event(seq),
    event_id uuid NOT NULL,
    recorded_at timestamptz NOT NULL,
    actor text NOT NULL,
    action text NOT NULL,
    digest text NOT NULL
);
CREATE FUNCTION twin.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Twin history is append-only';
END $$;
CREATE FUNCTION twin.record_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO twin.audit VALUES (NEW.seq, NEW.event_id, NEW.recorded_at,
        NEW.body->'source'->>'authority', NEW.operation, NEW.digest);
    RETURN NEW;
END $$;
CREATE TRIGGER event_history_immutable BEFORE UPDATE OR DELETE ON twin.event
    FOR EACH ROW EXECUTE FUNCTION twin.reject_mutation();
CREATE TRIGGER event_no_truncate BEFORE TRUNCATE ON twin.event
    FOR EACH STATEMENT EXECUTE FUNCTION twin.reject_mutation();
CREATE TRIGGER audit_history_immutable BEFORE UPDATE OR DELETE ON twin.audit
    FOR EACH ROW EXECUTE FUNCTION twin.reject_mutation();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON twin.audit
    FOR EACH STATEMENT EXECUTE FUNCTION twin.reject_mutation();
CREATE TRIGGER evidence_history_immutable BEFORE UPDATE OR DELETE ON twin.evidence_link
    FOR EACH ROW EXECUTE FUNCTION twin.reject_mutation();
CREATE TRIGGER evidence_no_truncate BEFORE TRUNCATE ON twin.evidence_link
    FOR EACH STATEMENT EXECUTE FUNCTION twin.reject_mutation();
CREATE TRIGGER event_audit AFTER INSERT ON twin.event
    FOR EACH ROW EXECUTE FUNCTION twin.record_audit();

CREATE TABLE twin.outbox (
    event_seq bigint NOT NULL REFERENCES twin.event(seq),
    destination text NOT NULL CHECK (destination IN ('kafka','pgstac')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    delivered_at timestamptz,
    last_error text,
    PRIMARY KEY (event_seq, destination)
);
CREATE INDEX outbox_pending ON twin.outbox(destination, available_at, event_seq)
    WHERE delivered_at IS NULL;

-- Valid intervals are computed from the revisions visible at the knowledge cutoff.
CREATE FUNCTION twin.snapshot(p_valid timestamptz, p_known timestamptz,
    p_timeline text, p_branch text, p_max_seq bigint DEFAULT 9223372036854775807) RETURNS SETOF twin.event LANGUAGE sql STABLE AS $$
    SELECT * FROM (
        SELECT DISTINCT ON (e.matrix, e.entity_id) e.*
        FROM twin.event e
        WHERE e.timeline = p_timeline AND e.branch = p_branch
            AND e.valid_from <= p_valid AND e.recorded_at <= p_known AND e.seq <= p_max_seq
        ORDER BY e.matrix, e.entity_id, e.valid_from DESC, e.seq DESC
    ) chosen WHERE chosen.operation <> 'retire'
$$;
CREATE VIEW twin.temporal_period AS
    SELECT event_id, matrix, entity_id, timeline, branch, operation,
        tstzrange(valid_from, lead(valid_from) OVER (
            PARTITION BY matrix, entity_id, timeline, branch ORDER BY valid_from
        ), '[)') AS valid_period, recorded_at
    FROM (
        SELECT DISTINCT ON (matrix, entity_id, timeline, branch, valid_from) *
        FROM twin.event
        ORDER BY matrix, entity_id, timeline, branch, valid_from, seq DESC
    ) revisions;

CREATE MATERIALIZED VIEW twin.current_state AS
    SELECT * FROM twin.snapshot(statement_timestamp(), statement_timestamp(), 'observed', 'main');
CREATE UNIQUE INDEX current_identity ON twin.current_state(matrix, entity_id);
CREATE INDEX current_geometry ON twin.current_state USING gist(geom);
CREATE MATERIALIZED VIEW twin.matrix_counts AS
    SELECT matrix, count(*) AS entity_count FROM twin.current_state GROUP BY matrix;
CREATE UNIQUE INDEX matrix_counts_identity ON twin.matrix_counts(matrix);
