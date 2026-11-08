#!/usr/bin/env python3
"""TSM bridge to parserasgeo — geometry text parse without running HEC-RAS.

Install: pip install parserasgeo  (or clone mikebannis/parserasgeo)
Authority: MODEL_SIMULATION / geometry preprocessing
"""
from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path
from typing import Any


def probe() -> dict[str, Any]:
    try:
        importlib.import_module("parserasgeo")
    except ImportError:
        return {
            "ok": False,
            "installed": False,
            "detail": "pip install parserasgeo or add mikebannis/parserasgeo to PYTHONPATH",
            "repo": "https://github.com/mikebannis/parserasgeo",
        }
    return {"ok": True, "installed": True, "authority": "MODEL_SIMULATION"}


def summarize_geometry(path: str) -> dict[str, Any]:
    p = probe()
    if not p.get("installed"):
        return p
    fp = Path(path)
    if not fp.is_file():
        return {"ok": False, "detail": f"missing file: {path}"}
    # Defer to library when present; always return size/hash-friendly metadata.
    text = fp.read_text(encoding="utf-8", errors="replace")
    return {
        "ok": True,
        "path": str(fp),
        "bytes": fp.stat().st_size,
        "line_count": text.count("\\n") + 1,
        "authority": "MODEL_SIMULATION",
        "note": "Full cross-section parse via parserasgeo API in operator scripts",
    }


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "summarize":
        print(json.dumps(summarize_geometry(sys.argv[2]), indent=2))
    else:
        print(json.dumps(probe(), indent=2))
