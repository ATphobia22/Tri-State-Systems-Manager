#!/usr/bin/env python3
"""Non-certifying Posey DEM integrity gate: validates file hashes and horizontal CRS only."""
import argparse
import hashlib
import json
from pathlib import Path


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def inspect(paths, expected_hashes, expected_epsg=2968):
    import rasterio
    rasters = []
    for path in paths:
        with rasterio.open(path) as raster:
            epsg = raster.crs.to_epsg() if raster.crs else None
            checksum = sha256(path)
            expected = expected_hashes.get(path.name)
            tags = {**raster.tags(), **raster.tags(1)}
            vertical_tags = {key: value for key, value in tags.items()
                             if any(token in key.lower() for token in
                                    ("vertical", "vert_datum", "geoid", "unit"))}
            valid = expected is not None and expected == checksum and epsg == expected_epsg
            rasters.append({
                "filename": path.name, "sha256": checksum, "expected_sha256": expected,
                "checksum_verified": expected is not None and checksum == expected,
                "horizontal_epsg": epsg, "expected_horizontal_epsg": expected_epsg,
                "horizontal_crs_verified": epsg == expected_epsg,
                "dimensions": [raster.width, raster.height], "band_count": raster.count,
                "resolution_native": list(raster.res), "vertical_metadata_observed": vertical_tags,
                "vertical_datum_verified": False, "vertical_units_verified": False,
                "source_integrity_pass": valid,
            })
    return {
        "schema": "tsm.posey-dem-evidence-gate.v1",
        "rasters": rasters,
        "all_source_integrity_pass": bool(rasters) and all(r["source_integrity_pass"] for r in rasters),
        "safe_for_navd88_engineering": False,
        "engineering_blockers": [
            "vertical datum not independently verified",
            "vertical raster-value units not independently verified",
            "EPSG:2968 horizontal frame differs from TSM EPSG:2966 baseline",
            "no approved horizontal datum transformation performed",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dem", nargs="+", required=True, type=Path)
    parser.add_argument("--receipt", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    receipt = json.loads(args.receipt.read_text())
    original = {entry["filename"].rsplit(".", 1)[0]: entry["sha256"]
                for entry in receipt["results"]}
    expected = {path.name: original.get(path.stem) for path in args.dem}
    report = inspect(args.dem, expected)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    data = (json.dumps(report, sort_keys=True, indent=2) + "\n").encode()
    args.out.write_bytes(data)
    args.out.with_suffix(args.out.suffix + ".sha256").write_text(
        hashlib.sha256(data).hexdigest() + "  " + args.out.name + "\n")
    print(json.dumps({"all_source_integrity_pass": report["all_source_integrity_pass"],
                      "safe_for_navd88_engineering": report["safe_for_navd88_engineering"]}))
    return 0 if report["all_source_integrity_pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
