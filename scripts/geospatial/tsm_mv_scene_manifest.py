#!/usr/bin/env python3
"""Create a checksum-pinned UE-local GeoJSON scene manifest, without inferring CRS.

Does not convert coordinates or certify inputs. Use only AFTER an independently
reviewed GDAL/PROJ conversion from source files into EAST_SOUTH_UP centimeters.
"""
import argparse
import json
import math
import os
import tempfile
import sys
from pathlib import Path

SCHEMA = "tsm.mount-vernon.scene.v1"
FILES = ("buildings", "roads", "trees")


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
    if args.evidence_status == "SOURCE_REVIEWED" and args.vertical_datum != "NAVD88_REVIEWED":
        p.error("Only reviewed vertical evidence can be marked SOURCE_REVIEWED")
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tsm-native/Content/Python"))
    from tsm_mv_scene_contract import sha256_file, validate_scene

    root = args.scene_dir.expanduser().resolve(strict=True)
    manifest_path = root / "manifest.json"
    if manifest_path.exists():
        p.error("manifest already exists; never overwrite without a new reviewed snapshot")
    file_map = {}
    for name in FILES:
        path = root / (name + ".geojson")
        if not path.is_file() or path.is_symlink():
            p.error("missing/unsafe " + str(path))
        file_map[name] = {"path": path.name, "sha256": sha256_file(path)}
    output = {
        "schema": SCHEMA, "coordinate_frame": "UE_LOCAL_CM",
        "axes": "EAST_SOUTH_UP", "source_horizontal_crs": args.source_crs,
        "vertical_datum": args.vertical_datum, "evidence_status": args.evidence_status,
        "source_anchor": {"easting": args.anchor_x, "northing": args.anchor_y,
                          "units": args.units}, "files": file_map}
    validate_scene(root, output)
    # Publish only a complete manifest, without replacing a concurrent writer.
    with tempfile.NamedTemporaryFile(dir=root, mode="w", encoding="utf-8", delete=False) as out:
        temporary = Path(out.name)
        try:
            out.write(json.dumps(output, indent=2, sort_keys=True) + "\n")
            out.close()
            os.link(temporary, manifest_path)
        finally:
            temporary.unlink(missing_ok=True)
    print(json.dumps({"manifest": str(manifest_path), "sha256": sha256_file(manifest_path)}, indent=2))


if __name__ == "__main__":
    main()
