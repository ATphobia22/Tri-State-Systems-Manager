"""Opt-in real IFC parser smoke test; requires reviewed IfcOpenShell wheel."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

try:
    import ifcopenshell
    import ifcopenshell.guid
except ImportError:
    ifcopenshell = None

SCRIPT = Path(__file__).with_name("ifc_preflight.py")
spec = importlib.util.spec_from_file_location("tsm_ifc_preflight_real", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


@unittest.skipUnless(ifcopenshell is not None, "optional IfcOpenShell parser not installed")
class RealIfcParserSmokeTests(unittest.TestCase):
    def test_real_ifc4_file_is_hash_checked_and_not_claimed_surveyed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            path = root / "synthetic.ifc"
            out = root / "preflight.json"
            file = ifcopenshell.file(schema="IFC4")
            gid = ifcopenshell.guid.new()
            file.create_entity("IfcWall", GlobalId=gid, Name="Synthetic CI-only test object")
            file.write(str(path))
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            result = module.preflight(path, out, digest, "EPSG:2966", "NAVD88")
            self.assertEqual(result["productCount"], 1)
            self.assertEqual(result["products"][0]["globalId"], gid)
            self.assertEqual(result["georeferencing"]["placementState"], "UNRESOLVED_DATUM_OR_CRS")
            self.assertFalse(result["georeferencing"]["verticalDatumSourceVerified"])
            self.assertFalse(result["georeferencing"]["controlPointsVerified"])
            self.assertFalse(result["engineeringUse"])
            self.assertFalse(result["regulatoryUse"])
            self.assertEqual(json.loads(out.read_text())["schema"], module.SCHEMA)
            with self.assertRaises(module.PreflightError):
                module.preflight(path, out, digest, None, None)


if __name__ == "__main__":
    unittest.main()
