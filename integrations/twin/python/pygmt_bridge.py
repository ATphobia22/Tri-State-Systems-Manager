#!/usr/bin/env python3
"""TSM bridge to PyGMT (Generic Mapping Tools).

Repo: https://github.com/GenericMappingTools/pygmt
Install: pip install pygmt  (requires GMT installed on system)

Authority: PRESENTATION / MODEL preprocessing — not survey control.
"""
from __future__ import annotations

import importlib
import json
import sys
from typing import Any


def probe() -> dict[str, Any]:
    try:
        mod = importlib.import_module("pygmt")
    except ImportError:
        return {
            "ok": False,
            "installed": False,
            "detail": "Install GMT, then pip install pygmt",
            "repo": "https://github.com/GenericMappingTools/pygmt",
            "authority": "PRESENTATION",
        }
    return {
        "ok": True,
        "installed": True,
        "version": getattr(mod, "__version__", None),
        "authority": "PRESENTATION",
        "guidance": "Use pygmt.grdcut / grdsample on DEM; export GeoTIFF for twin terrain pipelines.",
    }


if __name__ == "__main__":
    print(json.dumps(probe(), indent=2))
