#!/usr/bin/env python3
"""TSM bridge probe for OpenFOAM (system install).

https://github.com/OpenFOAM/OpenFOAM-dev
Authority: MODEL_SIMULATION
"""
from __future__ import annotations

import json
import os
import shutil
import sys
from typing import Any


def probe() -> dict[str, Any]:
    block = shutil.which("blockMesh")
    foam = os.environ.get("WM_PROJECT_DIR") or os.environ.get("FOAM_INST_DIR")
    ok = bool(block or foam)
    return {
        "ok": ok,
        "installed": ok,
        "blockMesh": block,
        "WM_PROJECT_DIR": os.environ.get("WM_PROJECT_DIR"),
        "repo": "https://github.com/OpenFOAM/OpenFOAM-dev",
        "authority": "MODEL_SIMULATION",
        "detail": None if ok else "Install OpenFOAM; source etc/bashrc; ensure blockMesh on PATH",
        "solvers_of_interest": ["interFoam", "shallowWaterFoam", "simpleFoam"],
    }


if __name__ == "__main__":
    print(json.dumps(probe(), indent=2))
