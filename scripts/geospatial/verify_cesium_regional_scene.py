#!/usr/bin/env python3
"""Validate the generated Cesium viewer assets as deployed under the Pages base."""

from __future__ import annotations

from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import struct
import sys

from build_cesium_regional_scene import DEM_SOURCES, POSTS, REPLAY, SCREEN_LEVELS_M
from stage_cesium_posey_buildings import ARCHIVE_DIGEST, FOOTPRINT_COUNT, FOOTPRINT_DIGEST, MESH_COUNT, mesh_ids


def verify(root: Path) -> None:
    def read(relative: str) -> dict:
        return json.loads((root / relative).read_bytes())

    def need(condition: bool, detail: str) -> None:
        if not condition:
            raise ValueError(detail)

    data = "data/cesium-regional/"
    roads = read(data + "roads.json")
    road_ids = [f["id"] for f in roads["features"]]
    by_county = Counter(f["properties"]["county_geoid"] for f in roads["features"])
    need(len(road_ids) == len(set(road_ids)) == roads["metadata"]["featureCount"] == 29461, "TIGER road coverage")
    need(len(by_county) == 9 and by_county["17185"] == 3632, "Combined-nine road coverage")
    for source in roads["metadata"]["sources"]:
        need(by_county[source["county"]] == source["featureCount"], "TIGER county counts")

    replay = read(data + "replay.json")
    need(replay["classification"] == "OBSERVED" and len(replay["series"]) == len(REPLAY), "USGS archive")
    for actual, (station, _, _, _, _, _) in zip(replay["series"], REPLAY):
        need(actual["stationId"] == station and len(actual["rows"]) == 30, "USGS April 2025 daily series")

    terrain = data + "terrain/"
    layer = read(terrain + "layer.json")
    sources = read(terrain + "sources.json")
    need(layer["format"] == "heightmap-1.0" and layer["scheme"] == "tms", "Terrain protocol")
    need([s["sha256"] for s in sources["sources"]] == [source[3] for source in DEM_SOURCES], "USGS DEM source hashes")
    need(sources["sourceVerticalDatum"] == "NAVD88" and sources["engineeringUse"] is False, "Terrain provenance")
    expected_files = set()
    available = [ranges[0] for ranges in layer["available"]]
    need(len(available) == layer["maxzoom"] + 1 and layer["maxzoom"] >= 11, "Terrain level inventory")
    for level, area in enumerate(available):
        next_area = available[level + 1] if level + 1 < len(available) else None
        for x in range(area["startX"], area["endX"] + 1):
            for y in range(area["startY"], area["endY"] + 1):
                path = root / terrain / f"{level}/{x}/{y}.terrain"
                raw = path.read_bytes()
                expected_files.add(path)
                mask = 0
                if next_area:
                    for i in range(4):
                        if (next_area["startX"] <= 2*x + i % 2 <= next_area["endX"]
                                and next_area["startY"] <= 2*y + i // 2 <= next_area["endY"]):
                            mask |= 1 << i
                need(len(raw) == POSTS * POSTS * 2 + 2 and raw[-2:] == bytes([mask, 0]), f"Terrain bytes: {path}")
    need(expected_files == set((root / terrain).rglob("*.terrain")), "Unindexed terrain tile")
    width = 180 / (1 << 13)
    x = int((-87.898 + 180) / width)
    y = int((37.932 + 90) / width)
    tile = root / terrain / f"13/{x}/{y}.terrain"
    posts = struct.unpack(f"<{POSTS * POSTS}H", tile.read_bytes()[:-2])
    need(max(posts) - min(posts) > 20 and min(posts) > 5000, "Mount Vernon relief is missing")
    # Verify shared posts on a real high-detail tile boundary.
    adjacent = struct.unpack(f"<{POSTS * POSTS}H", (root / terrain / f"13/{x+1}/{y}.terrain").read_bytes()[:-2])
    need(posts[POSTS - 1::POSTS] == adjacent[::POSTS], "Terrain seam mismatch")

    screening = read(data + "screening.json")
    counts = [f["connectedCells"] for f in screening["frames"]]
    need(screening["classification"] == "SCENARIO" and screening["engineeringUse"] is False, "Screening authority")
    need(tuple(f["levelMNavd88"] for f in screening["frames"]) == SCREEN_LEVELS_M, "Screening frame inventory")
    need(counts == sorted(counts) and counts[0] < counts[-1], "Screening extents must grow monotonically")
    city_counts = [frame["connectedCityCells"] for frame in screening["frames"]]
    need(city_counts == sorted(city_counts) and city_counts[0] < city_counts[-1], "City screening coverage")
    city_boundary = root / (data + "city-boundary.json")
    need(sha256(city_boundary.read_bytes()).hexdigest() == screening["cityBoundary"]["sha256"], "City boundary digest")
    for frame in screening["frames"]:
        polygons = read(data + frame["path"])["features"]
        need(bool(polygons) == bool(frame["connectedCells"]), "Screening geometry/cell mismatch")
        need(all(f["geometry"]["type"] in ("Polygon", "MultiPolygon") and f["properties"]["class"] == "SCENARIO"
                 for f in polygons), "Invalid screening geometry")

    raw = (root / "mount-vernon-scene/scene.json").read_bytes()
    city = json.loads(raw)
    receipt = read("mount-vernon-scene/scene.receipt.json")
    need(sha256(raw).hexdigest() == receipt["sha256"] and len(raw) == receipt["byte_length"], "City archive digest")
    for kind in ("buildings", "roads"):
        features = city[kind]["features"]
        need(len(features) == receipt["feature_counts"][kind] > 0, f"City {kind} count")
        need(all(f["properties"]["height_m"] is None for f in features), "City planimetric elevation boundary")

    buildings = root / "3d-tiles/buildings-lidar-12450"
    tile_manifest = read("3d-tiles/buildings-lidar-12450/tileset.json")
    need(tile_manifest["asset"]["version"] == "1.1" and tile_manifest["root"]["implicitTiling"], "Building tileset format")
    for entry in (buildings / "SHA256SUMS").read_text().splitlines():
        digest, name = entry.split(maxsplit=1)
        need(sha256((buildings / name).read_bytes()).hexdigest() == digest, f"Building tiles checksum: {name}")

    preview = data + "posey-buildings/"
    preview_tileset = read(preview + "tileset.json")
    visual_ids = mesh_ids(root / preview, preview_tileset)
    posey = read(preview + "sources.json")
    missing = read(preview + "missing-height-footprints.json")
    outline_ids = {item["properties"]["source_objectid"] for item in missing["features"]}
    need(posey["previewArchiveSha256"] == ARCHIVE_DIGEST and posey["sourceFootprintSha256"] == FOOTPRINT_DIGEST,
         "Posey preview source digests")
    need(posey["meshCount"] == len(visual_ids) == MESH_COUNT and posey["footprintCount"] == FOOTPRINT_COUNT,
         "Posey 3D and source counts")
    need(posey["footprintOnlyCount"] == len(outline_ids) == len(missing["features"]) == FOOTPRINT_COUNT - MESH_COUNT
         and visual_ids.isdisjoint(outline_ids), "Posey footprint-only coverage")
    alignment = preview_tileset["asset"]["extras"]["tsm"]["displayAlignment"]
    need(alignment == posey["displayAlignment"] and alignment["geoidSha256"] == sources["geoid18Sha256"]
         and -32 < alignment["rootLocalUpOffsetM"] < -29 and not posey["engineeringUse"],
         "Posey alignment and authority boundary")
    for name in ("Workers/createVerticesFromHeightmap.js", "Workers/createGroundPolylineGeometry.js",
                 "Assets/approximateTerrainHeights.json", "LICENSE.md"):
        need((root / "vendor/cesium" / name).stat().st_size > 0, f"Cesium runtime asset {name}")
    print(f"Cesium build verified: {len(road_ids)} road segments, {len(expected_files)} terrain tiles, "
          f"{sum(len(s['rows']) for s in replay['series'])} observations, {len(counts)} screening frames, "
          f"{len(visual_ids)} Posey meshes and {len(outline_ids)} footprint-only IDs")


if __name__ == "__main__":
    verify(Path(sys.argv[1]))
