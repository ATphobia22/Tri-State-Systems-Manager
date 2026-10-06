#!/usr/bin/env python3
"""Acquire authoritative Posey County IGIO building footprints and join terrain elevations.

The IGIO Building Footprints 2016-2020 layer is the authoritative geometry source.
The layer is LiDAR-derived/reference geometry and has no Z values, so this program
performs an explicit elevation join against the highest-resolution committed
Posey DEM that covers each footprint. It never invents building heights.

Outputs:
  <output>                         enriched FeatureCollection
  <output>.receipt.json             acquisition/elevation provenance
  <output>.sha256                   SHA-256 of the GeoJSON
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import numpy as np
import rasterio
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import unary_union
from shapely.validation import make_valid
from rasterio.warp import transform as warp_transform

SERVICE = "https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0"
QUERY = f"{SERVICE}/query"
EXPECTED_POSEY = 23082
FT_PER_M = 3.280839895013123


def request_json(params: dict[str, object], attempts: int = 8) -> dict:
    query = urlencode(params)
    url = f"{QUERY}?{query}"
    last: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            result = subprocess.run(
                [
                    "curl", "--fail", "--silent", "--show-error", "--location",
                    "--retry", "3", "--retry-delay", "2", "--retry-all-errors",
                    "--http1.1", "--max-time", "300",
                    "-A", "TSM-IGIO-Posey-Building-Acquisition/1.0",
                    url,
                ],
                check=True,
                capture_output=True,
                text=True,
                timeout=330,
            )
            payload = json.loads(result.stdout)
            if "error" in payload:
                raise RuntimeError(json.dumps(payload["error"]))
            return payload
        except Exception as exc:
            last = exc
            if attempt == attempts:
                break
            time.sleep(min(60, 5 * attempt))
    raise RuntimeError(f"IGIO request failed after {attempts} attempts: {last}")


def arcgis_rings_to_geometry(rings: list[list[list[float]]]) -> Polygon | MultiPolygon:
    """Convert ArcGIS rings to valid polygonal geometry, preserving multipart/hole topology."""
    records: list[tuple[float, Polygon | MultiPolygon]] = []
    for raw_ring in rings:
        coordinates = [[float(point[0]), float(point[1])] for point in raw_ring]
        if len(coordinates) < 4:
            raise ValueError("ArcGIS polygon ring has fewer than four coordinates")
        if coordinates[0] != coordinates[-1]:
            coordinates.append(coordinates[0])
        area = 0.0
        for index, (x0, y0) in enumerate(coordinates[:-1]):
            x1, y1 = coordinates[index + 1]
            area += x0 * y1 - x1 * y0
        area *= 0.5
        if abs(area) <= 1e-15:
            raise ValueError("ArcGIS polygon ring has zero area")

        geometry = Polygon(coordinates)
        if not geometry.is_valid:
            geometry = make_valid(geometry)
        if geometry.is_empty or geometry.geom_type not in {"Polygon", "MultiPolygon"}:
            raise ValueError(
                f"ArcGIS polygon ring repair produced non-polygon geometry: {geometry.geom_type}"
            )
        records.append((area, geometry))

    outers = [geometry for area, geometry in records if area < 0.0]
    holes = [geometry for area, geometry in records if area > 0.0]
    if not outers:
        raise ValueError("ArcGIS polygon contains no clockwise exterior ring")

    polygons: list[Polygon | MultiPolygon] = []
    assigned_holes: set[int] = set()
    for outer_geometry in outers:
        assigned: list[Polygon | MultiPolygon] = []
        for hole_index, hole_geometry in enumerate(holes):
            if hole_index in assigned_holes:
                continue
            if outer_geometry.contains(hole_geometry.representative_point()):
                assigned.append(hole_geometry)
                assigned_holes.add(hole_index)
        if assigned:
            outer_geometry = outer_geometry.difference(unary_union(assigned))
        if outer_geometry.is_empty or outer_geometry.geom_type not in {"Polygon", "MultiPolygon"}:
            raise ValueError("ArcGIS polygon hole subtraction produced non-polygon geometry")
        polygons.append(outer_geometry)

    if len(assigned_holes) != len(holes):
        raise ValueError("ArcGIS polygon contains an unassigned interior ring")

    geometry = unary_union(polygons)
    if geometry.is_empty or geometry.geom_type not in {"Polygon", "MultiPolygon"}:
        raise ValueError(f"ArcGIS polygon assembly produced {geometry.geom_type}")
    if not geometry.is_valid:
        geometry = make_valid(geometry)
    if geometry.is_empty or geometry.geom_type not in {"Polygon", "MultiPolygon"} or not geometry.is_valid:
        raise ValueError("ArcGIS polygon assembly could not be validated")
    return geometry


def largest_ring(geometry: dict) -> list[list[float]]:
    if geometry.get("type") == "Polygon":
        polys = [geometry.get("coordinates", [])]
    elif geometry.get("type") == "MultiPolygon":
        polys = geometry.get("coordinates", [])
    else:
        return []
    best: list[list[float]] = []
    best_area = -1.0
    for poly in polys:
        if not poly:
            continue
        ring = poly[0]
        if len(ring) > 1 and ring[0] == ring[-1]:
            ring = ring[:-1]
        if len(ring) < 3:
            continue
        area = 0.0
        for i, (x0, y0, *_rest) in enumerate(ring):
            x1, y1, *_ = ring[(i + 1) % len(ring)]
            area += x0 * y1 - x1 * y0
        area = abs(area) * 0.5
        if area > best_area:
            best_area = area
            best = ring
    return best


def centroid(ring: list[list[float]]) -> tuple[float, float]:
    a = 0.0
    cx = cy = 0.0
    for i, (x0, y0, *_rest) in enumerate(ring):
        x1, y1, *_ = ring[(i + 1) % len(ring)]
        cross = x0 * y1 - x1 * y0
        a += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if abs(a) < 1e-15:
        return (
            sum(float(p[0]) for p in ring) / len(ring),
            sum(float(p[1]) for p in ring) / len(ring),
        )
    return cx / (3.0 * a), cy / (3.0 * a)


class ElevationSampler:
    def __init__(self, paths: list[Path]) -> None:
        self.datasets = []
        for path in paths:
            ds = rasterio.open(path)
            self.datasets.append(ds)

    def close(self) -> None:
        for ds in self.datasets:
            ds.close()

    def sample(self, lonlat: list[tuple[float, float]]) -> tuple[float, float, float, int, str] | None:
        for ds in self.datasets:
            xs = [p[0] for p in lonlat]
            ys = [p[1] for p in lonlat]
            if ds.crs and str(ds.crs) != "EPSG:4326":
                xs, ys = warp_transform("EPSG:4326", ds.crs, xs, ys)
            coords = list(zip(xs, ys))
            if not coords:
                continue
            vals = []
            for value in ds.sample(coords):
                v = float(value[0])
                if math.isfinite(v) and (ds.nodata is None or not math.isclose(v, float(ds.nodata))):
                    vals.append(v)
            if vals:
                return (
                    float(min(vals)) * FT_PER_M,
                    float(max(vals)) * FT_PER_M,
                    float(sum(vals) / len(vals)) * FT_PER_M,
                    len(vals),
                    str(ds.name),
                )
        return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", required=True, type=Path)
    ap.add_argument("--expected-count", type=int, default=EXPECTED_POSEY)
    ap.add_argument("--dem-root", type=Path, default=Path("data/posey-county/elevation"))
    ap.add_argument("--boundary", type=Path, default=Path("data/posey-county/boundaries/posey-county.geojson"))
    args = ap.parse_args()

    # The live IGIO layer advertises a 2,000-feature transfer limit. Avoid a
    # metadata request here because the service intermittently rejects otherwise
    # valid metadata requests with HTTP 500 while its query endpoint remains usable.

    boundary_doc = json.loads(args.boundary.read_text(encoding="utf-8"))
    boundary = shape(boundary_doc["features"][0]["geometry"])

    features: list[dict] = []
    object_ids: list[int] = []
    object_id_set: set[int] = set()
    page_size = 2000

    def acquire_objectid_range(lower: int, upper: int) -> None:
        """Acquire a disjoint OBJECTID range without server-side offsets.

        The live IGIO service intermittently returns HTTP 500 "/ by zero" for
        offset pagination. Range partitioning avoids that server defect while
        preserving complete, non-overlapping coverage. Any response that hits
        the transfer limit is bisected until each leaf query is complete.
        """
        try:
            payload = request_json({
                "where": f"county='Posey' AND objectid >= {lower} AND objectid <= {upper}",
                "outFields": "objectid,lidaryear,county",
                "returnGeometry": "true",
                "outSR": "4326",
                "resultRecordCount": page_size,
                "f": "pjson",
            })
        except RuntimeError as exc:
            # IGIO has emitted "/ by zero" for oversized range/offset queries.
            # Treat that as a signal to bisect the OBJECTID domain rather than
            # retrying the same server-side query indefinitely.
            if "/ by zero" not in str(exc) or lower >= upper:
                raise
            midpoint = lower + (upper - lower) // 2
            acquire_objectid_range(lower, midpoint)
            acquire_objectid_range(midpoint + 1, upper)
            return

        got = payload.get("features", [])
        exceeded = bool(payload.get("exceededTransferLimit", False))

        if exceeded or len(got) >= page_size:
            if lower >= upper:
                raise SystemExit(
                    f"IGIO range {lower}-{upper} remains transfer-limited at one OBJECTID"
                )
            midpoint = lower + (upper - lower) // 2
            acquire_objectid_range(lower, midpoint)
            acquire_objectid_range(midpoint + 1, upper)
            return

        for feature in got:
            attrs = feature.get("attributes", {})
            geometry = feature.get("geometry")
            if not geometry or attrs.get("county") != "Posey":
                raise SystemExit("IGIO response contained an unexpected county or missing geometry")
            object_id = int(attrs["objectid"])
            if object_id in object_id_set:
                raise SystemExit(f"Duplicate IGIO objectid {object_id} returned across partition queries")
            object_ids.append(object_id)
            object_id_set.add(object_id)
            rings = geometry.get("rings")
            if not rings:
                raise SystemExit(f"IGIO object {object_id} has no polygon rings")
            try:
                polygon = arcgis_rings_to_geometry(rings)
            except ValueError as exc:
                raise SystemExit(f"IGIO object {object_id} returned invalid polygon geometry: {exc}") from exc
            if polygon.is_empty or not polygon.is_valid:
                raise SystemExit(f"IGIO object {object_id} returned invalid polygon geometry")
            intersects_boundary = polygon.intersects(boundary)
            clipped = polygon.intersection(boundary) if intersects_boundary else polygon
            if intersects_boundary and (
                clipped.is_empty
                or clipped.geom_type not in {"Polygon", "MultiPolygon"}
                or not clipped.is_valid
            ):
                raise SystemExit(f"IGIO object {object_id} could not be clipped to the exact Posey County boundary")
            features.append({
                "type": "Feature",
                "geometry": mapping(clipped),
                "properties": {
                    "igioObjectId": object_id,
                    "lidarYear": attrs.get("lidaryear"),
                    "county": attrs.get("county"),
                    "geometryClippedToPoseyBoundary": intersects_boundary and not polygon.equals(clipped),
                    "poseyBoundaryAudit": "INTERSECTING" if intersects_boundary else "OUTSIDE_CENSUS_BOUNDARY",
                },
            })

        print(f"Acquired {len(features)}/{args.expected_count} (OBJECTID range {lower}-{upper})", flush=True)

    # The service has a finite OBJECTID domain; the recursive range splitter
    # never depends on undocumented offset pagination semantics.
    acquire_objectid_range(0, 2_147_483_647)

    count = len(features)
    if count != args.expected_count or len(object_id_set) != count:
        raise SystemExit(
            f"IGIO Posey feature-count/object-id mismatch: expected {args.expected_count}, got {count}"
        )

    dem_paths = sorted(args.dem_root.glob("*.tif"))
    if not dem_paths:
        raise SystemExit(f"No Posey DEM GeoTIFFs found under {args.dem_root}")
    # Prefer finer-resolution rasters; coverage is checked per footprint.
    dem_paths.sort(key=lambda p: float(rasterio.open(p).res[0]))
    sampler = ElevationSampler(dem_paths)
    try:
        enriched = []
        no_elevation = 0
        for index, feature in enumerate(features, start=1):
            ring = largest_ring(feature["geometry"])
            if len(ring) < 3:
                raise SystemExit(f"Invalid polygon for IGIO object {feature['properties']['igioObjectId']}")
            c = centroid(ring)
            # Vertex + centroid sampling ties elevation directly to the actual
            # footprint geometry rather than parcel geometry.
            sample_points = [c] + [(float(p[0]), float(p[1])) for p in ring[::max(1, len(ring)//16)]]
            result = sampler.sample(sample_points)
            props = feature["properties"]
            props["groundElevationSource"] = "TSM committed Posey 3DEP-derived DEM"
            props["groundElevationMethod"] = "IGIO-footprint centroid+boundary sampling"
            props["groundElevationReference"] = result[4] if result else None
            if result:
                props["groundElevationMinFt"] = result[0]
                props["groundElevationMaxFt"] = result[1]
                props["groundElevationMeanFt"] = result[2]
                props["groundElevationFt"] = result[2]
                props["groundElevationSampleCount"] = result[3]
                props["elevationCoverage"] = "SAMPLED"
            else:
                no_elevation += 1
                props["elevationCoverage"] = "UNAVAILABLE"
            props["sourceAuthority"] = "Indiana Geographic Information Office"
            props["authorityClass"] = "DERIVED"
            props["geometrySource"] = "Indiana Building Footprints 2016-2020"
            props["surveyGrade"] = False
            enriched.append(feature)
            if index % 1000 == 0:
                print(f"Elevation-joined {index}/{count}", flush=True)
    finally:
        sampler.close()

    if no_elevation:
        raise SystemExit(f"Elevation join failed for {no_elevation} footprints")

    output = args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    document = {
        "type": "FeatureCollection",
        "sourceAuthority": "Indiana Geographic Information Office",
        "sourceDataset": "Indiana Building Footprints 2016-2020",
        "sourceService": SERVICE,
        "sourceFilter": "county='Posey'",
        "sourceFeatureCount": count,
        "geometryCrs": "EPSG:4326",
        "elevationAuthority": "TSM committed 3DEP-derived Posey DEM",
        "elevationMethod": "footprint centroid + boundary samples",
        "elevationVerticalUnits": "feet",
        "elevationVerticalDatum": "NAVD88",
        "humanReviewRequired": True,
        "surveyGrade": False,
        "features": enriched,
    }
    output.write_text(json.dumps(document, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix(output.suffix + ".sha256").write_text(f"{digest}  {output.name}\n", encoding="utf-8")
    receipt = {
        "schema": "tsm-posey-igio-building-footprints-v1",
        "sourceService": SERVICE,
        "sourceDataset": "Indiana Building Footprints 2016-2020",
        "county": "Posey",
        "featureCount": count,
        "objectIdMin": object_ids[0],
        "objectIdMax": object_ids[-1],
        "geometryCrs": "EPSG:4326",
        "elevationMethod": "IGIO footprint centroid + boundary samples against highest-resolution covering committed Posey DEM",
        "elevationSampleCountField": "groundElevationSampleCount",
        "elevationSource": [str(p) for p in dem_paths],
        "geojsonSha256": digest,
        "status": "acquired-and-elevation-joined",
    }
    output.with_suffix(output.suffix + ".receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
