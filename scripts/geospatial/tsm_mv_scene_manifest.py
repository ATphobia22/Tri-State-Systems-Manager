#!/usr/bin/env python3
"""Pin a UE_LOCAL_CM Mount Vernon scene to immutable source-documenting checksums.

This tool validates PRECONVERTED local scene GeoJSON. It does not reproject,
decode LiDAR height, establish NAVD88, or silently infer survey anchors.
"""
import argparse
import hashlib
import json
import math
import re
import sys
from pathlib import Path


def _sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scene_dir", type=Path)
    parser.add_argument("--source-crs", required=True)
    parser.add_argument("--anchor-x", type=float, required=True)
    parser.add_argument("--anchor-y", type=float, required=True)
    parser.add_argument("--units", required=True, choices=("meter", "us_survey_foot"))
    parser.add_argument("--vertical-datum", required=True,
                        choices=("UNVERIFIED", "NAVD88_REVIEW_PENDING", "NAVD88_REVIEWED"))
    parser.add_argument("--evidence-status", default="PENDING_EVIDENCE",
                        choices=("PENDING_EVIDENCE", "SOURCE_REVIEWED"))
    args = parser.parse_args(argv)

    if not re.fullmatch(r"EPSG:[0-9]{4,6}", args.source_crs):
        parser.error("Provide the reviewed source EPSG code (e.g. EPSG:2968)")
    if not all(math.isfinite(v) for v in (args.anchor_x, args.anchor_y)):
        parser.error("Source anchor coordinates must be finite")
    if args.evidence_status == "SOURCE_REVIEWED" and args.vertical_datum != "NAVD88_REVIEWED":
        parser.error("Only reviewed vertical evidence can be marked SOURCE_REVIEWED")

    root = args.scene_dir.expanduser().resolve(strict=True)
    out = root / "manifest.json"
    if out.exists() or out.is_symlink():
        parser.error("Immutable scene manifest already exists; use a fresh snapshot folder")
    files = {}
    for role in ("buildings", "roads", "trees"):
        file = root / (role + ".geojson")
        if not file.is_file() or file.is_symlink():
            parser.error("Scene requires a real, local " + role + ".geojson")
        files[role] = {"path": file.name, "sha256": _sha256(file)}
    manifest = {
        "schema": "tsm.mount-vernon.scene.v1",
        "coordinate_frame": "UE_LOCAL_CM",
        "axes": "EAST_SOUTH_UP",
        "source_horizontal_crs": args.source_crs,
        "source_anchor": {
            "easting": args.anchor_x, "northing": args.anchor_y, "units": args.units,
        },
        "vertical_datum": args.vertical_datum,
        "evidence_status": args.evidence_status,
        "files": files,
    }
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tsm-native/Content/Python"))
    from tsm_mv_scene_contract import load_scene

    try:
        with out.open("x", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2, sort_keys=True)
            f.write("\n")
        load_scene(root)
    except Exception:
        out.unlink(missing_ok=True)
        raise
    print(json.dumps({"manifest": str(out), "sha256": _sha256(out)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
