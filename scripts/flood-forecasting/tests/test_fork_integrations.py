#!/usr/bin/env python3
"""Tests for TSM fork integration scripts (hydromt, hfsubsetR, wres-explorer)."""

import sys
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add parent dir to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import hydromt_tsm_catalog
import hydrofabric_subset
import wres_evaluation


class TestHydroMTDataCatalog(unittest.TestCase):
    """Test HydroMT data catalog generation."""

    def test_build_catalog_creates_file(self):
        """Catalog generation writes valid YAML."""
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yml', delete=False) as f:
            output = Path(f.name)

        try:
            hydromt_tsm_catalog.build_data_catalog(output)
            content = output.read_text()
            # Verify key sections present
            self.assertIn('dem_posey_25ft', content)
            self.assertIn('bfe_fis_table9', content)
            self.assertIn('369.1', content)  # BFE reference
            self.assertIn('root:', content)
        finally:
            output.unlink()

    def test_data_sources_have_required_fields(self):
        """All data sources define path and data_type."""
        for name, src in hydromt_tsm_catalog.DATA_SOURCES.items():
            self.assertIn('path', src, f"{name} missing path")
            self.assertIn('data_type', src, f"{name} missing data_type")
            self.assertIn('description', src, f"{name} missing description")

    def test_bfe_uses_regulatory_value(self):
        """BFE references use 369.1 ft, not the retired 375.0."""
        bfe_src = hydromt_tsm_catalog.DATA_SOURCES.get('bfe_fis_table9', {})
        desc = bfe_src.get('description', '')
        self.assertIn('369.1', desc)
        self.assertNotIn('375.0', desc)


class TestHydrofabricSubset(unittest.TestCase):
    """Test hydrofabric extraction script generation."""

    def test_build_r_script_xy(self):
        """R script generation for coordinate-based extraction."""
        script = hydrofabric_subset.build_r_script(
            xy=(-88.005075, 37.845887),
            output_path='./test.gpkg'
        )
        self.assertIn('library(hfsubsetR)', script)
        self.assertIn('get_subset', script)
        self.assertIn('-88.005075', script)
        self.assertIn('37.845887', script)

    def test_build_r_script_comid(self):
        """R script generation for COMID-based extraction."""
        script = hydrofabric_subset.build_r_script(
            comid='12345678',
            output_path='./test.gpkg'
        )
        self.assertIn('comid', script)
        self.assertIn('12345678', script)

    def test_build_r_script_requires_xy_or_comid(self):
        """Must specify xy or comid."""
        with self.assertRaises(ValueError):
            hydrofabric_subset.build_r_script()

    def test_anchor_coordinates(self):
        """TSM anchor coordinates are correct."""
        self.assertAlmostEqual(hydrofabric_subset.TSM_ANCHOR_LON, -88.005075, places=4)
        self.assertAlmostEqual(hydrofabric_subset.TSM_ANCHOR_LAT, 37.845887, places=4)


class TestWRESEvaluation(unittest.TestCase):
    """Test WRES evaluation framework."""

    def test_gage_registry(self):
        """TSM gages are registered with correct datums."""
        gages = wres_evaluation.TSM_GAGES
        self.assertIn('03381700', gages)
        self.assertIn('03378500', gages)

        # Verify datums use NAVD88
        self.assertEqual(gages['03381700']['datum_ft_navd88'], 309.10)
        self.assertEqual(gages['03378500']['datum_ft_navd88'], 352.71)

    def test_bfe_not_in_gage_data(self):
        """Gage datums are not confused with BFE."""
        # BFE is 369.1 ft, gage datums are much lower
        for gid, g in wres_evaluation.TSM_GAGES.items():
            self.assertLess(g['datum_ft_navd88'], 369.1,
                          f"{gid} datum should be below BFE")


if __name__ == '__main__':
    unittest.main()
