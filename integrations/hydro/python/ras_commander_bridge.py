#!/usr/bin/env python3
"""TSM bridge to ras-commander (optional dependency).

Install: pip install ras-commander
Requires HEC-RAS 6.x on the operator machine for plan execution.
HDF read paths may work without launching the GUI depending on ras-commander version.

Authority: MODEL_SIMULATION — not LOMA / not FIRM.
"""
from __future__ import annotations

import importlib
import json
import sys
from typing import Any


def probe() -> dict[str, Any]:
    try:
        mod = importlib.import_module("ras_commander")
    except ImportError:
        try:
            mod = importlib.import_module("rascommander")
        except ImportError:
            return {
                "ok": False,
                "installed": False,
                "detail": "pip install ras-commander",
                "repo": "https://github.com/gpt-cmdr/ras-commander",
            }
    return {
        "ok": True,
        "installed": True,
        "module": getattr(mod, "__name__", "ras_commander"),
        "version": getattr(mod, "__version__", None),
        "authority": "MODEL_SIMULATION",
    }


def extract_project_hint(project_dir: str) -> dict[str, Any]:
    """Best-effort project discovery; expands when ras-commander API is present."""
    p = probe()
    if not p.get("installed"):
        return p
    # Public API surface varies by version — prefer documenting path for operator scripts.
    return {
        "ok": True,
        "installed": True,
        "project_dir": project_dir,
        "guidance": (
            "Use ras-commander RasPrj / plan execution APIs in an operator notebook. "
            "TSM imports resulting WSE/depth tables via HecRasIntegrationBoundary.importHecRasResultSummary."
        ),
        "authority": "MODEL_SIMULATION",
    }


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "probe"
    if cmd == "probe":
        print(json.dumps(probe(), indent=2))
    elif cmd == "hint" and len(sys.argv) > 2:
        print(json.dumps(extract_project_hint(sys.argv[2]), indent=2))
    else:
        print(json.dumps({"ok": False, "detail": "usage: ras_commander_bridge.py [probe|hint <project_dir>]"}))
        sys.exit(2)
