"""Offline IFC preflight contract tests, runnable without IfcOpenShell."""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace

SCRIPT = Path(__file__).with_name("ifc_preflight.py")
spec = importlib.util.spec_from_file_location("tsm_ifc_preflight", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

A = "0" * 22
B = "1" * 22

class FakeProduct:
    def __init__(self, gid, kind="IfcWall", representation=None):
        self.GlobalId = gid
        self.Representation = representation
        self.kind = kind
    def is_a(self):
        return self.kind

class FakeModel:
    schema = "IFC4"
    def __init__(self, products=None, crs=None, conversion=None):
        self.products = products if products is not None else [FakeProduct(A)]
        self.crs = crs if crs is not None else []
        self.conversion = conversion if conversion is not None else []
    def by_type(self, entity):
        return {"IfcProduct": self.products, "IfcProjectedCRS": self.crs,
                "IfcMapConversion": self.conversion}.get(entity, [])

class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.source = {"sha256": hashlib.sha256(b"STEP").hexdigest(), "bytes": 4}

    def test_unreferenced_ifc_is_not_geospatially_authoritative(self):
        result = module.inspect_model(FakeModel(), self.source)
        self.assertEqual(result["georeferencing"]["placementState"], "UNRESOLVED_DATUM_OR_CRS")
        self.assertFalse(result["engineeringUse"])
        self.assertFalse(result["regulatoryUse"])
        self.assertEqual(result["geometry"]["meshesExported"], 0)

    def test_crs_and_operator_datum_still_require_independent_controls(self):
        operation = SimpleNamespace(Eastings=100.0, Northings=200.0,
                                    OrthogonalHeight=300.0, Scale=1.0,
                                    XAxisAbscissa=1.0, XAxisOrdinate=0.0)
        model = FakeModel(crs=[SimpleNamespace(Name="EPSG:2966")],
                          conversion=[operation])
        result = module.inspect_model(model, self.source, "NAVD88", "EPSG:2966")
        geo = result["georeferencing"]
        self.assertEqual(geo["placementState"], "CANDIDATE_FOR_CONTROL_POINT_REVIEW")
        self.assertFalse(geo["verticalDatumSourceVerified"])
        self.assertFalse(geo["controlPointsVerified"])
        self.assertFalse(geo["lengthUnitsVerified"])

    def test_expected_crs_mismatch_fails_placement(self):
        operation = SimpleNamespace(Eastings=1, Northings=2,
                                    OrthogonalHeight=3, Scale=1,
                                    XAxisAbscissa=1, XAxisOrdinate=0)
        model = FakeModel(crs=[SimpleNamespace(Name="EPSG:4326")],
                          conversion=[operation])
        result = module.inspect_model(model, self.source, "NAVD88", "EPSG:2966")
        self.assertEqual(result["georeferencing"]["placementState"], "UNRESOLVED_DATUM_OR_CRS")

    def test_duplicate_and_malformed_guid_rejected(self):
        for products in ([FakeProduct(A), FakeProduct(A)], [FakeProduct("bad")]):
            with self.assertRaises(module.PreflightError):
                module.inspect_model(FakeModel(products=products), self.source)

    def test_ambiguous_georeference_fails(self):
        with self.assertRaises(module.PreflightError):
            module.inspect_model(FakeModel(crs=[SimpleNamespace(Name="EPSG:2966")]), self.source)

    def test_invalid_scale_and_degenerate_axis_rejected(self):
        for scale, axis in ((-1, 1), (1, 0)):
            op = SimpleNamespace(Eastings=1, Northings=2,
                                 OrthogonalHeight=3, Scale=scale,
                                 XAxisAbscissa=axis, XAxisOrdinate=0)
            with self.assertRaises(module.PreflightError):
                module.inspect_model(FakeModel(crs=[SimpleNamespace(Name="EPSG:2966")],
                                               conversion=[op]), self.source)

    def test_file_hash_and_magic(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "test.ifc"
            p.write_bytes(b"ISO-10303-21;\nHEADER;\nENDSEC;\n")
            src = module.inspect_source(p)
            self.assertEqual(src["sha256"], hashlib.sha256(p.read_bytes()).hexdigest())
            with self.assertRaises(module.PreflightError):
                module.inspect_source(p, max_bytes=2)
            p.write_text("not IFC", encoding="utf-8")
            with self.assertRaises(module.PreflightError):
                module.inspect_source(p)

    def test_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            actual = Path(tmp) / "real.ifc"
            actual.write_bytes(b"ISO-10303-21;")
            sym = Path(tmp) / "alias.ifc"
            sym.symlink_to(actual)
            with self.assertRaises(module.PreflightError):
                module.inspect_source(sym)

    def test_checksum_is_required_for_fail_closed_preflight(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "test.ifc"
            path.write_bytes(b"ISO-10303-21;")
            with self.assertRaises(module.PreflightError):
                module.preflight(path, Path(tmp) / "out.json", "0"*64, None, None)


if __name__ == "__main__":
    unittest.main()
