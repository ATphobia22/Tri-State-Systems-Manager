"""Tests for the standard-library PMTiles header validator."""
from __future__ import annotations

import importlib.util
import struct
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("validate_pmtiles.py")
SPEC = importlib.util.spec_from_file_location("validate_pmtiles", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def make_archive(path: Path) -> None:
    header = bytearray(127)
    header[:7] = b"PMTiles"
    header[7] = 3
    struct.pack_into("<Q", header, 8, 127)  # root directory offset
    struct.pack_into("<Q", header, 16, 1)   # root directory length
    struct.pack_into("<Q", header, 24, 128) # metadata offset
    struct.pack_into("<Q", header, 32, 1)   # metadata length
    struct.pack_into("<Q", header, 56, 129) # tile data offset
    struct.pack_into("<Q", header, 64, 1)   # tile data length
    header[97] = 1
    header[98] = 1
    header[99] = 1
    header[100] = 7
    header[101] = 16
    path.write_bytes(bytes(header) + b"RMT")


class ValidatePmtilesTests(unittest.TestCase):
    def test_accepts_valid_minimal_v3_header(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "fixture.pmtiles"
            make_archive(archive)
            report = MODULE.parse_header(archive)
            self.assertEqual(report["version"], 3)
            self.assertEqual(report["min_zoom"], 7)
            self.assertEqual(report["max_zoom"], 16)
            self.assertEqual(len(report["sha256"]), 64)

    def test_rejects_wrong_magic(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "fixture.pmtiles"
            make_archive(archive)
            archive.write_bytes(b"badfile" + archive.read_bytes()[7:])
            with self.assertRaisesRegex(ValueError, "magic"):
                MODULE.parse_header(archive)

    def test_rejects_out_of_bounds_root_directory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "fixture.pmtiles"
            make_archive(archive)
            raw = bytearray(archive.read_bytes())
            struct.pack_into("<Q", raw, 16, 1000)
            archive.write_bytes(raw)
            with self.assertRaisesRegex(ValueError, "beyond archive"):
                MODULE.parse_header(archive)

    def test_rejects_overlapping_sections(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "fixture.pmtiles"
            make_archive(archive)
            raw = bytearray(archive.read_bytes())
            struct.pack_into("<Q", raw, 24, 127)
            archive.write_bytes(raw)
            with self.assertRaisesRegex(ValueError, "metadata overlaps root directory"):
                MODULE.parse_header(archive)

    def test_rejects_section_overlapping_header(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "fixture.pmtiles"
            make_archive(archive)
            raw = bytearray(archive.read_bytes())
            struct.pack_into("<Q", raw, 24, 126)  # metadata starts inside header
            archive.write_bytes(raw)
            with self.assertRaisesRegex(ValueError, "metadata overlaps the header"):
                MODULE.parse_header(archive)

    def test_rejects_invalid_zoom_range(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "fixture.pmtiles"
            make_archive(archive)
            raw = bytearray(archive.read_bytes())
            raw[100], raw[101] = 17, 16
            archive.write_bytes(raw)
            with self.assertRaisesRegex(ValueError, "zoom range"):
                MODULE.parse_header(archive)


if __name__ == "__main__":
    unittest.main()
