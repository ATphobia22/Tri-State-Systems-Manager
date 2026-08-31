#!/usr/bin/env python3
"""
Clip a Posey County (or statewide tile) DEM COG/GeoTIFF to Bonebank structure AOI
and optionally write a HEC-RAS-ready terrain subset.

Dependencies: rasterio, pyproj (optional), shapely
  pip install rasterio shapely pyproj

CRS policy (TSM):
  - Analysis: EPSG:2966 (NAD83 / Indiana West, US survey feet) + NAVD88
  - If your HEC-RAS project was started on another code, reproject deliberately
    and record the transform in the Evidence Ledger. Do not use EPSG:2968
    unless you have verified that code for your RAS project definition.

Authority: DERIVATION only. Does not issue LOMA or floodway approvals.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

# Site defaults (WGS84) — expand buffer in projected feet after transform
SITE_LON = -88.00510
SITE_LAT = 37.84589
BFE_FT = 375.0
LAG_SURVEY_FT = 377.2


def main() -> None:
    ap = argparse.ArgumentParser(description="Clip DEM to Bonebank AOI")
    ap.add_argument("dem", type=Path, help="Input DEM GeoTIFF/COG path")
    ap.add_argument("-o", "--out", type=Path, default=Path("bonebank_dem_clip.tif"))
    ap.add_argument("--buffer-ft", type=float, default=500.0, help="Half-size box buffer in US feet (approx)")
    ap.add_argument("--dst-crs", default="EPSG:2966", help="Target CRS (default EPSG:2966)")
    ap.add_argument("--manifest", type=Path, default=Path("bonebank_dem_clip_manifest.json"))
    args = ap.parse_args()

    try:
        import rasterio
        from rasterio.windows import from_bounds
        from rasterio.warp import transform as warp_transform, calculate_default_transform, reproject, Resampling
        from rasterio.enums import Resampling as RS
    except ImportError as e:
        raise SystemExit("Install rasterio: pip install rasterio shapely") from e

    # Build AOI in geographic then project to dst CRS for window
    # Approximate: convert buffer feet to degrees only for coarse window if dem is geographic;
    # preferred path: reproject full read window in projected CRS.

    with rasterio.open(args.dem) as src:
        src_crs = src.crs
        # Transform site lon/lat to src CRS for windowing
        xs, ys = warp_transform("EPSG:4326", src_crs, [SITE_LON], [SITE_LAT])
        x0, y0 = xs[0], ys[0]

        # Buffer: if projected feet CRS, use feet; if meters, convert
        buf = args.buffer_ft
        crs_str = src_crs.to_string() if src_crs else ""
        if src_crs and src_crs.is_projected:
            # Heuristic: EPSG:26916 is meters
            if "26916" in crs_str or (src_crs.linear_units or "").lower().startswith("metre"):
                buf = args.buffer_ft * 0.304800609601  # US survey foot → m approx
        else:
            # geographic: ~ft to degrees (very rough, latitude-dependent)
            buf = args.buffer_ft / 364000.0

        west, east = x0 - buf, x0 + buf
        south, north = y0 - buf, y0 + buf
        window = from_bounds(west, south, east, north, transform=src.transform)
        data = src.read(1, window=window, boundless=True, fill_value=src.nodata)
        transform = src.window_transform(window)

        profile = src.profile.copy()
        profile.update(
            height=data.shape[0],
            width=data.shape[1],
            transform=transform,
            compress="deflate",
        )

        args.out.parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(args.out, "w", **profile) as dst:
            dst.write(data, 1)

        # Optional reproject to EPSG:2966
        out_reproj = args.out.with_name(args.out.stem + "_2966.tif")
        if args.dst_crs and src_crs and src_crs.to_string() != args.dst_crs:
            dst_crs = args.dst_crs
            transform_t, width_t, height_t = calculate_default_transform(
                src_crs, dst_crs, profile["width"], profile["height"],
                *rasterio.transform.array_bounds(profile["height"], profile["width"], transform),
            )
            repro_profile = profile.copy()
            repro_profile.update(crs=dst_crs, transform=transform_t, width=width_t, height=height_t)
            with rasterio.open(out_reproj, "w", **repro_profile) as dst:
                reproject(
                    source=data,
                    destination=rasterio.band(dst, 1),
                    src_transform=transform,
                    src_crs=src_crs,
                    dst_transform=transform_t,
                    dst_crs=dst_crs,
                    resampling=Resampling.bilinear,
                )
            repro_path = str(out_reproj)
        else:
            repro_path = None

    manifest = {
        "artifact_type": "tsm.derivation.dem_clip.v1",
        "site": "13101 Bonebank Road",
        "centroid_wgs84": [SITE_LON, SITE_LAT],
        "bfe_ft_navd88": BFE_FT,
        "lag_survey_ft_navd88": LAG_SURVEY_FT,
        "input_dem": str(args.dem),
        "output_clip": str(args.out),
        "output_reproject_2966": repro_path,
        "buffer_ft_requested": args.buffer_ft,
        "dst_crs_policy": "EPSG:2966",
        "authority_class": "DERIVATION",
        "human_authority_final": True,
        "note": "Corroboration for terrain / RAS import only — not a sealed survey substitute",
    }
    args.manifest.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
