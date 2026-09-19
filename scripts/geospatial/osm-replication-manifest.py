#!/usr/bin/env python3
"""Create a deterministic manifest for an OSM PBF/diff ingestion batch.

Network acquisition is intentionally outside this script. A controlled
replication service downloads the PBF/OSC inputs; this tool hashes and records
the exact files before Baremaps/PostGIS/Martin ingestion.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--mode", choices=("planet_snapshot", "stateful_diffs"), required=True)
    args = parser.parse_args()
    if not args.input.is_file():
        raise SystemExit(f"input does not exist or is not a file: {args.input}")
    manifest = {
        "source": "OpenStreetMap",
        "license": "ODbL",
        "attribution_required": True,
        "input_format": "PBF" if args.input.suffix.lower() == ".pbf" else "OSC_CHANGE",
        "replication_mode": args.mode,
        "input_path": str(args.input.resolve()),
        "input_sha256": sha256(args.input),
        "destination_contract": ["PostGIS", "PMTiles", "Martin"],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
