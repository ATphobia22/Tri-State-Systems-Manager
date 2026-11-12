#!/usr/bin/env python3
"""Verify DEM metadata and reproducible horizontal reprojection; never infer vertical datum."""
import argparse
import hashlib
import json
from pathlib import Path

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("source", type=Path)
    p.add_argument("--target-crs", default="EPSG:2966")
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--source-vertical-datum", required=True,
                   help="Documented source vertical datum, e.g. NAVD88; not auto-verified")
    p.add_argument("--source-vertical-units", choices=["m", "ftUS", "ft"], required=True)
    p.add_argument("--target-vertical-units", choices=["m", "ftUS", "ft"], default="m")
    p.add_argument("--evidence", type=Path, required=True)
    args = p.parse_args()
    import rasterio
    from rasterio.warp import calculate_default_transform, reproject, Resampling
    from pyproj import CRS
    factors = {"m": 1.0, "ftUS": 1200/3937, "ft": 0.3048}
    with rasterio.open(args.source) as src:
        if src.crs is None:
            raise SystemExit("BLOCKED: source raster has no horizontal CRS")
        if src.count != 1:
            raise SystemExit("BLOCKED: expected a single-band DEM")
        target = CRS.from_user_input(args.target_crs)
        if target.is_geographic:
            raise SystemExit("BLOCKED: target CRS must be projected")
        transform, width, height = calculate_default_transform(
            src.crs, target, src.width, src.height, *src.bounds)
        profile = src.profile.copy()
        profile.update(driver="GTiff", crs=target.to_wkt(), transform=transform,
                       width=width, height=height, dtype="float32",
                       nodata=-9999.0, compress="deflate", predictor=3)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(args.output, "w", **profile) as dst:
            from rasterio.enums import Resampling
            import numpy as np
            from rasterio.warp import reproject
            factor = factors[args.source_vertical_units] / factors[args.target_vertical_units]
            # Reproject first, then scale only valid elevations, never nodata.
            reproject(source=rasterio.band(src, 1), destination=rasterio.band(dst, 1),
                      src_transform=src.transform, src_crs=src.crs,
                      src_nodata=src.nodata, dst_transform=transform, dst_crs=target,
                      dst_nodata=-9999.0, resampling=Resampling.bilinear)
            for _, window in dst.block_windows(1):
                values = dst.read(1, window=window)
                valid = np.isfinite(values) & (values != -9999.0)
                values[valid] *= factor
                dst.write(values, 1, window=window)
        evidence = {
            "schema": "tsm.dem-transform.v1", "source": str(args.source),
            "source_horizontal_crs": src.crs.to_string(),
            "target_horizontal_crs": target.to_string(),
            "source_vertical_datum_claim": args.source_vertical_datum,
            "source_vertical_datum_verified": False,
            "vertical_datum_transformation_applied": False,
            "vertical_unit_conversion_factor": factor,
            "source_vertical_units": args.source_vertical_units,
            "target_vertical_units": args.target_vertical_units,
            "engineering_accuracy_verified": False,
            "output": str(args.output),
        }
    h = hashlib.sha256()
    with args.output.open("rb") as f:
        for chunk in iter(lambda: f.read(1024*1024), b""):
            h.update(chunk)
    evidence["output_sha256"] = h.hexdigest()
    args.evidence.parent.mkdir(parents=True, exist_ok=True)
    args.evidence.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print("Horizontal reprojection and vertical unit conversion complete; vertical datum remains unverified.")

if __name__ == "__main__":
    main()
