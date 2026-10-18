#!/usr/bin/env python3
"""
TSM Hydrofabric Subset Tool (wraps ATphobia22/hfsubsetR)

Extracts NOAA hydrofabric subsets for the Ohio/Wabash River confluence
using the hfsubsetR R package fork.

Upstream: https://github.com/owp-spatial/hfsubsetR
Fork: https://github.com/ATphobia22/hfsubsetR (local: ~/workspace/forks/hfsubsetR)

The hydrofabric is NOAA's official river network topology dataset,
hosted at spatial.water.noaa.gov. It provides:
- Flowline geometries for every river reach
- COMID identifiers linking to NWM forecasts
- Catchment boundaries
- Network topology (upstream/downstream relationships)

TSM use: Extract the confluence hydrofabric to validate our
OpenHydroNet basin delineations and link NWM forecasts to river reaches.

Prerequisites (R):
    install.packages("remotes")
    remotes::install_github("ATphobia22/hfsubsetR")

Usage:
    python hydrofabric_subset.py --xy -88.005075 37.845887 --output ./hydrofabric_confluence.gpkg
    python hydrofabric_subset.py --comid <COMID> --output ./reach.gpkg
"""

import argparse
import subprocess
import sys
from pathlib import Path

# TSM anchor coordinates
TSM_ANCHOR_LON = -88.005075
TSM_ANCHOR_LAT = 37.845887

# HUC for the confluence area
CONFLUENCE_HUC8 = "05120113"  # Lower Ohio River


def check_r_available() -> bool:
    """Check if R is available."""
    try:
        result = subprocess.run(["R", "--version"], capture_output=True, text=True)
        return result.returncode == 0
    except FileNotFoundError:
        return False


def build_r_script(xy=None, comid=None, output_path=None) -> str:
    """Generate the R script that calls hfsubsetR."""
    lines = [
        'library(hfsubsetR)',
        '',
    ]

    if xy:
        lon, lat = xy
        lines.append(f'# Extract hydrofabric at TSM anchor: {lon}, {lat}')
        lines.append(f'hf <- get_subset(xy = c({lon}, {lat}))')
    elif comid:
        lines.append(f'# Extract hydrofabric for COMID: {comid}')
        lines.append(f'hf <- get_subset(comid = {comid})')
    else:
        raise ValueError("Must specify --xy or --comid")

    if output_path:
        lines.append(f'sf::st_write(hf, "{output_path}", delete_dsn = TRUE)')
        lines.append(f'cat("Written to {output_path}\\n")')

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Extract NOAA hydrofabric subsets for TSM confluence area"
    )
    parser.add_argument("--xy", nargs=2, type=float, metavar=("LON", "LAT"),
                        help="Extract by coordinates (default: TSM anchor)")
    parser.add_argument("--comid", type=str,
                        help="Extract by COMID identifier")
    parser.add_argument("--output", type=Path,
                        default=Path("./hydrofabric_confluence.gpkg"),
                        help="Output GeoPackage path")
    parser.add_argument("--print-r", action="store_true",
                        help="Print the R script without executing")

    args = parser.parse_args()

    xy = args.xy or (TSM_ANCHOR_LON, TSM_ANCHOR_LAT)

    r_script = build_r_script(
        xy=xy if not args.comid else None,
        comid=args.comid,
        output_path=str(args.output),
    )

    if args.print_r:
        print(r_script)
        return

    if not check_r_available():
        print("ERROR: R is not installed.", file=sys.stderr)
        print("Install R, then:", file=sys.stderr)
        print('  install.packages("remotes")', file=sys.stderr)
        print('  remotes::install_github("ATphobia22/hfsubsetR")', file=sys.stderr)
        print("", file=sys.stderr)
        print("Or use --print-r to see the R script.", file=sys.stderr)
        sys.exit(1)

    # Write temp R script and execute
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.R', delete=False) as f:
        f.write(r_script)
        r_file = f.name

    print(f"Executing R script for hydrofabric extraction...")
    result = subprocess.run(["Rscript", r_file], capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)

    Path(r_file).unlink()


if __name__ == "__main__":
    main()
