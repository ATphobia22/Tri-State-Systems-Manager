#!/usr/bin/env python3
"""
TSM Release Archive Manifest Compiler
Scans geospatial docs, release guides, registries, and geospatial tests;
computes SHA-256; writes immutable manifest.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("TSM-ArchiveCompiler")

ROOT = Path(__file__).resolve().parents[2]

ARCHIVE_TARGET_PATHS = [
    ROOT / "docs" / "geospatial",
    ROOT / "docs" / "release",
    ROOT / "integrations" / "registry",
    ROOT / "tests" / "geospatial",
    ROOT / "scripts" / "geospatial",
    ROOT / "scripts" / "native",
]

ALLOWED_EXTENSIONS = {".md", ".json", ".py", ".ps1", ".yml", ".yaml"}


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


def compile_release_manifest(target_dirs: List[Path], output_manifest_path: Path) -> int:
    compilation_timestamp = datetime.now(timezone.utc).isoformat()
    archived_artifacts = []

    logger.info("Starting TSM Release Archive Manifest compilation...")

    for base_dir in target_dirs:
        if not base_dir.exists():
            logger.warning("Target directory not found, skipping: %s", base_dir)
            continue

        logger.info("Scanning directory: %s", base_dir)
        for file_path in sorted(base_dir.rglob("*")):
            if not file_path.is_file():
                continue
            if file_path.suffix.lower() not in ALLOWED_EXTENSIONS:
                continue
            # Avoid hashing the output manifest into itself mid-write
            if file_path.resolve() == output_manifest_path.resolve():
                continue

            try:
                rel_path = file_path.relative_to(ROOT).as_posix()
            except ValueError:
                rel_path = file_path.as_posix()

            sha256_sum, size_bytes = compute_file_sha256(file_path)
            logger.info(
                "  [ARCHIVED] %s (%s bytes, SHA256: %s...)",
                rel_path,
                size_bytes,
                sha256_sum[:12],
            )
            archived_artifacts.append(
                {
                    "path": rel_path,
                    "extension": file_path.suffix.lower(),
                    "size_bytes": size_bytes,
                    "sha256": sha256_sum,
                    "indexed_at": compilation_timestamp,
                }
            )

    manifest_payload = {
        "manifest_version": "1.0.0",
        "project": "Tri-State Systems Manager (TSM)",
        "archive_purpose": "Immutable release evidence and documentation record",
        "compiled_at": compilation_timestamp,
        "total_artifacts": len(archived_artifacts),
        "artifacts": archived_artifacts,
        "policy": {
            "human_authority_final": True,
            "staging_is_not_production_hlod": True,
        },
    }

    output_manifest_path.parent.mkdir(parents=True, exist_ok=True)
    output_manifest_path.write_text(
        json.dumps(manifest_payload, indent=2) + "\n", encoding="utf-8"
    )
    logger.info("Manifest written: %s (%d artifacts)", output_manifest_path, len(archived_artifacts))
    return len(archived_artifacts)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compile the TSM release archive manifest by scanning "
        "the curated target directories. NOTE: this rewrites the manifest "
        "to cover EVERY matching file in those directories — it is not a "
        "refresh of the curated 11-artifact list. To re-hash just the "
        "curated list, use scripts/release/refresh_archive_manifest.py."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "integrations" / "registry" / "tsm_release_archive_manifest.json",
        help="manifest path to write (default: the curated manifest path)",
    )
    args = parser.parse_args()
    output = args.output
    try:
        n = compile_release_manifest(ARCHIVE_TARGET_PATHS, output)
        return 0 if n >= 0 else 1
    except Exception as e:  # noqa: BLE001
        logger.error("Archive compilation failed: %s", e)
        return 1


if __name__ == "__main__":
    sys.exit(main())
