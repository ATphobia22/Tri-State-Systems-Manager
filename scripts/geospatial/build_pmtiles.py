#!/usr/bin/env python3
"""
TSM PMTiles Builder.

Generates PMTiles archives from TSM vector data for the console.
Uses tippecanoe (MapLibre-compatible vector tiles) + pmtiles CLI.

PMTiles: https://github.com/protomaps/PMTiles
tippecanoe: https://github.com/felt/tippecanoe

Prerequisites:
  # Ubuntu/Debian
  sudo apt install tippecanoe
  # Or build from source

  # PMTiles CLI
  # Download from https://github.com/protomaps/go-pmtiles/releases

  # Python PMTiles tools (alternative)
  pip install pmtiles

Console expects files in: tsm-console/public/data/pmtiles/
Protocol registered in: tsm-console/src/lib/pmtiles-protocol.ts

Usage:
  python build_pmtiles.py --input buildings.geojson --output tristate-buildings.pmtiles
  python build_pmtiles.py --all  # build all configured layers
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

OUT_DIR = Path("tsm-console/public/data/pmtiles")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# TSM layers to convert to PMTiles
LAYERS = {
    "buildings": {
        "input": "tsm-console/public/3d-tiles/buildings-3d.json",
        "minzoom": 10,
        "maxzoom": 15,
        "layer_name": "buildings",
        "description": "TSM building footprints with heights (22,815 features)",
    },
    # Add more as data becomes available:
    # "parcels": {
    #     "input": "data/parcels/tristate-parcels.geojson",
    #     "minzoom": 10,
    #     "maxzoom": 14,
    #     "layer_name": "parcels",
    # },
}


def check_tools():
    """Verify tippecanoe and pmtiles CLI are available."""
    missing = []
    if not shutil.which("tippecanoe"):
        missing.append("tippecanoe (https://github.com/felt/tippecanoe)")
    # pmtiles CLI is optional if using Python pmtiles lib
    if missing:
        print("Missing tools:", file=sys.stderr)
        for m in missing:
            print(f"  - {m}", file=sys.stderr)
        print("\nInstall and re-run.", file=sys.stderr)
        return False
    return True


def build_layer(name: str, cfg: dict, out_dir: Path = OUT_DIR) -> Path:
    """Build a single PMTiles archive from GeoJSON."""
    input_path = Path(cfg["input"])
    if not input_path.exists():
        print(f"  SKIP {name}: input not found: {input_path}")
        return None

    output = out_dir / f"tristate-{name}.pmtiles"
    tmp_mbtiles = out_dir / f"_{name}.mbtiles"

    print(f"\nBuilding {name}...")
    print(f"  Input: {input_path}")
    print(f"  Output: {output}")

    # Step 1: GeoJSON → MBTiles via tippecanoe
    cmd = [
        "tippecanoe",
        f"--output={tmp_mbtiles}",
        f"--minimum-zoom={cfg['minzoom']}",
        f"--maximum-zoom={cfg['maxzoom']}",
        f"--layer={cfg['layer_name']}",
        "--drop-densest-as-needed",
        "--extend-zooms-if-still-dropping",
        "--force",
        str(input_path),
    ]
    print(f"  Running: {' '.join(cmd[:4])} ...")
    subprocess.run(cmd, check=True)

    # Step 2: MBTiles → PMTiles
    # Option A: pmtiles CLI (go-pmtiles)
    if shutil.which("pmtiles"):
        subprocess.run(
            ["pmtiles", "convert", str(tmp_mbtiles), str(output)],
            check=True,
        )
    else:
        # Option B: Python pmtiles library
        print("  pmtiles CLI not found, using Python pmtiles...")
        from pmtiles.tile import zxy_to_tileid  # noqa
        # Full conversion via Python is complex; recommend installing CLI
        print("  Install go-pmtiles for MBTiles→PMTiles conversion:")
        print("  https://github.com/protomaps/go-pmtiles/releases")
        return None

    # Cleanup
    tmp_mbtiles.unlink(missing_ok=True)

    size_mb = output.stat().st_size / 1e6
    print(f"  Done: {output} ({size_mb:.1f} MB)")
    return output


def main():
    ap = argparse.ArgumentParser(description="TSM PMTiles builder")
    ap.add_argument("--input", help="Input GeoJSON file")
    ap.add_argument("--output", help="Output .pmtiles path")
    ap.add_argument("--name", default="custom", help="Layer name")
    ap.add_argument("--minzoom", type=int, default=10)
    ap.add_argument("--maxzoom", type=int, default=15)
    ap.add_argument("--all", action="store_true", help="Build all configured layers")
    args = ap.parse_args()

    if not check_tools():
        sys.exit(1)

    if args.all:
        for name, cfg in LAYERS.items():
            build_layer(name, cfg)
    elif args.input and args.output:
        build_layer(args.name, {
            "input": args.input,
            "minzoom": args.minzoom,
            "maxzoom": args.maxzoom,
            "layer_name": args.name,
        }, out_dir=Path(args.output).parent)
    else:
        ap.print_help()
        print("\nConfigured layers:")
        for name, cfg in LAYERS.items():
            print(f"  {name}: {cfg['description']}")


if __name__ == "__main__":
    main()
