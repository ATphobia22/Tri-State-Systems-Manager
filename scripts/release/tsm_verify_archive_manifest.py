#!/usr/bin/env python3
"""TSM Release Archive Manifest Verifier — recompute SHA-256 vs manifest."""

from __future__ import annotations

import hashlib
import json
import logging
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("TSM-ArchiveVerifier")

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "integrations" / "registry" / "tsm_release_archive_manifest.json"


def compute_file_sha256(file_path: Path, chunk_size: int = 8192) -> str:
    sha256_hash = hashlib.sha256()
    with file_path.open("rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()


def verify_manifest(manifest_file: Path) -> bool:
    if not manifest_file.exists():
        logger.error("Manifest not found: %s", manifest_file)
        return False

    logger.info("Loading manifest: %s", manifest_file)
    try:
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        logger.error("Failed to parse manifest JSON: %s", e)
        return False

    artifacts = manifest.get("artifacts", [])
    logger.info("Verifying %d artifact(s)...", len(artifacts))

    mismatch_count = 0
    missing_count = 0

    for item in artifacts:
        rel = item["path"]
        file_path = ROOT / rel
        expected_hash = item["sha256"]

        if not file_path.exists():
            logger.error("  [MISSING] %s", rel)
            missing_count += 1
            continue

        actual_hash = compute_file_sha256(file_path)
        if actual_hash != expected_hash:
            logger.error("  [MISMATCH] %s", rel)
            logger.error("    Expected: %s", expected_hash)
            logger.error("    Actual:   %s", actual_hash)
            mismatch_count += 1
        else:
            logger.info("  [VERIFIED] %s", rel)

    if mismatch_count or missing_count:
        logger.error(
            "FAILED: %d missing, %d mismatch",
            missing_count,
            mismatch_count,
        )
        return False

    logger.info("PASSED: all archive artifacts match immutable hashes.")
    return True


def main() -> int:
    return 0 if verify_manifest(MANIFEST_PATH) else 1


if __name__ == "__main__":
    sys.exit(main())
