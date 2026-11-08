#!/usr/bin/env python3
"""TSM bridge notes for HydroPol2D.

Repo: https://github.com/marcusnobrega-eng/HydroPol2D
2D hydrodynamic / hydrologic mesh engine — operator clone & run.
Authority: MODEL_SIMULATION
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


def probe(root: str | None = None) -> dict[str, Any]:
    p = Path(root) if root else None
    present = bool(p and p.is_dir())
    return {
        "ok": present,
        "installed": present,
        "repo": "https://github.com/marcusnobrega-eng/HydroPol2D",
        "authority": "MODEL_SIMULATION",
        "detail": None
        if present
        else "Clone HydroPol2D and pass root path to probe(root)",
        "tsm_import": "Export depth/velocity grids; label MODEL_SIMULATION in evidence store",
    }


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    print(json.dumps(probe(arg), indent=2))
