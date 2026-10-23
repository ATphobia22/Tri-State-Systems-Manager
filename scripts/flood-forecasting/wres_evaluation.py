#!/usr/bin/env python3
"""
TSM WRES Evaluation Tool (wraps ATphobia22/wres-explorer)

Evaluates NOAA National Water Model (NWM) forecast skill at TSM gage
locations using the WRES (Water Resources Evaluation Service) framework.

Upstream: https://github.com/NOAA-OWP/wres-explorer
Fork: https://github.com/ATphobia22/wres-explorer (local: ~/workspace/forks/wres-explorer)

WRES evaluates NWM forecasts against observed USGS gage data using
standard metrics (NSE, KGE, bias, etc.). This tells us how much to
trust NWM forecasts at our specific gages before using them in
flood forecasting.

TSM gages:
    - 03381700: Ohio River at Old Shawneetown, IL (station altitude 309.10 ft NAVD88; not a gage-zero offset)
    - 03378500: Wabash River at New Harmony, IN (station altitude 352.71 ft NAVD88; gage-zero conversion remains unverified)
    - MTVI3: Ohio River at Mount Vernon, IN (NWS)

Prerequisites:
    pip install ~/workspace/forks/wres-explorer
    # Or: pip install wres-explorer (from PyPI, if published)

Usage:
    python wres_evaluation.py --gage 03381700 --evaluate
    python wres_evaluation.py --all-gages --metrics-table
"""

import argparse
import sys
from pathlib import Path

# TSM gages for WRES evaluation
TSM_GAGES = {
    "03381700": {
        "name": "Ohio River at Old Shawneetown, IL",
        "station_altitude_ft_navd88": 309.10,
        "station_altitude_source_uri": "https://waterdata.usgs.gov/monitoring-location/USGS-03381700/",
        "gage_height_vertical_datum": "GAGE_DATUM",
        "gage_zero_navd88_ft": None,
        "flood_stage_ft": 33.0,
        # NWM v3.0.17 RouteLink (CUAHSI HydroShare DOI 10.4211/hs.1fe9975004ce4b5097d41939afa14f84):
        # usgs_site_code 03381700 -> feature_id 1347434, nwm_feature_id 11866736
        # (reach centroid lon -88.13341, lat 37.68983)
        "nwm_feature_id": 11866736,
    },
    "03378500": {
        "name": "Wabash River at New Harmony, IN",
        "station_altitude_ft_navd88": 352.71,
        "station_altitude_source_uri": "https://waterdata.usgs.gov/monitoring-location/USGS-03378500/",
        "gage_height_vertical_datum": "GAGE_DATUM",
        "gage_zero_navd88_ft": None,
        "flood_stage_ft": 15.0,
        # NWM v3.0.17 RouteLink (CUAHSI HydroShare DOI 10.4211/hs.1fe9975004ce4b5097d41939afa14f84):
        # usgs_site_code 03378500 -> feature_id 1346192, nwm_feature_id 10382125
        # (reach centroid lon -87.94322, lat 38.130775)
        "nwm_feature_id": 10382125,
    },
}


def check_wres_available() -> bool:
    """Check if wres-explorer is installed."""
    try:
        import importlib.util
        spec = importlib.util.find_spec("wres_explorer")
        return spec is not None
    except ImportError:
        return False


def evaluate_gage(gage_id: str, output_dir: Path) -> None:
    """
    Run WRES evaluation for a single gage.

    This requires:
    1. NWM forecast data (from NOAA)
    2. USGS observed data (from waterdata.usgs.gov)
    3. WRES evaluation configuration

    See https://github.com/ATphobia22/wres-explorer for the full workflow.
    """
    if gage_id not in TSM_GAGES:
        print(f"ERROR: Unknown gage {gage_id}", file=sys.stderr)
        print(f"Available: {list(TSM_GAGES.keys())}", file=sys.stderr)
        sys.exit(1)

    gage = TSM_GAGES[gage_id]
    print(f"Evaluating NWM skill at {gage['name']} ({gage_id})")
    print(f"  Station altitude: {gage['station_altitude_ft_navd88']} ft NAVD88 (land-surface metadata, not a gage-zero offset)")
    print(f"  Raw gage-height vertical datum: {gage['gage_height_vertical_datum']}")
    if gage["gage_zero_navd88_ft"] is None:
        print("  Gage-height-to-NAVD88 conversion: not configured; no WSE conversion is applied.")
    print(f"  Flood stage: {gage['flood_stage_ft']} ft")
    print("")

    if not check_wres_available():
        print("wres-explorer not installed.", file=sys.stderr)
        print("Install: pip install ~/workspace/forks/wres-explorer", file=sys.stderr)
        print("", file=sys.stderr)
        print("Manual workflow:", file=sys.stderr)
        print("  1. Download NWM forecasts for the gage's NWM feature ID", file=sys.stderr)
        print("  2. Download USGS observations from waterdata.usgs.gov", file=sys.stderr)
        print("  3. Format as WRES CSV2", file=sys.stderr)
        print("  4. Run: wres-explorer <evaluation_csv>", file=sys.stderr)
        return

    print("WRES evaluation framework ready.")
    print("Next: Provide NWM forecast + USGS observation CSV2 files.")
    print(f"Output will go to: {output_dir}")


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate NWM forecast skill at TSM gages using WRES"
    )
    parser.add_argument("--gage", type=str, help="USGS gage ID to evaluate")
    parser.add_argument("--all-gages", action="store_true",
                        help="Evaluate all TSM gages")
    parser.add_argument("--evaluate", action="store_true",
                        help="Run WRES evaluation")
    parser.add_argument("--metrics-table", action="store_true",
                        help="Show metrics table")
    parser.add_argument("--output", type=Path, default=Path("./wres-output"),
                        help="Output directory")

    args = parser.parse_args()

    if args.all_gages:
        for gage_id in TSM_GAGES:
            evaluate_gage(gage_id, args.output)
            print("")
    elif args.gage:
        evaluate_gage(args.gage, args.output)
    else:
        print("TSM gages configured for WRES evaluation:")
        for gid, g in TSM_GAGES.items():
            print(f"  {gid}: {g['name']}")
        print("")
        parser.print_help()


if __name__ == "__main__":
    main()
