#!/usr/bin/env python3
"""TSM bridge to rascontrol (Windows COM HEC-RAS controller).

Install: pip install rascontrol  (and pywin32)
Platform: Windows only with HEC-RAS installed.
Authority: MODEL_SIMULATION
"""
from __future__ import annotations

import importlib
import json
import sys
from typing import Any


def probe() -> dict[str, Any]:
    if sys.platform != "win32":
        return {
            "ok": False,
            "installed": False,
            "detail": "rascontrol requires Windows + HEC-RAS COM",
            "repo": "https://github.com/mikebannis/rascontrol",
        }
    try:
        importlib.import_module("rascontrol")
    except ImportError:
        return {
            "ok": False,
            "installed": False,
            "detail": "pip install rascontrol pywin32",
            "repo": "https://github.com/mikebannis/rascontrol",
        }
    return {"ok": True, "installed": True, "platform": "win32", "authority": "MODEL_SIMULATION"}


if __name__ == "__main__":
    print(json.dumps(probe(), indent=2))
