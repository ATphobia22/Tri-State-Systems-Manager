#!/usr/bin/env python3
"""Encode a validated elevation raster as Mapbox Terrain-RGB PNG tilesource.

The input must already have an explicitly verified vertical datum. Terrain-RGB
encodes meters above the source datum; it does not encode or transform datums.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from osgeo import gdal


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

    dataset = gdal.Open(str(args.input), gdal.GA_ReadOnly)
    if dataset is None:
        raise FileNotFoundError(args.input)

    band = dataset.GetRasterBand(1)
    values = band.ReadAsArray().astype(np.float64)
    if args.units == "feet":
        values *= 0.3048

    rgb = encode_terrain_rgb(values)
    driver = gdal.GetDriverByName("PNG")
    if driver is None:
        raise RuntimeError("GDAL PNG driver is unavailable")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    output = driver.Create(str(args.output), dataset.RasterXSize, dataset.RasterYSize, 3, gdal.GDT_Byte)
    if output is None:
        raise RuntimeError(f"unable to create {args.output}")

    output.SetGeoTransform(dataset.GetGeoTransform())
    output.SetProjection(dataset.GetProjection())
    for index in range(3):
        output.GetRasterBand(index + 1).WriteArray(rgb[index])
    output.FlushCache()
    output = None
    dataset = None
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
