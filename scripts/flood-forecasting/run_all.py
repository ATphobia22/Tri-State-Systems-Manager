#!/usr/bin/env python3
"""
TSM Flood Forecasting — Master Orchestrator.

Orchestrates available pipeline stages. Stages that only print guidance or lack
required model configuration must report unavailable/failure, never success:
  1. Data ingestion (USGS gages, antecedent precipitation)
  2. Nowcasting (TimesFM 0-48h)
  3. Operational forecasts (GEOGloWS 10-day)
  4. Rating curves (ras2fim → discharge to depth)
  5. Flood alerting (stage thresholds)
  6. BFE synthesis (InFRM estBFE + FIS PDF parsing)

Each step can run independently. This orchestrator chains them.

Usage:
  python run_all.py --step all          # full pipeline
  python run_all.py --step ingest       # gage data only
  python run_all.py --step nowcast      # TimesFM only
  python run_all.py --step forecast     # GEOGloWS only
  python run_all.py --step antecedent   # precipitation index only

Steps:
  ingest      → tsm_usgs_ingest.py (USGS gage heights + discharge)
  antecedent  → antecedent_precip.py (wet/dry conditions)
  nowcast     → timesfm-gage-nowcast.py (0-48h zero-shot forecast)
  forecast    → geoglows_forecast.py (10-day operational)
  rating      → ras2fim_tristate.py (catalog only; generation unavailable)
"""

import argparse
import subprocess
import sys
from pathlib import Path

from tsm_config import GAGES, OUTPUT_DIRS

SCRIPT_DIR = Path(__file__).parent


def run_script(name: str, args: list = None):
    """Run a pipeline script, streaming output."""
    script = SCRIPT_DIR / name
    cmd = [sys.executable, str(script)] + (args or [])
    print(f"\n{'='*60}")
    print(f"  {name} {' '.join(args or [])}")
    print(f"{'='*60}\n")
    result = subprocess.run(cmd, cwd=SCRIPT_DIR)
    if result.returncode != 0:
        print(f"\n⚠️  {name} exited with code {result.returncode}", file=sys.stderr)
    return result.returncode == 0


def step_ingest():
    """Pull latest gage data from USGS."""
    print("\n📥 Step 1: Data Ingestion")
    ok = True
    for site, cfg in GAGES.items():
        if site == "MTVI3":
            continue  # NWS, not USGS
        ok &= run_script("tsm_usgs_ingest.py", [])
        break  # tsm_usgs_ingest handles all sites in __main__
    return ok


def step_antecedent():
    """Compute antecedent precipitation index."""
    print("\n🌧️  Step 2: Antecedent Precipitation")
    from tsm_config import ANCHOR_LAT, ANCHOR_LON
    return run_script("antecedent_precip.py", [
        "--lat", str(ANCHOR_LAT),
        "--lon", str(ANCHOR_LON),
    ])


def step_nowcast():
    """Run TimesFM 0-48h nowcast."""
    print("\n⚡ Step 3: TimesFM Nowcasting (0-48h)")
    return run_script("timesfm-gage-nowcast.py", [])


def step_forecast():
    """Pull GEOGloWS 10-day operational forecast."""
    print("\n🌊 Step 4: GEOGloWS Forecast (10-day)")
    print("  UNAVAILABLE: no verified river IDs are configured in geoglows_forecast.py.")
    print("  No operational forecast was retrieved or produced.")
    return False


def step_rating():
    """Report rating-curve stage as unavailable until solver execution is implemented."""
    print("\n📐 Step 5: Rating Curves (ras2fim)")
    # The model listing is only a catalog display; it is not a rating-curve run.
    run_script("ras2fim_tristate.py", ["--list-models"])
    print("  UNAVAILABLE: this wrapper does not execute HEC-RAS/ras2fim or generate rating curves.")
    return False


def step_alert_check():
    """Check current stages against flood thresholds."""
    print("\n🚨 Step 6: Flood Alert Check")
    from tsm_config import FLOOD_STAGES

    try:
        from tsm_usgs_ingest import get_gage_height
        for site in ["03381700", "03378500"]:
            df = get_gage_height(site, days=1)
            if len(df) == 0:
                continue
            latest = df["value_ft"].iloc[-1]
            cfg = GAGES[site]
            print(f"\n  {cfg['name']}: {latest:.2f} ft")

            # Check MTVI3 thresholds as reference
            mtv = FLOOD_STAGES["MTVI3"]
            if latest >= mtv["major_ft"]:
                print(f"  🔴 MAJOR FLOOD (≥{mtv['major_ft']} ft)")
            elif latest >= mtv["moderate_ft"]:
                print(f"  🟠 MODERATE FLOOD (≥{mtv['moderate_ft']} ft)")
            elif latest >= mtv["flood_ft"]:
                print(f"  🟡 FLOOD STAGE (≥{mtv['flood_ft']} ft)")
            elif latest >= mtv["action_ft"]:
                print(f"  🔵 ACTION STAGE (≥{mtv['action_ft']} ft)")
            else:
                print(f"  🟢 Normal (below action stage)")
    except Exception as e:
        print(f"  Alert check failed: {e}")
        return False
    return True


def step_bfe():
    """Synthesize BFE estimate for the anchor site (InFRM + FIS)."""
    print("\n🏔️  Step 7: BFE Synthesis (InFRM estBFE + FIS)")
    from tsm_config import ANCHOR_LAT, ANCHOR_LON
    return run_script("bfe_ingestion.py", [
        "--lat", str(ANCHOR_LAT),
        "--lon", str(ANCHOR_LON),
    ])


def step_hydromt():
    """Build HydroMT data catalog for SFINCS flood modeling."""
    print("\n🔧 Step 8: HydroMT Data Catalog (SFINCS inputs)")
    return run_script("hydromt_tsm_catalog.py", ["--build-catalog"])


def step_hydrofabric():
    """Show hydrofabric extraction command for the confluence area."""
    print("\n🌐 Step 9: NOAA Hydrofabric Subset")
    print("  Fork: ATphobia22/hfsubsetR (R package)")
    print("  Run: python hydrofabric_subset.py --print-r")
    print("  Then execute the R script to download from spatial.water.noaa.gov")
    print("  UNAVAILABLE: the extraction has not been executed by this step.")
    return False


def step_wres():
    """Check WRES evaluation framework for NWM forecast skill."""
    print("\n📊 Step 10: WRES Forecast Evaluation")
    return run_script("wres_evaluation.py", ["--all-gages"])


STEPS = {
    "ingest": step_ingest,
    "antecedent": step_antecedent,
    "nowcast": step_nowcast,
    "forecast": step_forecast,
    "rating": step_rating,
    "alert": step_alert_check,
    "bfe": step_bfe,
    "hydromt": step_hydromt,
    "hydrofabric": step_hydrofabric,
    "wres": step_wres,
}

STEP_ORDER = ["ingest", "antecedent", "nowcast", "forecast", "rating", "alert", "bfe",
              "hydromt", "hydrofabric", "wres"]


def main():
    ap = argparse.ArgumentParser(description="TSM Flood Forecasting Orchestrator")
    ap.add_argument("--step", choices=list(STEPS) + ["all"], default="all")
    args = ap.parse_args()

    print("TSM Flood Forecasting Pipeline")
    print("=" * 60)

    steps = STEP_ORDER if args.step == "all" else [args.step]
    results = {}

    for s in steps:
        try:
            results[s] = STEPS[s]()
        except Exception as e:
            print(f"\n❌ Step {s} failed: {e}", file=sys.stderr)
            results[s] = False

    print(f"\n{'='*60}")
    print("Pipeline Summary:")
    for s, ok in results.items():
        print(f"  {'✅' if ok else '❌'} {s}")
    print(f"{'='*60}")

    sys.exit(0 if all(results.values()) else 1)


if __name__ == "__main__":
    main()
