#!/usr/bin/env python3
"""TSM bridge to FEniCSx (dolfinx) — optional.

https://github.com/FEniCS/dolfinx
Authority: MODEL_SIMULATION
"""
from __future__ import annotations

import importlib
import json
import sys
from typing import Any


def probe() -> dict[str, Any]:
    try:
        mod = importlib.import_module("dolfinx")
    except ImportError:
        return {
            "ok": False,
            "installed": False,
            "detail": "Install FEniCSx/dolfinx per https://fenicsproject.org/",
            "repo": "https://github.com/FEniCS/dolfinx",
            "authority": "MODEL_SIMULATION",
        }
    return {
        "ok": True,
        "installed": True,
        "version": getattr(mod, "__version__", None),
        "authority": "MODEL_SIMULATION",
        "guidance": "Build mesh + function spaces in operator scripts; export fields for twin overlays.",
    }


if __name__ == "__main__":
    print(json.dumps(probe(), indent=2))
