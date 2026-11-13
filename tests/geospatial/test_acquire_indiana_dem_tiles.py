import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[2] / "scripts/geospatial/acquire_indiana_dem_tiles.py"
spec = importlib.util.spec_from_file_location("indiana_dem_acquire", MODULE)
acquisition = importlib.util.module_from_spec(spec)
spec.loader.exec_module(acquisition)


class TestTiffSignatures(unittest.TestCase):
    def test_valid_classic_and_big_tiff_magic(self):
        signatures = [
            bytes((0x49,0x49,0x2A,0x00)),
            bytes((0x4D,0x4D,0x00,0x2A)),
            bytes((0x49,0x49,0x2B,0x00)),
            bytes((0x4D,0x4D,0x00,0x2B)),
        ]
        for signature in signatures:
            with self.subTest(signature=signature):
                self.assertTrue(acquisition.has_tiff_magic(signature))

    def test_json_html_and_literal_escape_strings_rejected(self):
        for signature in (b'{"er',b"<htm",b"\x49\x49",b"II*\\x00",b"MM\\x00*"):
            with self.subTest(signature=signature):
                self.assertFalse(acquisition.has_tiff_magic(signature[:4]))

    def test_reject_corrupt_existing_cache_and_accept_tiff_candidate(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"tile.tif"
            path.write_bytes(b"<html>not a tiff")
            self.assertFalse(acquisition.is_tiff_candidate(path))
            path.write_bytes(bytes((0x49,0x49,0x2A,0x00))+bytes(16))
            self.assertTrue(acquisition.is_tiff_candidate(path))
            path.write_bytes(bytes((0x49,0x49,0x2A,0x00)))
            self.assertFalse(acquisition.is_tiff_candidate(path))

    def test_missing_tile_is_not_cached(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertFalse(acquisition.is_tiff_candidate(Path(folder)/"missing.tif"))


if __name__ == "__main__":
    unittest.main()
