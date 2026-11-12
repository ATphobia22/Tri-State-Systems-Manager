#!/usr/bin/env python3
"""Validate a generated eight-county offline bundle against its file inventory."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def verify(manifest_path: Path) -> dict:
    root = manifest_path.resolve().parent
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    if data.get("schema") != "tsm.tristate.offline-screening-layers.v1":
        raise ValueError("Invalid manifest schema")
    if data.get("hydrologic_aoi_approved") is not False or data.get("regulatory_use") is not False:
        raise ValueError("Unreviewed sources cannot imply regulatory authority")
    source = data.get("vector_assets", [])
    raster = data.get("posey_raster", {})
    geopackage = data.get("geopackage")
    rows = source + [raster.get("geoTIFF"), raster.get("previewPNG"), geopackage]
    if len(source) != 16 or len(rows) != 19 or any(not isinstance(v, dict) for v in rows):
        raise ValueError("Expected 16 county line layers, 2 raster outputs and one GeoPackage")
    if geopackage.get("format") != "OGC_GPKG" or geopackage.get("crs") != "EPSG:4326":
        raise ValueError("Incorrect GeoPackage metadata")
    expected = {(c, k) for c in data.get("counties", {}) for k in ("roads", "linearwater")}
    actual = {(row.get("county_geoid"), Path(row["path"]).stem.split("-")[-1]) for row in source}
    if len(expected) != 16 or expected != actual:
        raise ValueError("Eight-county vector inventory is incomplete")
    seen = set()
    for row in rows:
        rel = Path(row["path"])
        if rel.is_absolute() or ".." in rel.parts or str(rel) in seen:
            raise ValueError("Unsafe output path")
        seen.add(str(rel))
        asset = (root / rel).resolve()
        if root not in asset.parents or asset.is_symlink() or not asset.is_file():
            raise ValueError("Missing or escaping offline asset")
        if asset.stat().st_size != row["bytes"]:
            raise ValueError(f"Byte size mismatch: {rel}")
        digest = hashlib.sha256()
        with asset.open("rb") as handle:
            for block in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(block)
        if digest.hexdigest() != row["sha256"]:
            raise ValueError(f"Checksum mismatch: {rel}")
        if row.get("enabled") is not False:
            raise ValueError("Unreviewed offline layer enabled unexpectedly")
    import sqlite3
    db_path = root / geopackage["path"]
    counts = data.get("vector_counts", {})
    expected_roads = sum(row.get("roads", 0) for row in counts.values())
    expected_water = sum(row.get("linearwater", 0) for row in counts.values())
    if geopackage.get("layers") != {
        "roads_2024": expected_roads, "linearwater_2024": expected_water
    }:
        raise ValueError("GeoPackage feature inventory differs from sources")
    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as db:
        for layer, count in (("roads_2024", expected_roads),
                             ("linearwater_2024", expected_water)):
            registered = db.execute("SELECT srs_id FROM gpkg_contents WHERE table_name=?", (layer,)).fetchone()
            if registered != (4326,):
                raise ValueError("GeoPackage layer CRS not EPSG:4326")
            actual_count = db.execute(f"SELECT COUNT(*) FROM {layer}").fetchone()[0]
            if actual_count != count:
                raise ValueError("GeoPackage row count mismatch")
    return {"status": "INTEGRITY_ONLY_VERIFIED", "layers": len(rows),
            "review": "SOURCE_UNREVIEWED", "regulatory_use": False}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--manifest", type=Path, required=True)
    args = ap.parse_args()
    print(json.dumps(verify(args.manifest), sort_keys=True))


if __name__ == "__main__":
    main()
