#!/usr/bin/env python3
"""Acquire every Indiana 2020 QL2 LAS tile intersecting the Posey footprint AOI."""
from __future__ import annotations

import argparse
import json
import math
import subprocess
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform


BASE = "https://giselevationingov.s3.us-east-2.amazonaws.com/las/statewide/2020/SPW/ql2"
TILE_FT = 5000


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--geojson", required=True, type=Path)
    ap.add_argument("--output", required=True, type=Path)
    ap.add_argument("--expected-buildings", type=int, default=23082)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    doc = json.loads(args.geojson.read_text(encoding="utf-8"))
    features = doc.get("features", [])
    if len(features) != args.expected_buildings:
        raise SystemExit(f"expected {args.expected_buildings} footprints, found {len(features)}")

    to2966 = Transformer.from_crs("EPSG:4326", "EPSG:2966", always_xy=True)
    aoi = None
    for feature in features:
        g = shape(feature["geometry"])
        g = transform(lambda x, y, z=None: to2966.transform(x, y), g)
        aoi = g if aoi is None else aoi.union(g)
    minx, miny, maxx, maxy = aoi.bounds
    x0 = math.floor(minx / TILE_FT) * TILE_FT
    y0 = math.floor(miny / TILE_FT) * TILE_FT
    x1 = math.floor(maxx / TILE_FT) * TILE_FT
    y1 = math.floor(maxy / TILE_FT) * TILE_FT

    tiles = []
    for x in range(int(x0), int(x1) + TILE_FT, TILE_FT):
        for y in range(int(y0), int(y1) + TILE_FT, TILE_FT):
            box = __import__("shapely").geometry.box(x, y, x + TILE_FT, y + TILE_FT)
            if not aoi.intersects(box):
                continue
            name = f"IN2020_{x // 100:05d}{y // 1000:03d}_12"
            tiles.append(name)

    if not tiles:
        raise SystemExit("no 3DEP QL2 tiles intersect the Posey footprint AOI")

    args.output.mkdir(parents=True, exist_ok=True)
    if args.dry_run:
        print(json.dumps({"tileCount": len(tiles), "tiles": tiles}, indent=2))
        return

    for tile in sorted(set(tiles)):
        dest = args.output / f"{tile}.las"
        if dest.exists() and dest.stat().st_size > 0:
            continue
        url = f"{BASE}/{tile}.las"
        subprocess.run(
            ["curl", "--fail", "--location", "--retry", "4", "--retry-all-errors", "-o", str(dest), url],
            check=True,
        )
        if dest.stat().st_size == 0:
            raise SystemExit(f"downloaded empty LAS file: {dest}")

    hashes = []
    for path in sorted(args.output.glob("*.las")):
        digest = subprocess.check_output(["sha256sum", str(path)], text=True).split()[0]
        hashes.append(f"{digest}  {path.name}")
    (args.output / "SHA256SUMS-las.txt").write_text("\n".join(hashes) + "\n", encoding="utf-8")
    print(json.dumps({"tileCount": len(set(tiles)), "tiles": sorted(set(tiles)), "output": str(args.output)}))


if __name__ == "__main__":
    main()
