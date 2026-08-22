#!/usr/bin/env python3
"""Extract verified GeoTIFF metadata without inventing spatial parameters."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

try:
    import rasterio
except ImportError as exc:  # pragma: no cover
    raise SystemExit("rasterio is required: pip install rasterio") from exc


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def build_manifest(path: Path) -> dict[str, Any]:
    with rasterio.open(path) as dataset:
        if dataset.crs is None:
            raise ValueError("GeoTIFF has no CRS; refusing to create a geospatial manifest")
        if dataset.width <= 0 or dataset.height <= 0:
            raise ValueError("GeoTIFF dimensions must be positive")
        transform = dataset.transform
        bounds = dataset.bounds
        resolution_x = abs(transform.a)
        resolution_y = abs(transform.e)
        if resolution_x <= 0 or resolution_y <= 0:
            raise ValueError("GeoTIFF has invalid pixel resolution")
        return {
            "schemaVersion": "1.0.0",
            "assetType": "orthophoto",
            "assetId": f"ortho-{sha256_file(path)[:16]}",
            "source": {"filename": path.name},
            "contentHash": sha256_file(path),
            "horizontalCrs": dataset.crs.to_string(),
            "bounds": {
                "minX": bounds.left,
                "minY": bounds.bottom,
                "maxX": bounds.right,
                "maxY": bounds.top,
            },
            "pixelWidth": dataset.width,
            "pixelHeight": dataset.height,
            "resolution": {"x": resolution_x, "y": resolution_y, "units": "dataset CRS units per pixel"},
            "bandCount": dataset.count,
            "nodata": dataset.nodata,
            "transform": list(transform),
            "tileRecommendation": {"tileSize": 2048, "format": "PNG/JPEG/WEBP", "overviewResampling": "average"},
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    manifest = build_manifest(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
