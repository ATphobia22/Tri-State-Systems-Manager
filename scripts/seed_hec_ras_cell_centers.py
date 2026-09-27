#!/usr/bin/env python3
"""Seed HEC-RAS 2D cell centers into the TSM PostGIS engineering registry.

This is an explicit, operator-run ingestion step. It never truncates the target
table and refuses to invent a source CRS or database connection.
"""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

from backend.engineering.hecras_geometry import read_cell_centers


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--hdf", required=True, type=Path)
    parser.add_argument("--source-crs", required=True)
    parser.add_argument("--flow-area")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    parser.add_argument("--target-crs", default="EPSG:2966")
    args = parser.parse_args()

    if not args.database_url:
        raise SystemExit("DATABASE_URL is required; no database default is permitted")
    if args.target_crs.upper() != "EPSG:2966":
        raise SystemExit("This registry requires target CRS EPSG:2966")
    if not args.hdf.is_file():
        raise SystemExit(f"HEC-RAS HDF5 artifact not found: {args.hdf}")

    source_hash = sha256_file(args.hdf)
    cells = read_cell_centers(
        args.hdf,
        source_crs=args.source_crs,
        target_crs=args.target_crs,
        flow_area=args.flow_area,
    )
    if not cells:
        raise SystemExit("No finite HEC-RAS cell centers were available for ingestion")

    rows = [
        (
            cell.flow_area,
            cell.cell_id,
            cell.easting_ft,
            cell.northing_ft,
            cell.source_x,
            cell.source_y,
            cell.source_crs,
            cell.target_crs,
            source_hash,
            f"{cell.flow_area}:{cell.cell_id}",
        )
        for cell in cells
    ]

    sql = """
        INSERT INTO engineering.hec_ras_cell_centers (
            flow_area_name, cell_id, geom, source_x, source_y, source_crs,
            target_crs, source_artifact_sha256, source_record_id, review_status
        )
        VALUES %s
        ON CONFLICT (flow_area_name, cell_id)
        DO UPDATE SET
            geom = EXCLUDED.geom,
            source_x = EXCLUDED.source_x,
            source_y = EXCLUDED.source_y,
            source_crs = EXCLUDED.source_crs,
            target_crs = EXCLUDED.target_crs,
            source_artifact_sha256 = EXCLUDED.source_artifact_sha256,
            source_record_id = EXCLUDED.source_record_id,
            review_status = 'PENDING_REVIEW',
            updated_at = now()
    """
    template = (
        "(%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 2966), "
        "%s, %s, %s, %s, %s, %s, %s)"
    )

    with psycopg2.connect(args.database_url) as connection:
        with connection.cursor() as cursor:
            execute_values(cursor, sql, rows, template=template, page_size=5000)

    print(f"seeded {len(cells)} HEC-RAS cell centers; source_sha256={source_hash}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
