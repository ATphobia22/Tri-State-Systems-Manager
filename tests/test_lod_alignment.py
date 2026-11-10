"""Synthetic geometry exercises validation, never claims regional accuracy."""
import copy
import importlib.util
import math
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np

PATH = Path(__file__).resolve().parents[1] / "scripts/geospatial/validate_lod_alignment.py"
SPEC = importlib.util.spec_from_file_location("validate_lod_alignment", PATH)
lod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(lod)


def metadata():
    return {"crs": "EPSG:26916", "vertical_datum": "NAVD88", "vertical_units": "m"}


def vertex(x=101, y=199, z=10):
    return {"x": x, "y": y, "z": z, "is_base": True}


class AlignmentTests(unittest.TestCase):
    def evaluate(self, vertices=None, terrain=None, transform=None, **kw):
        return lod.verify_terrain_alignment(
            vertices if vertices is not None else [vertex()],
            np.array([[10., 12.], [14., 16.]]) if terrain is None else terrain,
            (100., 2., 0., 200., 0., -2.) if transform is None else transform,
            mesh_metadata=kw.pop("mesh_metadata", metadata()),
            terrain_metadata=kw.pop("terrain_metadata", metadata()),
            tolerance_m=kw.pop("tolerance_m", .1), **kw)

    def test_comparison_does_not_move_vertices_or_certify_lod(self):
        vertices = [vertex(), vertex(z=10.25)]
        original = copy.deepcopy(vertices)
        r = self.evaluate(vertices)
        self.assertEqual(r["status"], "mismatch")
        self.assertEqual(r["total_violations"], 1)
        self.assertAlmostEqual(r["max_abs_delta_m"], .25)
        self.assertAlmostEqual(r["rmse_m"], math.sqrt(.03125))
        self.assertEqual(vertices, original)
        self.assertFalse(r["lod_certified"])

    def test_rotated_affine_uses_both_axes(self):
        # x=100+2*c+r; y=200+c-2*r; pixel centre (c=1.5,r=.5) => (103.5,200.5)
        r = self.evaluate([vertex(103.5, 200.5, 12)], transform=(100, 2, 1, 200, 1, -2))
        self.assertEqual(r["status"], "aligned")
        self.assertEqual(r["checked_base_vertices"], 1)

    def test_negative_indices_and_far_edge_are_not_wrapped_or_clamped(self):
        for v in [vertex(x=99.9), vertex(x=104), vertex(y=196), vertex(y=200.1)]:
            r = self.evaluate([v])
            self.assertEqual(r["status"], "incomplete")
            self.assertFalse(r["is_valid"])
            self.assertEqual(r["unavailable"][0]["reason"], "OUT_OF_BOUNDS")

    def test_nodata_and_mask_are_unavailable_not_alignment(self):
        for grid, extra in [(np.array([[-9999.]]), {"nodata": -9999}),
                             (np.array([[np.nan]]), {}),
                             (np.ma.array([[10.]], mask=[[True]]), {})]:
            r = self.evaluate(terrain=grid, **extra)
            self.assertEqual(r["status"], "incomplete")
            self.assertEqual(r["checked_base_vertices"], 0)
            self.assertIsNone(r["rmse_m"])

    def test_missing_or_mismatched_crs_datum_units_do_not_pass(self):
        for field, value in [("crs", "EPSG:2966"), ("crs", ""),
                             ("vertical_datum", "UNVERIFIED"),
                             ("vertical_datum", "EGM2008"), ("vertical_units", "ftUS")]:
            mesh = metadata(); mesh[field] = value
            r = self.evaluate(mesh_metadata=mesh)
            self.assertEqual(r["status"], "incomplete")
            self.assertFalse(r["is_valid"])

    def test_empty_base_evidence_cannot_pass(self):
        for vertices in [[], [{**vertex(), "is_base": False}]]:
            self.assertEqual(self.evaluate(vertices)["status"], "incomplete")

    def test_malformed_vertices_rasters_transforms_and_tolerances_rejected(self):
        cases = [dict(vertices=[vertex(z=float("nan"))]),
                 dict(vertices=[{"x": 101, "y": 199, "z": 10}]),
                 dict(vertices=[{**vertex(), "is_base": 1}]),
                 dict(terrain=np.zeros((2, 2, 3))),
                 dict(transform=(0, 1, 2, 0, 2, 4)),
                 dict(transform=(0, 1, 0, 0)),
                 dict(vertices=[vertex(z=1 + 2j)]),
                 dict(tolerance_m=-1), dict(tolerance_m=float("nan")),
                 dict(tolerance_m=True)]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(ValueError):
                self.evaluate(**case)

    def test_tolerance_is_explicit_and_exact_match_can_use_zero(self):
        r = self.evaluate(tolerance_m=0)
        self.assertTrue(r["is_valid"])
        self.assertEqual(r["tolerance_m"], 0)
        with self.assertRaises(TypeError):
            lod.verify_terrain_alignment([], np.zeros((1, 1)), (0, 1, 0, 0, 0, -1),
                                         mesh_metadata=metadata(), terrain_metadata=metadata())


class AlignmentCommandTests(unittest.TestCase):
    def test_real_geotiff_command_binds_report_to_inputs_and_reports_mismatch(self):
        import rasterio
        from rasterio.transform import Affine
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            terrain = root / "dtm.tif"
            with rasterio.open(terrain, "w", driver="GTiff", width=2, height=2,
                               count=1, dtype="float32", crs="EPSG:26916",
                               transform=Affine(2, 0, 100, 0, -2, 200)) as out:
                out.write(np.full((2, 2), 10, dtype=np.float32), 1)
            digest = hashlib.sha256(terrain.read_bytes()).hexdigest()
            document = {"vertices": [vertex()], "mesh_metadata": metadata(),
                        "terrain_metadata": metadata(), "terrain_sha256": digest}
            source = root / "vertices.json"
            report = root / "result.json"
            args = ["--mesh-document", str(source), "--terrain", str(terrain),
                    "--tolerance-m", ".1", "--report", str(report)]
            source.write_text(json.dumps(document))
            self.assertEqual(lod.main(args), 0)
            result = json.loads(report.read_text())
            self.assertEqual(result["input_sha256"]["terrain"], digest)
            self.assertEqual(result["input_sha256"]["mesh_document"],
                             hashlib.sha256(source.read_bytes()).hexdigest())
            self.assertFalse(result["datum_independently_verified"])
            document["vertices"][0]["z"] = 20
            source.write_text(json.dumps(document))
            self.assertEqual(lod.main(args), 2)
            self.assertEqual(json.loads(report.read_text())["status"], "mismatch")
            document["terrain_sha256"] = "0" * 64
            source.write_text(json.dumps(document))
            self.assertEqual(lod.main(args), 2)
            self.assertIn("SHA256", json.loads(report.read_text())["issues"][0])

    def test_unreadable_raster_is_reported_without_traceback(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            terrain = root / "bad.tif"
            terrain.write_bytes(b"not a raster")
            source = root / "vertices.json"
            source.write_text(json.dumps({"terrain_sha256": hashlib.sha256(terrain.read_bytes()).hexdigest()}))
            report = root / "report.json"
            self.assertEqual(lod.main(["--mesh-document", str(source), "--terrain", str(terrain),
                                       "--tolerance-m", ".1", "--report", str(report)]), 2)
            self.assertEqual(json.loads(report.read_text())["status"], "incomplete")

    def test_malformed_document_is_a_structured_unavailable_report(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "invalid.json"
            source.write_text("[]")
            terrain = root / "exists.tif"
            terrain.write_bytes(b"reach document validation before raster loading")
            report = root / "report.json"
            self.assertEqual(lod.main(["--mesh-document", str(source), "--terrain", str(terrain),
                                       "--tolerance-m", ".1", "--report", str(report)]), 2)
            self.assertEqual(json.loads(report.read_text())["status"], "incomplete")


if __name__ == "__main__":
    unittest.main()
