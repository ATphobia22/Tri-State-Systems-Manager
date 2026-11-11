#!/usr/bin/env python3
"""
TSM Master Verification Suite — atomic gates:
  1. Release Archive Manifest Integrity
  2. ECEF Bonebank fixture + bounds + orthonormality
  3. Optional OGC 3D Tiles staged tileset
  4. Production HLOD & UE5.8 Shipping evidence status (honest)

Gate 4 never claims Shipping certified without exe + air-gap log evidence.
Default exit 0 when gates 1–2 pass and Gate 4 only *reports* missing production assets.
Use --require-production to fail if HLOD/Shipping are not fully certified.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("TSM-MasterVerifier")

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "integrations" / "registry" / "tsm_release_archive_manifest.json"
FIXTURE_PATH = ROOT / "tests" / "geospatial" / "fixtures" / "bonebank_reference_transform.json"
TARGET_TILESET = ROOT / "tiles" / "posey_county_offline" / "tileset.json"
PRODUCTION_HLOD_DIR = ROOT / "assets" / "production_hlod"
DEFAULT_SHIPPING_EXE = ROOT / "Binaries" / "Win64" / "TriStateSystemsManager.exe"


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
        if h.hexdigest() != expected:
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
        raise VerificationError(f"OGC 3D Tiles version unexpected: {version!r}")
    root = tileset.get("root") or {}
    if "boundingVolume" not in root:
        raise VerificationError("tileset root missing boundingVolume")
    logger.info("  [PASS] Staged tileset structural check OK (version %s).", version)


def _assess_production_hlod_shipping(
    shipping_exe: Path,
    airgap_log: Optional[Path],
) -> Dict[str, Any]:
    """Shared evidence rules with tsm_certify_hlod_shipping.py."""
    glb_dir = TARGET_TILESET.parent
    glb_count = len(list(glb_dir.rglob("*.glb"))) if glb_dir.exists() else 0

    staging_only = True
    authority = "MISSING"
    if TARGET_TILESET.exists():
        try:
            data = json.loads(TARGET_TILESET.read_text(encoding="utf-8"))
            extras = (data.get("root") or {}).get("extras") or {}
            tsm = extras.get("tsm") or {}
            authority = str(tsm.get("authority", "UNSPECIFIED"))
            staging_only = authority == "DERIVED_STAGING" or glb_count == 0
        except json.JSONDecodeError:
            authority = "PARSE_ERROR"
            staging_only = True

    hlod_json = (
        list(PRODUCTION_HLOD_DIR.glob("*.json"))
        if PRODUCTION_HLOD_DIR.exists()
        else []
    )
    # Production HLOD requires real mesh content, not JSON receipts alone
    hlod_certified = bool(
        TARGET_TILESET.exists() and glb_count > 0 and not staging_only
    )

    shipping_certified = bool(
        shipping_exe.exists()
        and airgap_log is not None
        and airgap_log.exists()
    )

    return {
        "authority": authority,
        "staging_only": staging_only,
        "glb_count": glb_count,
        "production_hlod_json_receipts": len(hlod_json),
        "hlod_production_certified": hlod_certified,
        "ue58_shipping_airgap_certified": shipping_certified,
        "shipping_exe_present": shipping_exe.exists(),
        "airgap_log_present": bool(airgap_log and airgap_log.exists()),
    }


def verify_production_hlod_and_shipping(
    *,
    require_production: bool,
    shipping_exe: Path,
    airgap_log: Optional[Path],
) -> Dict[str, Any]:
    logger.info("--- GATE 4: Production HLOD & UE5.8 Shipping Evidence ---")
    status = _assess_production_hlod_shipping(shipping_exe, airgap_log)

    if status["staging_only"]:
        logger.warning(
            "  [WARN] Tileset still DERIVED_STAGING or zero GLB — not production HLOD."
        )
    else:
        logger.info("  [PASS] Non-staging tileset with GLB content detected.")

    if status["production_hlod_json_receipts"]:
        logger.info(
            "  [INFO] %d JSON receipt(s) under assets/production_hlod "
            "(receipts alone do not certify mesh HLOD).",
            status["production_hlod_json_receipts"],
        )

    if not status["shipping_exe_present"]:
        logger.info(
            "  [INFO] UE5.8 Shipping binary not present at %s "
            "(requires Windows BuildCookRun).",
            shipping_exe,
        )
    else:
        logger.info("  [PASS] Shipping executable present: %s", shipping_exe)

    if not status["airgap_log_present"]:
        logger.info(
            "  [INFO] Air-gap acceptance log not supplied — "
            "run Test-TSMShippingRuntime.ps1 and pass --airgap-log."
        )
    else:
        logger.info("  [PASS] Air-gap log present.")

    logger.info(
        "  [STATUS] hlod_production_certified=%s  ue58_shipping_airgap_certified=%s",
        status["hlod_production_certified"],
        status["ue58_shipping_airgap_certified"],
    )

    if require_production:
        if not status["hlod_production_certified"]:
            raise VerificationError(
                "--require-production: production HLOD not certified "
                "(need non-staging tileset + GLB meshes)."
            )
        if not status["ue58_shipping_airgap_certified"]:
            raise VerificationError(
                "--require-production: UE5.8 Shipping air-gap not certified "
                "(need exe + air-gap log)."
            )
        logger.info("  [PASS] Production HLOD and Shipping evidence complete.")
    else:
        logger.info(
            "  [PASS] Gate 4 status recorded (harness mode — not claiming Shipping)."
        )

    return status


def run_master_verification(
    *,
    require_production: bool = False,
    shipping_exe: Optional[Path] = None,
    airgap_log: Optional[Path] = None,
) -> int:
    logger.info("==================================================")
    logger.info("TSM Master Verification Suite")
    logger.info("==================================================")
    try:
        verify_archive_manifest()
        verify_ecef_geodetic_fixtures()
        verify_ogc_tileset_and_assets()
        status = verify_production_hlod_and_shipping(
            require_production=require_production,
            shipping_exe=shipping_exe or DEFAULT_SHIPPING_EXE,
            airgap_log=airgap_log,
        )

        # Write sidecar status for CI artifacts
        out = (
            ROOT
            / "integrations"
            / "registry"
            / "tsm_master_verification_gate4_status.json"
        )
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")

        logger.info("==================================================")
        if require_production and status["hlod_production_certified"] and status[
            "ue58_shipping_airgap_certified"
        ]:
            logger.info("ALL GATES PASSED — PRODUCTION EVIDENCE PRESENT (exit 0)")
        else:
            logger.info(
                "GATES 1–3 PASSED; GATE 4 STATUS RECORDED "
                "(not UE Shipping certified without evidence)"
            )
        logger.info("==================================================")
        return 0
    except Exception as e:
        logger.error("VERIFICATION FAILED: %s", e)
        return 1


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--require-production",
        action="store_true",
        help="Fail unless production HLOD + Shipping air-gap evidence exist",
    )
    p.add_argument("--shipping-exe", type=Path, default=None)
    p.add_argument("--airgap-log", type=Path, default=None)
    args = p.parse_args(argv)
    return run_master_verification(
        require_production=args.require_production,
        shipping_exe=args.shipping_exe,
        airgap_log=args.airgap_log,
    )


if __name__ == "__main__":
    sys.exit(main())
