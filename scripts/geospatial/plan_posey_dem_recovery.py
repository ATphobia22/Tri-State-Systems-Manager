#!/usr/bin/env python3
"""Plan 2020 Indiana DEM tile recovery against actual IGIO building footprints.

This is a deterministic source selection/staging audit, NOT a building-height
derivation, NAVD88 certification or independent raster-coverage claim.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import shape
from shapely.errors import GEOSException

EXPECTED_BUILDINGS = 23082
TILE_FEET = 5000
MAX_TILES_PER_POLYGON = 256
MAX_SOURCE_TILES = 1500
SOURCE_BUCKET = "gisimageryingov"
SOURCE_PREFIX = "demoptimized/statewide/2020/SPW/2.5ft/"


def tile_names_for_bounds(bounds: tuple[float, float, float, float]) -> list[str]:
    if (len(bounds) != 4 or not all(isinstance(v, (int, float)) and
            not isinstance(v, bool) and math.isfinite(v) for v in bounds)):
        raise ValueError("invalid projected bounds")
    west, south, east, north = bounds
    if west < 0 or south < 0 or west > east or south > north:
        raise ValueError("invalid projected bounds ordering")
    x0, x1 = int(math.floor(west / TILE_FEET)), int(math.floor(east / TILE_FEET))
    y0, y1 = int(math.floor(south / TILE_FEET)), int(math.floor(north / TILE_FEET))
    count = (x1 - x0 + 1) * (y1 - y0 + 1)
    if count < 1 or count > MAX_TILES_PER_POLYGON:
        raise ValueError("unbounded or suspicious projected polygon extent")
    names = []
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            east_thousands, north_thousands = x * 5, y * 5
            if east_thousands > 9999 or north_thousands > 9999:
                raise ValueError("source tile key coordinate overflow")
            names.append(f"IN2020_{east_thousands:04d}{north_thousands:04d}_12.tif")
    return sorted(names)


def _polygon_exteriors(geometry: dict):
    if not isinstance(geometry, dict) or geometry.get("type") not in ("Polygon", "MultiPolygon"):
        raise ValueError("IGIO building must be Polygon or MultiPolygon")
    try:
        geom = shape(geometry)
        if geom.is_empty or not geom.is_valid or geom.area <= 0:
            raise ValueError("invalid authoritative polygon geometry")
        parts = [geom] if geom.geom_type == "Polygon" else list(geom.geoms)
        if not parts:
            raise ValueError("empty building geometry")
        return [list(part.exterior.coords) for part in parts]
    except (TypeError, AttributeError, IndexError, ValueError, GEOSException) as exc:
        raise ValueError("invalid IGIO polygon geometry") from exc


def _feature_tile_names(exteriors, transformer, projected: bool) -> set[str]:
    """Plan one complete source geometry atomically, never partial parts."""
    names = set()
    for exterior in exteriors:
        xs, ys = [], []
        for item in exterior:
            x, y = item[0], item[1]
            if not all(isinstance(v, (int, float)) and not isinstance(v, bool)
                       and math.isfinite(v) for v in (x, y)):
                raise ValueError("non-finite input coordinates")
            if not projected:
                if not (-90 <= x <= -86 and 36 <= y <= 40):
                    raise ValueError("building outside bounded southwestern Indiana AOI")
                x, y = transformer.transform(x, y)
            if not (math.isfinite(x) and math.isfinite(y)):
                raise ValueError("untransformable projected coordinates")
            xs.append(x)
            ys.append(y)
        names.update(tile_names_for_bounds((min(xs), min(ys), max(xs), max(ys))))
    return names


def plan(data: dict, *, expected_count: int = EXPECTED_BUILDINGS,
         projected: bool = False, quarantine_invalid_geometry: bool = False) -> dict:
    if (not isinstance(data, dict) or data.get("type") != "FeatureCollection"
            or not isinstance(data.get("features"), list)):
        raise ValueError("input must be GeoJSON FeatureCollection")
    features = data["features"]
    if type(expected_count) is not int or expected_count < 1 or len(features) != expected_count:
        raise ValueError("authoritative building inventory count mismatch")
    transformer = None if projected else Transformer.from_crs("EPSG:4326", "EPSG:2968", always_xy=True)
    ids, tiles = set(), set()
    invalid_geometry_ids = []
    for feature in features:
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise ValueError("invalid IGIO building feature")
        props = feature.get("properties")
        if (not isinstance(props, dict) or type(props.get("igioObjectId")) is not int
                or props["igioObjectId"] < 0):
            raise ValueError("missing authoritative integer igioObjectId")
        oid = props["igioObjectId"]
        if oid in ids:
            raise ValueError("duplicate authoritative igioObjectId")
        ids.add(oid)
        try:
            feature_tiles = _feature_tile_names(
                _polygon_exteriors(feature.get("geometry")), transformer, projected
            )
        except ValueError:
            if not quarantine_invalid_geometry:
                raise
            invalid_geometry_ids.append(oid)
            continue
        if len(tiles | feature_tiles) > MAX_SOURCE_TILES:
            raise ValueError("unbounded county DEM tile plan")
        tiles.update(feature_tiles)
    if not tiles:
        raise ValueError("no valid geometry available for a source tile plan")
    names = sorted(tiles)
    return {
        "schemaVersion": "tsm.posey-dem-recovery-plan.v1",
        "authoritativeObjectIdCount": len(ids),
        "expectedBuildingCount": expected_count,
        "candidateCoveredSourceGeometryCount": len(ids) - len(invalid_geometry_ids),
        "invalidGeometryCount": len(invalid_geometry_ids),
        "invalidGeometryObjectIds": sorted(invalid_geometry_ids),
        "fullSourceGeometryValid": not invalid_geometry_ids,
        "tileCount": len(names),
        "tileNames": names,
        "sourceBucket": SOURCE_BUCKET,
        "sourceRegion": "us-east-2",
        "sourcePrefix": SOURCE_PREFIX,
        "horizontalGridCrsInterpretation": "EPSG:2968 (verify against each raster)",
        "heightVerticalDatumRequired": "NAVD88 (GEOID12B source metadata; verify each raster)",
        "sourceObjectAvailabilityVerified": False,
        "rasterPixelCoverageVerified": False,
        "fullSourceTileCoverageVerified": False,
        "heightsVerified": False,
        "regulatoryUse": False,
        "warning": "Tile selection does not verify raster pixels, survey datum or any building height.",
    }


def audit_staged_tiles(report: dict, root: Path) -> dict:
    import rasterio
    from dem_vertical_evidence import pinned_navd88_scale_to_ft
    if not root.is_dir() or root.is_symlink():
        raise ValueError("missing or symlinked DEM staging directory")
    missing, unpinned, invalid, present = [], [], [], 0
    for name in report["tileNames"]:
        path = root / name
        if not path.is_file() or path.is_symlink():
            missing.append(name)
            continue
        present += 1
        if pinned_navd88_scale_to_ft(path) is None:
            unpinned.append(name)
            continue
        try:
            with rasterio.open(path) as ds:
                if ds.crs is None or ds.count < 1 or ds.width < 1 or ds.height < 1:
                    invalid.append(name)
        except (rasterio.errors.RasterioError, OSError):
            invalid.append(name)
    return {
        "stagedCount": present,
        "missingCount": len(missing),
        "unpinnedOrDatumUnverifiedCount": len(unpinned),
        "invalidRasterCount": len(invalid),
        "missingTileNames": missing,
        "unpinnedTileNames": unpinned,
        "invalidTileNames": invalid,
        "stagedMetadataAuditPassed": (not (missing or unpinned or invalid)
                                       and report.get("fullSourceGeometryValid") is True),
        "rasterPixelCoverageVerified": False,
        "heightsVerified": False,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--geojson", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--expected-count", type=int, default=EXPECTED_BUILDINGS)
    ap.add_argument("--staged-dem-dir", type=Path)
    ap.add_argument("--require-complete-staging", action="store_true")
    ap.add_argument("--quarantine-invalid-geometry", action="store_true",
                    help="Emit a non-certifying candidate plan and invalid source IDs instead of rejecting every valid footprint")
    args = ap.parse_args()
    try:
        if args.out.exists() or args.out.resolve() == args.geojson.resolve():
            raise ValueError("refusing to overwrite source or existing report")
        if args.require_complete_staging and args.staged_dem_dir is None:
            raise ValueError("cannot require staging without --staged-dem-dir")
        raw = args.geojson.read_bytes()
        if len(raw) > 200 * 1024 * 1024:
            raise ValueError("input exceeds bounded source size")
        report = plan(json.loads(raw), expected_count=args.expected_count,
                      quarantine_invalid_geometry=args.quarantine_invalid_geometry)
        report["inputSha256"] = hashlib.sha256(raw).hexdigest()
        if args.staged_dem_dir is not None:
            report["staging"] = audit_staged_tiles(report, args.staged_dem_dir)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps({"tilesRequired": report["tileCount"],
                          "invalidGeometryCount": report["invalidGeometryCount"],
                          "fullSourceGeometryValid": report["fullSourceGeometryValid"],
                          "staging": report.get("staging", {})}, sort_keys=True))
        return 2 if (args.require_complete_staging and
                     not report["staging"]["stagedMetadataAuditPassed"]) else 0
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print("DEM recovery plan rejected: " + type(exc).__name__)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
