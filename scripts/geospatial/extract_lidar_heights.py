#!/usr/bin/env python3
"""Extract LiDAR-derived building heights for IGIO footprints.

Method (research-validated 2026-10-07, per USGS July 2026 3DEP evaluation):
for each building footprint, query 3DEP LiDAR via AWS EPT, isolate roof
points (Classification 6) and ground points (Classification 2), and compute:

    height = median(roof Z) - median(ground Z)

This REPLACES the prohibited storeys*3.5 assumption and the fixed 10-ft
extrusion default. Heights are written as `lidarHeightFt` with full
provenance. Features without sufficient LiDAR coverage are left without a
height (the builder skips them fail-closed); nothing is invented.

Data sources:
  - EPT: USGS 3DEP LiDAR via https://s3-us-west-2.amazonaws.com/usgs-lidar-public/
    (STAC catalog: https://usgs-lidar-stac.s3-us-west-2.amazonaws.com/ept/catalog.json)
  - Default dataset: USGS_LPC_IN_WT_B12_Posey_2013_LAS_2016 (2013/2016 Posey County)
    Fallback: IN_Statewide_Opt2_B6_2017
  - Z values are meters, NAVD88 orthometric (USGS 3DEP spec).

Fail-closed behavior:
  - EPT unreachable -> exit non-zero, no output written.
  - No roof points or no ground points for a feature -> height left unset,
    reason recorded; downstream builder skips the feature.
  - Never falls back to assumed heights.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import sys
import urllib.request
from pathlib import Path

M_TO_FTUS = 3937.0 / 1200.0

STAC_CATALOG = "https://usgs-lidar-stac.s3-us-west-2.amazonaws.com/ept/catalog.json"
DEFAULT_EPT = ("https://s3-us-west-2.amazonaws.com/usgs-lidar-public/"
               "USGS_LPC_IN_WT_B12_Posey_2013_LAS_2016/ept.json")
FALLBACK_EPT = ("https://s3-us-west-2.amazonaws.com/usgs-lidar-public/"
                "IN_Statewide_Opt2_B6_2017/ept.json")

# Posey County bbox (lon/lat) for STAC search
POSEY_BBOX = (-88.08, 37.75, -87.92, 38.03)

CLASS_GROUND = 2
CLASS_BUILDING = 6
CLASS_BUILDING_ALT = 8

MIN_ROOF_POINTS = 5
MIN_GROUND_POINTS = 3


def fetch_json(url: str, timeout: int = 30) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "TSM-LiDAR-Extractor/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def find_posey_ept() -> str:
    """Search the STAC catalog for an EPT dataset intersecting Posey County.

    Prefers the most specific (Posey-named) dataset over statewide collections.
    """
    cat = fetch_json(STAC_CATALOG)
    candidates = []
    for link in cat.get("links", []):
        if link.get("rel") != "item":
            continue
        name = link["href"].split("/")[-1]
        if "IN_" not in name and "Indiana" not in name and "Posey" not in name:
            continue
        try:
            item = fetch_json(link["href"], timeout=15)
        except Exception:
            continue
        bbox = item.get("bbox") or []
        if len(bbox) >= 4 and not (bbox[2] < POSEY_BBOX[0] or bbox[0] > POSEY_BBOX[2]
                                   or bbox[3] < POSEY_BBOX[1] or bbox[1] > POSEY_BBOX[3]):
            for asset in item.get("assets", {}).values():
                href = asset.get("href", "")
                if href.endswith("ept.json"):
                    # Prefer Posey-specific over statewide: smaller bbox = more specific
                    area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
                    specificity = 0 if "Posey" in name else 1
                    candidates.append((specificity, area, href, name))
    if not candidates:
        raise RuntimeError("no EPT dataset intersecting Posey County found in STAC catalog")
    candidates.sort()
    print(f"STAC candidates: {[(c[3], round(c[1], 3)) for c in candidates]}", file=sys.stderr)
    return candidates[0][2]


def lonlat_to_3857(lon: float, lat: float) -> tuple[float, float]:
    """WGS84 lon/lat -> EPSG:3857 (EPT native SRS)."""
    x = lon * 20037508.34 / 180.0
    y = math.log(math.tan((90.0 + lat) * math.pi / 360.0)) / (math.pi / 180.0)
    y = y * 20037508.34 / 180.0
    return x, y


def point_in_polygon(x: float, y: float, ring: list) -> bool:
    """Ray-casting point-in-polygon."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def node_bounds(node_id: str, root_bounds: list) -> list:
    level, x, y, z = map(int, node_id.split("-"))
    n = 2 ** level
    xmin, ymin, zmin, xmax, ymax, zmax = root_bounds
    dx, dy, dz = (xmax - xmin) / n, (ymax - ymin) / n, (zmax - zmin) / n
    return [xmin + x * dx, ymin + y * dy, zmin + z * dz,
            xmin + (x + 1) * dx, ymin + (y + 1) * dy, zmin + (z + 1) * dz]


def median(values: list[float]) -> float:
    s = sorted(values)
    n = len(s)
    mid = n // 2
    return (s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2.0)


class EPTReader:
    def __init__(self, ept_url: str):
        self.base = ept_url.rsplit("/", 1)[0]
        try:
            self.info = fetch_json(ept_url)
        except Exception as e:
            raise RuntimeError(f"EPT unreachable at {ept_url}: {e}")
        self.root_bounds = self.info["bounds"]
        self.native_crs = self._resolve_native_crs(self.info.get("srs"))
        self._hier = None
        self._level_nodes: dict[int, set[str]] = {}
        self._cache: dict[str, object] = {}

    @staticmethod
    def _resolve_native_crs(srs):
        """Resolve the horizontal EPT CRS from common EPT srs encodings."""
        if isinstance(srs, str) and srs:
            return srs
        if isinstance(srs, dict):
            authority = srs.get("authority")
            horizontal = srs.get("horizontal")
            if authority and horizontal:
                return f"{authority}:{horizontal}"
            for key in ("compound", "wkt", "horizontal"):
                if srs.get(key):
                    return str(srs[key])
        return "EPSG:3857"

    def lonlat_to_native(self, lon: float, lat: float) -> tuple[float, float]:
        """Transform WGS84 coordinates into the EPT horizontal CRS."""
        try:
            from pyproj import Transformer
            transformer = getattr(self, "_transformer", None)
            if transformer is None:
                transformer = Transformer.from_crs("EPSG:4326", self.native_crs, always_xy=True)
                self._transformer = transformer
            return transformer.transform(lon, lat)
        except Exception as e:
            if self.native_crs != "EPSG:3857":
                raise RuntimeError(f"unable to transform EPSG:4326 to EPT CRS {self.native_crs}: {e}")
            return lonlat_to_3857(lon, lat)

    def hierarchy(self, target_level: int = 6) -> dict:
        """Load only the EPT hierarchy pages needed for target-level lookup."""
        if self._hier is not None and self._hier.get("_loaded_to_level") == target_level:
            return {k: v for k, v in self._hier.items() if k != "_loaded_to_level"}
        page = fetch_json(f"{self.base}/ept-hierarchy/0-0-0-0.json")
        self._hier = dict(page)
        self._hier["_loaded_to_level"] = target_level
        return page

    def node_for_point(self, x: float, y: float, target_level: int = 8):
        """Resolve a populated EPT node by descending only the point's x/y path."""
        xmin, ymin, _, xmax, ymax, _ = self.root_bounds
        if not (xmax > xmin and ymax > ymin):
            return None
        current_page = self.hierarchy(target_level)
        ix = min(2 ** target_level - 1, max(0, int((x - xmin) / (xmax - xmin) * (2 ** target_level))))
        iy = min(2 ** target_level - 1, max(0, int((y - ymin) / (ymax - ymin) * (2 ** target_level))))
        candidates = [nid for nid, count in current_page.items()
                      if isinstance(count, int) and count != 0 and nid.startswith("1-")]
        for level in range(1, target_level + 1):
            n = 2 ** level
            px = min(n - 1, max(0, int((x - xmin) / (xmax - xmin) * n)))
            py = min(n - 1, max(0, int((y - ymin) / (ymax - ymin) * n)))
            prefix = f"{level}-{px}-{py}-"
            matching = [nid for nid, count in current_page.items()
                        if nid.startswith(prefix) and isinstance(count, int) and count != 0]
            if not matching:
                return None
            if level == target_level:
                return matching[0]
            next_pages = []
            for nid in matching:
                count = current_page[nid]
                if count < 0:
                    next_pages.append(nid)
            if not next_pages:
                return matching[0]
            merged = {}
            for nid in next_pages:
                child_page = fetch_json(f"{self.base}/ept-hierarchy/{nid}.json")
                merged.update(child_page)
            current_page = merged
        return None

    def read_node(self, node_id: str):
        """Fetch and parse LAZ for a node (cached). Returns laspy LasData."""
        if node_id in self._cache:
            return self._cache[node_id]
        import laspy
        url = f"{self.base}/ept-data/{node_id}.laz"
        req = urllib.request.Request(url, headers={"User-Agent": "TSM-LiDAR-Extractor/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        las = laspy.read(io.BytesIO(data))
        self._cache[node_id] = las
        # Keep cache bounded
        if len(self._cache) > 8:
            oldest = next(iter(self._cache))
            del self._cache[oldest]
        return las


def extract_heights(geojson_path: Path, out_path: Path, ept_url: str | None,
                    limit: int = 0, target_level: int = 8) -> dict:
    import numpy as np

    ept_url = ept_url or find_posey_ept()
    print(f"EPT: {ept_url}", file=sys.stderr)
    reader = EPTReader(ept_url)

    data = json.loads(geojson_path.read_text())
    features = data.get("features", [])
    if limit > 0:
        features = features[:limit]

    stats = {"total": len(features), "with_height": 0, "no_roof_points": 0,
             "no_ground_points": 0, "no_ept_node": 0, "errors": 0, "error_examples": [], "class_histogram": {}, "sample_node": None}

    for idx, ft in enumerate(features):
        props = ft.get("properties", {}) or {}
        sid = props.get("igioObjectId", props.get("sourceObjectId", props.get("OBJECTID", idx)))
        try:
            geom = ft.get("geometry", {})
            coords = geom.get("coordinates", [])
            if geom.get("type") == "MultiPolygon":
                # Use largest part
                parts = coords
                ring = max((p[0] for p in parts), key=lambda r: abs(sum(
                    (r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1])
                    for i in range(len(r))) / 2))
            elif geom.get("type") == "Polygon":
                ring = coords[0]
            else:
                stats["errors"] += 1
                props["lidarHeightStatus"] = "unsupported-geometry"
                continue

            # Footprint bbox in EPSG:3857 (collect all exterior ring points)
            all_pts = []
            if geom.get("type") == "MultiPolygon":
                for part in coords:
                    all_pts.extend(part[0])
            else:
                all_pts = coords[0]
            lons = [c[0] for c in all_pts]
            lats = [c[1] for c in all_pts]
            cx3857, cy3857 = lonlat_to_3857(sum(lons) / len(lons), sum(lats) / len(lats))

            node_id = reader.node_for_point(cx3857, cy3857, target_level)
            if not node_id:
                stats["no_ept_node"] += 1
                props["lidarHeightStatus"] = "no-ept-node"
                continue

            las = reader.read_node(node_id)
            xs = np.array(las.x)
            ys = np.array(las.y)
            zs = np.array(las.z)  # meters, NAVD88
            classes = np.array(las.classification)
            for cls_value, cls_count in zip(*np.unique(classes, return_counts=True)):
                key = str(int(cls_value))
                stats["class_histogram"][key] = stats["class_histogram"].get(key, 0) + int(cls_count)
            if stats["sample_node"] is None:
                stats["sample_node"] = {"node": node_id, "point_count": int(len(zs)), "native_crs": reader.native_crs, "root_bounds": reader.root_bounds}

            # Bounding-box prefilter in 3857
            bx1, by1 = lonlat_to_3857(min(lons), min(lats))
            bx2, by2 = lonlat_to_3857(max(lons), max(lats))
            # Small buffer for ground points (20 m)
            buf = 5.0
            in_buf = (xs >= bx1 - buf) & (xs <= bx2 + buf) & (ys >= by1 - buf) & (ys <= by2 + buf)
            if not np.any(in_buf):
                stats["no_ground_points"] += 1
                props["lidarHeightStatus"] = "no-points-in-buffer"
                continue

            # Polygon in 3857 for precise filtering
            ring_native = [reader.lonlat_to_native(c[0], c[1]) for c in ring]
            # For MultiPolygon use the largest ring for point test
            if geom.get("type") == "MultiPolygon":
                ring3857 = [lonlat_to_3857(c[0], c[1]) for c in
                            max((p[0] for p in coords), key=lambda r: len(r))]

            idxs = np.where(in_buf)[0]
            roof_z, ground_z = [], []
            try:
                from pyproj import CRS
                axis = CRS.from_user_input(reader.native_crs).axis_info[0]
                unit_name = (axis.unit_name or "").lower()
                buffer_native = 20.0 / 0.3048006096012192 if "foot" in unit_name else 20.0
            except Exception:
                buffer_native = 20.0
            gx0 = min(p[0] for p in ring_native) - buffer_native
            gx1 = max(p[0] for p in ring_native) + buffer_native
            gy0 = min(p[1] for p in ring_native) - buffer_native
            gy1 = max(p[1] for p in ring_native) + buffer_native
            for i in idxs:
                c = int(classes[i])
                px, py = float(xs[i]), float(ys[i])
                if c in (CLASS_BUILDING, CLASS_BUILDING_ALT):
                    if point_in_polygon(px, py, ring_native):
                        roof_z.append(float(zs[i]))
                elif c == CLASS_GROUND:
                    if gx0 <= px <= gx1 and gy0 <= py <= gy1:
                        ground_z.append(float(zs[i]))

            if len(roof_z) < MIN_ROOF_POINTS:
                stats["no_roof_points"] += 1
                props["lidarHeightStatus"] = f"insufficient-roof-points:{len(roof_z)}"
                continue
            if len(ground_z) < MIN_GROUND_POINTS:
                stats["no_ground_points"] += 1
                props["lidarHeightStatus"] = f"insufficient-ground-points:{len(ground_z)}"
                continue

            roof_m = median(roof_z)
            ground_m = median(ground_z)
            height_m = roof_m - ground_m
            if height_m <= 0 or height_m > 100:
                stats["errors"] += 1
                props["lidarHeightStatus"] = f"implausible-height:{height_m:.2f}m"
                continue

            height_ft = height_m * M_TO_FTUS
            props["lidarHeightFt"] = round(height_ft, 2)
            props["lidarHeightM"] = round(height_m, 3)
            props["lidarRoofElevM"] = round(roof_m, 3)
            props["lidarGroundElevM"] = round(ground_m, 3)
            props["lidarRoofPoints"] = len(roof_z)
            props["lidarGroundPoints"] = len(ground_z)
            props["lidarHeightMethod"] = "median(Classification in {6,8} Z) - median(Classification=2 Z)"
            props["lidarHeightDatum"] = "NAVD88"
            props["lidarHeightUnit"] = "ftUS"
            props["lidarSource"] = ept_url
            props["lidarHeightStatus"] = "OK"
            stats["with_height"] += 1

        except Exception as e:
            stats["errors"] += 1
            if len(stats["error_examples"]) < 10:
                stats["error_examples"].append(type(e).__name__ + ": " + str(e)[:240])
            props["lidarHeightStatus"] = f"error:{str(e)[:60]}"

        if (idx + 1) % 500 == 0:
            print(f"  {idx + 1}/{len(features)} ... with_height={stats['with_height']}",
                  file=sys.stderr)

    data["features"] = features
    out_path.write_text(json.dumps(data))
    return stats


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--geojson", required=True, type=Path, help="input IGIO footprints")
    ap.add_argument("--out", required=True, type=Path, help="output GeoJSON with lidarHeightFt")
    ap.add_argument("--ept-url", default=None, help="override EPT ept.json URL")
    ap.add_argument("--limit", type=int, default=0, help="process first N features (testing)")
    ap.add_argument("--level", type=int, default=6, help="EPT hierarchy level for node queries")
    args = ap.parse_args()

    try:
        stats = extract_heights(args.geojson, args.out, args.ept_url, args.limit, args.level)
    except RuntimeError as e:
        print(f"FATAL: {e}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(stats, indent=2))
    if stats["with_height"] == 0 and stats["total"] > 0:
        print("FATAL: no heights extracted", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
