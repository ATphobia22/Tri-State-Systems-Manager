#!/usr/bin/env python3
"""Verify a FEMA panel file's SHA-256 against the panel verification log.

Computes the SHA-256 of a panel file on disk and compares it to the most
recent hash recorded in ``firm_panel_verification_log`` for that panel id.

Fail-closed outcomes:
  - ``verified``    — file hash matches the latest logged hash
  - ``mismatch``    — file hash differs from the latest logged hash
  - ``unverifiable``— no verification row exists for the panel, or the DB
                      cannot be reached

Exit code is 0 only for ``verified``. This script never determines regulatory
effectiveness, SFHA status, or LOMA status.

Usage:
    TSM_DATABASE_URL=postgres://... python verify_panel_hashes.py \
        --panel-id 18129C0265C --file ./panels/18129C0265C.tif
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Any

CHUNK_SIZE = 1024 * 1024


def sha256_file(path: Path) -> str:
    """Return the lowercase hex SHA-256 of a file. Raises on missing file."""
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def latest_logged_hash(conn: Any, panel_id: str) -> str | None:
    """Return the most recent logged hash for a panel, or None if absent."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT panel_file_sha256 FROM firm_panel_verification_log "
            "WHERE panel_id = %s ORDER BY verified_at DESC LIMIT 1",
            (panel_id,),
        )
        row = cur.fetchone()
    return row[0] if row else None


def verify_panel(panel_id: str, file_path: Path, conn: Any) -> dict:
    """Compare a panel file's hash to the verification log. Never raises on
    DB absence: DB errors are reported as ``unverifiable``, not as crashes."""
    if not panel_id or len(panel_id.strip()) < 4:
        return {"panel_id": panel_id, "outcome": "unverifiable",
                "detail": "panel_id missing or implausibly short"}
    try:
        file_hash = sha256_file(file_path)
    except OSError as exc:
        return {"panel_id": panel_id, "outcome": "unverifiable",
                "detail": f"cannot read panel file: {exc}"}

    try:
        recorded = latest_logged_hash(conn, panel_id)
    except Exception as exc:  # DB unreachable, bad schema, etc.
        return {"panel_id": panel_id, "file_sha256": file_hash,
                "outcome": "unverifiable",
                "detail": f"verification log unreachable: {exc}"}

    if recorded is None:
        return {"panel_id": panel_id, "file_sha256": file_hash,
                "outcome": "unverifiable",
                "detail": "no verification row for this panel"}
    if recorded.lower() != file_hash.lower():
        return {"panel_id": panel_id, "file_sha256": file_hash,
                "recorded_sha256": recorded, "outcome": "mismatch",
                "detail": "file hash differs from latest logged hash"}
    return {"panel_id": panel_id, "file_sha256": file_hash,
            "recorded_sha256": recorded, "outcome": "verified",
            "detail": "file hash matches latest logged hash"}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verify a FEMA panel file hash against the verification log.")
    parser.add_argument("--panel-id", required=True)
    parser.add_argument("--file", required=True,
                        help="Path to the panel file on disk.")
    args = parser.parse_args(argv)

    db_url = os.environ.get("TSM_DATABASE_URL")
    if not db_url:
        print("error: TSM_DATABASE_URL is required", file=sys.stderr)
        return 2
    try:
        import psycopg2
    except ImportError:
        print("error: psycopg2 is required", file=sys.stderr)
        return 2

    try:
        conn = psycopg2.connect(db_url)
    except Exception as exc:
        print(json.dumps({"panel_id": args.panel_id, "outcome": "unverifiable",
                          "detail": f"database connection failed: {exc}"}))
        return 1

    with conn:
        result = verify_panel(args.panel_id, Path(args.file), conn)
    print(json.dumps(result, indent=2))
    return 0 if result["outcome"] == "verified" else 1


if __name__ == "__main__":
    raise SystemExit(main())
