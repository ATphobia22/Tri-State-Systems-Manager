"""Tests for scripts/run_migrations.py — no live Postgres required.

A stubbed DBAPI connection records every statement, so these tests cover
discovery ordering, skip-if-applied, checksum recording, and transaction
use (commit per applied migration, rollback on failure) without a database.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from scripts.run_migrations import (
    Migration,
    apply_migration,
    discover_migrations,
    get_applied_versions,
    resolve_dsn,
    run,
)


class FakeCursor:
    def __init__(self, applied_versions: set[str], fail_on: str | None = None):
        self.executed: list[tuple[str, tuple | None]] = []
        self.applied_versions = applied_versions
        self.fail_on = fail_on

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        self.executed.append((sql, params))
        if self.fail_on is not None and self.fail_on in sql:
            raise RuntimeError(f"simulated failure in: {sql[:60]}")

    def fetchall(self):
        return [(version,) for version in sorted(self.applied_versions)]


class FakeConnection:
    def __init__(self, applied_versions=None, fail_on: str | None = None):
        self.applied_versions: set[str] = set(applied_versions or set())
        self.fail_on = fail_on
        self.cursors: list[FakeCursor] = []
        self.commits = 0
        self.rollbacks = 0
        self.closed = False

    def cursor(self):
        cur = FakeCursor(self.applied_versions, self.fail_on)
        self.cursors.append(cur)
        return cur

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed = True

    @property
    def executed(self):
        return [stmt for cur in self.cursors for stmt in cur.executed]


def _write_migrations(tmp_path: Path, files: dict[str, str]) -> Path:
    migrations_dir = tmp_path / "migrations"
    migrations_dir.mkdir()
    for name, sql in files.items():
        (migrations_dir / name).write_text(sql, encoding="utf-8")
    return migrations_dir


def test_discover_migrations_orders_by_filename_and_hashes_bytes(tmp_path):
    migrations_dir = _write_migrations(
        tmp_path,
        {
            "010_second.sql": "SELECT 10;",
            "001_first.sql": "SELECT 1;",
            "002_middle.sql": "SELECT 2;",
            "notes.txt": "not a migration",
        },
    )
    found = discover_migrations(migrations_dir)
    assert [m.version for m in found] == ["001_first", "002_middle", "010_second"]
    assert found[0].checksum_sha256 == hashlib.sha256(b"SELECT 1;").hexdigest()
    assert all(len(m.checksum_sha256) == 64 for m in found)


def test_run_skips_applied_versions_and_applies_the_rest_in_order(tmp_path):
    migrations_dir = _write_migrations(
        tmp_path,
        {"001_a.sql": "SELECT 1;", "002_b.sql": "SELECT 2;", "003_c.sql": "SELECT 3;"},
    )
    conn = FakeConnection(applied_versions={"001_a"})
    result = run(conn, migrations_dir, applier="test-runner")
    assert result == {"applied": ["002_b", "003_c"], "skipped": ["001_a"]}
    applied_sql = [sql for sql, _ in conn.executed if sql.startswith("SELECT") and "schema_migrations" not in sql]
    assert applied_sql == ["SELECT 2;", "SELECT 3;"]
    assert "SELECT 1;" not in applied_sql


def test_run_records_version_checksum_and_applier(tmp_path):
    sql = "CREATE TABLE tsm.example (id int);"
    migrations_dir = _write_migrations(tmp_path, {"001_a.sql": sql})
    conn = FakeConnection()
    run(conn, migrations_dir, applier="test-runner")
    record_stmts = [
        (stmt, params) for stmt, params in conn.executed if stmt.startswith("INSERT INTO tsm.schema_migrations")
    ]
    assert len(record_stmts) == 1
    stmt, params = record_stmts[0]
    assert "ON CONFLICT (version) DO UPDATE" in stmt
    assert params == ("001_a", hashlib.sha256(sql.encode()).hexdigest(), "test-runner")


def test_run_is_idempotent_on_rerun(tmp_path):
    migrations_dir = _write_migrations(tmp_path, {"001_a.sql": "SELECT 1;"})
    conn = FakeConnection()
    assert run(conn, migrations_dir)["applied"] == ["001_a"]
    # Second run sees the version as applied and applies nothing.
    conn2 = FakeConnection(applied_versions={"001_a"})
    assert run(conn2, migrations_dir) == {"applied": [], "skipped": ["001_a"]}
    assert conn2.commits == 0


def test_apply_migration_commits_once_per_migration(tmp_path):
    migrations_dir = _write_migrations(
        tmp_path, {"001_a.sql": "SELECT 1;", "002_b.sql": "SELECT 2;"}
    )
    conn = FakeConnection()
    run(conn, migrations_dir)
    assert conn.commits == 2
    assert conn.rollbacks == 0


def test_apply_migration_rolls_back_and_raises_on_failure(tmp_path):
    migrations_dir = _write_migrations(
        tmp_path, {"001_a.sql": "SELECT 1;", "002_b.sql": "BOOM; SELECT 2;"}
    )
    conn = FakeConnection(fail_on="BOOM")
    with pytest.raises(RuntimeError, match="simulated failure"):
        run(conn, migrations_dir)
    assert conn.commits == 1  # 001_a committed; 002_b rolled back
    assert conn.rollbacks == 1


def test_get_applied_versions_reads_schema_migrations():
    conn = FakeConnection(applied_versions={"001_a", "097_x"})
    assert get_applied_versions(conn) == {"001_a", "097_x"}


def test_resolve_dsn_requires_the_env_var(monkeypatch):
    monkeypatch.setenv("TSM_POSTGRES_DSN", "postgresql://user@127.0.0.1:5432/tsm")
    assert resolve_dsn() == "postgresql://user@127.0.0.1:5432/tsm"
    monkeypatch.delenv("TSM_POSTGRES_DSN")
    with pytest.raises(SystemExit, match="TSM_POSTGRES_DSN"):
        resolve_dsn()
    monkeypatch.setenv("TSM_POSTGRES_DSN", "   ")
    with pytest.raises(SystemExit, match="TSM_POSTGRES_DSN"):
        resolve_dsn()


def test_discover_migrations_on_empty_dir(tmp_path):
    assert discover_migrations(tmp_path) == []
