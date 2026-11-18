#!/usr/bin/env python3
"""Stage versioned public sources for the Cesium River Valley screening viewer."""

from __future__ import annotations

import argparse
from contextlib import ExitStack
import heapq
from io import BytesIO
import json
from pathlib import Path
import shutil
import struct
import zlib
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from zipfile import ZipFile

import numpy as np
import rasterio
from rasterio.features import rasterize, shapes
from rasterio.transform import from_bounds
from pyproj import CRS, Transformer
import shapefile
from shapely.geometry import shape
from shapely.ops import transform

from compile_tri_state_offline_layers import COUNTIES, read_tiger, sha256
from tsm_geodesy import GeoidGrid, GEOID18_GRID_SHA256, default_geoid_grid_path

ROOT = Path(__file__).resolve().parents[2]
TNM = "https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1/TIFF/historical"
DEM_SOURCES = (
    ("n38w088", "20260417", "69e6dc80b66b01f903b6a024", "b74f6a1d0a052b087be2eb0c81e0bc97c2526afc966b86cd12d225c1b12480ab"),
    ("n38w089", "20260417", "69e6dc80b66b01f903b6a022", "ecc753dbe408f90d07afb32980cf942a992f4567fe90837a4251b870c1b4ca46"),
    ("n39w088", "20221205", "638eda99d34ed907bf7bcc59", "565d450ab19eab55c8df558a25f1b69e2c0a64f72b22217b3f7026662d991bc6"),
    ("n39w089", "20221205", "638eda97d34ed907bf7bcc57", "8d199408a98ad5a5316f93bc24d3f0789540dbdd7ac5136fa5347cae0e29dee2"),
)
# This rectangle contains the road bounds of the combined-nine scope.
REGIONAL_BOUNDS = (-88.43, 37.45, -87.015, 38.58)
# Relief tapers smoothly to the reference ellipsoid around the visual coverage edge.
MESH_BOUNDS = (-88.50, 37.38, -87.0, 38.62)
POSTS = 65
CITY_BOUNDS = (-87.965, 37.888, -87.843, 37.975)
SCREEN_LEVELS_M = (100, 105, 110, 115, 120, 125, 130, 135)
TIGER_ROOT = ROOT / "data/fabrics/downloads/tiger-2024"
CITY_BOUNDARY = ROOT / "data/posey-county/boundaries/mount-vernon-census2020.geojson"
CITY_SOURCE = ("https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/"
               "Places_CouSub_ConCity_SubMCD/MapServer/18/query?where=GEOID%3D%271851732%27"
               "&outFields=GEOID%2CNAME&outSR=4326&f=geojson")
OHIO_WATER_SOURCE = TIGER_ROOT / "tl_2024_18129_areawater.zip"
REPLAY = (
    ("03378500", "00060", "New Harmony, IN", "Discharge", "ft^3/s", "ft³/s"),
    ("03322000", "00065", "Evansville, IN", "Gage height", "ft", "ft"),
    ("03322420", "00065", "Uniontown Dam, KY", "Gage height", "ft", "ft"),
)
USGS_DAILY = "https://api.waterdata.usgs.gov/ogcapi/v1/collections/daily/items"


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n", encoding="utf-8")


def acquire_dem(cache: Path, cell: str, version: str, digest: str) -> tuple[Path, str]:
    name = f"USGS_1_{cell}_{version}.tif"
    url = f"{TNM}/{cell}/{name}"
    target = cache / name
    if not target.is_file():
        cache.mkdir(parents=True, exist_ok=True)
        for attempt in range(3):
            try:
                with tempfile.NamedTemporaryFile(dir=cache) as staging:
                    with urllib.request.urlopen(url, timeout=45) as response:
                        shutil.copyfileobj(response, staging, length=1024 * 1024)
                    staging.flush()
                    if sha256(Path(staging.name)) != digest:
                        raise ValueError(f"USGS source digest mismatch: {name}")
                    shutil.copyfile(staging.name, target)
                break
            except (OSError, urllib.error.URLError) as exc:
                if attempt == 2:
                    raise
                print(f"Retrying {name}: {exc}", flush=True)
                time.sleep(2 ** attempt)
    if sha256(target) != digest:
        raise ValueError(f"USGS source digest mismatch: {target}")
    return target, url


def build_roads(out: Path) -> None:
    sources = []
    features = []
    for county, (state, _) in sorted({**COUNTIES, "17185": ("IL", "Wabash")}.items()):
        name = f"tl_2024_{county}_roads.zip"
        path = TIGER_ROOT / name
        rows = read_tiger(path, county, "roads", state=state)
        for row in rows:
            props = row["properties"]
            row["properties"] = {k: props[k] for k in ("source_id", "county_geoid", "name", "mtfcc")}
        features.extend(rows)
        sources.append({"county": county, "featureCount": len(rows), "sha256": sha256(path),
                        "url": f"https://www2.census.gov/geo/tiger/TIGER2024/ROADS/{name}"})
    if len({f["id"] for f in features}) != len(features):
        raise ValueError("Duplicate TIGER/Line road identities")
    write_json(out / "roads.json", {
        "type": "FeatureCollection", "metadata": {
            "authority": "U.S. Census Bureau TIGER/Line 2024", "crs": "EPSG:4326",
            "featureCount": len(features), "countyCount": len(sources), "sources": sources, "engineeringUse": False,
        }, "features": features,
    })


def build_replay(out: Path) -> None:
    series = []
    for station, parameter, name, label, units, display_units in REPLAY:
        path = ROOT / "data/fabrics/downloads/usgs-water/april-2025-replay" / f"usgs-daily-{station}-{parameter}-2025-04-01.json"
        data = json.loads(path.read_bytes())
        features = data["features"]
        if data["type"] != "FeatureCollection" or not features:
            raise ValueError(f"No archived USGS observations: {station}")
        locations = set()
        rows = {}
        for feature in features:
            p = feature["properties"]
            if (p["monitoring_location_id"], p["parameter_code"], p["statistic_id"], p["unit_of_measure"]) != (
                    f"USGS-{station}", parameter, "00003", units):
                raise ValueError(f"Unexpected USGS series or unit: {station}")
            date = p["time"]
            if date in rows or not ("2025-04-01" <= date <= "2025-04-30"):
                raise ValueError(f"Duplicate or out-of-range USGS date: {date}")
            location = tuple(feature["geometry"]["coordinates"])
            if (feature["geometry"]["type"] != "Point" or len(location) != 2
                    or not (-89 < location[0] < -87 and 37 < location[1] < 39)):
                raise ValueError(f"Unexpected USGS station coordinates: {station}")
            locations.add(location)
            rows[date] = {"date": date, "value": float(p["value"]), "approval": p["approval_status"],
                          "qualifier": p["qualifier"]}
        if len(locations) != 1:
            raise ValueError(f"USGS position mismatch: {station}")
        lon, lat = locations.pop()
        query = urllib.parse.urlencode({"monitoring_location_id": f"USGS-{station}", "parameter_code": parameter,
                                        "time": "2025-04-01/2025-04-30", "f": "json", "limit": 100})
        series.append({"stationId": station, "name": name, "lon": lon, "lat": lat, "label": label,
                       "unit": display_units, "source": f"{USGS_DAILY}?{query}", "sourceSha256": sha256(path),
                       "rows": [rows[date] for date in sorted(rows)]})
    write_json(out / "replay.json", {"classification": "OBSERVED", "statistic": "daily mean", "series": series})


def bilinear(values: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    col = np.floor(x).astype(int)
    row = np.floor(y).astype(int)
    dx = x - col
    dy = y - row
    return ((1 - dy) * ((1 - dx) * values[row, col] + dx * values[row, col + 1])
            + dy * ((1 - dx) * values[row + 1, col] + dx * values[row + 1, col + 1]))


def heights(longitudes: np.ndarray, latitudes: np.ndarray, rasters: list, geoid: GeoidGrid) -> np.ndarray:
    west, south, east, north = MESH_BOUNDS
    use_x = (longitudes > west) & (longitudes < east)
    use_y = (latitudes > south) & (latitudes < north)
    output = np.zeros((POSTS, POSTS))
    if not use_x.any() or not use_y.any():
        return output
    lon, lat = np.meshgrid(longitudes[use_x], latitudes[use_y])
    orthometric = sample_dem(lon, lat, rasters)
    nx = (lon % 360 - geoid.glomn) / geoid.dlo
    ny = (lat - geoid.glamn) / geoid.dla
    separation = bilinear(geoid._data, nx, ny)
    rw, rs, re, rn = REGIONAL_BOUNDS
    weight = np.clip(np.minimum.reduce([
        (lon - west) / (rw - west), (east - lon) / (east - re),
        (lat - south) / (rs - south), (north - lat) / (north - rn),
    ]), 0, 1)
    output[np.ix_(use_y, use_x)] = (orthometric + separation) * weight
    return output


def sample_dem(lon: np.ndarray, lat: np.ndarray, rasters: list) -> np.ndarray:
    orthometric = np.full(lon.shape, np.nan)
    for raster, values in rasters:
        bounds = raster.bounds
        inside = ((lon >= bounds.left + raster.res[0]) & (lon <= bounds.right - raster.res[0])
                  & (lat >= bounds.bottom + raster.res[1]) & (lat <= bounds.top - raster.res[1])
                  & np.isnan(orthometric))
        x, y = ~raster.transform * (lon[inside], lat[inside])
        orthometric[inside] = bilinear(values, x - 0.5, y - 0.5)
    if not np.isfinite(orthometric).all() or np.any((orthometric < -250) | (orthometric > 1500)):
        raise ValueError("Regional 3DEP mosaic has missing or invalid elevations")
    return orthometric


def visible_ranges(max_level: int) -> list[dict]:
    west, south, east, north = MESH_BOUNDS
    ranges = [{"startX": 0, "endX": 1, "startY": 0, "endY": 0}]
    for level in range(1, max_level + 1):
        width = 180 / (1 << level)
        ranges.append({
            "startX": int((west + 180) / width), "endX": int((east + 180) / width),
            "startY": int((south + 90) / width), "endY": int((north + 90) / width),
        })
    return ranges


def build_terrain(out: Path, cache: Path, max_level: int) -> None:
    terrain = out / "terrain"
    ranges = visible_ranges(max_level)
    grid = default_geoid_grid_path()
    if sha256(grid) != GEOID18_GRID_SHA256:
        raise ValueError("GEOID18 grid digest mismatch")
    geoid = GeoidGrid(grid)
    sources = []
    with ExitStack() as stack:
        rasters = []
        for cell, version, item, digest in DEM_SOURCES:
            path, url = acquire_dem(cache, cell, version, digest)
            dataset = stack.enter_context(rasterio.open(path))
            if dataset.crs.to_epsg() != 4269 or dataset.count != 1 or dataset.shape != (3612, 3612):
                raise ValueError(f"Unexpected USGS raster header: {path}")
            raster = dataset.read(1, masked=True).filled(np.nan)
            rasters.append((dataset, raster))
            sources.append({"file": path.name, "url": url, "metadata": url.removesuffix(".tif") + ".xml",
                            "catalog": f"https://www.sciencebase.gov/catalog/item/{item}",
                            "sha256": digest, "bytes": path.stat().st_size, "publication": f"{version[:4]}-{version[4:6]}-{version[6:]}"})
        for level, tiles in enumerate(ranges):
            width = 180 / (1 << level)
            children = ranges[level + 1] if level < max_level else None
            for x in range(tiles["startX"], tiles["endX"] + 1):
                folder = terrain / str(level) / str(x)
                folder.mkdir(parents=True, exist_ok=True)
                lon = np.linspace(x * width - 180, (x + 1) * width - 180, POSTS)
                for y in range(tiles["startY"], tiles["endY"] + 1):
                    lat = np.linspace((y + 1) * width - 90, y * width - 90, POSTS)
                    samples = heights(lon, lat, rasters, geoid)
                    child_mask = 0
                    if children:
                        for dy in range(2):
                            for dx in range(2):
                                if (children["startX"] <= 2*x + dx <= children["endX"]
                                        and children["startY"] <= 2*y + dy <= children["endY"]):
                                    child_mask |= 1 << (2*dy + dx)
                    posts = np.rint((samples + 1000) * 5).astype("<u2").tobytes()
                    (folder / f"{y}.terrain").write_bytes(posts + bytes([child_mask, 0]))
            print(f"Generated Cesium terrain level {level}", flush=True)
        build_city_screening(out, rasters)
    write_json(terrain / "layer.json", {
        "tilejson": "2.1.0", "name": "Tri-State USGS 3DEP terrain", "version": "1.0.0",
        "format": "heightmap-1.0", "projection": "EPSG:4326", "scheme": "tms",
        "tiles": ["{z}/{x}/{y}.terrain"], "maxzoom": max_level, "available": [[r] for r in ranges],
        "attribution": "USGS 3D Elevation Program and NOAA NGS GEOID18",
    })
    write_json(terrain / "sources.json", {
        "sources": sources, "sourceCrs": "EPSG:4269", "sourceVerticalDatum": "NAVD88",
        "sourceUnits": "m", "sourceGroundSpacing": "1 arc-second",
        "sourceSpecification": "https://www.usgs.gov/faqs/what-projection-horizontal-datum-vertical-datum-and-resolution-a-usgs-digital-elevation-model",
        "visualCoverage": REGIONAL_BOUNDS, "transitionCoverage": MESH_BOUNDS,
        "output": "Geographic Cesium heightmap, approx. ellipsoidal metres via GEOID18",
        "geoid18Sha256": GEOID18_GRID_SHA256,
        "engineeringUse": False, "regulatoryUse": False,
    })


def ohio_seed_mask(grid_transform, grid_shape: tuple[int, int]) -> np.ndarray:
    with ZipFile(OHIO_WATER_SOURCE) as archive:
        stem = OHIO_WATER_SOURCE.stem
        source_crs = CRS.from_wkt(archive.read(stem + ".prj").decode("utf-8"))
        project = Transformer.from_crs(source_crs, "EPSG:4326", always_xy=True).transform
        reader = shapefile.Reader(shp=BytesIO(archive.read(stem + ".shp")),
                                  shx=BytesIO(archive.read(stem + ".shx")),
                                  dbf=BytesIO(archive.read(stem + ".dbf")))
        polygons = [transform(project, shape(row.shape.__geo_interface__)) for row in reader.iterShapeRecords()
                    if row.record["FULLNAME"] == "Ohio Riv" and row.record["MTFCC"] == "H3010"]
    return rasterize(polygons, transform=grid_transform, out_shape=grid_shape,
                     fill=0, all_touched=False).astype(bool)


def river_access_elevation(terrain_m: np.ndarray, seeds: np.ndarray) -> np.ndarray:
    """Lowest steady level connecting a cell to the river over four-neighbor terrain."""
    if terrain_m.shape != seeds.shape or not seeds.any() or not np.isfinite(terrain_m).all():
        raise ValueError("Invalid screening terrain or Ohio River seeds")
    rows, cols = terrain_m.shape
    costs = np.full((rows, cols), np.inf)
    queue = []
    for row, col in zip(*np.nonzero(seeds)):
        level = float(terrain_m[row, col])
        costs[row, col] = level
        queue.append((level, row, col))
    heapq.heapify(queue)
    while queue:
        level, row, col = heapq.heappop(queue)
        if level != costs[row, col]:
            continue
        for r, c in ((row - 1, col), (row + 1, col), (row, col - 1), (row, col + 1)):
            if 0 <= r < rows and 0 <= c < cols:
                candidate = max(level, terrain_m[r, c])
                if candidate < costs[r, c]:
                    costs[r, c] = candidate
                    heapq.heappush(queue, (candidate, r, c))
    return costs



def write_screening_png(path: Path, connected: np.ndarray) -> None:
    """Write a deterministic, pixel-faithful RGBA overlay for a 4-neighbor flood mask.

    Geospatial bounds are stored in screening.json, not in this unreferenced PNG.
    This is a hypothetical visual layer, never a hydraulic or regulatory output.
    """
    if connected.ndim != 2 or connected.dtype != np.bool_ or not connected.size:
        raise ValueError("Screening raster requires a nonempty 2D boolean connected-cell mask")
    rows, cols = connected.shape
    rgba = np.empty((rows, cols, 4), dtype=np.uint8)
    rgba[:, :, 0] = 35
    rgba[:, :, 1] = 186
    rgba[:, :, 2] = 242
    rgba[:, :, 3] = np.where(connected, 136, 0).astype(np.uint8)

    def chunk(kind: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + kind + data
                + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff))

    raw = b"".join(b"\x00" + rgba[row].tobytes() for row in range(rows))
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", cols, rows, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, level=9))
           + chunk(b"IEND", b""))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def build_city_screening(out: Path, rasters: list) -> None:
    west, south, east, north = CITY_BOUNDS
    rows, cols = 264, 360
    grid_transform = from_bounds(*CITY_BOUNDS, cols, rows)
    lon, lat = np.meshgrid(
        west + (np.arange(cols) + 0.5) * ((east - west) / cols),
        north - (np.arange(rows) + 0.5) * ((north - south) / rows),
    )
    terrain = sample_dem(lon, lat, rasters)
    seed = ohio_seed_mask(grid_transform, (rows, cols))
    costs = river_access_elevation(terrain, seed)
    city = json.loads(CITY_BOUNDARY.read_bytes())
    feature, = city["features"]
    if feature["properties"]["GEOID"] != "1851732":
        raise ValueError("Unexpected incorporated-city reference")
    city_geometry = shape(feature["geometry"])
    if not city_geometry.is_valid or not all(
            a <= b <= c for a, b, c in zip((west, south, west, south), city_geometry.bounds, (east, north, east, north))):
        raise ValueError("Mount Vernon screening grid does not cover the incorporated city")
    in_city = rasterize([city_geometry], transform=grid_transform, out_shape=(rows, cols)).astype(bool)
    write_json(out / "city-boundary.json", city)
    frames = []
    for level in SCREEN_LEVELS_M:
        connected = (costs <= level) & ~seed
        mask = connected.astype(np.uint8)
        path = f"screening/{level}.json"
        write_json(out / path, {
            "type": "FeatureCollection",
            "features": [{"type": "Feature", "geometry": geometry,
                          "properties": {"levelMNavd88": level, "class": "SCENARIO"}}
                         for geometry, _ in shapes(mask, mask=connected, transform=grid_transform)],
        })
        raster_path = f"screening/{level}.png"
        write_screening_png(out / raster_path, connected)
        frames.append({"levelMNavd88": level, "connectedCells": int(connected.sum()),
                       "connectedCityCells": int((connected & in_city).sum()), "path": path,
                       "raster": raster_path, "rasterSha256": sha256(out / raster_path)})
    write_json(out / "screening.json", {
        "classification": "SCENARIO", "method": "Four-neighbor connection to Census Ohio River surface polygons",
        "waterLevelSource": "Hypothetical fixed elevation", "verticalDatum": "NAVD88", "units": "m",
        "bounds": CITY_BOUNDS, "rows": rows, "cols": cols,
        "cityBoundary": {"geoid": "1851732", "sourceVintage": 2020,
                         "source": CITY_SOURCE, "sha256": sha256(out / "city-boundary.json")},
        "riverSha256": sha256(OHIO_WATER_SOURCE),
        "riverSource": f"https://www2.census.gov/geo/tiger/TIGER2024/AREAWATER/{OHIO_WATER_SOURCE.name}",
        "engineeringUse": False, "regulatoryUse": False, "frames": frames,
    })


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--max-level", type=int, choices=range(10, 14), default=13)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=args.output.parent) as temporary:
        output = Path(temporary)
        build_roads(output)
        build_replay(output)
        build_terrain(output, args.cache, args.max_level)
        shutil.copytree(output, args.output, dirs_exist_ok=True)


if __name__ == "__main__":
    main()
