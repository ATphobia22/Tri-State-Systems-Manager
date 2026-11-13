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


if __name__ == '__main__':
    unittest.main()
