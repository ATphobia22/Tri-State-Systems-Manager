#!/usr/bin/env python3
"""Build TSM vector archives directly as PMTiles using Tippecanoe.

PMTiles archives are immutable, static artifacts served with HTTP Range support.
Dynamic parcel lookup remains a separate PostGIS RPC concern.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

OUT_DIR = Path("tsm-console/public/data/pmtiles")

LAYERS: dict[str, dict[str, Any]] = {
    "buildings": {
        "input": "tsm-console/public/3d-tiles/buildings-3d.json",
        "minzoom": 10,
        "maxzoom": 15,
        "layer_name": "buildings",
        "description": "TSM building footprints with heights",
        "drop_densest_as_needed": True,
        "attribution": "Tri-State Systems Manager; source attribution is retained in source metadata",
    },
    # Add parcel configuration only after a validated, licensed GeoJSON input
    # has been normalized to EPSG:4326 and its source lineage has been recorded.
}


def check_tools() -> bool:
    """Return whether Tippecanoe is available."""
    if shutil.which("tippecanoe"):
        return True
    print(
        "Missing required tool: tippecanoe. See https://github.com/felt/tippecanoe",
        file=sys.stderr,
    )
    return False


def build_layer(
    name: str,
    cfg: dict[str, Any],
    out_dir: Path = OUT_DIR,
    output_path: Path | None = None,
) -> Path | None:
    """Build one PMTiles archive directly, honoring the requested output path."""
    input_path = Path(cfg["input"])
    if not input_path.is_file():
        raise FileNotFoundError(f"Input GeoJSON not found for {name}: {input_path}")

    minzoom = int(cfg["minzoom"])
    maxzoom = int(cfg["maxzoom"])
    if minzoom < 0 or maxzoom > 22 or minzoom > maxzoom:
        raise ValueError(f"Invalid zoom range for {name}: {minzoom}..{maxzoom}")

    layer_name = str(cfg["layer_name"])
    if not layer_name or len(layer_name) > 128:
        raise ValueError(f"Invalid vector layer name for {name}")

    output = output_path if output_path is not None else out_dir / f"tristate-{name}.pmtiles"
    if output.suffix.lower() != ".pmtiles":
        raise ValueError(f"Output must use the .pmtiles extension: {output}")

    output.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "tippecanoe",
        "--output",
        str(output),
        "--minimum-zoom",
        str(minzoom),
        "--maximum-zoom",
        str(maxzoom),
        "--layer",
        layer_name,
        "--attribution",
        str(cfg.get("attribution", "Tri-State Systems Manager")),
        "--force",
    ]
    if cfg.get("drop_densest_as_needed", False):
        # Explicit lossy mode for display-only layers that may exceed tile limits.
        cmd.extend(["--drop-densest-as-needed", "--extend-zooms-if-still-dropping"])
    else:
        # Preserve features by default. This can increase archive size; do not
        # silently discard property boundaries or source features to fit tiles.
        cmd.append("--drop-rate=0")
    cmd.append(str(input_path))

    print(f"Building {name}: {input_path} -> {output}")
    subprocess.run(cmd, check=True)

    if not output.is_file() or output.stat().st_size <= 0:
        raise RuntimeError(f"Tippecanoe completed without producing a non-empty archive: {output}")

    print(f"Built {output} ({output.stat().st_size / 1_000_000:.1f} MB)")
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Build TSM PMTiles vector archives")
    parser.add_argument("--input", help="Input GeoJSON file")
    parser.add_argument("--output", help="Output .pmtiles path (honored exactly)")
    parser.add_argument("--name", default="custom", help="Vector layer name")
    parser.add_argument("--minzoom", type=int, default=10)
    parser.add_argument("--maxzoom", type=int, default=15)
    parser.add_argument("--all", action="store_true", help="Build all configured layers")
    parser.add_argument(
        "--allow-lossy-simplification",
        action="store_true",
        help="Allow Tippecanoe to drop dense features when tile-size limits require it",
    )
    args = parser.parse_args()

    if args.all and (args.input or args.output):
        parser.error("--all cannot be combined with --input or --output")
    if not args.all and not (args.input and args.output):
        parser.error("Provide --input and --output, or use --all")
    if not check_tools():
        return 2

    try:
        if args.all:
            for name, cfg in LAYERS.items():
                build_layer(name, cfg)
        else:
            build_layer(
                args.name,
                {
                    "input": args.input,
                    "minzoom": args.minzoom,
                    "maxzoom": args.maxzoom,
                    "layer_name": args.name,
                    "drop_densest_as_needed": args.allow_lossy_simplification,
                },
                output_path=Path(args.output),
            )
    except (OSError, ValueError, subprocess.CalledProcessError, RuntimeError) as error:
        print(f"PMTiles build failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
