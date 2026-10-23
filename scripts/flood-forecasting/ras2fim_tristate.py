#!/usr/bin/env python3
"""
TSM HEC-RAS/ras2fim workflow adapter scaffold.

IMPORTANT: actual HEC-RAS/ras2fim inundation generation is NOT implemented here.
The current CLI can print setup guidance, list candidate model catalog entries,
and convert an already generated rating-curve CSV. It must not report a model
run as successful or imply that rasters were generated when no solver was run.

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
import math
import re
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


def check_ras2fim():
    """Print setup guidance; this function does not probe runtime availability."""
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


def generate_inundation_library(ras_project: str, flows: list, output_dir: Path) -> None:
    """Fail closed until the real HEC-RAS/ras2fim execution contract is implemented."""
    del ras_project, flows, output_dir
    raise NotImplementedError(
        "Inundation generation is not implemented by this TSM wrapper. "
        "It does not execute HEC-RAS or NOAA-OWP ras2fim and produces no "
        "inundation rasters or rating curves. No model run was performed."
    )


def rating_curve_to_tsm(rating_csv: Path, reach_id: str):
    """
    Convert ras2fim rating curve to TSM flood forecast format.

    TSM console needs: discharge (cfs) → flood depth (ft) → inundation extent
    This bridges OpenHydroNet/TimesFM discharge forecasts to visible flooding.
    """
    import pandas as pd

    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", reach_id):
        raise ValueError("reach_id must contain only letters, digits, underscores, or hyphens")
    if not rating_csv.is_file():
        raise FileNotFoundError(f"Rating-curve CSV not found: {rating_csv}")

    df = pd.read_csv(rating_csv)
    required_columns = ["discharge_cfs", "depth_ft"]
    missing = [column for column in required_columns if column not in df.columns]
    if missing:
        raise ValueError(f"Rating-curve CSV is missing required columns: {', '.join(missing)}")
    if df.empty:
        raise ValueError("Rating-curve CSV contains no points")

    # Validate numerical semantics before producing JSON that downstream code
    # might mistake for model evidence. JSON NaN/Infinity are not valid numbers.
    for column in required_columns:
        try:
            df[column] = pd.to_numeric(df[column], errors="raise")
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Rating-curve column {column} must be numeric") from exc
        values = df[column].tolist()
        if any(pd.isna(value) or not math.isfinite(float(value)) for value in values):
            raise ValueError(f"Rating-curve column {column} must contain finite values")
        if any(float(value) < 0 for value in values):
            raise ValueError(f"Rating-curve column {column} cannot contain negative values")

    print(f"Rating curve for {reach_id}: {len(df)} points")
    print(f"  Discharge range: {df['discharge_cfs'].min():.0f} - {df['discharge_cfs'].max():.0f} cfs")
    print(f"  Depth range: {df['depth_ft'].min():.1f} - {df['depth_ft'].max():.1f} ft")

    # This conversion preserves the upstream source identity; it does not
    # establish whether the CSV was produced by a validated model run.
    out = OUT_DIR / f"rating_{reach_id}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    tsm_format = {
        "reach_id": reach_id,
        "source": "precomputed rating-curve CSV (upstream provenance must be verified)",
        "units": {"discharge": "cfs", "depth": "ft"},
        "points": df[required_columns].to_dict("records"),
    }
    out.write_text(json.dumps(tsm_format, indent=2, allow_nan=False), encoding="utf-8")
    print(f"  TSM format: {out}")
    return out


def main():
    ap = argparse.ArgumentParser(description="TSM HEC-RAS/ras2fim workflow scaffold")
    ap.add_argument("--ras-project", help="Path to HEC-RAS .prj file")
    ap.add_argument("--flows", help="Comma-separated discharges in cfs")
    ap.add_argument("--rating-curve", help="Path to ras2fim rating curve CSV")
    ap.add_argument("--reach", default="ohio_846_773", help="Reach identifier")
    ap.add_argument("--check", action="store_true", help="Print setup guidance (does not probe availability)")
    ap.add_argument("--list-models", action="store_true", help="List candidate models only; does not validate or run them")
    args = ap.parse_args()

    if args.check:
        check_ras2fim()
        return

    if args.list_models:
        print("TSM HEC-RAS model catalog (paths/data are not verified; nothing is executed):")
        for name, info in TSM_RAS_MODELS.items():
            print(f"\n  {name}:")
            print(f"    Reach: {info['reach']}")
            print(f"    Datum: {info['datum']}")
            print(f"    Path: {info['path']}")
            if "note" in info:
                print(f"    ⚠️  {info['note']}")
        return

    if bool(args.ras_project) != bool(args.flows):
        ap.error("--ras-project and --flows must be supplied together")

    if args.ras_project and args.flows:
        try:
            flows = [float(value.strip()) for value in args.flows.split(",")]
        except ValueError:
            ap.error("--flows must be a comma-separated list of numeric discharges in cfs")
        if not flows or any(not math.isfinite(flow) or flow < 0 for flow in flows):
            ap.error("--flows must contain finite, non-negative discharges in cfs")
        try:
            generate_inundation_library(args.ras_project, flows, OUT_DIR)
        except NotImplementedError as exc:
            ap.error(str(exc))
        return

    if args.rating_curve:
        try:
            rating_curve_to_tsm(Path(args.rating_curve), args.reach)
        except (FileNotFoundError, ImportError, ValueError) as exc:
            ap.error(str(exc))
        return

    ap.print_help()


if __name__ == "__main__":
    main()
