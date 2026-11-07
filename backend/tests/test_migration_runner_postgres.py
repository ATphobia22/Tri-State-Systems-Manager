"""Real PostgreSQL checks, isolated in a new disposable database per test.

Set TSM_TEST_POSTGRES_DSN to a test server role allowed to CREATE DATABASE.
No existing database or schema is dropped or modified by these tests.
"""
import os
import uuid
from pathlib import Path

import psycopg2
from psycopg2 import sql
import pytest

from scripts.run_migrations import ensure_ledger, run


@pytest.fixture
def db():
    dsn = os.environ.get("TSM_TEST_POSTGRES_DSN")
    if not dsn:
        pytest.skip("TSM_TEST_POSTGRES_DSN is not configured")
    admin = psycopg2.connect(dsn)
    admin.autocommit = True
    name = "tsm_migration_test_" + uuid.uuid4().hex
    with admin.cursor() as cur:
        cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
    conn = psycopg2.connect(dsn, dbname=name)
    try:
        yield conn
    finally:
        conn.close()
        with admin.cursor() as cur:
            cur.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(name)))
        admin.close()


def migrations(tmp_path: Path, files):
    for name, body in files.items():
        (tmp_path / name).write_text(body)
    return tmp_path


def test_fresh_database_rerun_and_checksum_drift(db, tmp_path):
    folder = migrations(tmp_path, {"001_a.sql": "BEGIN; CREATE TABLE public.sample(id int); COMMIT;"})
    assert run(db, folder)["applied"] == ["001_a"]
    assert run(db, folder)["skipped"] == ["001_a"]
    (folder / "001_a.sql").write_text("SELECT 42;")
    (folder / "002_b.sql").write_text("CREATE TABLE public.should_not_exist(id int);")
    with pytest.raises(ValueError, match="checksum mismatch"):
        run(db, folder)
    with db.cursor() as cur:
        cur.execute("SELECT to_regclass('public.should_not_exist')")
        assert cur.fetchone()[0] is None


def test_wrapped_sql_and_ledger_failure_roll_back_together(db, tmp_path):
    ensure_ledger(db)
    with db.cursor() as cur:
        cur.execute("""CREATE FUNCTION tsm.reject_record() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'ledger write rejected'; END; $$ LANGUAGE plpgsql;
        CREATE TRIGGER reject_record BEFORE INSERT ON tsm.schema_migrations
        FOR EACH ROW EXECUTE FUNCTION tsm.reject_record();""")
    db.commit()
    folder = migrations(tmp_path, {"001_a.sql": "BEGIN; CREATE TABLE public.rollback_sample(id int); COMMIT;"})
    with pytest.raises(psycopg2.Error, match="ledger write rejected"):
        run(db, folder)
    with db.cursor() as cur:
        cur.execute("SELECT to_regclass('public.rollback_sample')")
        assert cur.fetchone()[0] is None
        cur.execute("SELECT count(*) FROM tsm.schema_migrations")
        assert cur.fetchone()[0] == 0
    # The failed run must release its session lock so a second connection can run.
    other = psycopg2.connect(os.environ["TSM_TEST_POSTGRES_DSN"], dbname=db.info.dbname)
    empty = tmp_path / "empty"
    empty.mkdir()
    try:
        assert run(other, empty) == {"applied": [], "skipped": []}
    finally:
        other.close()


def test_legacy_null_digest_is_reported_without_backfilling(db, tmp_path):
    ensure_ledger(db)
    with db.cursor() as cur:
        cur.execute("INSERT INTO tsm.schema_migrations(version) VALUES ('001_a')")
    db.commit()
    folder = migrations(tmp_path, {"001_a.sql": "SELECT 1;"})
    with pytest.warns(RuntimeWarning, match="no verifiable checksum"):
        assert run(db, folder)["skipped"] == ["001_a"]
    with db.cursor() as cur:
        cur.execute("SELECT checksum_sha256 FROM tsm.schema_migrations WHERE version='001_a'")
        assert cur.fetchone()[0] is None
