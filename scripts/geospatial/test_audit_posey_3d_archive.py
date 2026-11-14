"""Synthetic, tiny tileset check for the independent Posey archive auditor."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest

CODE = Path(__file__).with_name("audit_posey_3d_archive.py")
spec = importlib.util.spec_from_file_location("posey_audit_contract", CODE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def glb():
    data = json.dumps({"asset": {"version": "2.0"}, "meshes": [{"primitives": []}]}).encode()
    data += b" " * ((4 - len(data) % 4) % 4)
    return struct.pack("<4sIIII", b"glTF", 2, 20 + len(data), len(data), 0x4E4F534A) + data


class ArchiveContractTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.flat = self.root / "flat"
        self.flat.mkdir()
        local = self.root / "flat-local"
        local.mkdir()
        self.data = {
            "sourceId": 740296,
            "groundElevationFtNavd88": 402.0,
            "lidarHeightFt": 14.07,
            "heightProvenance": "OBSERVED",
        }
        (self.flat / "740296.glb").write_bytes(glb())
        (local / "740296.glb").write_bytes(glb())
        self.manifest = {
            "artifactId": "tsm-buildings-3d-tiles-lod1",
            "engineeringUse": False,
            "regulatoryUse": False,
            "source": {"sourceFeatureCount": 1},
            "input": {
                "featureCount": 1, "heightSources": {"OBSERVED": 1, "DERIVED": 0},
                "geojsonSha256": "0" * 64,
            },
            "tileCount": 1,
            "content": ["740296.glb"],
        }
        self.child = {
            "content": {"uri": "740296.glb"},
            "extras": {"tsm": {
                "sourceObjectId": 740296,
                "groundElevationFtNavd88": 402.0,
                "lidarHeightFt": 14.07,
                "heightProvenance": "OBSERVED",
            }},
        }
        self.refresh()

    def refresh(self):
        (self.flat / "manifest.json").write_text(json.dumps(self.manifest))
        (self.flat / "tileset.json").write_text(json.dumps({"root": {"children": [self.child]}}))
        checks = []
        for name in ("740296.glb", "manifest.json", "tileset.json"):
            checks.append(f"{digest(self.flat / name)}  {name}")
        (self.flat / "SHA256SUMS").write_text("\n".join(checks) + "\n")

    def test_identity_and_sha_pass(self):
        result = module.audit(self.root)
        self.assertEqual(result["checkedSha256Entries"], 3)
        self.assertEqual(result["tileSourceObjectIdCount"], 1)
        self.assertTrue(result["internalConsistencyVerified"])
        self.assertFalse(result["surveyCertified"])

    def test_modified_geometry_fails_checksum(self):
        (self.flat / "740296.glb").write_bytes(glb() + b"tampering")
        with self.assertRaisesRegex(module.ArchiveAuditError, "BAD_SHA256"):
            module.audit(self.root)

    def test_metadata_identity_mismatch_fails(self):
        self.child["extras"]["tsm"]["sourceObjectId"] = 740297
        self.refresh()
        with self.assertRaisesRegex(module.ArchiveAuditError, "OBJECTID_AND_GLB_URI_MISMATCH"):
            module.audit(self.root)

    def test_zero_source_height_is_not_invented(self):
        self.child["extras"]["tsm"].pop("groundElevationFtNavd88")
        self.refresh()
        with self.assertRaisesRegex(module.ArchiveAuditError, "MISSING_NONFINITE_groundElevationFtNavd88"):
            module.audit(self.root)


if __name__ == "__main__":
    unittest.main()
