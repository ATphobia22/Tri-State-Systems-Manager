#!/usr/bin/env python3
"""
TSM USGS LiDAR EPT Integration.

Maps the TSM tri-state area to USGS 3DEP Entwine Point Tile (EPT) resources
hosted free on S3. These plug directly into the console's 3D viewer.

Fork: https://github.com/ATphobia22/usgs-lidar
Upstream: https://github.com/hobuinc/usgs-lidar (viewer at https://usgs-lidar.io)
EPT docs: https://entwine.io/entwine-point-tile.html

USGS 3DEP EPT bucket: s3://usgs-lidar-public/
Public HTTPS: https://s3-us-west-2.amazonaws.com/usgs-lidar-public/
"""

import json
from pathlib import Path

# ---------------------------------------------------------------------------
# Known 3DEP EPT resources covering the tri-state area
# Naming: {STATE}_{PROJECT}_{YEAR}/ept.json
# Full index: https://s3-us-west-2.amazonaws.com/usgs-lidar-public/index.html
# ---------------------------------------------------------------------------

TRISTATE_EPT = {
    # Indiana 2020 statewide (QL2) — covers Posey, Vanderburgh, Warrick, Gibson
    "IN_2020": {
        "url": "https://s3-us-west-2.amazonaws.com/usgs-lidar-public/IN_2020/ept.json",
        "crs": "EPSG:2968",  # Indiana State Plane West (ft)
        "vdatum": "NAVD88",
        "year": 2020,
        "quality": "QL2",
        "counties": ["Posey", "Vanderburgh", "Warrick", "Gibson"],
    },
    # Illinois Gallatin County area — check index for exact project name
    # Kentucky Henderson/Union — check index for exact project name
}

EPT_INDEX = "https://s3-us-west-2.amazonaws.com/usgs-lidar-public/ept.json"


def get_ept_metadata(ept_url: str) -> dict:
    """Fetch EPT metadata (bounds, point count, schema) from ept.json."""
    import requests
    r = requests.get(ept_url, timeout=30)
    r.raise_for_status()
    return r.json()


def write_console_config(out_path: Path = None) -> Path:
    """
    Write EPT source config for the TSM console's 3D viewer.
    The console loads these via its point-cloud layer.
    """
    config = {
        "sources": [
            {
                "id": key,
                "name": f"USGS 3DEP LiDAR — {val['year']} ({', '.join(val['counties'])})",
                "eptUrl": val["url"],
                "crs": val["crs"],
                "verticalDatum": val["vdatum"],
                "quality": val["quality"],
                "license": "Public domain (USGS)",
                "attribution": "U.S. Geological Survey 3D Elevation Program",
            }
            for key, val in TRISTATE_EPT.items()
        ],
        # Tri-state viewer bounds (matches console)
        "defaultView": {
            "bbox": [-88.7, 37.6, -87.2, 38.5],
        },
    }
    out = out_path or Path("ept-sources.json")
    out.write_text(json.dumps(config, indent=2))
    print(f"Wrote {out}")
    return out


def print_summary():
    """Print EPT resources and verify reachability."""
    import requests
    for key, val in TRISTATE_EPT.items():
        try:
            meta = get_ept_metadata(val["url"])
            bounds = meta.get("bounds", "unknown")
            points = meta.get("points", "unknown")
            print(f"✅ {key}: {points:,} points, bounds={bounds}")
        except Exception as e:
            print(f"❌ {key}: {str(e)[:80]}")


if __name__ == "__main__":
    import sys
    if "--check" in sys.argv:
        print_summary()
    else:
        write_console_config()
        print("\nRun with --check to verify EPT URLs are reachable.")
        print("Add IL/KY project URLs from https://usgs-lidar.io/ as needed.")
