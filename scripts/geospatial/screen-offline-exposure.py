#!/usr/bin/env python3
"""Generate an offline-only advisory intersection count from reviewed layers."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.geospatial.offline_exposure import (  # noqa: E402
    ExposureScreeningError, screen_local_exposure,
)
from backend.geospatial.incident_layers import IncidentLayerError  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", type=Path, required=True)
    p.add_argument("--hazard", required=True)
    p.add_argument("--assets", required=True)
    p.add_argument("--output", type=Path, help="Optional JSON evidence report")
    args = p.parse_args()
    try:
        result = screen_local_exposure(args.hazard, args.assets, root=args.root)
        serialized = json.dumps(result, indent=2, sort_keys=True) + "\n"
        if args.output:
            if args.output.exists() or args.output.is_symlink():
                raise ExposureScreeningError("refusing to overwrite existing report")
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(serialized, encoding="utf-8")
        print(serialized, end="")
        return 0
    except (ExposureScreeningError, IncidentLayerError, OSError, ValueError) as exc:
        print(f"Offline screening unavailable: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
