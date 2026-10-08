#!/usr/bin/env python3
"""
DERIVED height extraction from Indiana 2020 COPC for gap buildings.

The 2020 statewide QL2 delivery did not classify building points (zero Class 6).
This script derives heights from elevated Class 1 (unclassified) returns clipped
to building footprints, using the same fail-closed thresholds as the OBSERVED
(3DEP EPT Class 6) pipeline.

Methodology:
- Ground: median of Class 2 points within footprint (+ small buffer)
- Roof candidates: Class 1 points >6 ft above ground median, within footprint
- Height = median(roof candidates) - median(ground)
- MIN_ROOF_POINTS = 5, MIN_GROUND_POINTS = 10 (same as OBSERVED)
- Tree confound: if roof candidate vertical std dev > 10 ft, mark unreliable
- Implausible: height <= 0 or > 328 ft (100m, same as OBSERVED)

Provenance (gate #6):
- OBSERVED: "3DEP EPT Class 6 building points" (12,450 buildings)
- DERIVED: "Indiana 2020 COPC elevated Class 1 returns (footprint-clipped)"

CRS: NAD83(HARN) / Indiana West (ftUS) + NAVD88 height - Geoid12B (ftUS)
Z values in feet. Height = median(roof) - median(ground) cancels the
Geoid12B-vs-Geoid18 difference.

Fail-closed: buildings where DERIVED extraction fails get
lidarHeightStatus="UNAVAILABLE", never synthetic heights.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.request
from statistics import median, stdev

import numpy as np
import laspy
from pyproj import Transformer

# Same thresholds as OBSERVED pipeline
MIN_ROOF_POINTS = 5
MIN_GROUND_POINTS = 10
CLASS_UNCLASSIFIED = 1
CLASS_GROUND = 2

# DERIVED-specific parameters
ROOF_HEIGHT_THRESHOLD_FT = 6.0  # Class 1 points must be >6 ft above ground
MAX_ROOF_STDDEV_FT = 10.0  # Tree confound: reject if roof candidates too spread
MAX_PLAUSIBLE_HEIGHT_FT = 328.0  # 100m, same as OBSERVED pipeline
MIN_PLAUSIBLE_HEIGHT_FT = 0.0

# CRS transformers
# Building footprints are in WGS84 lon/lat
# 2020 COPC is in NAD83(HARN) / Indiana West (ftUS), EPSG:2968
_lonlat_to_spw = Transformer.from_crs("EPSG:4326", "EPSG:2968", always_xy=True)


def lonlat_to_spw(lon: float, lat: float) -> tuple[float, float]:
    """Convert WGS84 lon/lat to Indiana State Plane West (ftUS)."""
    return _lonlat_to_spw.transform(lon, lat)


def point_in_polygon(x: float, y: float, poly: list[tuple[float, float]]) -> bool:
    """Ray casting point-in-polygon test."""
    n = len(poly)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def get_footprint_ring_spw(geom: dict) -> list[tuple[float, float]]:
    """Extract the exterior ring of a Polygon/MultiPolygon, converted to SPW feet."""
    gtype = geom.get("type")
    coords = geom.get("coordinates", [])
    if gtype == "Polygon":
        ring = coords[0]
    elif gtype == "MultiPolygon":
        # Use the largest ring
        ring = max((p[0] for p in coords), key=len)
    else:
        raise ValueError(f"Unsupported geometry type: {gtype}")
    return [lonlat_to_spw(c[0], c[1]) for c in ring]


def download_tile(url: str, dest: str) -> str:
    """Download a COPC tile, return SHA-256 hex digest."""
    if os.path.exists(dest):
        print(f"  [cached] {os.path.basename(dest)}", flush=True)
    else:
        print(f"  [download] {os.path.basename(dest)}", flush=True)
        urllib.request.urlretrieve(url, dest)
    h = hashlib.sha256()
    with open(dest, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def extract_derived_height(
    las_path: str,
    ring_spw: list[tuple[float, float]],
) -> dict:
    """
    Extract DERIVED height for a single building footprint from a COPC tile.

    Returns dict with lidarHeightStatus and measurement fields.
    """
    result = {"lidarHeightStatus": "UNAVAILABLE"}

    # Bounding box of footprint in SPW feet
    xs_ring = [p[0] for p in ring_spw]
    ys_ring = [p[1] for p in ring_spw]
    bx1, bx2 = min(xs_ring), max(xs_ring)
    by1, by2 = min(ys_ring), max(ys_ring)

    # Two-tier buffer strategy:
    # - Roof candidates: strictly within footprint (precise)
    # - Ground points: larger buffer (50 ft) to find nearby ground when
    #   building footprint itself has no visible ground (common in 2020 data)
    roof_buf = 2.0  # small buffer for roof bbox prefilter
    ground_buf = 50.0  # larger buffer for ground search

    try:
        las = laspy.read(las_path)
    except Exception as e:
        result["lidarHeightStatus"] = f"error:tile-read-failed:{e}"
        return result

    xs = np.array(las.x)
    ys = np.array(las.y)
    zs = np.array(las.z)  # feet, NAVD88/Geoid12B
    classes = np.array(las.classification)

    # Bounding-box prefilter with ground buffer
    in_buf = (xs >= bx1 - ground_buf) & (xs <= bx2 + ground_buf) & \
             (ys >= by1 - ground_buf) & (ys <= by2 + ground_buf)
    if not np.any(in_buf):
        result["lidarHeightStatus"] = "no-points-in-buffer"
        return result

    idxs = np.where(in_buf)[0]
    roof_z: list[float] = []
    ground_z: list[float] = []

    # Two-pass collection:
    # - Ground: Class 2 points anywhere in the larger buffer
    # - Roof: Class 1 points strictly within footprint polygon
    for i in idxs:
        c = int(classes[i])
        z = float(zs[i])
        x = float(xs[i])
        y = float(ys[i])
        if c == CLASS_GROUND:
            ground_z.append(z)
        elif c == CLASS_UNCLASSIFIED:
            # Roof candidates must be within footprint (with tiny bbox prefilter)
            if (bx1 - roof_buf <= x <= bx2 + roof_buf and
                    by1 - roof_buf <= y <= by2 + roof_buf):
                if point_in_polygon(x, y, ring_spw):
                    roof_z.append(z)

    if len(ground_z) < MIN_GROUND_POINTS:
        result["lidarHeightStatus"] = f"insufficient-ground-points:{len(ground_z)}"
        return result

    ground_median = median(ground_z)

    # Filter roof candidates: must be >6 ft above ground
    roof_candidates = [z for z in roof_z if z > ground_median + ROOF_HEIGHT_THRESHOLD_FT]

    if len(roof_candidates) < MIN_ROOF_POINTS:
        result["lidarHeightStatus"] = f"insufficient-roof-points:{len(roof_candidates)}"
        return result

    # Tree confound check: high vertical variance suggests vegetation, not roof
    if len(roof_candidates) >= 2:
        roof_std = stdev(roof_candidates)
        if roof_std > MAX_ROOF_STDDEV_FT:
            result["lidarHeightStatus"] = (
                f"tree-confound-unreliable:stddev={roof_std:.1f}ft"
            )
            return result

    roof_median = median(roof_candidates)
    height_ft = roof_median - ground_median

    if height_ft <= MIN_PLAUSIBLE_HEIGHT_FT or height_ft > MAX_PLAUSIBLE_HEIGHT_FT:
        result["lidarHeightStatus"] = f"implausible-height:{height_ft:.2f}ft"
        return result

    result.update({
        "lidarHeightStatus": "OK",
        "lidarHeightFt": round(height_ft, 2),
        "lidarRoofElevFt": round(roof_median, 2),
        "lidarGroundElevFt": round(ground_median, 2),
        "lidarRoofPoints": len(roof_candidates),
        "lidarGroundPoints": len(ground_z),
        "lidarHeightMethod": (
            "median(Class 1 Z > ground+6ft, footprint-clipped) - "
            "median(Class 2 Z)"
        ),
        "lidarHeightDatum": "NAVD88 (Geoid12B)",
        "lidarHeightUnit": "ftUS",
        "heightProvenance": "DERIVED",
        "heightProvenanceMethod": (
            "Indiana 2020 COPC elevated Class 1 returns (footprint-clipped)"
        ),
    })
    return result


def main() -> int:
    ap = argparse.ArgumentParser(
        description="DERIVED height extraction from Indiana 2020 COPC"
    )
    ap.add_argument("--geojson", required=True,
                    help="Input GeoJSON with 23,082 buildings")
    ap.add_argument("--tile-list", required=True,
                    help="Text file with COPC tile URLs (one per line, # comments)")
    ap.add_argument("--tile-dir", required=True,
                    help="Directory for tile downloads (will be cleaned per-tile)")
    ap.add_argument("--out", required=True,
                    help="Output GeoJSON with DERIVED heights merged")
    ap.add_argument("--tile-manifest", required=True,
                    help="Output JSON with tile SHA-256 digests")
    ap.add_argument("--limit-tiles", type=int, default=0,
                    help="Process only first N tiles (0 = all, for testing)")
    args = ap.parse_args()

    os.makedirs(args.tile_dir, exist_ok=True)

    # Load buildings
    print("Loading buildings...", flush=True)
    with open(args.geojson) as f:
        data = json.load(f)
    features = data["features"]
    print(f"  Total features: {len(features)}", flush=True)

    # Identify gap buildings (not OK)
    gaps = []
    for feat in features:
        props = feat.get("properties", {})
        if props.get("lidarHeightStatus") != "OK":
            # Pre-compute footprint ring in SPW feet
            try:
                ring_spw = get_footprint_ring_spw(feat["geometry"])
            except Exception as e:
                props["lidarHeightStatus"] = f"error:footprint-crs:{e}"
                props["heightProvenance"] = "UNAVAILABLE"
                continue
            # Centroid in SPW for tile matching
            xs = [p[0] for p in ring_spw]
            ys = [p[1] for p in ring_spw]
            cx = sum(xs) / len(xs)
            cy = sum(ys) / len(ys)
            gaps.append({
                "feature": feat,
                "props": props,
                "ring_spw": ring_spw,
                "cx": cx,
                "cy": cy,
                "done": False,
            })
    print(f"  Gap buildings to process: {len(gaps)}", flush=True)

    # Load tile list
    tiles = []
    with open(args.tile_list) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            # Strip inline comments
            url = line.split("#")[0].strip()
            if url:
                tiles.append(url)
    print(f"  Tiles: {len(tiles)}", flush=True)

    if args.limit_tiles > 0:
        tiles = tiles[:args.limit_tiles]
        print(f"  Limited to first {len(tiles)} tiles", flush=True)

    # Mark OBSERVED buildings with provenance
    for feat in features:
        props = feat.get("properties", {})
        if props.get("lidarHeightStatus") == "OK" and "heightProvenance" not in props:
            props["heightProvenance"] = "OBSERVED"
            props["heightProvenanceMethod"] = "3DEP EPT Class 6 building points"

    # Process tiles
    tile_manifest = []
    stats = {
        "derived_ok": 0,
        "unavailable": 0,
        "tiles_processed": 0,
        "tiles_failed": 0,
    }

    for ti, url in enumerate(tiles):
        tile_name = os.path.basename(url)
        print(f"\n[{ti+1}/{len(tiles)}] {tile_name}", flush=True)

        tile_path = os.path.join(args.tile_dir, tile_name)
        try:
            sha256 = download_tile(url, tile_path)
        except Exception as e:
            print(f"  [error] download failed: {e}", flush=True)
            stats["tiles_failed"] += 1
            tile_manifest.append({
                "url": url, "tile": tile_name,
                "sha256": None, "status": f"download-failed:{e}",
                "buildings_processed": 0,
            })
            continue

        # Read tile bounds from header
        try:
            with laspy.open(tile_path) as las:
                hdr = las.header
                # Header mins/maxs are in SPW feet
                hx_min, hy_min = float(hdr.mins[0]), float(hdr.mins[1])
                hx_max, hy_max = float(hdr.maxs[0]), float(hdr.maxs[1])
        except Exception as e:
            print(f"  [error] header read failed: {e}", flush=True)
            stats["tiles_failed"] += 1
            tile_manifest.append({
                "url": url, "tile": tile_name,
                "sha256": sha256, "status": f"header-read-failed:{e}",
                "buildings_processed": 0,
            })
            os.remove(tile_path)
            continue

        # Find gap buildings in this tile's bounds
        in_tile = [
            g for g in gaps
            if not g["done"]
            and hx_min <= g["cx"] <= hx_max
            and hy_min <= g["cy"] <= hy_max
        ]
        print(f"  Bounds: X[{hx_min:.0f},{hx_max:.0f}] Y[{hy_min:.0f},{hy_max:.0f}]", flush=True)
        print(f"  Gap buildings in tile: {len(in_tile)}", flush=True)

        buildings_processed = 0
        for g in in_tile:
            result = extract_derived_height(tile_path, g["ring_spw"])
            g["props"].update(result)
            # Ensure provenance is set even on failure
            if g["props"].get("lidarHeightStatus") != "OK":
                g["props"]["heightProvenance"] = "UNAVAILABLE"
                g["props"]["heightProvenanceMethod"] = (
                    "DERIVED extraction failed; no synthetic height generated"
                )
                stats["unavailable"] += 1
            else:
                stats["derived_ok"] += 1
            g["done"] = True
            buildings_processed += 1

        tile_manifest.append({
            "url": url,
            "tile": tile_name,
            "sha256": sha256,
            "status": "processed",
            "buildings_processed": buildings_processed,
            "header_bounds_spw_ft": {
                "x_min": hx_min, "x_max": hx_max,
                "y_min": hy_min, "y_max": hy_max,
            },
        })
        stats["tiles_processed"] += 1

        # Clean up tile to save disk
        os.remove(tile_path)
        print(f"  [cleaned] {tile_name}", flush=True)

    # Any gaps not matched to a tile remain UNAVAILABLE
    unmatched = [g for g in gaps if not g["done"]]
    for g in unmatched:
        g["props"]["lidarHeightStatus"] = "UNAVAILABLE"
        g["props"]["heightProvenance"] = "UNAVAILABLE"
        g["props"]["heightProvenanceMethod"] = (
            "No 2020 COPC tile coverage; no synthetic height generated"
        )
        stats["unavailable"] += 1
    if unmatched:
        print(f"\nUnmatched buildings (no tile coverage): {len(unmatched)}", flush=True)

    # Write output
    print(f"\nWriting output to {args.out}...", flush=True)
    with open(args.out, "w") as f:
        json.dump(data, f)

    print(f"Writing tile manifest to {args.tile_manifest}...", flush=True)
    with open(args.tile_manifest, "w") as f:
        json.dump({
            "tiles": tile_manifest,
            "stats": stats,
            "method": "DERIVED from Indiana 2020 COPC elevated Class 1 returns",
            "crs": "NAD83(HARN) / Indiana West (ftUS) + NAVD88 height - Geoid12B (ftUS)",
        }, f, indent=2)

    # Summary
    print("\n" + "=" * 60, flush=True)
    print("DERIVED EXTRACTION COMPLETE", flush=True)
    print("=" * 60, flush=True)
    print(f"  Tiles processed: {stats['tiles_processed']}/{len(tiles)}", flush=True)
    print(f"  Tiles failed: {stats['tiles_failed']}", flush=True)
    print(f"  DERIVED heights (OK): {stats['derived_ok']}", flush=True)
    print(f"  UNAVAILABLE: {stats['unavailable']}", flush=True)

    # Final counts
    ok_obs = sum(1 for f in features
                 if f.get("properties", {}).get("heightProvenance") == "OBSERVED")
    ok_der = sum(1 for f in features
                 if f.get("properties", {}).get("heightProvenance") == "DERIVED")
    unav = sum(1 for f in features
               if f.get("properties", {}).get("heightProvenance") == "UNAVAILABLE")
    print(f"\n  Final: {ok_obs} OBSERVED + {ok_der} DERIVED + {unav} UNAVAILABLE = {len(features)}", flush=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())
