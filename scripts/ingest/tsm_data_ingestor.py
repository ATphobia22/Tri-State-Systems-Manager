#!/usr/bin/env python3
"""Compatibility entrypoint — delegates to provenance-safe geospatial ingestor."""
from __future__ import annotations

import runpy
import sys
from pathlib import Path

TARGET = Path(__file__).resolve().parents[1] / "geospatial" / "tsm_data_ingestor.py"

if __name__ == "__main__":
    if not TARGET.exists():
        print(f"Missing {TARGET}", file=sys.stderr)
        sys.exit(1)
    sys.argv[0] = str(TARGET)
    runpy.run_path(str(TARGET), run_name="__main__")
