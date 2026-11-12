#!/usr/bin/env python3
"""Offline cross-state release-data preflight.

Proves hashes and actual GeoTIFF FOOTPRINT coverage against county polygons.
Does not prove interior raster validity, building completeness, regulatory
flood elevations, provenance truth, or independent geodetic acceptance.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from collections import defaultdict
from pathlib import Path

CORE_SIX = ("18129", "21101", "21225", "17193", "17185", "17059")
ENGINEERING_EIGHT = ("18129", "18163", "18051", "18173", "17193", "17059", "21101", "21225")
SCOPES = {
    "community-six": CORE_SIX,
    "engineering-eight": ENGINEERING_EIGHT,
    "combined-nine": tuple(dict.fromkeys(CORE_SIX + ENGINEERING_EIGHT)),
}
REQUIRED_LAYER_KINDS = ("terrain", "imagery", "buildings", "roads", "hydrography")
HEX = re.compile(r"^[0-9a-f]{64}$")
FIPS = re.compile(r"^[0-9]{5}$")
DATE = re.compile(r"^20[0-9]{2}-[0-9]{2}-[0-9]{2}$")


def require(condition: bool, reason: str) -> None:
    if not condition:
        raise ValueError(reason)


def digest(path: Path) -> str:
    hash_object = hashlib.sha256()
    with path.open("rb") as handle:
        for buffer in iter(lambda: handle.read(1024 * 1024), b""):
            hash_object.update(buffer)
    return hash_object.hexdigest()


def checked_file(root: Path, entry: dict, *, field: str = "path") -> Path:
    require(isinstance(entry, dict), "invalid asset descriptor")
    rel = entry.get(field)
    claimed = entry.get("sha256")
    require(isinstance(rel, str) and bool(rel) and "\\" not in rel and "\x00" not in rel,
            "invalid relative asset path")
    require(not Path(rel).is_absolute(), "absolute paths forbidden")
    candidate = root.joinpath(*rel.split("/"))
    require(not any(part in ("", ".", "..") for part in rel.split("/")),
            "path traversal or malformed relative path")
    require(candidate.resolve().is_relative_to(root), "asset outside data root")
    require(candidate.is_file() and not candidate.is_symlink(),
            "asset is missing, non-file or symlinked: " + rel)
    require(isinstance(claimed, str) and HEX.fullmatch(claimed) is not None,
            "real lowercase SHA-256 required: " + rel)
    require(digest(candidate) == claimed, "SHA-256 mismatch: " + rel)
    return candidate


def feature_geom(path: Path, fips: str):
    from shapely.geometry import shape
    from shapely.ops import unary_union
    document = json.loads(path.read_text(encoding="utf-8"))
    if document.get("type") == "FeatureCollection":
        features = document.get("features", [])
    elif document.get("type") == "Feature":
        features = [document]
    else:
        raise ValueError("expected GeoJSON county polygon FeatureCollection")
    polygons = []
    for feature in features:
        props = feature.get("properties", {})
        require(str(props.get("GEOID", props.get("FIPS", ""))) == fips,
                "county polygon GEOID mismatch: " + fips)
        geom = shape(feature["geometry"])
        require(geom.is_valid and not geom.is_empty and geom.geom_type in ("Polygon", "MultiPolygon"),
                "invalid county polygon")
        polygons.append(geom)
    require(bool(polygons), "county boundary geometry absent")
    united = unary_union(polygons)
    require(united.is_valid and not united.is_empty, "county polygon union invalid")
    # A coarse CONUS sanity bound; source identity must also be reviewed by humans.
    west, south, east, north = united.bounds
    require(-92 < west < -80 and 36 < south < 42 and -92 < east < -80 and 36 < north < 42,
            "county boundary outside the project region")
    return united


def raster_extent(path: Path, expected_crs: str):
    import rasterio
    from shapely.geometry import box
    with rasterio.open(path) as dataset:
        require(dataset.crs is not None and dataset.width > 0 and dataset.height > 0,
                "raster lacks usable CRS or pixels")
        require(dataset.crs.to_string() == expected_crs,
                "raster CRS differs from independently recorded source CRS")
        bounds = dataset.bounds
        require(all(math.isfinite(v) for v in bounds), "invalid raster bounds")
        require(bounds.left < bounds.right and bounds.bottom < bounds.top,
                "invalid raster extent")
        return box(bounds.left, bounds.bottom, bounds.right, bounds.top), dataset.crs


def reproject(geom, source_crs):
    from pyproj import Transformer
    from shapely.ops import transform
    transformer = Transformer.from_crs(source_crs, "EPSG:5070", always_xy=True)
    return transform(transformer.transform, geom)


def audit(manifest: dict, data_root: Path, scope: str, minimum_footprint: float = 0.99) -> dict:
    from shapely.ops import unary_union
    require(scope in SCOPES, "unsupported release geography scope")
    require(0.9 <= minimum_footprint <= 1.0, "invalid footprint coverage threshold")
    require(manifest.get("schema") == "tsm.cross-state.release-snapshot.v1", "invalid data contract")
    require(manifest.get("scope") == scope, "release scope mismatch")
    root = data_root.resolve(strict=True)
    require(root.is_dir() and not data_root.is_symlink(), "data root must be a physical directory")
    counties = manifest.get("counties")
    required = SCOPES[scope]
    require(isinstance(counties, dict) and set(counties) == set(required),
            "county manifest must contain exactly the selected scope FIPS, no omissions or extras")
    rows = []
    failures = []
    checked = 0
    for fips in required:
        county = counties[fips]
        require(isinstance(county, dict), "invalid county record")
        boundary_rec = county.get("boundary", {})
        require(isinstance(boundary_rec.get("authority"), str) and boundary_rec["authority"].strip(),
                "boundary authority required")
        original_boundary = feature_geom(checked_file(root, boundary_rec), fips)
        checked += 1
        county_geom = reproject(original_boundary, "EPSG:4326")
        county_area = county_geom.area
        require(county_area > 100.0 and math.isfinite(county_area), "invalid projected county polygon")
        by_kind = defaultdict(list)
        status_by_kind = {}
        assets = county.get("assets")
        require(isinstance(assets, list), "county assets must be a list")
        for entry in assets:
            kind = entry.get("kind")
            require(kind in REQUIRED_LAYER_KINDS, "unrecognized required layer type")
            file = checked_file(root, entry)
            checked += 1
            for field in ("source_id", "source_url", "acquired_at", "retrieved_at", "source_crs"):
                require(isinstance(entry.get(field), str) and bool(entry[field].strip()),
                        "missing source metadata: " + field)
            require(entry["source_url"].startswith("https://"), "source URL must be HTTPS")
            for field in ("acquired_at", "retrieved_at"):
                require(DATE.fullmatch(entry[field]) is not None, "invalid source date")
            if kind in ("terrain", "imagery"):
                require(file.suffix.lower() in (".tif", ".tiff"), "spatial raster must be a GeoTIFF")
                rect, crs = raster_extent(file, entry["source_crs"])
                footprint = reproject(rect, crs)
                require(footprint.is_valid, "invalid projected raster footprint")
                by_kind[kind].append(footprint)
                if kind == "terrain":
                    for fld in ("vertical_datum", "vertical_units", "geoid_model"):
                        require(isinstance(entry.get(fld), str) and entry[fld].strip() and entry[fld].upper() not in ("UNKNOWN", "NONE", "N/A", "UNSPECIFIED"),
                                "terrain vertical source metadata is required: " + fld)
                    receipt = entry.get("vertical_evidence")
                    checked_file(root, receipt)
                    checked += 1
                    require(receipt.get("review_state") == "SOURCE_METADATA_REVIEWED",
                            "terrain source datum receipt not reviewed")
            else:
                # This proves a source asset exists, not its complete feature coverage.
                # A distinct identity/count/geometry audit is always required.
                index = entry.get("coverage_index")
                index_path = checked_file(root, index)
                checked += 1
                vector_footprint = feature_geom(index_path, fips)
                require(vector_footprint.intersects(original_boundary),
                        "source index does not intersect the selected county: " + fips)
                status_by_kind[kind] = "FILE_AND_COUNTY_INDEX_INTERSECTION_CHECKED_COMPLETENESS_PENDING"
        row = {"county_fips": fips, "layers": {}, "terrain_bounds_coverage": 0.0}
        for kind in REQUIRED_LAYER_KINDS:
            if kind in ("terrain", "imagery"):
                candidates = by_kind.get(kind, [])
                if candidates:
                    union = unary_union(candidates)
                    fraction = max(0.0, min(1.0, union.intersection(county_geom).area / county_area))
                else:
                    fraction = 0.0
                row["layers"][kind] = {
                    "status": "RASTER_BOUNDS_THRESHOLD_PASSED" if fraction >= minimum_footprint else "MISSING_OR_INCOMPLETE",
                    "bounds_coverage_fraction": round(fraction, 6),
                    "pixel_validity_checked": False,
                }
                if kind == "terrain":
                    row["terrain_bounds_coverage"] = round(fraction, 6)
                if fraction < minimum_footprint:
                    failures.append(f"{fips}/{kind}: incomplete raster bounds coverage")
            else:
                present = kind in status_by_kind
                row["layers"][kind] = {
                    "status": status_by_kind.get(kind, "MISSING_SOURCE_ASSET"),
                    "feature_completeness_checked": False,
                }
                if not present:
                    failures.append(f"{fips}/{kind}: required source absent")
        rows.append(row)
    return {
        "schema": "tsm.cross-state.release-preflight.v1",
        "scope": scope,
        "county_count": len(rows),
        "counties": rows,
        "files_sha256_verified": checked,
        "result": "SOURCE_FILES_AND_RASTER_BOUNDS_CHECKED_ONLY" if not failures else "NOT_READY_MISSING_SOURCE_COVERAGE",
        "required_coverage_fraction": minimum_footprint,
        "blocking_findings": failures,
        "science_and_geodetic_approval": "NOT_EVIDENCED",
        "scene_rendering_verified": False,
        "offline_shipping_verified": False,
        "limitations": [
            "Raster footprint bounds do not prove non-nodata pixel coverage or elevation accuracy.",
            "Building, roads and hydrography feature completeness are not proven by an index.",
            "SHA-256 proves byte identity, not scientific source provenance or geoid transformation.",
            "No unreviewed water-surface prediction, regulatory determination, or approval is implied."
        ]
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--data-root", required=True, type=Path)
    parser.add_argument("--scope", required=True, choices=SCOPES.keys())
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--min-coverage", default=0.99, type=float)
    args = parser.parse_args()
    require(not args.report.exists(), "refusing to overwrite an existing release evidence receipt")
    report = audit(json.loads(args.manifest.read_text(encoding="utf8")),
                   args.data_root, args.scope, args.min_coverage)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"result": report["result"], "counties": len(report["counties"]),
                      "blocking_findings": report["blocking_findings"]}))
    if report["blocking_findings"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
