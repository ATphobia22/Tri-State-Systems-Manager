#!/usr/bin/env python3
"""TSM bridge to EPA SWMM / pyswmm (optional).

SWMM5: https://www.epa.gov/water-research/storm-water-management-model-swmm
Python: pip install pyswmm  (or swmm-api)

Authority: MODEL_SIMULATION — urban drainage / runoff; not NFHL/FIRM.
"""
from __future__ import annotations


import importlib
import json
import sys
from pathlib import Path
from typing import Any


def probe() -> dict[str, Any]:
    mods = []
    for name in ("pyswmm", "swmm_api", "swmmapi"):
        try:
            importlib.import_module(name)
            mods.append(name)
        except ImportError:
            pass
    if not mods:
        return {
            "ok": False,
            "installed": False,
            "detail": "pip install pyswmm",
            "docs": "https://www.epa.gov/water-research/storm-water-management-model-swmm",
            "authority": "MODEL_SIMULATION",
        }
    return {
        "ok": True,
        "installed": True,
        "modules": mods,
        "authority": "MODEL_SIMULATION",
        "guidance": "Open a .inp with pyswmm.Simulation; export node/link time series; import to TSM as MODEL_SIMULATION.",
    }


def summarize_inp(path: str) -> dict[str, Any]:
    p = probe()
    if not p.get("installed"):
        return p
    fp = Path(path)
    if not fp.is_file():
        return {"ok": False, "detail": f"missing: {path}"}
    text = fp.read_text(encoding="utf-8", errors="replace")
    sections = [ln.strip()[1:] for ln in text.splitlines() if ln.startswith("[") and ln.endswith("]")]
    return {
        "ok": True,
        "path": str(fp),
        "bytes": fp.stat().st_size,
        "sections_found": sections[:40],
        "authority": "MODEL_SIMULATION",
    }


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "inp":
        print(json.dumps(summarize_inp(sys.argv[2]), indent=2))
    else:
        print(json.dumps(probe(), indent=2))
