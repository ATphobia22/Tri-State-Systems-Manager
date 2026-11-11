#!/usr/bin/env python3
"""
TSM Master Verification Suite — atomic gates:
  1. Archive manifest integrity
  2. ECEF Bonebank fixture + bounds + orthonormality
  3. Optional OGC 3D Tiles 1.1 staged tileset

Does not claim UE5.8 Shipping or production HLOD completion.
"""

from __future__ import annotations

import hashlib
import json
import logging
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("TSM-MasterVerifier")

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "integrations" / "registry" / "tsm_release_archive_manifest.json"
FIXTURE_PATH = ROOT / "tests" / "geospatial" / "fixtures" / "bonebank_reference_transform.json"
TARGET_TILESET = ROOT / "tiles" / "posey_county_offline" / "tileset.json"


class VerificationError(Exception):
    pass


def verify_archive_manifest() -> None:
    logger.info("--- GATE 1: Release Archive Manifest Integrity ---")
    if not MANIFEST_PATH.exists():
        raise VerificationError(
            f"Archive manifest missing at {MANIFEST_PATH}. "
            "Run scripts/release/tsm_archive_compiler.py first."
        )

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    artifacts = manifest.get("artifacts", [])
    logger.info("Checking %d artifact(s)...", len(artifacts))

    errors = 0
    for item in artifacts:
        file_path = ROOT / item["path"]
        expected = item["sha256"]
        if not file_path.exists():
            logger.error("  [MISSING] %s", item["path"])
            errors += 1
            continue
        h = hashlib.sha256()
        with file_path.open("rb") as bf:
            while True:
                chunk = bf.read(8192)
                if not chunk:
                    break
                h.update(chunk)
        actual = h.hexdigest()
        if actual != expected:
            logger.error("  [DRIFT] %s", item["path"])
            errors += 1

    if errors:
        raise VerificationError(f"Archive manifest failed with {errors} error(s).")
    logger.info("  [PASS] Archive manifest integrity verified.")


def verify_ecef_geodetic_fixtures() -> None:
    logger.info("--- GATE 2: ECEF Geodetic Spatial & Fixture Correctness ---")
    if not FIXTURE_PATH.exists():
        raise VerificationError(f"Regression fixture missing at {FIXTURE_PATH}")

    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    matrix = fixture["transform_matrix"]
    bounds = fixture["bounds"]

    if len(matrix) != 16:
        raise VerificationError("Fixture transform must have 16 elements.")

    tx, ty, tz = float(matrix[12]), float(matrix[13]), float(matrix[14])

    if not (
        bounds["x_min"] <= tx <= bounds["x_max"]
        and bounds["y_min"] <= ty <= bounds["y_max"]
        and bounds["z_min"] <= tz <= bounds["z_max"]
    ):
        raise VerificationError(
            f"Translation ({tx}, {ty}, {tz}) violates Posey County bounds."
        )

    if tx <= 0:
        raise VerificationError("Midwest sign trap: fixture X must be positive.")

    r00, r01, r02 = matrix[0], matrix[4], matrix[8]
    r10, r11, r12 = matrix[1], matrix[5], matrix[9]
    r20, r21, r22 = matrix[2], matrix[6], matrix[10]
    det = (
        r00 * (r11 * r22 - r12 * r21)
        - r01 * (r10 * r22 - r12 * r20)
        + r02 * (r10 * r21 - r11 * r20)
    )
    if abs(det - 1.0) > 1e-4:
        raise VerificationError(
            f"Rotation determinant {det:.5f} fails orthonormality."
        )

    exp = fixture.get("expected_ecef", {})
    if exp:
        if abs(tx - float(exp["x"])) > 0.05:
            raise VerificationError("Fixture X diverges from expected_ecef.")
        if abs(ty - float(exp["y"])) > 0.05:
            raise VerificationError("Fixture Y diverges from expected_ecef.")
        if abs(tz - float(exp["z"])) > 0.05:
            raise VerificationError("Fixture Z diverges from expected_ecef.")

    logger.info(
        "  [PASS] ECEF (X=%.2f, Y=%.2f, Z=%.2f) det=%.4f",
        tx,
        ty,
        tz,
        det,
    )


def verify_ogc_tileset_and_assets() -> None:
    logger.info("--- GATE 3: OGC 3D Tiles 1.1 staged tileset (optional) ---")
    if not TARGET_TILESET.exists():
        logger.info(
            "  [INFO] tileset.json not staged — DERIVED_STAGING pending real HLOD. Skip."
        )
        return

    tileset = json.loads(TARGET_TILESET.read_text(encoding="utf-8"))
    version = str(tileset.get("asset", {}).get("version", ""))
    if version not in ("1.0", "1.1"):
        raise VerificationError(
            f"OGC 3D Tiles version unexpected: {version!r}"
        )
    root = tileset.get("root") or {}
    if "boundingVolume" not in root:
        raise VerificationError("tileset root missing boundingVolume")
    logger.info("  [PASS] Staged tileset structural check OK (version %s).", version)


def run_master_verification() -> int:
    logger.info("==================================================")
    logger.info("TSM Master Verification Suite")
    logger.info("==================================================")
    try:
        verify_archive_manifest()
        verify_ecef_geodetic_fixtures()
        verify_ogc_tileset_and_assets()
        logger.info("==================================================")
        logger.info("GATES PASSED (spatial/docs harness — not UE Shipping)")
        logger.info("==================================================")
        return 0
    except Exception as e:
        logger.error("VERIFICATION FAILED: %s", e)
        return 1


if __name__ == "__main__":
    sys.exit(run_master_verification())
