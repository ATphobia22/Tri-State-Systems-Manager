#!/usr/bin/env python3
"""TSM bridge notes for 3dfier (tudelft3d).

Repo: https://github.com/tudelft3d/3dfier
Builds 3D GIS solids from 2D polygons + elevation.
Authority: PRESENTATION
"""
from __future__ import annotations

import json
import shutil
import sys
from typing import Any


def probe() -> dict[str, Any]:
    exe = shutil.which("3dfier")
    return {
        "ok": bool(exe),
        "installed": bool(exe),
        "executable": exe,
        "repo": "https://github.com/tudelft3d/3dfier",
        "authority": "PRESENTATION",
        "detail": None if exe else "Build/install 3dfier; ensure binary on PATH",
        "guidance": "Feed building footprints + DEM; export CityJSON/OBJ for Cesium/Three loaders",
    }


if __name__ == "__main__":
    print(json.dumps(probe(), indent=2))
