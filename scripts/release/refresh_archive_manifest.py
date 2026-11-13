#!/usr/bin/env python3
"""TSM Release Archive Manifest Refresher — re-hash the CURATED list only.

The curated manifest (integrations/registry/tsm_release_archive_manifest.json)
lists a fixed set of release artifacts. Re-hashing it is NOT the job of
scripts/release/tsm_archive_compiler.py: that tool scans whole directories
and would expand the manifest to every matching file (a different,
uncurated manifest). This script instead:

  * reads the manifest as-is (artifact list is fixed — nothing added/removed),
  * recomputes SHA-256 + size_bytes for each listed artifact,
  * updates the hash/size/indexed_at of any drifted entry,
  * bumps compiled_at to the refresh time,
  * writes the manifest back in the compiler's format (indent=2 + newline),
  * exits nonzero if any listed artifact is missing (never silently drops one).

Usage: python scripts/release/refresh_archive_manifest.py [--check]
  --check  report drift without writing (exit 1 if any entry is stale).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "integrations" / "registry" / "tsm_release_archive_manifest.json"


def compute_file_sha256(file_path: Path, chunk_size: int = 8192) -> tuple[str, int]:
    sha256_hash = hashlib.sha256()
    total_bytes = 0
    with file_path.open("rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            sha256_hash.update(chunk)
            total_bytes += len(chunk)
    return sha256_hash.hexdigest(), total_bytes


def refresh(check_only: bool = False) -> int:
    if not MANIFEST_PATH.exists():
        print(f"Manifest not found: {MANIFEST_PATH}", file=sys.stderr)
        return 1
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    artifacts = manifest.get("artifacts", [])
    timestamp = datetime.now(timezone.utc).isoformat()
    drifted = []
    missing = []
    for item in artifacts:
        rel = item["path"]
        file_path = ROOT / rel
        if not file_path.exists():
            print(f"  [MISSING] {rel}", file=sys.stderr)
            missing.append(rel)
            continue
        actual_hash, actual_size = compute_file_sha256(file_path)
        if actual_hash != item.get("sha256") or actual_size != item.get("size_bytes"):
            print(f"  [DRIFT] {rel} ({item.get('sha256', '')[:12]} -> {actual_hash[:12]})")
            drifted.append(rel)
            if not check_only:
                item["sha256"] = actual_hash
                item["size_bytes"] = actual_size
                item["indexed_at"] = timestamp
        else:
            print(f"  [OK] {rel}")
    if missing:
        print(f"FAILED: {len(missing)} listed artifact(s) missing; manifest unchanged.",
              file=sys.stderr)
        return 1
    if check_only:
        if drifted:
            print(f"CHECK: {len(drifted)} stale entr{'y' if len(drifted) == 1 else 'ies'}: "
                  + ", ".join(drifted))
            return 1
        print(f"CHECK: all {len(artifacts)} entries current.")
        return 0
    if drifted:
        manifest["compiled_at"] = timestamp
        MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        print(f"Refreshed {len(drifted)} entr{'y' if len(drifted) == 1 else 'ies'}; "
              f"compiled_at={timestamp}")
    else:
        print(f"No drift: all {len(artifacts)} entries current; manifest untouched.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true",
                        help="report drift without writing (exit 1 if stale)")
    args = parser.parse_args()
    return refresh(check_only=args.check)


if __name__ == "__main__":
    sys.exit(main())
