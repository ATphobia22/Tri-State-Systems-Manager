#!/usr/bin/env python3
"""Binary integrity + structural tests for TSM Posey offline tileset."""

from __future__ import annotations

import json
import struct
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TILESET = ROOT / "tiles" / "posey_county_offline" / "tileset.json"
GLB_MAGIC = b"glTF"


class TilesetStructureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if not TILESET.exists():
            raise unittest.SkipTest(f"tileset not staged: {TILESET}")

    def test_tileset_json_parses(self) -> None:
        data = json.loads(TILESET.read_text(encoding="utf-8"))
        self.assertIn("root", data)
        self.assertIn("asset", data)

    def test_root_has_box_and_transform(self) -> None:
        data = json.loads(TILESET.read_text(encoding="utf-8"))
        root = data["root"]
        self.assertIn("box", root.get("boundingVolume", {}))
        self.assertEqual(len(root["boundingVolume"]["box"]), 12)
        self.assertEqual(len(root.get("transform", [])), 16)

    def test_glb_magic_if_present(self) -> None:
        """Any .glb next to tileset must start with glTF magic."""
        for glb in TILESET.parent.rglob("*.glb"):
            with glb.open("rb") as f:
                magic = f.read(4)
            self.assertEqual(
                magic,
                GLB_MAGIC,
                f"{glb} missing glTF magic (got {magic!r})",
            )


if __name__ == "__main__":
    # Also exercise ECEF unit checks without a file when imported path works
    sys.path.insert(0, str(ROOT / "scripts" / "geospatial"))
    from tsm_ecef_validator import (  # type: ignore
        validate_rotation_orthonormality,
        validate_ecef_translation,
        POSEY_CO_ECEF_BOUNDS,
    )

    # Identity rotation + Bonebank-ish translation
    m = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        175550.8, -5039980.7, 3892024.2, 1,
    ]
    validate_rotation_orthonormality(m)
    validate_ecef_translation(m)
    assert POSEY_CO_ECEF_BOUNDS["x_min"] > 0  # regression: X must be + in Posey

    unittest.main()
