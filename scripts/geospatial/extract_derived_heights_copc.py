#!/usr/bin/env python3
"""
DERIVED height extraction from Indiana 2020 COPC for gap buildings.

The 2020 statewide QL2 delivery did not classify building points (zero Class 6).
This script derives heights from elevated Class 1 (unclassified) returns clipped
to building footprints, using the same resilient thresholds as the OBSERVED
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

Resilient: buildings where DERIVED extraction fails get
lidarHeightStatus="UNAVAILABLE", never synthetic heights.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
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

TILE_FT = 5000
GROUND_BUFFER_FT = 50.0
SOURCE_PREFIX = 'https://giselevationingov.s3.amazonaws.com/copc/statewide/2020/SPW/ql2/'
MAX_TILES_PER_BUILDING = 64


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


def get_footprint_polygons_spw(
    geom: dict,
) -> list[list[list[tuple[float, float]]]]:
    """Return all Polygon/MultiPolygon parts and interior holes in SPW ftUS.

    Discarding holes or secondary parts can falsely classify canopy as roof
    returns. Reject invalid coordinates rather than inventing geometry.
    """
    gtype = geom.get("type")
    coords = geom.get("coordinates", [])
    if gtype == "Polygon":
        parts = [coords]
    elif gtype == "MultiPolygon":
        parts = coords
    else:
        raise ValueError(f"Unsupported geometry type: {gtype}")
    if not isinstance(parts, list) or not parts:
        raise ValueError("Empty footprint geometry")
    result = []
    for part in parts:
        if not isinstance(part, list) or not part:
            raise ValueError("Empty polygon")
        polygon = []
        for ring in part:
            if not isinstance(ring, list) or len(ring) < 4:
                raise ValueError("Invalid footprint ring")
            transformed = []
            for coordinate in ring:
                if not isinstance(coordinate, (list, tuple)) or len(coordinate) < 2:
                    raise ValueError("Invalid footprint coordinate")
                lon, lat = coordinate[:2]
                if not all(isinstance(v, (float, int)) and
                           not isinstance(v, bool) and np.isfinite(v)
                           for v in (lon, lat)) or not (-180 <= lon <= 180 and -90 <= lat <= 90):
                    raise ValueError("Nonfinite or out-of-range WGS84 footprint")
                x, y = lonlat_to_spw(lon, lat)
                if not (np.isfinite(x) and np.isfinite(y)):
                    raise ValueError("Nonfinite projected footprint")
                transformed.append((float(x), float(y)))
            if len(set(transformed)) < 3:
                raise ValueError("Degenerate footprint ring")
            polygon.append(transformed)
        result.append(polygon)
    return result


def get_footprint_ring_spw(geom: dict) -> list[tuple[float, float]]:
    """Compatibility helper: largest exterior by projected area, not vertex count."""
    polygons = get_footprint_polygons_spw(geom)
    def area(ring: list[tuple[float, float]]) -> float:
        return abs(sum(
            ring[i][0] * ring[(i + 1) % len(ring)][1]
            - ring[(i + 1) % len(ring)][0] * ring[i][1]
            for i in range(len(ring))
        ))
    return max((p[0] for p in polygons), key=area)


def point_in_footprint(
    x: float, y: float,
    polygons: list[list[list[tuple[float, float]]]],
) -> bool:
    """Test every exterior ring, excluding interior holes and detached parts."""
    return any(
        point_in_polygon(x, y, part[0]) and
        not any(point_in_polygon(x, y, hole) for hole in part[1:])
        for part in polygons
    )


def search_windows(polygons):
    """Return one ground-search window per polygon exterior, including detached parts."""
    windows = []
    for exterior, *_holes in polygons:
        eastings, northings = zip(*exterior)
        windows.append((
            min(eastings) - GROUND_BUFFER_FT, min(northings) - GROUND_BUFFER_FT,
            max(eastings) + GROUND_BUFFER_FT, max(northings) + GROUND_BUFFER_FT,
        ))
    return windows


def intersecting_grids(windows):
    grids = set()
    for west, south, east, north in windows:
        x0, x1 = math.floor(west / TILE_FT), math.floor(east / TILE_FT)
        y0, y1 = math.floor(south / TILE_FT), math.floor(north / TILE_FT)
        if min(x0, y0) < 0 or max(x1, y1) > 1999:
            raise ValueError('projected footprint lies outside the source grid')
        if (x1 - x0 + 1) * (y1 - y0 + 1) > MAX_TILES_PER_BUILDING:
            raise ValueError('projected footprint exceeds the bounded tile window')
        grids.update((e, n) for e in range(x0, x1 + 1) for n in range(y0, y1 + 1))
        if len(grids) > MAX_TILES_PER_BUILDING:
            raise ValueError('multipart footprint exceeds the bounded tile window')
    return grids


def grid_url(grid):
    easting, northing = grid
    return f'{SOURCE_PREFIX}IN2020_{easting * 5:04d}{northing * 5:04d}_12.copc.laz'



def source_grid(url):
    pattern = re.escape(SOURCE_PREFIX) + r'IN2020_([0-9]{4})([0-9]{4})_12\.copc\.laz'
    match = re.fullmatch(pattern, url)
    if match is None or any(int(value) % 5 for value in match.groups()):
        raise ValueError(f'Invalid Indiana 2020 COPC source URL: {url}')
    return tuple(int(value) // 5 for value in match.groups())


def footprint_tile_plan(features):
    """Group single-tile gaps and set aside gaps requiring a combined source window."""
    tiles = {}
    adjacent = {}
    invalid = []
    for index, feature in enumerate(features):
        if feature['properties'].get('lidarHeightStatus') == 'OK':
            continue
        try:
            polygons = get_footprint_polygons_spw(feature['geometry'])
            windows = search_windows(polygons)
            grids = intersecting_grids(windows)
        except (TypeError, ValueError, KeyError):
            invalid.append(index)
            continue
        if len(grids) == 1:
            grid = next(iter(grids))
            tiles.setdefault(grid, {})[index] = polygons
        else:
            adjacent[index] = (polygons, windows, grids)
    return tiles, adjacent, invalid


def verified_tile_bounds(path, grid):
    with laspy.open(path) as source:
        crs = source.header.parse_crs()
        if crs is None:
            raise ValueError('COPC header has no source CRS')
        horizontal = crs.sub_crs_list[0] if crs.is_compound else crs
        if horizontal.is_bound:
            horizontal = horizontal.source_crs
        if horizontal.to_epsg() != 2968:
            raise ValueError('COPC header must use the Indiana West ftUS source CRS')
        vertical = crs.sub_crs_list[1] if crs.is_compound else None
        if vertical is None or vertical.to_epsg() != 6360:
            raise ValueError('COPC header must use NAVD88 US survey feet')
        west, south = (index * TILE_FT for index in grid)
        x_min, y_min = source.header.mins[:2]
        x_max, y_max = source.header.maxs[:2]
        if not all(np.isfinite((x_min, y_min, x_max, y_max))) or x_min > x_max or y_min > y_max:
            raise ValueError('COPC header has invalid horizontal bounds')
        if x_max < west or x_min >= west + TILE_FT or y_max < south or y_min >= south + TILE_FT:
            raise ValueError('COPC header does not intersect the named tile')
        return float(x_min), float(y_min), float(x_max), float(y_max)


def download_tile(url: str, dest: str, max_attempts: int = 3) -> str:
    """Download a COPC tile atomically and return its SHA-256 digest.

    A cancelled/failed download must never leave a partial file at ``dest``
    where a retry could mistake it for a complete cache entry.

    The egress path can truncate a stream while closing it cleanly (no
    exception from the read loop), so the received byte count is verified
    against the Content-Length response header on every attempt. A mismatch
    discards the partial file and retries; persistent failure raises
    resilient (the tile is marked download-failed and retried on rerun,
    never silently committed as a truncated file).
    """
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        print(f"  [cached-candidate] {os.path.basename(dest)}", flush=True)
    else:
        print(f"  [download] {os.path.basename(dest)}", flush=True)
        partial = dest + ".part"
        last_error: Exception | None = None
        for attempt in range(1, max_attempts + 1):
            try:
                if os.path.exists(partial):
                    os.remove(partial)
                with urllib.request.urlopen(url, timeout=120) as response, open(partial, "wb") as output:
                    expected_len = response.getheader("Content-Length")
                    expected = int(expected_len) if expected_len else None
                    received = 0
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        output.write(chunk)
                        received += len(chunk)
                    output.flush()
                    os.fsync(output.fileno())
                if os.path.getsize(partial) == 0:
                    raise OSError("downloaded COPC tile is empty")
                if expected is not None and received != expected:
                    raise OSError(
                        f"truncated download: received {received} of {expected} bytes"
                    )
                os.replace(partial, dest)
                last_error = None
                break
            except Exception as exc:
                last_error = exc
                try:
                    if os.path.exists(partial):
                        os.remove(partial)
                except OSError:
                    pass
                if attempt < max_attempts:
                    print(f"  [retry {attempt}/{max_attempts}] {os.path.basename(dest)}: {exc}", flush=True)
        if last_error is not None:
            raise last_error
    h = hashlib.sha256()
    with open(dest, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def load_tile_arrays(las_path: str) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Decompress a COPC/LAZ tile once; share its points across all gap footprints.

    Decompression previously happened inside each per-building extraction call,
    multiplying I/O and CPU by the number of buildings within the same tile.
    """
    las = laspy.read(las_path)
    return (
        np.array(las.x),
        np.array(las.y),
        np.array(las.z),
        np.array(las.classification),
    )


def extract_derived_height(
    las_path: str,
    ring_spw: list[tuple[float, float]] | list[list[list[tuple[float, float]]]],
    tile_arrays: tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray] | None = None,
) -> dict:
    """
    Extract DERIVED height for a single building footprint from a COPC tile.

    Returns dict with lidarHeightStatus and measurement fields.
    """
    result = {"lidarHeightStatus": "UNAVAILABLE"}

    # Existing callers may supply a single ring; the production path supplies
    # all exterior/interior rings of every MultiPolygon part.
    polygons = [[ring_spw]] if ring_spw and isinstance(ring_spw[0], tuple) else ring_spw
    if not polygons or not all(isinstance(part, list) and part for part in polygons):
        return {"lidarHeightStatus": "error:footprint-crs:empty"}
    perimeter = [point for part in polygons for point in part[0]]
    if not perimeter:
        return {"lidarHeightStatus": "error:footprint-crs:empty"}
    xs_ring = [p[0] for p in perimeter]
    ys_ring = [p[1] for p in perimeter]
    bx1, bx2 = min(xs_ring), max(xs_ring)
    by1, by2 = min(ys_ring), max(ys_ring)

    # Two-tier buffer strategy:
    # - Roof candidates: strictly within footprint (precise)
    # - Ground points: larger buffer (50 ft) to find nearby ground when
    #   building footprint itself has no visible ground (common in 2020 data)
    roof_buf = 2.0  # small buffer for roof bbox prefilter

    if tile_arrays is None:
        try:
            tile_arrays = load_tile_arrays(las_path)
        except Exception as e:
            result["lidarHeightStatus"] = f"error:tile-read-failed:{e}"
            return result

    xs, ys, zs, classes = tile_arrays  # feet, NAVD88/Geoid12B

    # Bounding-box prefilter with ground buffer
    in_buf = np.zeros(len(xs), dtype=bool)
    for west, south, east, north in search_windows(polygons):
        in_buf |= (xs >= west) & (xs <= east) & (ys >= south) & (ys <= north)
    in_buf &= np.isfinite(zs)
    if not np.any(in_buf):
        result["lidarHeightStatus"] = "no-points-in-buffer"
        return result

    idxs = np.where(in_buf)[0]
    roof_z: list[float] = []
    ground_z: list[float] = []
    canopy_count = 0

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
                if point_in_footprint(x, y, polygons):
                    roof_z.append(z)
        elif c == 5 and point_in_footprint(x, y, polygons):
            canopy_count += 1

    if len(ground_z) < MIN_GROUND_POINTS:
        result["lidarHeightStatus"] = f"insufficient-ground-points:{len(ground_z)}"
        return result

    ground_median = median(ground_z)

    # Filter roof candidates: must be >6 ft above ground
    roof_candidates = [z for z in roof_z if z > ground_median + ROOF_HEIGHT_THRESHOLD_FT]

    if len(roof_candidates) < MIN_ROOF_POINTS:
        result["lidarHeightStatus"] = f"insufficient-roof-points:{len(roof_candidates)}"
        result["canopyOcclusionStatus"] = "POSSIBLE_CANOPY_OCCLUSION" if canopy_count >= MIN_ROOF_POINTS else "NO_QUALIFYING_BUILDING_CLASS_POINTS"
        result["canopyPointsWithinFootprint"] = canopy_count
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
        "lidarHeightM": round(height_ft * 0.3048006096012192, 3),
        "lidarRoofElevFt": round(roof_median, 2),
        "lidarGroundElevFt": round(ground_median, 2),
        "lidarRoofElevM": round(roof_median * 0.3048006096012192, 3),
        "lidarGroundElevM": round(ground_median * 0.3048006096012192, 3),
        "lidarHeightUncertaintyM": round((1.4826 * (median([abs(z - roof_median) for z in roof_candidates]) + median([abs(z - ground_median) for z in ground_z])) * 0.3048006096012192), 3),
        "lidarHeightConfidence": "HIGH" if len(roof_candidates) >= 30 and len(ground_z) >= 15 else "MEDIUM" if len(roof_candidates) >= 10 and len(ground_z) >= 5 else "LOW",
        "canopyOcclusionStatus": "NOT_FLAGGED_BY_CLASS_5_SCREEN",
        "canopyPointsWithinFootprint": canopy_count,
        "lidarRoofPoints": len(roof_candidates),
        "lidarGroundPoints": len(ground_z),
        "lidarHeightMethod": (
            "median(Class 1 Z > ground+6ft, footprint-clipped) - "
            "median(Class 2 Z)"
        ),
        "lidarHeightDatum": "NAVD88",
        "lidarAbsoluteElevationModel": "GEOID12B",
        "lidarHeightUnit": "ftUS",
        "heightProvenance": "DERIVED",
        "heightProvenanceMethod": (
            "Indiana 2020 COPC elevated Class 1 returns (footprint-clipped)"
        ),
    })
    return result


def atomic_write_json(path: str, payload: dict) -> None:
    """Write JSON with replace semantics so interruption cannot truncate state."""
    target = os.path.abspath(path)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    temporary = target + ".tmp"
    with open(temporary, "w", encoding="utf-8") as stream:
        json.dump(payload, stream, separators=(",", ":"))
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, target)


def sha256_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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
    ap.add_argument("--checkpoint-dir", default=None,
                    help="Directory for resilient per-tile resume checkpoints; defaults to TILE_MANIFEST.checkpoint")
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

    primary_tiles, adjacent, invalid = footprint_tile_plan(features)
    gaps = {
        index: polygons
        for buildings in primary_tiles.values()
        for index, polygons in buildings.items()
    }
    for index in invalid:
        features[index]['properties'].update(
            lidarHeightStatus='error:footprint-crs:invalid',
            heightProvenance='UNAVAILABLE',
        )
    for index in adjacent:
        features[index]['properties'].update(
            lidarHeightStatus='adjacent-tile-window-required',
            heightProvenance='UNAVAILABLE',
            heightProvenanceMethod='Complete COPC search window requires adjacent tiles',
        )
    print(f"  Single-tile gaps: {len(gaps)}; adjacent-tile gaps: {len(adjacent)}; "
          f"invalid geometry: {len(invalid)}", flush=True)

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
    tiles = list(dict.fromkeys(tiles))
    tile_grids = {url: source_grid(url) for url in tiles}
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

    # Resume only when all inputs and the exact implementation are unchanged.
    checkpoint_dir = args.checkpoint_dir or (args.tile_manifest + ".checkpoint")
    results_dir = os.path.join(checkpoint_dir, "results")
    state_path = os.path.join(checkpoint_dir, "state.json")
    os.makedirs(results_dir, exist_ok=True)
    checkpoint_identity = {
        "schema_version": 1,
        "input_sha256": sha256_file(args.geojson),
        "tile_list_sha256": hashlib.sha256(("\n".join(tiles) + "\n").encode()).hexdigest(),
        "script_sha256": sha256_file(__file__),
    }
    state = {**checkpoint_identity, "completed_tiles": {}}
    if os.path.isfile(state_path):
        try:
            with open(state_path, encoding="utf-8") as stream:
                saved = json.load(stream)
        except (OSError, json.JSONDecodeError) as exc:
            raise SystemExit(f"RESILIENT: unreadable checkpoint {state_path}: {exc}")
        if any(saved.get(k) != v for k, v in checkpoint_identity.items()):
            raise SystemExit("RESILIENT: checkpoint input, tile list, script, or schema changed; use a fresh --checkpoint-dir")
        if not isinstance(saved.get("completed_tiles"), dict):
            raise SystemExit("RESILIENT: checkpoint completed_tiles is invalid")
        state = saved

    # Restore validated per-tile results. Each result file is written before
    # its tile is committed to state.json, making interrupted writes replay-safe.
    tile_manifest = []
    stats = {"derived_ok": 0, "unavailable": 0, "tiles_processed": 0, "tiles_failed": 0}
    completed = state["completed_tiles"]
    processed_indices = set()
    for tile_url, record in completed.items():
        if tile_url not in tiles or not isinstance(record, dict):
            raise SystemExit("RESILIENT: checkpoint references a tile outside the current tile list")
        result_path = os.path.join(checkpoint_dir, record.get("results_file", ""))
        if not os.path.isfile(result_path) or sha256_file(result_path) != record.get("results_sha256"):
            raise SystemExit(f"RESILIENT: checkpoint result missing or hash mismatch for {tile_url}")
        with open(result_path, encoding="utf-8") as stream:
            tile_result = json.load(stream)
        if tile_result.get("url") != tile_url or tile_result.get("tile_sha256") != record.get("sha256"):
            raise SystemExit(f"RESILIENT: checkpoint tile identity mismatch for {tile_url}")
        for index_text, saved_props in tile_result.get("feature_properties", {}).items():
            index = int(index_text)
            if index not in primary_tiles.get(tile_grids[tile_url], {}) or not isinstance(saved_props, dict):
                raise SystemExit(f"RESILIENT: invalid feature index in checkpoint for {tile_url}: {index}")
            features[index]["properties"] = saved_props
            processed_indices.add(index)
        tile_manifest.append(record["manifest_entry"])
        stats["tiles_processed"] += 1
        stats["derived_ok"] += int(tile_result.get("derived_ok", 0))
        stats["unavailable"] += int(tile_result.get("unavailable", 0))
    print(f"Resume checkpoint: {len(completed)}/{len(tiles)} tiles already committed", flush=True)

    for ti, url in enumerate(tiles):
        tile_name = os.path.basename(url)
        if url in completed:
            print(f"\n[{ti+1}/{len(tiles)}] {tile_name} [checkpoint hit]", flush=True)
            continue
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

        grid = tile_grids[url]
        try:
            hx_min, hy_min, hx_max, hy_max = verified_tile_bounds(tile_path, grid)
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

        in_tile = primary_tiles.get(grid, {})
        print(f"  Bounds: X[{hx_min:.0f},{hx_max:.0f}] Y[{hy_min:.0f},{hy_max:.0f}]", flush=True)
        print(f"  Gap buildings in tile: {len(in_tile)}", flush=True)

        buildings_processed = 0
        feature_properties = {}
        tile_derived_ok = 0
        tile_unavailable = 0
        # A single LAZ tile may contain many building footprints. Decompress
        # once and reuse the same immutable point arrays for every footprint.
        try:
            tile_arrays = load_tile_arrays(tile_path) if in_tile else None
        except Exception as exc:
            print(f"  [error] tile read failed: {exc}", flush=True)
            stats["tiles_failed"] += 1
            tile_manifest.append({
                "url": url, "tile": tile_name, "sha256": sha256,
                "status": f"tile-read-failed:{exc}", "buildings_processed": 0,
            })
            os.remove(tile_path)
            continue
        for index, polygons in in_tile.items():
            props = features[index]["properties"]
            result = extract_derived_height(tile_path, polygons, tile_arrays)
            props.update(result)
            if result.get("lidarHeightStatus") == "OK":
                props["lidarSource"] = url
                stats["derived_ok"] += 1
                tile_derived_ok += 1
            else:
                props["heightProvenance"] = "UNAVAILABLE"
                props["heightProvenanceMethod"] = "DERIVED extraction failed"
                stats["unavailable"] += 1
                tile_unavailable += 1
            feature_properties[str(index)] = props
            processed_indices.add(index)
            buildings_processed += 1

        del tile_arrays  # Release decoded point buffers before the next tile.
        manifest_entry = {
            "url": url,
            "tile": tile_name,
            "sha256": sha256,
            "status": "processed",
            "buildings_processed": buildings_processed,
            "header_bounds_spw_ft": {
                "x_min": hx_min, "x_max": hx_max,
                "y_min": hy_min, "y_max": hy_max,
            },
        }
        tile_result = {
            "url": url,
            "tile_sha256": sha256,
            "feature_properties": feature_properties,
            "derived_ok": tile_derived_ok,
            "unavailable": tile_unavailable,
            "manifest_entry": manifest_entry,
        }
        result_name = hashlib.sha256(url.encode()).hexdigest() + ".json"
        result_path = os.path.join(results_dir, result_name)
        atomic_write_json(result_path, tile_result)
        completed[url] = {
            "sha256": sha256,
            "results_file": os.path.relpath(result_path, checkpoint_dir),
            "results_sha256": sha256_file(result_path),
            "manifest_entry": manifest_entry,
        }
        atomic_write_json(state_path, state)
        tile_manifest.append(manifest_entry)
        stats["tiles_processed"] += 1

        # Clean up tile to save disk
        os.remove(tile_path)
        print(f"  [cleaned] {tile_name}", flush=True)

    # Any gaps not matched to a tile remain UNAVAILABLE
    unmatched = set(gaps) - processed_indices
    for index in unmatched:
        features[index]["properties"].update(
            lidarHeightStatus="UNAVAILABLE",
            heightProvenance="UNAVAILABLE",
            heightProvenanceMethod="No verified 2020 COPC tile coverage",
        )
    stats["unavailable"] += len(unmatched) + len(adjacent) + len(invalid)
    stats["adjacent_tile_gaps"] = len(adjacent)
    stats["invalid_geometry"] = len(invalid)
    if unmatched:
        print(f"\nUnmatched buildings (no verified tile coverage): {len(unmatched)}", flush=True)

    # Write output
    print(f"\nWriting output to {args.out}...", flush=True)
    atomic_write_json(args.out, data)

    print(f"Writing tile manifest to {args.tile_manifest}...", flush=True)
    atomic_write_json(args.tile_manifest, {
        "tiles": sorted(tile_manifest, key=lambda entry: tiles.index(entry["url"]) if entry.get("url") in tiles else len(tiles)),
        "stats": stats,
        "method": "DERIVED from Indiana 2020 COPC elevated Class 1 returns",
        "crs": "NAD83(HARN) / Indiana West (ftUS) + NAVD88 height - Geoid12B (ftUS)",
        "checkpoint": {"directory": checkpoint_dir, "schema_version": checkpoint_identity["schema_version"]},
    })

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

    if stats["tiles_failed"]:
        print(f"RESILIENT: {stats['tiles_failed']} tile(s) failed; rerun with the same checkpoint directory after resolving network/source failures.", file=sys.stderr, flush=True)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
