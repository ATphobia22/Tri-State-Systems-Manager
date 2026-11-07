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
- Re-runs are idempotent: applied versions are skipped.
- The Postgres DSN comes only from the required ``TSM_POSTGRES_DSN``
  environment variable. There is no default DSN and no password anywhere in
  this file; a missing variable fails loudly before any connection attempt.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psycopg2

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


def apply_migration(conn: Any, migration: Migration, applier: str) -> None:
    """Apply one migration in a transaction and record version + checksum.

    Rolls back and re-raises on any failure so a failed migration is never
    marked applied.
    """
    try:
        with conn.cursor() as cur:
            cur.execute(migration.path.read_text(encoding="utf-8"))
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
    """Apply all pending migrations. Returns {'applied': [...], 'skipped': [...]}."""
    applied: list[str] = []
    skipped: list[str] = []
    already = get_applied_versions(conn)
    for migration in discover_migrations(migrations_dir):
        if migration.version in already:
            skipped.append(migration.version)
            continue
        apply_migration(conn, migration, applier)
        applied.append(migration.version)
    return {"applied": applied, "skipped": skipped}


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
