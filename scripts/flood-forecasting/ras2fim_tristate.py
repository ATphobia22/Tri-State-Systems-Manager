#!/usr/bin/env python3
"""
TSM ras2fim Integration — HEC-RAS to Flood Inundation Mapping.

Takes HEC-RAS 1D model outputs and generates:
  1. Flood depth inundation rasters for a range of discharges
  2. Synthetic rating curves (stage-discharge relationships)
  3. Floodplain mapping libraries paired with forecast discharges

Upstream: https://github.com/NOAA-OWP/ras2fim
  "Creation of flood inundation raster libraries and rating curves
   from HEC-RAS models"

TSM connection:
  - Input: HEC-RAS models in data/fabrics/hydraulic-models/
    (e.g., model-4449 JT Myers, McFadden Creek models)
  - Output: Inundation rasters → served via console flood layer
  - Rating curves → paired with TimesFM/OpenHydroNet discharge forecasts
    for real-time flood depth prediction

Workflow:
  1. Run HEC-RAS model for range of flows (steady-state profiles)
  2. ras2fim clips results to NWM hydrofabric reaches
  3. Generate depth grids for each flow
  4. Build synthetic rating curves (reach-averaged depth vs discharge)
  5. TSM console: forecast discharge → lookup depth grid → render flood extent

Usage:
  python ras2fim_tristate.py --ras-project /path/to/4449.prj --flows 1000,5000,10000,50000
  python ras2fim_tristate.py --rating-curve --reach ohio_846_773

Requires:
  - HEC-RAS installed (Windows) or ras2fim Docker container
  - GDAL, rasterio, geopandas
  - NWM hydrofabric for the Ohio/Wabash region
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

# TSM HEC-RAS models (from data/fabrics/hydraulic-models/)
TSM_RAS_MODELS = {
    "4449_JTMyers": {
        "path": "data/fabrics/hydraulic-models/ohio-river/model-4449-JTMyers-FIS.zip",
        "reach": "Ohio River, JT Myers Pool, Mile 846 to 773",
        "datum": "NGVD29",
        "note": "CANDIDATE_ARCHIVE_ONLY — not approved for execution",
    },
    "mcfadden_9917": {
        "path": "data/fabrics/hydraulic-models/mcfadden-creek/",
        "reach": "McFadden Creek",
        "datum": "NAVD88",
    },
}

OUT_DIR = Path("./ras2fim-output")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def check_ras2fim():
    """Check if ras2fim is available."""
    # ras2fim is typically run via Docker or direct Python
    # https://github.com/NOAA-OWP/ras2fim#installation
    print("ras2fim setup:")
    print("  Option 1: Docker")
    print("    docker pull noaaowp/ras2fim")
    print("  Option 2: Direct install")
    print("    git clone https://github.com/NOAA-OWP/ras2fim")
    print("    pip install -r requirements.txt")
    print()
    print("  HEC-RAS itself requires Windows or Wine.")
    print("  For Linux: use the ras2fim Docker container which includes Wine.")


def generate_inundation_library(ras_project: str, flows: list, output_dir: Path):
    """
    Generate flood depth rasters for a range of discharges.

    This wraps the ras2fim workflow:
    1. clip_hecras_to_nwm.py — clip HEC-RAS geometry to NWM reaches
    2. create_fim_rasters.py — generate depth grids per flow
    3. rating_curve.py — build synthetic rating curves
    """
    print(f"HEC-RAS Project: {ras_project}")
    print(f"Flows (cfs): {flows}")
    print(f"Output: {output_dir}")
    print()
    print("ras2fim steps:")
    print("  1. Clip HEC-RAS cross-sections to NWM hydrofabric")
    print("  2. Run steady-state profiles for each discharge")
    print("  3. Generate depth rasters (GeoTIFF)")
    print("  4. Build rating curves (CSV: discharge → reach-averaged depth)")
    print()
    print("  NOTE: Requires HEC-RAS execution environment.")
    print("  See check_ras2fim() for setup options.")

    # TODO: implement actual ras2fim calls once environment is available
    # subprocess.run([
    #     "python", "ras2fim/src/clip_hecras_to_nwm.py",
    #     "-p", ras_project, ...
    # ])


def rating_curve_to_tsm(rating_csv: Path, reach_id: str):
    """
    Convert ras2fim rating curve to TSM flood forecast format.

    TSM console needs: discharge (cfs) → flood depth (ft) → inundation extent
    This bridges OpenHydroNet/TimesFM discharge forecasts to visible flooding.
    """
    import pandas as pd

    df = pd.read_csv(rating_csv)
    print(f"Rating curve for {reach_id}: {len(df)} points")
    print(f"  Discharge range: {df['discharge_cfs'].min():.0f} - {df['discharge_cfs'].max():.0f} cfs")
    print(f"  Depth range: {df['depth_ft'].min():.1f} - {df['depth_ft'].max():.1f} ft")

    # Write TSM format
    out = OUT_DIR / f"rating_{reach_id}.json"
    tsm_format = {
        "reach_id": reach_id,
        "source": "ras2fim synthetic rating curve",
        "units": {"discharge": "cfs", "depth": "ft"},
        "points": df[["discharge_cfs", "depth_ft"]].to_dict("records"),
    }
    out.write_text(json.dumps(tsm_format, indent=2))
    print(f"  TSM format: {out}")
    return out


def main():
    ap = argparse.ArgumentParser(description="TSM ras2fim integration")
    ap.add_argument("--ras-project", help="Path to HEC-RAS .prj file")
    ap.add_argument("--flows", help="Comma-separated discharges in cfs")
    ap.add_argument("--rating-curve", help="Path to ras2fim rating curve CSV")
    ap.add_argument("--reach", default="ohio_846_773", help="Reach identifier")
    ap.add_argument("--check", action="store_true", help="Show setup instructions")
    ap.add_argument("--list-models", action="store_true")
    args = ap.parse_args()

    if args.check:
        check_ras2fim()
        return

    if args.list_models:
        print("TSM HEC-RAS models:")
        for name, info in TSM_RAS_MODELS.items():
            print(f"\n  {name}:")
            print(f"    Reach: {info['reach']}")
            print(f"    Datum: {info['datum']}")
            print(f"    Path: {info['path']}")
            if "note" in info:
                print(f"    ⚠️  {info['note']}")
        return

    if args.ras_project and args.flows:
        flows = [float(f) for f in args.flows.split(",")]
        generate_inundation_library(args.ras_project, flows, OUT_DIR)
        return

    if args.rating_curve:
        rating_curve_to_tsm(Path(args.rating_curve), args.reach)
        return

    ap.print_help()


if __name__ == "__main__":
    main()
