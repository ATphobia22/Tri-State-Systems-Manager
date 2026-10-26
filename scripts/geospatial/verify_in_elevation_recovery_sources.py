#!/usr/bin/env python3
"""Inventory official IGIO elevation archive sources needed for height-gap QA.

Public S3 HEAD requests establish existence and byte size, NOT a measured
building height, geodetic datum, source vintage, or a SHA-256 digest.
Never copies source geometry into an output.
"""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BUCKET = "giselevationingov"
REGION = "us-east-2"
HOST = "https://giselevationingov.s3.amazonaws.com"
REGISTRY = "https://registry.opendata.aws/in-elevation/"
NAME = re.compile(r"^IN2020_(\d{8})_12\.copc\.laz$")
MAX_TILES = 1000
MAX_HEADERS = 5000

# All prefixes and filename case checked against actual IGIO public S3 listings.
LAYER_TEMPLATES = {
    "2020_NDHM": "ndhmoptimized/statewide/2020/SPW/5ft/IN2020_{grid}_12_ndhm.tif",
    "2020_DSM": "dsmoptimized/statewide/2020/SPW/5ft/IN2020_{grid}_12_dsm.tif",
    "2020_DEM": "demoptimized/statewide/2020/SPW/2.5ft/IN2020_{grid}_12.tif",
    "2020_LAS": "las/statewide/2020/SPW/ql2/IN2020_{grid}_12.las",
    "2013_COPC": "copc/statewide/2013/SPW/ql3/in2013_{grid}_12.copc.laz",
    "2013_NDHM": "ndhmoptimized/statewide/2013/SPW/5ft/in2013_{grid}_12_ndhm.tif",
}
DEFAULT_LAYERS = ("2020_NDHM", "2020_DSM", "2020_DEM")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as src:
        for block in iter(lambda: src.read(1048576), b""):
            digest.update(block)
    return digest.hexdigest()


def parse_copc_tile_list(path: Path, *, max_tiles: int = MAX_TILES) -> list[str]:
    """Only accept the exact 2020 Indiana COPC path for each 5000-foot tile."""
    grids: set[str] = set()
    prefix = HOST + "/copc/statewide/2020/SPW/ql2/"
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        if not line.startswith(prefix):
            raise ValueError("Unrecognized COPC host or prefix")
        match = NAME.fullmatch(line[len(prefix):])
        if match is None:
            raise ValueError("Unrecognized tile filename")
        grid = match.group(1)
        east, north = int(grid[:4]), int(grid[4:])
        if east % 5 or north % 5:
            raise ValueError("Tile grid violates 5000-ft State Plane lattice")
        grids.add(grid)
        if len(grids) > max_tiles:
            raise ValueError("Too many tiles in bounded inventory")
    if not grids:
        raise ValueError("No 2020 IGIO COPC tiles in inventory")
    return sorted(grids)


def expected_objects(grids: list[str], layers: tuple[str, ...]) -> list[dict]:
    if not layers or len(layers) != len(set(layers)):
        raise ValueError("Layer list must be nonempty with no duplicates")
    if any(layer not in LAYER_TEMPLATES for layer in layers):
        raise ValueError("Unknown source layer")
    if len(grids) * len(layers) > MAX_HEADERS:
        raise ValueError("Too many public object HEAD requests")
    return [
        {"grid": grid, "layer": layer, "key": LAYER_TEMPLATES[layer].format(grid=grid)}
        for grid in grids for layer in layers
    ]


def head_object(key: str, *, timeout: float = 15.0) -> dict:
    if not key or any(bad in key for bad in ("..", "//", ":")) or key.startswith("/"):
        raise ValueError("Untrusted S3 key")
    req = Request(HOST + "/" + key, method="HEAD",
                  headers={"User-Agent": "TSM-IGIO-OpenData-Inventory/1.0"})
    try:
        with urlopen(req, timeout=timeout) as response:
            length = response.headers.get("Content-Length")
            if not length or not length.isdigit() or int(length) <= 0:
                return {"status": "METADATA_INCOMPLETE"}
            return {
                "status": "PRESENT",
                "sizeBytes": int(length),
                "etagNotSha256": response.headers.get("ETag"),
                "lastModified": response.headers.get("Last-Modified"),
                "s3VersionId": response.headers.get("x-amz-version-id"),
            }
    except HTTPError as exc:
        return ({"status": "NOT_FOUND"} if exc.code == 404
                else {"status": "UNVERIFIED_HTTP", "httpCode": exc.code})
    except (URLError, TimeoutError, OSError):
        return {"status": "SOURCE_UNREACHABLE"}


def inventory(
    tile_list: Path, *,
    layers: tuple[str, ...] = DEFAULT_LAYERS,
    verify: bool = False,
    max_tiles: int = MAX_TILES,
    workers: int = 12,
    timeout: float = 15.0,
) -> dict:
    if not 1 <= max_tiles <= MAX_TILES or not 1 <= workers <= 16 or not 0.5 <= timeout <= 120:
        raise ValueError("Inventory bound exceeded")
    grids = parse_copc_tile_list(tile_list, max_tiles=max_tiles)
    objects = expected_objects(grids, layers)
    if verify:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            tasks = {pool.submit(head_object, obj["key"], timeout=timeout): i
                     for i, obj in enumerate(objects)}
            for done in as_completed(tasks):
                objects[tasks[done]].update(done.result())
    else:
        for obj in objects:
            obj["status"] = "NOT_PROBED"
    summaries = {
        layer: dict(sorted(Counter(obj["status"] for obj in objects
                                   if obj["layer"] == layer).items()))
        for layer in layers
    }
    return {
        "schemaVersion": "tsm.igio-indiana-elevation-registry.v1",
        "dataClassification": "PUBLIC_SOURCE_METADATA",
        "engineeringUse": False,
        "regulatoryUse": False,
        "buildingHeightAccepted": False,
        "sourceAuthorityIndependentlyVerified": False,
        "bucket": BUCKET,
        "region": REGION,
        "registry": REGISTRY,
        "licence": "CC0",
        "inventoryMethod": "PUBLIC_ANONYMOUS_HEAD" if verify else "OFFLINE_PATH_PLAN",
        "inputTileListSha256": sha256_file(tile_list),
        "tileCount": len(grids),
        "candidateObjectCount": len(objects),
        "productAvailability": summaries,
        "objects": objects,
        "caveats": [
            "S3 object existence and ETag cannot prove roof height, units, datum, or SHA-256.",
            "nDHM is a normalized surface-height raster and may include trees.",
            "2013 source coverage/vintage may differ from a 2020 building footprint.",
            "Only validated LiDAR evidence can satisfy the separate building height gate.",
            "No downloaded LAS, geometry, coordinates or raster pixels are published.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tile-list", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("--layers", nargs="+", choices=sorted(LAYER_TEMPLATES),
                        default=list(DEFAULT_LAYERS))
    parser.add_argument("--max-tiles", type=int, default=MAX_TILES)
    parser.add_argument("--workers", type=int, default=12)
    parser.add_argument("--timeout", type=float, default=15.0)
    args = parser.parse_args()
    try:
        sidecar = args.out.with_suffix(args.out.suffix + ".sha256")
        if args.out.resolve() == args.tile_list.resolve() or args.out.exists() or sidecar.exists():
            raise ValueError("Refusing to overwrite source or preexisting receipt")
        report = inventory(args.tile_list, layers=tuple(args.layers), verify=args.verify,
                           max_tiles=args.max_tiles, workers=args.workers,
                           timeout=args.timeout)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n",
                            encoding="utf-8")
        sidecar.write_text(f"{sha256_file(args.out)}  {args.out.name}\n", encoding="utf-8")
        print(json.dumps({"tileCount": report["tileCount"],
                          "productAvailability": report["productAvailability"]}, sort_keys=True))
        return 0
    except (OSError, UnicodeError, ValueError) as exc:
        # User-owned paths and arbitrary source strings must not leak.
        print("Indiana elevation source inventory rejected: " + type(exc).__name__)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
