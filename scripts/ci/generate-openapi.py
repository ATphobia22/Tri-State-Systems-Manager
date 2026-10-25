#!/usr/bin/env python3
"""Generate or verify the FastAPI OpenAPI artifact from the live route tree.

Usage (from repository root, after installing backend requirements):
  python scripts/ci/generate-openapi.py --check
  python scripts/ci/generate-openapi.py --write

The check mode is read-only. It never commits to main or bypasses CI.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.main import app  # noqa: E402

OPENAPI_FILE = ROOT / "backend" / "app" / "openapi.json"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_mutually_exclusive_group(required=True)
    actions.add_argument("--check", action="store_true", help="Fail if checked-in OpenAPI differs from FastAPI")
    actions.add_argument("--write", action="store_true", help="Update checked-in OpenAPI for code review")
    parser.add_argument("--candidate", type=Path, help="Write a generated comparison artifact when checking")
    args = parser.parse_args()

    live = app.openapi()
    if not isinstance(live.get("paths"), dict) or len(live["paths"]) < 17:
        print("FAIL: OpenAPI route inventory is unexpectedly incomplete", file=sys.stderr)
        return 1
    if not isinstance(live.get("components"), dict):
        print("FAIL: OpenAPI components are unexpectedly missing", file=sys.stderr)
        return 1

    rendered = json.dumps(live, indent=2, ensure_ascii=False) + "\n"
    if args.write:
        OPENAPI_FILE.write_text(rendered, encoding="utf-8")
        print(f"Updated {OPENAPI_FILE.relative_to(ROOT)} ({len(live['paths'])} paths)")
        return 0

    if args.candidate:
        args.candidate.parent.mkdir(parents=True, exist_ok=True)
        args.candidate.write_text(rendered, encoding="utf-8")
    try:
        committed = json.loads(OPENAPI_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"FAIL: committed OpenAPI artifact is unavailable or invalid: {exc}", file=sys.stderr)
        return 1

    if committed != live:
        print(
            "FAIL: backend/app/openapi.json differs from live FastAPI schema. "
            "Run python scripts/ci/generate-openapi.py --write and commit "
            "both API code and regenerated contract through a reviewed PR.",
            file=sys.stderr,
        )
        return 1

    print(f"PASS: OpenAPI contract matches live FastAPI ({len(live['paths'])} routes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
