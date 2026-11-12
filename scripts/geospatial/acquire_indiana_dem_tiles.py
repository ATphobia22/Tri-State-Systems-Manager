#!/usr/bin/env python3
"""Bounded, resumable Indiana 2016–2020 DEM ImageServer acquisition.

Raster export is a source acquisition, NOT a certified vertical transformation.
All raster CRS/vertical units must be checked from authoritative source metadata.
"""
import argparse
import hashlib
import json
import math
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests

SERVICE = "https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_2016_2020_DEM/ImageServer"

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def fetch_json(session, url, params):
    r = session.get(url, params=params, timeout=(15, 90))
    r.raise_for_status()
    result = r.json()
    if "error" in result:
        raise RuntimeError(str(result["error"]))
    return result

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--bbox-3857", nargs=4, type=float, required=True,
                   metavar=("XMIN", "YMIN", "XMAX", "YMAX"))
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--resolution-m", type=float, default=1.0)
    p.add_argument("--tile-pixels", type=int, default=1024)
    p.add_argument("--max-bytes", type=int, default=12_000_000_000)
    p.add_argument("--delay", type=float, default=0.2)
    args = p.parse_args()
    xmin, ymin, xmax, ymax = args.bbox_3857
    if not all(math.isfinite(v) for v in (xmin,ymin,xmax,ymax)):
        p.error("Bounding coordinates must be finite")
    if not xmin < xmax or not ymin < ymax:
        p.error("Bounding box must have positive area")
    if not (0.25 <= args.resolution_m <= 30 and 128 <= args.tile_pixels <= 2048):
        p.error("Resolution must be 0.25–30 m; tile pixels 128–2048")
    args.out.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": "TSM-DEM-Evidence/1.0"})
    metadata = fetch_json(session, SERVICE, {"f": "json"})
    if "pixelType" not in metadata or "extent" not in metadata:
        raise RuntimeError("ImageServer did not return expected raster metadata")
    nx = math.ceil((xmax - xmin) / (args.resolution_m * args.tile_pixels))
    ny = math.ceil((ymax - ymin) / (args.resolution_m * args.tile_pixels))
    if nx * ny > 50000:
        p.error("More than 50,000 tiles requested; divide into smaller AOIs")
    manifest = {
        "schema": "tsm.dem-acquisition.v1", "source_url": SERVICE,
        "source_metadata": metadata, "bbox_3857": [xmin,ymin,xmax,ymax],
        "requested_resolution_m": args.resolution_m,
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
        "vertical_datum_verified": False, "vertical_transform_applied": False,
        "engineering_accuracy_verified": False, "tiles": []
    }
    total = 0
    try:
        for iy in range(ny):
            for ix in range(nx):
                left = xmin + ix * args.tile_pixels * args.resolution_m
                bottom = ymin + iy * args.tile_pixels * args.resolution_m
                right = min(xmax, left + args.tile_pixels * args.resolution_m)
                top = min(ymax, bottom + args.tile_pixels * args.resolution_m)
                width = max(1, math.ceil((right-left)/args.resolution_m))
                height = max(1, math.ceil((top-bottom)/args.resolution_m))
                name = f"dem_{iy:04d}_{ix:04d}.tif"
                dest = args.out / name
                if not dest.exists() or dest.stat().st_size == 0:
                    params = {
                        "f": "image", "bbox": f"{left},{bottom},{right},{top}",
                        "bboxSR": 3857, "imageSR": 3857,
                        "size": f"{width},{height}", "format": "tiff",
                        "pixelType": "F32", "interpolation": "RSP_NearestNeighbor",
                    }
                    response = session.get(SERVICE + "/exportImage", params=params,
                                           timeout=(20, 180), stream=True)
                    response.raise_for_status()
                    temp = dest.with_suffix(".part")
                    with open(temp, "wb") as f:
                        for chunk in response.iter_content(1024*1024):
                            if chunk:
                                f.write(chunk)
                                total += len(chunk)
                                if total > args.max_bytes:
                                    raise RuntimeError("Download exceeded --max-bytes")
                    with open(temp, "rb") as f:
                        if f.read(4) not in (b"II*\\x00", b"MM\\x00*"):
                            raise RuntimeError(f"{name} is not a TIFF; inspect ImageServer response")
                    os.replace(temp, dest)
                    time.sleep(args.delay)
                manifest["tiles"].append({
                    "name": name, "bbox_3857": [left,bottom,right,top],
                    "bytes": dest.stat().st_size, "sha256": sha256(dest)
                })
    finally:
        manifest["tile_count"] = len(manifest["tiles"])
        manifest["complete"] = len(manifest["tiles"]) == nx * ny
        (args.out / "acquisition-manifest.json").write_text(
            json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    print(f"Acquired {len(manifest['tiles'])}/{nx*ny} TIFF tiles; manifest written")

if __name__ == "__main__":
    main()
