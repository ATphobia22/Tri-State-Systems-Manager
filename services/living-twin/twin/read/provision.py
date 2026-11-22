"""Provision the local Compose API login without event-store write privileges."""
from psycopg import sql

from ..store import connect


def provision():
    from os import environ

    role = "twin_state_api"
    password = environ["TWIN_STATE_DB_PASSWORD"]
    with connect() as conn:
        conn.execute("SELECT pg_advisory_xact_lock(946322, 3)")
        exists = conn.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (role,)).fetchone()
        verb = sql.SQL("ALTER ROLE") if exists else sql.SQL("CREATE ROLE")
        conn.execute(sql.SQL("{} {} LOGIN PASSWORD {} NOSUPERUSER NOCREATEDB NOCREATEROLE").format(
            verb, sql.Identifier(role), sql.Literal(password),
        ))
        conn.execute("GRANT USAGE ON SCHEMA twin, read_model TO twin_state_api")
        conn.execute("GRANT SELECT ON twin.event TO twin_state_api")
        conn.execute("GRANT SELECT (event_seq,destination,delivered_at) ON twin.outbox TO twin_state_api")
        conn.execute("GRANT SELECT ON ALL TABLES IN SCHEMA read_model TO twin_state_api")
        conn.execute("GRANT INSERT (job_id,target) ON read_model.rebuild_job TO twin_state_api")


if __name__ == "__main__":
    provision()
