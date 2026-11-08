#!/usr/bin/env python3
"""TSM bridge notes for NOAA-OWP/ras2fim.

ras2fim builds inundation raster libraries and synthetic rating curves from
HEC-RAS 1D models (Windows + HEC-RAS required). TSM does not vendor ras2fim;
this probe documents the integration contract.

Repo: https://github.com/NOAA-OWP/ras2fim
Authority: MODEL_SIMULATION — not NFHL/FIRM substitute
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


def probe(ras2fim_root: str | None = None) -> dict[str, Any]:
    root = Path(ras2fim_root) if ras2fim_root else None
    present = bool(root and root.is_dir())
    return {
        "ok": present,
        "installed": present,
        "repo": "https://github.com/NOAA-OWP/ras2fim",
        "requires": ["Windows", "HEC-RAS ~6.3", "conda env ras2fim"],
        "tsm_import_path": "Import rating curves / depth grids as MODEL_SIMULATION evidence after human review",
        "authority": "MODEL_SIMULATION",
        "detail": None if present else "Clone NOAA-OWP/ras2fim and pass root to probe(ras2fim_root)",
    }


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    print(json.dumps(probe(arg), indent=2))
