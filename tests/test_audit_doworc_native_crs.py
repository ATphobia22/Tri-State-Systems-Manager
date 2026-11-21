"""Contract tests for DoWORC native CRS evidence extraction."""
import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/geo/audit_doworc_native_crs.py"
spec = importlib.util.spec_from_file_location("audit_doworc", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class AuditTests(unittest.TestCase):
    def test_missing_prj_remains_unknown(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "missing.zip"
            with zipfile.ZipFile(p, "w") as z:
                z.writestr("layer.shp", b"placeholder")
            row = module.audit(p)["layers"][0]
            self.assertEqual(row["status"], "MISSING_PRJ")
            self.assertIsNone(row["source_epsg"])
            self.assertIsNone(row["vertical_datum"])

    def test_malformed_projection_is_reported(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "invalid.zip"
            with zipfile.ZipFile(p, "w") as z:
                z.writestr("layer.shp", b"placeholder")
                z.writestr("layer.prj", "invalid WKT")
            row = module.audit(p)["layers"][0]
            self.assertEqual(row["status"], "INVALID_PRJ")
            self.assertIsNone(row["source_epsg"])

    def test_distinct_crs_remain_distinct(self):
        from pyproj import CRS
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "mixed.zip"
            with zipfile.ZipFile(p, "w") as z:
                for name, epsg in (("utm", 26916), ("stateplane", 2966)):
                    z.writestr(name + ".shp", b"placeholder")
                    z.writestr(name + ".prj", CRS.from_epsg(epsg).to_wkt())
            rows = module.audit(p)["layers"]
            self.assertEqual({r["source_epsg"] for r in rows}, {26916, 2966})
            self.assertTrue(all(r["status"] == "PARSED_HORIZONTAL" for r in rows))
            self.assertTrue(all(r["vertical_datum"] is None for r in rows))

if __name__ == "__main__":
    unittest.main()
