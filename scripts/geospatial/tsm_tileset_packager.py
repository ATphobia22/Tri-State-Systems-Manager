#!/usr/bin/env python3
"""
TSM tileset packager / staging helper.

Collects an existing Posey offline tileset directory or writes a minimal
validated stub structure for CI when no binary assets are present.
Does not invent building geometry or heights.
"""

from __future__ import annotations

import json
import logging
import math
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("TSM-TilesetPackager")

OUT_DIR = Path("tiles/posey_county_offline")
TILESET = OUT_DIR / "tileset.json"

# Reference ECEF near Bonebank / Posey (WGS84, ~120 m)
# Matches scripts/geospatial/tsm_ecef_validator.py envelope.
REF_TX, REF_TY, REF_TZ = 175550.8, -5039980.7, 3892024.2


def identity_rotation_transform(tx: float, ty: float, tz: float) -> list[float]:
    """Column-major 4x4: R=I, translation (tx,ty,tz)."""
    return [
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        tx, ty, tz, 1.0,
    ]


def axis_aligned_box(
    cx: float, cy: float, cz: float, hx: float, hy: float, hz: float
) -> list[float]:
    """3D Tiles boundingVolume.box half-axes aligned to ECEF axes."""
    return [
        cx, cy, cz,
        hx, 0.0, 0.0,
        0.0, hy, 0.0,
        0.0, 0.0, hz,
    ]


def package() -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if TILESET.exists():
        logger.info("Existing tileset preserved: %s", TILESET.resolve())
        return TILESET

    # Staging-only geometric envelope — NOT survey data, NOT building inventory.
    tileset = {
        "asset": {
            "version": "1.1",
            "tilesetVersion": "tsm-posey-staging-1",
            "gltfUpAxis": "Y",
        },
        "geometricError": 5000.0,
        "root": {
            "boundingVolume": {
                "box": axis_aligned_box(
                    REF_TX, REF_TY, REF_TZ, 5000.0, 5000.0, 500.0
                )
            },
            "geometricError": 1000.0,
            "refine": "ADD",
            "transform": identity_rotation_transform(REF_TX, REF_TY, REF_TZ),
            "children": [],
            "extras": {
                "tsm": {
                    "authority": "DERIVED_STAGING",
                    "note": "Placeholder offline root for CI spatial gates. Replace with real GLB/HLOD content before Shipping.",
                    "region": "Posey County, Indiana",
                }
            },
        },
    }

    TILESET.write_text(json.dumps(tileset, indent=2) + "\n", encoding="utf-8")
    logger.info("Wrote staging tileset: %s", TILESET.resolve())
    return TILESET


def main() -> int:
    try:
        package()
        return 0
    except Exception as e:  # noqa: BLE001
        logger.error("Packager failed: %s", e)
        return 1


if __name__ == "__main__":
    sys.exit(main())
