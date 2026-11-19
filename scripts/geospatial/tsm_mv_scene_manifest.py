#!/usr/bin/env python3
"""Create a checksum-pinned UE-local GeoJSON scene manifest, without inferring CRS.

Does not convert coordinates or certify inputs. Use only AFTER an independently
reviewed GDAL/PROJ conversion from source files into EAST_SOUTH_UP centimeters.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

SCHEMA = "tsm.mount-vernon.scene.v1"
FILES = ("buildings", "roads", "trees")


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as src:
        for chunk in iter(lambda: src.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("scene_dir", type=Path)
    p.add_argument("--source-crs", required=True)
    p.add_argument("--anchor-x", type=float, required=True)
    p.add_argument("--anchor-y", type=float, required=True)
    p.add_argument("--units", required=True, choices=("meter", "us_survey_foot"))
    p.add_argument("--vertical-datum", required=True,
                   choices=("UNVERIFIED", "NAVD88_REVIEW_PENDING", "NAVD88_REVIEWED"))
    p.add_argument("--evidence-status", default="PENDING_EVIDENCE",
                   choices=("PENDING_EVIDENCE", "SOURCE_REVIEWED"))
    args = p.parse_args(argv)
    if not args.source_crs.startswith("EPSG:") or not args.source_crs[5:].isdigit():
        p.error("source-crs must be an explicit EPSG code")
    if not all(math.isfinite(x) for x in (args.anchor_x, args.anchor_y)):
        p.error("source anchor coordinates must be finite")
    root = args.scene_dir.expanduser().resolve(strict=True)
    manifest_path = root / "manifest.json"
    if manifest_path.exists():
        p.error("manifest already exists; never overwrite without a new reviewed snapshot")
    file_map = {}
    for name in FILES:
        path = root / (name + ".geojson")
        if not path.is_file() or path.is_symlink():
            p.error("missing/unsafe " + str(path))
        file_map[name] = {"path": path.name, "sha256": sha(path)}
    output = {
        "schema": SCHEMA, "coordinate_frame": "UE_LOCAL_CM",
        "axes": "EAST_SOUTH_UP", "source_horizontal_crs": args.source_crs,
        "vertical_datum": args.vertical_datum, "evidence_status": args.evidence_status,
        "source_anchor": {"easting": args.anchor_x, "northing": args.anchor_y,
                          "units": args.units}, "files": file_map}
    # Validate before persisting; import path is checked at top level.
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tsm-native/Content/Python"))
    from tsm_mv_scene_contract import load_scene
    try:
        with manifest_path.open("x", encoding="utf-8") as out:
            out.write(json.dumps(output, indent=2, sort_keys=True) + "\n")
        load_scene(root)
    except Exception:
        manifest_path.unlink(missing_ok=True)
        raise
    print("Wrote validated local manifest:", manifest_path)
    print("SHA-256:", sha(manifest_path))


if __name__ == "__main__":
    main()
