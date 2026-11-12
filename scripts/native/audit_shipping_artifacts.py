#!/usr/bin/env python3
"""Produce an auditable inventory of an actual staged Windows Shipping build.

This does NOT prove code signing, clean-machine launch, geodetic correctness,
or regulatory certification. Missing evidence is reported, never synthesized.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys

def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()

def inventory(root):
    root = Path(root).resolve()
    if not root.is_dir():
        raise ValueError("staged directory does not exist: " + str(root))
    entries = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError("symlink is not allowed in staged release: " + str(path))
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        entries.append({"path": rel, "bytes": path.stat().st_size,
                        "sha256": sha256_file(path)})
    executables = [e for e in entries if Path(e["path"]).name.lower() == "tsmnative.exe"]
    return {
        "schema": "tsm.release-artifact-inventory.v1",
        "root_label": root.name,
        "files": entries,
        "total_bytes": sum(e["bytes"] for e in entries),
        "gates": {
            "shipping_executable_present": "PRESENT_UNVERIFIED" if executables else "NOT_EVIDENCED",
            "authenticode_signature": "NOT_EVIDENCED",
            "offline_windows_11_startup": "NOT_EVIDENCED",
            "headed_3d_rendering": "NOT_EVIDENCED",
            "navd88_elevation_validation": "NOT_EVIDENCED",
            "regulatory_certification": "NOT_EVIDENCED"
        }
    }

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("staged_directory")
    parser.add_argument("--output", required=True, help="JSON inventory destination outside the staged directory")
    parser.add_argument("--require-exe", action="store_true")
    args = parser.parse_args()
    root = Path(args.staged_directory).resolve()
    output = Path(args.output).resolve()
    if output == root or root in output.parents:
        parser.error("--output must be outside the staged directory")
    try:
        report = inventory(root)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    except (OSError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 2
    print(f"Inventory: {len(report['files'])} files, {report['total_bytes']} bytes; {output}")
    if args.require_exe and report["gates"]["shipping_executable_present"] == "NOT_EVIDENCED":
        print("TSMNative.exe not present", file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
