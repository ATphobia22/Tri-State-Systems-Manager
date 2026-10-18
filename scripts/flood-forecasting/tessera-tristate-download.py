#!/usr/bin/env python3
"""
TESSERA embeddings download for the TSM tri-state region.

Pulls 128-dimensional, 10m annual land embeddings (2017-2025) from the
AWS Open Data Registry for the Ohio-Wabash tri-state bounding box.

Prereqs:  pip install geotessera boto3 numpy rasterio

Dataset: https://registry.opendata.aws/tessera/  (CC-BY-SA)
Docs:    https://github.com/dClimate/tessera-embeddings/blob/main/docs/global-store.md
"""

import os
from pathlib import Path

# Tri-state bounding box: [min_lon, min_lat, max_lon, max_lat]
# Covers Posey, Vanderburgh, Warrick, Gibson (IN), Gallatin, White (IL),
# Henderson, Union (KY)
TRISTATE_BBOX = (-88.7, 37.6, -87.2, 38.5)

YEARS = list(range(2017, 2026))  # 2017-2025 inclusive

OUT_DIR = Path(os.environ.get("TESSERA_OUT", "./tessera-tristate"))
OUT_DIR.mkdir(parents=True, exist_ok=True)


def download_year(year: int) -> Path:
    """Download one year of TESSERA embeddings clipped to the tri-state bbox."""
    from geotessera import GeoTessera  # pip install geotessera

    out_path = OUT_DIR / f"tessera_{year}_tristate.npy"
    if out_path.exists():
        print(f"[{year}] already downloaded, skipping: {out_path}")
        return out_path

    print(f"[{year}] fetching embeddings for bbox {TRISTATE_BBOX} ...")
    gt = GeoTessera()
    arr = gt.get_embeddings(
        bbox=TRISTATE_BBOX,
        year=year,
    )
    # arr shape: (H, W, 128) float32/int8, 10m pixels
    import numpy as np
    np.save(out_path, arr)
    print(f"[{year}] saved {arr.shape} -> {out_path}")
    return out_path


def main():
    print(f"TESSERA tri-state download: bbox={TRISTATE_BBOX}, years={YEARS[0]}-{YEARS[-1]}")
    print(f"Output dir: {OUT_DIR.resolve()}")
    for year in YEARS:
        try:
            download_year(year)
        except Exception as e:
            print(f"[{year}] FAILED: {e}")
    print("Done.")


if __name__ == "__main__":
    main()
