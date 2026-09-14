from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

import h5py

from backend.engineering.bishop import BishopSlice, bishop_factor_of_safety
from backend.engineering.hecras_hdf5 import discover_water_surface_datasets, read_water_surface
from backend.engineering.no_rise import compare_water_surface


class EngineeringPrimitiveTests(unittest.TestCase):
    def test_bishop_is_reproducible(self) -> None:
        slices = (
            BishopSlice(10.0, 12000.0, 0.12, 250.0, 0.42, 800.0),
            BishopSlice(10.0, 14000.0, 0.18, 250.0, 0.42, 900.0),
        )
        first = bishop_factor_of_safety(slices)
        second = bishop_factor_of_safety(slices)
        self.assertTrue(first.converged)
        self.assertEqual(first.factor_of_safety, second.factor_of_safety)
        self.assertEqual(first.input_sha256, second.input_sha256)

    def test_hecras_dataset_discovery_and_no_rise(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory) / "base.hdf"
            proposed = Path(directory) / "proposed.hdf"
            dataset = "Results/Unsteady/Output/Output Blocks/Base Output/Unsteady Time Series/2D Flow Areas/Test Area/Water Surface"
            with h5py.File(base, "w") as handle:
                handle.create_dataset(dataset, data=[[100.0, 101.0, 102.0]])
            with h5py.File(proposed, "w") as handle:
                handle.create_dataset(dataset, data=[[100.0, 101.005, 101.99]])
            refs = discover_water_surface_datasets(base)
            self.assertEqual(len(refs), 1)
            self.assertEqual(read_water_surface(base, dataset), [100.0, 101.0, 102.0])
            result = compare_water_surface(base, proposed, criterion_ft=0.01)
            self.assertEqual(result.max_rise_ft, 0.005)
            self.assertTrue(result.compliant)
            self.assertEqual(len(result.base_model_hash), 64)


if __name__ == "__main__":
    unittest.main()
