#!/usr/bin/env python3
"""TSM bridge to Landlab (optional).

Repo: https://github.com/landlab/landlab
Install: pip install landlab

2D grid earth-surface / catchment process models.
Authority: MODEL_SIMULATION
"""
from __future__ import annotations

import importlib
import json
import sys
from typing import Any


def probe() -> dict[str, Any]:
    try:
        mod = importlib.import_module("landlab")
    except ImportError:
        return {
            "ok": False,
            "installed": False,
            "detail": "pip install landlab",
            "repo": "https://github.com/landlab/landlab",
            "authority": "MODEL_SIMULATION",
        }
    return {
        "ok": True,
        "installed": True,
        "version": getattr(mod, "__version__", None),
        "authority": "MODEL_SIMULATION",
        "guidance": "Build RasterModelGrid / Voronoi; run components; export fields for twin overlays.",
    }


def demo_grid_shape(rows: int = 10, cols: int = 10) -> dict[str, Any]:
    p = probe()
    if not p.get("installed"):
        return p
    from landlab import RasterModelGrid  # type: ignore

    grid = RasterModelGrid((rows, cols), xy_spacing=10.0)
    return {
        "ok": True,
        "rows": rows,
        "cols": cols,
        "number_of_nodes": int(grid.number_of_nodes),
        "authority": "MODEL_SIMULATION",
    }


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "probe"
    if cmd == "demo":
        print(json.dumps(demo_grid_shape(), indent=2))
    else:
        print(json.dumps(probe(), indent=2))
