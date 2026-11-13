"""Ensure exported DEM candidates are actual spatial elevation rasters, not pictures."""
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/geospatial"))
from inspect_indiana_dem_export import inspect_export

BOX = (1000.0, 2000.0, 1004.0, 2003.0)


class TestDEMExport(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.file = Path(self.tmp.name) / 'dem.tif'

    def create(self, crs='EPSG:3857', bands=1, dtype='float32', data=370.0):
        with rasterio.open(self.file, 'w', driver='GTiff', height=3, width=4,
                           count=bands, crs=crs, dtype=dtype, nodata=0,
                           transform=from_origin(1000, 2003, 1, 1)) as ds:
            for band in range(1, bands + 1):
                ds.write(np.full((3, 4), data, dtype=dtype), band)

    def inspect(self, box=BOX):
        return inspect_export(self.file, bbox_3857=box, width=4, height=3)

    def test_valid_elevation_exports_receipt_with_noncertified_vertical(self):
        self.create()
        result = self.inspect()
        self.assertEqual(result['validFinitePixelCount'], 12)
        self.assertEqual(len(result['sha256']), 64)
        self.assertFalse(result['sourceVerticalDatumVerified'])
        self.assertFalse(result['sourceElevationUnitsVerified'])

    def test_rejects_three_band_hillshade(self):
        self.create(bands=3, dtype='uint8', data=137)
        with self.assertRaisesRegex(ValueError, 'one-band float32'):
            self.inspect()

    def test_rejects_wrong_horizontal_crs(self):
        self.create(crs='EPSG:2966')
        with self.assertRaisesRegex(ValueError, 'EPSG:3857'):
            self.inspect()

    def test_rejects_all_nodata(self):
        self.create(data=0)
        with self.assertRaisesRegex(ValueError, 'no valid finite'):
            self.inspect()

    def test_rejects_mismatched_spatial_bounds(self):
        self.create()
        with self.assertRaisesRegex(ValueError, 'bounds disagree'):
            self.inspect(box=(2000, 2000, 2004, 2003))

    def test_rejects_fake_tiff_header(self):
        self.file.write_bytes(b'II*\\x00' + b'0' * 100)
        with self.assertRaisesRegex(ValueError, 'not a supported'):
            self.inspect()

    def test_rejects_symlink(self):
        source = Path(self.tmp.name) / 'source.tif'
        self.create()
        self.file.rename(source)
        self.file.symlink_to(source)
        with self.assertRaisesRegex(ValueError, 'symlinked'):
            self.inspect()


class TestAcquisitionIntegration(TestDEMExport):
    """Exercise actual acquisition entry point with a no-network TIFF response."""

    def _run_acquisition(self, output, response_bytes, calls):
        import acquire_indiana_dem_tiles as acquire
        import json
        from unittest.mock import patch

        class FakeResponse:
            def raise_for_status(self):
                pass

            def iter_content(self, _chunk_size):
                yield response_bytes

        class FakeSession:
            def __init__(self):
                self.headers = {}

            def get(self, url, **_kwargs):
                calls.append(url)
                return FakeResponse()

        args = [
            "acquire_indiana_dem_tiles.py", "--bbox-3857",
            "1000", "2000", "1004", "2003", "--tile-pixels", "128",
            "--resolution-m", "1", "--delay", "0", "--out", str(output),
        ]
        with patch.object(acquire.requests, "Session", return_value=FakeSession()), \
             patch.object(acquire, "fetch_json", return_value={
                 "pixelType": "F32", "extent": {"spatialReference": {"wkid": 3857}}}), \
             patch.object(sys, "argv", args):
            acquire.main()
        return json.loads((output / "acquisition-manifest.json").read_text())

    def test_new_download_is_promoted_only_after_raster_validation(self):
        self.create()
        output = Path(self.tmp.name) / "output"
        calls = []
        manifest = self._run_acquisition(output, self.file.read_bytes(), calls)
        self.assertEqual(len(calls), 1)
        self.assertTrue(manifest["complete"])
        self.assertTrue(manifest["tiles"][0]["localExportStructureVerified"])
        self.assertFalse(manifest["tiles"][0]["sourceVerticalDatumVerified"])

    def test_corrupt_resumed_tiff_is_never_reported_complete(self):
        self.create()
        output = Path(self.tmp.name) / "output"
        calls = []
        self._run_acquisition(output, self.file.read_bytes(), calls)
        target = output / "dem_0000_0000.tif"
        target.write_bytes(b"invalid legacy resume payload")
        with self.assertRaisesRegex(ValueError, "not a supported"):
            self._run_acquisition(output, self.file.read_bytes(), calls)
        self.assertEqual(len(calls), 1)


if __name__ == '__main__':
    unittest.main()
