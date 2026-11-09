#!/usr/bin/env python3
"""PostGIS integration smoke test. Requires TSM_POSTGIS_DSN, psycopg3 and a migrated DB.

No writes to government production tables. A rollback-only test transaction verifies
PostGIS geography availability and the actual government source/dataset/feature schema.
"""
from __future__ import annotations
import os
import sys

def verify(connect=None) -> dict:
    if connect is None:
        import psycopg
        connect = psycopg.connect
    dsn = os.environ.get("TSM_POSTGIS_DSN")
    if not dsn:
        raise RuntimeError("TSM_POSTGIS_DSN_REQUIRED")
    with connect(dsn) as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT PostGIS_Version()")
            version = cursor.fetchone()[0]
            cursor.execute(
                "SELECT to_regclass('government.source'), "
                "to_regclass('government.dataset'), "
                "to_regclass('government.feature')"
            )
            tables = cursor.fetchone()
            if any(table is None for table in tables):
                raise RuntimeError("GOVERNMENT_SCHEMA_INCOMPLETE")
            cursor.execute("SELECT ST_SRID(ST_SetSRID(ST_MakePoint(-87.9,37.9),4326))")
            if cursor.fetchone()[0] != 4326:
                raise RuntimeError("POSTGIS_SRID_TEST_FAILED")
            conn.rollback()
    return {"postgis_version": version, "tables": list(map(str, tables)),
            "test": "PASSED", "status": "SCHEMA_SMOKE_ONLY"}

if __name__ == "__main__":
    try:
        import json
        print(json.dumps(verify(), indent=2))
    except Exception as exc:
        print(f"POSTGIS_CHECK_FAILED: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
