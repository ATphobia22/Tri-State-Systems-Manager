#!/usr/bin/env python3
"""Validate and describe an orthophoto without inventing geospatial metadata."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def build_manifest(path: Path) -> dict[str, Any]:
    try:
        import rasterio
    except ImportError as exc:
        raise RuntimeError("rasterio is required: python -m pip install rasterio") from exc

    with rasterio.open(path) as dataset:
        if dataset.crs is None:
            raise ValueError("orthophoto has no CRS; refusing to generate georeferenced metadata")
        bounds = dataset.bounds
        resolution_x, resolution_y = dataset.res
        transform = dataset.transform
        return {
            "assetType": "orthophoto",
            "assetPath": str(path),
            "contentHashSha256": sha256_file(path),
            "driver": dataset.driver,
            "width": dataset.width,
            "height": dataset.height,
            "bandCount": dataset.count,
            "dtype": dataset.dtypes[0],
            "crs": dataset.crs.to_string(),
            "bounds": {
                "minX": bounds.left,
                "minY": bounds.bottom,
                "maxX": bounds.right,
                "maxY": bounds.top,
            },
            "resolution": {"x": resolution_x, "y": resolution_y},
            "nodata": dataset.nodata,
            "transform": list(transform),
            "isTiled": bool(dataset.is_tiled),
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data/ortho_surface_albedo_metadata.json"))
    args = parser.parse_args()

    manifest = build_manifest(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
