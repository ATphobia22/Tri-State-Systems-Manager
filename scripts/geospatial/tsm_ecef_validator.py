#!/usr/bin/env python3
"""
Tri-State Systems Manager (TSM) — ECEF Transform & Bounding Volume Validator

Validates 4x4 ECEF transformation matrices and 3D Tiles bounding boxes against
geodetic bounds for Posey County, Indiana (air-gapped / offline packaging).

ECEF windows derived from WGS84 closed-form conversion of Posey AOI corners
(approx 37.80–38.15°N, 88.10–87.80°W, h≈120 m). Identity root transforms are
rejected for the offline Posey package policy.
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import sys
from pathlib import Path
from typing import List, Sequence, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("TSM-ECEFValidator")


class ECEFValidationError(Exception):
    """Raised when spatial or matrix validation fails."""


# Posey County operational ECEF envelope (meters, WGS84). Margins included.
# Computed 2026-11-11 from AOI samples; X is positive in this longitude band.
POSEY_CO_ECEF_BOUNDS = {
    "x_min": 150_000.0,
    "x_max": 210_000.0,
    "y_min": -5_060_000.0,
    "y_max": -5_000_000.0,
    "z_min": 3_870_000.0,
    "z_max": 3_940_000.0,
}

# Bounding-box center may sit slightly outside tight translation envelope.
BOX_CENTER_MARGIN_M = 50_000.0
MAX_HALF_AXIS_M = 50_000.0


def validate_rotation_orthonormality(
    matrix: Sequence[float], tolerance: float = 1e-4
) -> bool:
    """Require 3x3 linear part ≈ rotation: columns unit length, det ≈ +1."""
    if len(matrix) != 16:
        raise ECEFValidationError(
            f"Invalid transform matrix length: expected 16, found {len(matrix)}"
        )

    # Column-major 3D Tiles / glTF layout
    r00, r01, r02 = matrix[0], matrix[4], matrix[8]
    r10, r11, r12 = matrix[1], matrix[5], matrix[9]
    r20, r21, r22 = matrix[2], matrix[6], matrix[10]

    det = (
        r00 * (r11 * r22 - r12 * r21)
        - r01 * (r10 * r22 - r12 * r20)
        + r02 * (r10 * r21 - r11 * r20)
    )
    if abs(det - 1.0) > tolerance:
        raise ECEFValidationError(
            f"Rotation matrix determinant is {det:.5f} "
            f"(expected 1.0 ± {tolerance}). Scaled, sheared, or reflected."
        )

    col0 = r00**2 + r10**2 + r20**2
    col1 = r01**2 + r11**2 + r21**2
    col2 = r02**2 + r12**2 + r22**2
    if (
        abs(col0 - 1.0) > tolerance
        or abs(col1 - 1.0) > tolerance
        or abs(col2 - 1.0) > tolerance
    ):
        raise ECEFValidationError(
            "Rotation submatrix columns are not unit length."
        )

    # Column orthogonality
    d01 = r00 * r01 + r10 * r11 + r20 * r21
    d02 = r00 * r02 + r10 * r12 + r20 * r22
    d12 = r01 * r02 + r11 * r12 + r21 * r22
    if abs(d01) > tolerance or abs(d02) > tolerance or abs(d12) > tolerance:
        raise ECEFValidationError(
            "Rotation submatrix columns are not orthogonal."
        )

    logger.info("  [PASS] 3x3 rotation orthonormal (det=%.6f).", det)
    return True


def validate_ecef_translation(
    matrix: Sequence[float],
) -> Tuple[float, float, float]:
    """Translation at column-major indices 12,13,14 must lie in Posey ECEF window."""
    if len(matrix) != 16:
        raise ECEFValidationError(
            f"Invalid transform matrix length: expected 16, found {len(matrix)}"
        )

    tx, ty, tz = float(matrix[12]), float(matrix[13]), float(matrix[14])
    logger.info(
        "  ECEF translation: X=%.2f Y=%.2f Z=%.2f", tx, ty, tz
    )

    b = POSEY_CO_ECEF_BOUNDS
    if not (b["x_min"] <= tx <= b["x_max"]):
        raise ECEFValidationError(
            f"Translation X ({tx:.2f}) outside Posey ECEF "
            f"[{b['x_min']}, {b['x_max']}]."
        )
    if not (b["y_min"] <= ty <= b["y_max"]):
        raise ECEFValidationError(
            f"Translation Y ({ty:.2f}) outside Posey ECEF "
            f"[{b['y_min']}, {b['y_max']}]."
        )
    if not (b["z_min"] <= tz <= b["z_max"]):
        raise ECEFValidationError(
            f"Translation Z ({tz:.2f}) outside Posey ECEF "
            f"[{b['z_min']}, {b['z_max']}]."
        )

    logger.info("  [PASS] ECEF translation within Posey County bounds.")
    return tx, ty, tz


def validate_bounding_volume_box(box: Sequence[float]) -> bool:
    """3D Tiles box: center[3] + half-axes u,v,w [3 each]."""
    if len(box) != 12:
        raise ECEFValidationError(
            f"Invalid boundingVolume.box length: expected 12, found {len(box)}"
        )

    cx, cy, cz = float(box[0]), float(box[1]), float(box[2])
    b = POSEY_CO_ECEF_BOUNDS
    m = BOX_CENTER_MARGIN_M
    if not (b["x_min"] - m <= cx <= b["x_max"] + m):
        raise ECEFValidationError(
            f"Bounding box center X ({cx:.2f}) displaced from Posey region."
        )
    if not (b["y_min"] - m <= cy <= b["y_max"] + m):
        raise ECEFValidationError(
            f"Bounding box center Y ({cy:.2f}) displaced from Posey region."
        )
    if not (b["z_min"] - m <= cz <= b["z_max"] + m):
        raise ECEFValidationError(
            f"Bounding box center Z ({cz:.2f}) displaced from Posey region."
        )

    u_len = math.sqrt(box[3] ** 2 + box[4] ** 2 + box[5] ** 2)
    v_len = math.sqrt(box[6] ** 2 + box[7] ** 2 + box[8] ** 2)
    w_len = math.sqrt(box[9] ** 2 + box[10] ** 2 + box[11] ** 2)
    if u_len <= 0 or v_len <= 0 or w_len <= 0:
        raise ECEFValidationError(
            "Bounding volume box has zero or negative half-axis extent."
        )

    max_extent = max(u_len, v_len, w_len)
    if max_extent > MAX_HALF_AXIS_M:
        raise ECEFValidationError(
            f"Bounding half-axis ({max_extent:.2f} m) exceeds "
            f"{MAX_HALF_AXIS_M:.0f} m regional tile threshold."
        )

    logger.info(
        "  [PASS] Bounding box OK (max half-axis %.2f m).", max_extent
    )
    return True


def audit_tileset_spatial_correctness(tileset_path: Path) -> None:
    """Full ECEF + bounding-volume audit for a tileset.json."""
    logger.info("Auditing spatial correctness: %s", tileset_path.resolve())

    if not tileset_path.exists():
        raise ECEFValidationError(f"tileset.json not found: {tileset_path}")

    with tileset_path.open("r", encoding="utf-8") as f:
        tileset = json.load(f)

    root = tileset.get("root")
    if not root:
        raise ECEFValidationError("Missing 'root' node in tileset.json.")

    bv = root.get("boundingVolume")
    if not bv or "box" not in bv:
        raise ECEFValidationError("Root missing boundingVolume.box.")

    logger.info("Validating root boundingVolume.box...")
    validate_bounding_volume_box(bv["box"])

    transform = root.get("transform")
    if not transform:
        raise ECEFValidationError(
            "Root missing explicit ECEF transform. "
            "Identity fallback forbidden for Posey offline package."
        )

    logger.info("Validating root ECEF transform...")
    validate_ecef_translation(transform)
    validate_rotation_orthonormality(transform)

    children = root.get("children") or []
    logger.info("Auditing %d child bounding volumes...", len(children))
    for child in children:
        child_bv = child.get("boundingVolume")
        if child_bv and "box" in child_bv:
            validate_bounding_volume_box(child_bv["box"])

    logger.info(
        "SUCCESS: ECEF transforms and bounding volumes passed "
        "Posey County spatial validation."
    )


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "tileset",
        nargs="?",
        type=Path,
        default=Path("tiles/posey_county_offline/tileset.json"),
        help="Path to tileset.json",
    )
    parser.add_argument(
        "--allow-missing",
        action="store_true",
        help="Exit 0 if tileset file is absent (CI staging optional).",
    )
    args = parser.parse_args(argv)

    try:
        if args.allow_missing and not args.tileset.exists():
            logger.warning(
                "tileset missing at %s — skipped (--allow-missing)",
                args.tileset,
            )
            return 0
        audit_tileset_spatial_correctness(args.tileset)
        return 0
    except ECEFValidationError as e:
        logger.error("SPATIAL VALIDATION FAILED: %s", e)
        return 1
    except Exception as e:  # noqa: BLE001 — top-level CLI boundary
        logger.error("UNEXPECTED ERROR DURING SPATIAL AUDIT: %s", e)
        return 1


if __name__ == "__main__":
    sys.exit(main())
