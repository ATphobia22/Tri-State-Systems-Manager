"""Apply ``database/migrations/*.sql`` in order, idempotently.

Usage (from the repo root; no Docker required)::

    export TSM_POSTGRES_DSN="postgresql://user@127.0.0.1:5432/tsm"
    python3 scripts/run_migrations.py [--migrations-dir database/migrations]

Behaviour:
- Discovers ``*.sql`` files in filename order and applies each one whose
  version (the filename stem, e.g. ``097_tsm_ingestion_gaps``) is not yet in
  ``tsm.schema_migrations``.
- Applies each migration in a transaction: on failure the connection is
  rolled back and the error propagates; nothing is marked applied.
- Records version + SHA-256 checksum of the file bytes + applier in
  ``tsm.schema_migrations``. Migration files also self-record their version
  (without a checksum), so the record step uses ``ON CONFLICT DO UPDATE``
  to fill in a missing checksum without overwriting one already stored.
- Re-runs verify stored checksums before applying pending work. Legacy null
  checksums produce explicit warnings and are never retroactively invented.
- A session advisory lock excludes another canonical runner. The ledger is
  created before its first query, so an empty database can bootstrap.
- Ordinary outer BEGIN/COMMIT wrappers are removed from trusted repository SQL
  so DDL and ledger writes share the connection transaction. Other top-level
  transaction control is rejected; this is not a sandbox for untrusted SQL.
- The Postgres DSN comes only from the required ``TSM_POSTGRES_DSN``
  environment variable. There is no default DSN and no password anywhere in
  this file; a missing variable fails loudly before any connection attempt.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psycopg2
import sqlparse
from sqlparse import tokens as sql_tokens

DSN_ENV_VAR = "TSM_POSTGRES_DSN"
DEFAULT_APPLIER = "run_migrations.py"
REPO_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Migration:
    version: str
    path: Path
    checksum_sha256: str


def resolve_dsn(env: Any = os.environ) -> str:
    """Return the required Postgres DSN, or fail loudly when it is absent."""
    dsn = str(env.get(DSN_ENV_VAR, "") or "").strip()
    if not dsn:
        raise SystemExit(
            f"ERROR: {DSN_ENV_VAR} environment variable is required and must "
            "contain a Postgres DSN. No default DSN exists (a default DSN "
            "would have to carry a password)."
        )
    return dsn


def discover_migrations(migrations_dir: Path) -> list[Migration]:
    """Return ``*.sql`` migrations in filename order with SHA-256 checksums."""
    if not migrations_dir.is_dir():
        raise FileNotFoundError(f"Migration directory does not exist: {migrations_dir}")
    migrations: list[Migration] = []
    for path in sorted(Path(migrations_dir).glob("*.sql")):
        data = path.read_bytes()
        migrations.append(
            Migration(
                version=path.stem,
                path=path,
                checksum_sha256=hashlib.sha256(data).hexdigest(),
            )
        )
    return migrations


def get_applied_versions(conn: Any) -> set[str]:
    """Return the set of versions already recorded in tsm.schema_migrations."""
    with conn.cursor() as cur:
        cur.execute("SELECT version FROM tsm.schema_migrations")
        return {row[0] for row in cur.fetchall()}


def get_applied_checksums(conn: Any) -> dict[str, str | None]:
    with conn.cursor() as cur:
        cur.execute("SELECT version, checksum_sha256 FROM tsm.schema_migrations")
        return dict(cur.fetchall())


def managed_sql(raw: bytes) -> str:
    """Keep ordinary BEGIN/COMMIT wrappers under the runner's transaction.

    This processes trusted repository SQL, not arbitrary untrusted SQL. Other
    top-level transaction controls are rejected; dollar-quoted functions remain
    intact. Nontransactional operations need a separately reviewed runner.
    """
    statements = list(sqlparse.parse(raw.decode("utf-8")))
    def words(stmt):
        return [t.normalized for t in stmt.flatten()
                if not t.is_whitespace and t.ttype not in sql_tokens.Comment
                and t.value != ";"]
    statements = [s for s in statements if words(s)]
    if statements and words(statements[0]) == ["BEGIN"]:
        if words(statements[-1]) != ["COMMIT"]:
            raise ValueError("Migration BEGIN requires an outer COMMIT")
        statements = statements[1:-1]
    for statement in statements:
        w = words(statement)
        if w[0] in {"BEGIN", "COMMIT", "ROLLBACK", "ABORT", "END", "SAVEPOINT", "RELEASE"} or w[:2] in (["START", "TRANSACTION"], ["PREPARE", "TRANSACTION"], ["SET", "TRANSACTION"]):
            raise ValueError("Embedded transaction control is unsupported")
    return "\n".join(str(s) for s in statements)


def ensure_ledger(conn: Any) -> None:
    """Create only the canonical ledger so a fresh database can bootstrap."""
    with conn.cursor() as cur:
        cur.execute("CREATE SCHEMA IF NOT EXISTS tsm")
        cur.execute("""CREATE TABLE IF NOT EXISTS tsm.schema_migrations (
            version text PRIMARY KEY,
            applied_at timestamptz NOT NULL DEFAULT now(),
            checksum_sha256 char(64),
            applied_by text NOT NULL DEFAULT current_user)""")
    conn.commit()


def apply_migration(conn: Any, migration: Migration, applier: str) -> None:
    """Apply one migration in a transaction and record version + checksum.

    Rolls back and re-raises on any failure so a failed migration is never
    marked applied.
    """
    try:
        with conn.cursor() as cur:
            raw = migration.path.read_bytes()
            if hashlib.sha256(raw).hexdigest() != migration.checksum_sha256:
                raise ValueError(f"Migration bytes changed after discovery: {migration.version}")
            cur.execute(managed_sql(raw))
            cur.execute(
                "INSERT INTO tsm.schema_migrations"
                "(version, checksum_sha256, applied_by) VALUES (%s, %s, %s)"
                " ON CONFLICT (version) DO UPDATE SET"
                " checksum_sha256 = COALESCE("
                "tsm.schema_migrations.checksum_sha256, EXCLUDED.checksum_sha256)",
                (migration.version, migration.checksum_sha256, applier),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def run(
    conn: Any, migrations_dir: Path, applier: str = DEFAULT_APPLIER
) -> dict[str, list[str]]:
    """Use a dedicated connection to apply pending migrations. Returns {'applied': [...], 'skipped': [...]}."""
    if getattr(conn, "autocommit", False):
        raise ValueError("Migration runner requires a dedicated non-autocommit connection")
    migrations = discover_migrations(migrations_dir)
    lock_key = 0x54534D4D494752  # stable session lock for the canonical TSM ledger
    with conn.cursor() as cur:
        cur.execute("SELECT pg_try_advisory_lock(%s)", (lock_key,))
        acquired = cur.fetchone()[0]
    if not acquired:
        conn.rollback()
        raise RuntimeError("Another TSM migration runner holds the ledger lock")
    try:
        ensure_ledger(conn)
        already = get_applied_checksums(conn)
        # Check every recorded digest before applying any pending migration.
        for migration in migrations:
            if migration.version not in already:
                continue
            recorded = already[migration.version]
            if recorded is None:
                warnings.warn(f"Legacy migration has no verifiable checksum: {migration.version}", RuntimeWarning)
            elif recorded.strip() != migration.checksum_sha256:
                raise ValueError(f"Applied migration checksum mismatch: {migration.version}")
        applied, skipped = [], []
        for migration in migrations:
            if migration.version in already:
                skipped.append(migration.version)
            else:
                apply_migration(conn, migration, applier)
                applied.append(migration.version)
        return {"applied": applied, "skipped": skipped}
    finally:
        # Session locks survive rollback; release explicitly even on SQL failure.
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_unlock(%s)", (lock_key,))
        conn.commit()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--migrations-dir",
        type=Path,
        default=REPO_ROOT / "database" / "migrations",
        help="Directory of *.sql migration files (default: database/migrations).",
    )
    parser.add_argument(
        "--applier",
        default=DEFAULT_APPLIER,
        help="Value recorded as applied_by in tsm.schema_migrations.",
    )
    args = parser.parse_args(argv)
    dsn = resolve_dsn()
    conn = psycopg2.connect(dsn)
    try:
        result = run(conn, args.migrations_dir, args.applier)
    finally:
        conn.close()
    print(f"Applied: {result['applied'] or 'none'}")
    print(f"Skipped (already applied): {result['skipped'] or 'none'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
