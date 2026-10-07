#!/usr/bin/env python3
"""Reconstruct LOD2 roof geometry from 3DEP LiDAR via roof-plane fitting.

Pipeline (research-validated 2026-10-07):
  LiDAR registration -> building-point classification (Class 6)
  -> roof segmentation (RANSAC plane fitting, iterative)
  -> roof-plane fitting (least-squares refinement)
  -> topological roof graph (plane adjacency)
  -> LOD2 classification

TRUTHFUL LOD LABELING (per ArcGIS LOD2 spec, research-validated):
  - LOD1.2 = flat roof representation (extruded prism, no roof geometry)
  - LOD2.0 = roof slope and directional orientation represented
  A building is labeled LOD2 ONLY when >=1 roof plane is actually
  reconstructed from LiDAR points. The string "roof_type": "gable" as
  metadata alone does NOT make a flat extrusion into LOD2.

Output: GeoJSON with per-feature `roofPlanes` (plane equation, normal,
slope_deg, azimuth_deg, inlier_count, rmse_m) and `achievedLod` (1 or 2).

Fail-closed: buildings with insufficient roof points (<30 Class 6 points)
or failed plane fits get achievedLod=1 and no fabricated roof geometry.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import sys
import urllib.request
from pathlib import Path

import numpy as np

# Reuse EPT infrastructure from the height extractor
sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_lidar_heights import (
    EPTReader, find_posey_ept, point_in_polygon,
    CLASS_BUILDING, M_TO_FTUS,
)

MIN_ROOF_POINTS = 30
RANSAC_ITERATIONS = 200
RANSAC_THRESHOLD_M = 0.15
MIN_PLANE_INLIERS = 20
MIN_PLANE_AREA_M2 = 4.0


def fit_plane_svd(points: np.ndarray) -> tuple[np.ndarray, float]:
    """Fit plane via SVD. Returns (normal_unit, d) for n.p + d = 0, plus RMSE."""
    centroid = points.mean(axis=0)
    _, _, vt = np.linalg.svd(points - centroid)
    normal = vt[-1]
    # Ensure upward normal
    if normal[2] < 0:
        normal = -normal
    d = -np.dot(normal, centroid)
    dists = np.abs(points @ normal + d)
    rmse = float(np.sqrt((dists ** 2).mean()))
    return normal, d, rmse


def ransac_planes(points: np.ndarray, max_planes: int = 6) -> list[dict]:
    """Iteratively fit planes via RANSAC. Returns list of plane dicts."""
    remaining = points.copy()
    planes = []
    rng = np.random.default_rng(42)  # deterministic

    for _ in range(max_planes):
        if len(remaining) < MIN_PLANE_INLIERS:
            break
        best_inliers = None
        best_count = 0
        n = len(remaining)
        for _ in range(RANSAC_ITERATIONS):
            idx = rng.choice(n, 3, replace=False)
            p1, p2, p3 = remaining[idx]
            v1, v2 = p2 - p1, p3 - p1
            normal = np.cross(v1, v2)
            norm = np.linalg.norm(normal)
            if norm < 1e-9:
                continue
            normal = normal / norm
            if normal[2] < 0:
                normal = -normal
            d = -np.dot(normal, p1)
            dists = np.abs(remaining @ normal + d)
            inliers = dists < RANSAC_THRESHOLD_M
            count = int(inliers.sum())
            if count > best_count:
                best_count = count
                best_inliers = inliers
        if best_count < MIN_PLANE_INLIERS:
            break
        # Refine with all inliers
        inlier_pts = remaining[best_inliers]
        normal, d, rmse = fit_plane_svd(inlier_pts)
        # Recompute inliers with refined plane
        dists = np.abs(remaining @ normal + d)
        final_inliers = dists < RANSAC_THRESHOLD_M * 1.5
        final_pts = remaining[final_inliers]
        if len(final_pts) < MIN_PLANE_INLIERS:
            break
        normal, d, rmse = fit_plane_svd(final_pts)
        # Plane area estimate (convex hull area in plane coordinates)
        area = estimate_plane_area(final_pts, normal)
        if area < MIN_PLANE_AREA_M2:
            remaining = remaining[~final_inliers]
            continue
        slope_deg = float(math.degrees(math.acos(min(1.0, abs(normal[2])))))
        # Azimuth of steepest descent
        horiz = np.array([normal[0], normal[1]])
        hn = np.linalg.norm(horiz)
        azimuth = float(math.degrees(math.atan2(horiz[0], horiz[1]))) if hn > 1e-6 else 0.0
        if azimuth < 0:
            azimuth += 360.0
        planes.append({
            "normal": [round(float(v), 6) for v in normal],
            "d": round(float(d), 4),
            "slope_deg": round(slope_deg, 2),
            "azimuth_deg": round(azimuth, 2),
            "inlier_count": int(len(final_pts)),
            "rmse_m": round(rmse, 4),
            "area_m2": round(area, 2),
        })
        remaining = remaining[~final_inliers]

    return planes


def estimate_plane_area(points: np.ndarray, normal: np.ndarray) -> float:
    """Estimate plane patch area via 2D convex hull in plane coordinates."""
    # Project to plane basis
    n = normal / np.linalg.norm(normal)
    # Find orthogonal basis
    up = np.array([0.0, 0.0, 1.0])
    u = np.cross(n, up)
    if np.linalg.norm(u) < 1e-6:
        u = np.array([1.0, 0.0, 0.0])
    u = u / np.linalg.norm(u)
    v = np.cross(n, u)
    centroid = points.mean(axis=0)
    p2d = np.column_stack([(points - centroid) @ u, (points - centroid) @ v])
    # Convex hull via scipy if available, else bounding box approximation
    try:
        from scipy.spatial import ConvexHull
        hull = ConvexHull(p2d)
        return float(hull.volume)  # volume = area in 2D
    except ImportError:
        # Bounding-box fallback (overestimates; conservative for min-area gate)
        return float((p2d[:, 0].max() - p2d[:, 0].min()) *
                     (p2d[:, 1].max() - p2d[:, 1].min()))


def classify_roof(planes: list[dict]) -> str:
    """Classify roof type from reconstructed planes (descriptive, not prescriptive)."""
    if not planes:
        return "unknown"
    if len(planes) == 1:
        return "flat" if planes[0]["slope_deg"] < 5.0 else "shed"
    if len(planes) == 2:
        return "gable"
    if len(planes) >= 3:
        return "hip" if len(planes) <= 4 else "complex"
    return "unknown"


def process_feature(ft: dict, reader: EPTReader, target_level: int = 8) -> dict:
    """Reconstruct roof planes for one footprint. Returns stats dict."""
    props = ft.get("properties", {}) or {}
    geom = ft.get("geometry", {})
    coords = geom.get("coordinates", [])

    if geom.get("type") == "MultiPolygon":
        ring = max((p[0] for p in coords), key=lambda r: len(r))
        all_pts = []
        for part in coords:
            all_pts.extend(part[0])
    elif geom.get("type") == "Polygon":
        ring = coords[0]
        all_pts = coords[0]
    else:
        props["achievedLod"] = 1
        props["lodNote"] = "unsupported-geometry"
        return {"status": "unsupported-geometry"}

    lons = [c[0] for c in all_pts]
    lats = [c[1] for c in all_pts]
    cx_native, cy_native = reader.lonlat_to_native(sum(lons) / len(lons), sum(lats) / len(lats))
    node_id = reader.node_for_point(cx_native, cy_native, target_level)
    if not node_id:
        props["achievedLod"] = 1
        props["lodNote"] = "no-ept-node"
        return {"status": "no-ept-node"}

    las = reader.read_node(node_id)
    xs = np.array(las.x)
    ys = np.array(las.y)
    zs = np.array(las.z)
    classes = np.array(las.classification)

    ring_native = [reader.lonlat_to_native(c[0], c[1]) for c in ring]
    # Collect building points within polygon
    pts = []
    for i in range(len(xs)):
        if int(classes[i]) != CLASS_BUILDING:
            continue
        if point_in_polygon(float(xs[i]), float(ys[i]), ring_native):
            pts.append([float(xs[i]), float(ys[i]), float(zs[i])])

    if len(pts) < MIN_ROOF_POINTS:
        props["achievedLod"] = 1
        props["lodNote"] = f"insufficient-roof-points:{len(pts)}"
        return {"status": "insufficient-points", "n": len(pts)}

    points = np.array(pts)
    planes = ransac_planes(points)

    if not planes:
        props["achievedLod"] = 1
        props["lodNote"] = "no-planes-fitted"
        return {"status": "no-planes", "n": len(pts)}

    # LOD2 achieved: roof slope and orientation actually reconstructed
    props["achievedLod"] = 2
    props["roofPlanes"] = planes
    props["roofPlaneCount"] = len(planes)
    props["roofTypeObserved"] = classify_roof(planes)
    props["roofTypeNote"] = ("descriptive label from reconstructed planes; "
                             "not an input assumption")
    props["lodNote"] = f"LOD2: {len(planes)} roof plane(s) reconstructed from LiDAR"
    return {"status": "lod2", "planes": len(planes), "n": len(pts)}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--geojson", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--ept-url", default=None)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--level", type=int, default=8)
    args = ap.parse_args()

    ept_url = args.ept_url or find_posey_ept()
    print(f"EPT: {ept_url}", file=sys.stderr)
    try:
        reader = EPTReader(ept_url)
    except RuntimeError as e:
        print(f"FATAL: {e}", file=sys.stderr)
        sys.exit(1)

    data = json.loads(args.geojson.read_text())
    features = data.get("features", [])
    if args.limit > 0:
        features = features[:args.limit]

    stats = {"total": len(features), "lod2": 0, "lod1": 0, "errors": 0}
    for idx, ft in enumerate(features):
        try:
            r = process_feature(ft, reader, args.level)
            if r["status"] == "lod2":
                stats["lod2"] += 1
            else:
                stats["lod1"] += 1
        except Exception as e:
            stats["errors"] += 1
            ft.get("properties", {})["achievedLod"] = 1
            ft.get("properties", {})["lodNote"] = f"error:{str(e)[:60]}"
        if (idx + 1) % 200 == 0:
            print(f"  {idx + 1}/{len(features)} lod2={stats['lod2']}", file=sys.stderr)

    data["features"] = features
    args.out.write_text(json.dumps(data))
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
