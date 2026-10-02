#!/usr/bin/env python3
"""Encode a validated elevation raster as Mapbox Terrain-RGB PNG tilesource.

The input must already have an explicitly verified vertical datum. Terrain-RGB
encodes meters above the source datum; it does not encode or transform datums.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def encode_terrain_rgb(elevation_m: np.ndarray) -> np.ndarray:
    """Return uint8 RGB channels using the Mapbox Terrain-RGB encoding."""
    if not np.all(np.isfinite(elevation_m)):
        raise ValueError("input elevation contains non-finite values")

    encoded = np.rint((elevation_m + 10000.0) * 10.0).astype(np.int64)
    if np.any(encoded < 0) or np.any(encoded > 16777215):
        raise ValueError("elevation is outside Terrain-RGB representable range")

    red = (encoded // 65536).astype(np.uint8)
    green = ((encoded // 256) % 256).astype(np.uint8)
    blue = (encoded % 256).astype(np.uint8)
    return np.stack((red, green, blue), axis=0)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--vertical-datum", required=True)
    parser.add_argument("--units", choices=("meters", "feet"), default="meters")
    args = parser.parse_args()

    datum = args.vertical_datum.strip()
    if not datum:
        raise ValueError("--vertical-datum is required and must be verified upstream")
    if datum.upper() != "NAVD88":
        raise ValueError("production Terrain-RGB contract currently requires verified NAVD88 input")

    # Pillow decodes GeoTIFF elevation samples without requiring the GDAL Python
    # bindings. Georeferencing is intentionally not copied to PNG; XYZ placement
    # is owned by the caller/tile pyramid builder.
    with Image.open(args.input) as dataset:
        values = np.asarray(dataset, dtype=np.float64)

    if values.ndim == 3:
        if values.shape[0] != 1:
            raise ValueError("input raster must contain exactly one elevation band")
        values = values[0]
    if values.ndim != 2:
        raise ValueError("input raster must decode to a 2D elevation array")
    if args.units == "feet":
        values *= 0.3048

    rgb = encode_terrain_rgb(values)
    image = np.moveaxis(rgb, 0, -1).astype(np.uint8)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(image, mode="RGB").save(args.output, format="PNG", optimize=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
