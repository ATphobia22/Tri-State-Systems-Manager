#!/usr/bin/env python3
"""Print the exact Python environment identity to place in an approved HEC manifest."""

from __future__ import annotations

import argparse
import json
import platform
import struct
import sys
from pathlib import Path

from hec_runtime_common import (
    installed_environment_fingerprint,
    installed_environment_inventory,
    sha256_file,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", required=True, help="TSM workspace root")
    parser.add_argument("--lock-file", required=True, help="Relative path to the generated hash-locked requirements file")
    parser.add_argument("--lock-uri", required=True, help="Immutable URI identifying the retained lock file")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    workspace = Path(args.workspace).resolve(strict=True)
    if not workspace.is_dir():
        raise ValueError("Workspace must be a directory")
    lock_relative = Path(args.lock_file)
    if lock_relative.is_absolute() or any(part in {".", ".."} for part in lock_relative.parts):
        raise ValueError("Lock-file path must be relative and contain no dot segments")
    lock_path = (workspace / lock_relative).resolve(strict=True)
    try:
        lock_path.relative_to(workspace)
    except ValueError as exc:
        raise ValueError("Lock file must remain inside the TSM workspace") from exc
    if not lock_path.is_file():
        raise ValueError("Lock file must be a regular file")
    if not args.lock_uri.strip() or args.lock_uri.strip().upper() in {"UNASSIGNED", "TBD"}:
        raise ValueError("An immutable lock URI is required")

    runtime_platform = (
        "windows-x64"
        if sys.platform == "win32" and struct.calcsize("P") == 8 and platform.machine().lower() in {"amd64", "x86_64"}
        else "other"
    )
    payload = {
        "python_version": platform.python_version(),
        "platform": runtime_platform,
        "lock_uri": args.lock_uri,
        "lock_workspace_path": lock_relative.as_posix(),
        "lock_sha256": sha256_file(lock_path),
        "installed_packages_sha256": installed_environment_fingerprint(),
        "installed_distributions": installed_environment_inventory(),
    }
    print(json.dumps(payload, indent=2, sort_keys=True))
    if runtime_platform != "windows-x64":
        print("WARNING: the coupled HEC runtime is qualified only for windows-x64.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"HEC environment fingerprint failed closed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
