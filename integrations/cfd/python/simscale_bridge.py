#!/usr/bin/env python3
"""TSM bridge probe for SimScale cloud CAE API.

Requires operator account + API key (SIMSCALE_API_KEY).
Does not embed credentials. Authority: MODEL_SIMULATION
"""
from __future__ import annotations

import json
import os
import sys
from typing import Any


def probe() -> dict[str, Any]:
    key = os.environ.get("SIMSCALE_API_KEY") or os.environ.get("TSM_SIMSCALE_API_KEY")
    return {
        "ok": bool(key),
        "configured": bool(key),
        "authority": "MODEL_SIMULATION",
        "docs": "https://www.simscale.com/",
        "detail": None
        if key
        else "Set SIMSCALE_API_KEY for API access; run simulations in SimScale UI or REST",
        "guidance": "Export result fields; import to TSM evidence as MODEL_SIMULATION with humanReviewed.",
    }


if __name__ == "__main__":
    print(json.dumps(probe(), indent=2))
