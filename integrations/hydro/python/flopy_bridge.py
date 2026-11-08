#!/usr/bin/env python3
"""TSM bridge to FloPy / MODFLOW (optional).

Repo: https://github.com/modflowpy/flopy
Install: pip install flopy
MODFLOW binaries: separate USGS install

Authority: MODEL_SIMULATION — groundwater; not a flood FIRM substitute.
"""
from __future__ import annotations

import importlib
import json
import sys
from typing import Any


def probe() -> dict[str, Any]:
    try:
        mod = importlib.import_module("flopy")
    except ImportError:
        return {
            "ok": False,
            "installed": False,
            "detail": "pip install flopy; install MODFLOW executable separately",
            "repo": "https://github.com/modflowpy/flopy",
            "authority": "MODEL_SIMULATION",
        }
    return {
        "ok": True,
        "installed": True,
        "version": getattr(mod, "__version__", None),
        "authority": "MODEL_SIMULATION",
        "guidance": "Use flopy.modflow / flopy.mf6; export heads to NetCDF/arrays; twin as groundwater layer.",
    }


if __name__ == "__main__":
    print(json.dumps(probe(), indent=2))
