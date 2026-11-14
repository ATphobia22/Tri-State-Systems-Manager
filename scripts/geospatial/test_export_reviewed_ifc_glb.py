"""Tests for reviewed IFC->GLB conversion contract without external tools."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

PATH = Path(__file__).with_name("export_reviewed_ifc_glb.py")
spec = importlib.util.spec_from_file_location("tsm_export_ifc_glb", PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
GID = "0" * 22


def sha(b):
    return hashlib.sha256(b).hexdigest()


def fake_glb(meshes=True):
    model = json.dumps({"asset": {"version": "2.0"}, "meshes": [{"primitives": []}] if meshes else []}).encode()
    model += b" " * ((4 - len(model) % 4) % 4)
    return struct.pack("<4sIIII", b"glTF", 2, 20 + len(model), len(model), 0x4E4F534A) + model


class IfcGlbBridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.output = root / "out"
        self.output.mkdir()
        self.ifc = root / "test.ifc"
        self.ifc.write_bytes(b"ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n")
        self.exe = root / "IfcConvert"
        self.exe.write_text("#!/bin/sh\nexit 0\n")
        self.exe.chmod(0o700)
        self.preflight = root / "preflight.json"
        self.crosswalk = root / "links.json"
        self.assets = root / "assets.json"
        self.assets.write_text(json.dumps({"assets": [{"assetId": "IGIO:fixture-42"}]}))
        self.p = {
            "schema": "tsm.geobim.ifc-preflight.v1",
            "source": {"sha256": sha(self.ifc.read_bytes())},
            "products": [{"globalId": GID, "ifcClass": "IfcWall", "hasRepresentation": True}],
            "georeferencing": {"projectedCrs": "EPSG:2966", "verticalDatumDeclared": "NAVD88",
                               "controlPointsVerified": False},
            "geometry": {"meshesExported": 0},
        }
        self.c = {
            "assetRegistrySha256": sha(self.assets.read_bytes()),
            "mappings": [{
                "ifcGlobalId": GID, "assetId": "IGIO:fixture-42",
                "reviewEvidenceSha256": sha(b"independent human review fixture"),
                "reviewState": "HUMAN_REVIEWED_CANDIDATE",
            }],
        }
        self.save()

    def save(self):
        self.preflight.write_text(json.dumps(self.p))
        self.crosswalk.write_text(json.dumps(self.c))

    def convert(self):
        with patch.object(module.subprocess, "run") as proc:
            def write_glb(*args, **kwargs):
                self.assertEqual(args[0][0], str(self.exe))
                self.assertEqual(args[0][1], str(self.ifc))
                Path(args[0][2]).write_bytes(fake_glb())
                self.assertFalse(kwargs.get("shell", False))
                return SimpleNamespace(returncode=0, stdout="", stderr="")
            proc.side_effect = write_glb
            return module.convert(self.ifc, self.preflight, self.crosswalk, self.assets, self.exe, self.output)

    def test_verified_byte_chain_and_explicit_unplaced_mesh(self):
        result = self.convert()
        self.assertEqual(result["geometry"]["meshCount"], 1)
        self.assertEqual(result["geometry"]["coordinateFrame"], "IFC_MODEL_LOCAL")
        self.assertEqual(result["links"][0]["assetId"], "IGIO:fixture-42")
        for k in ("surveyCertified", "sourceDatumVerified", "regulatoryApproved",
                  "nativeViewerValidated", "hydraulicModelInputApproved"):
            self.assertFalse(result[k])
        self.assertEqual(result["sourceIfcSha256"], sha(self.ifc.read_bytes()))
        self.assertTrue((self.output / "ifc-model-asset-bridge.json").is_file())
        with self.assertRaisesRegex(module.BridgeError, "OUTPUT_EXISTS"):
            self.convert()

    def test_crosswalk_must_be_pinned_to_registry(self):
        self.c["assetRegistrySha256"] = "0" * 64
        self.save()
        with self.assertRaisesRegex(module.BridgeError, "ASSET_REGISTRY_HASH_MISMATCH"):
            self.convert()

    def test_source_cannot_change_after_preflight(self):
        self.ifc.write_bytes(self.ifc.read_bytes() + b"MODIFIED")
        with self.assertRaisesRegex(module.BridgeError, "IFC_BYTES_CHANGED"):
            self.convert()

    def test_unauthorized_or_missing_link_cannot_pass(self):
        self.c["mappings"][0]["assetId"] = "GUESSED:543"
        self.save()
        with self.assertRaisesRegex(module.BridgeError, "GIS_ASSET_NOT_FOUND"):
            self.convert()
        self.c["mappings"][0]["assetId"] = "IGIO:fixture-42"
        self.c["mappings"][0]["reviewState"] = "AUTOMATICALLY_VERIFIED"
        self.save()
        with self.assertRaisesRegex(module.BridgeError, "HUMAN_REVIEWED_CANDIDATE"):
            self.convert()

    def test_duplicate_ifc_link_rejected(self):
        self.c["mappings"].append(dict(self.c["mappings"][0]))
        self.save()
        with self.assertRaisesRegex(module.BridgeError, "UNMATCHED_OR_DUPLICATE"):
            self.convert()

    def test_reject_empty_and_corrupt_glb(self):
        self.assertRaisesRegex(module.BridgeError, "GLB_HAS_NO_MESHES",
                               module.validate_glb, self._file(fake_glb(False)))
        self.assertRaisesRegex(module.BridgeError, "GLB_MISSING_OR_UNBOUNDED",
                               module.validate_glb, self._file(b"xxx"))

    def test_converter_failure_removes_partial_geometry(self):
        with patch.object(module.subprocess, "run") as run:
            def fail(*args, **kwargs):
                (self.output / "ifc-model.glb").write_bytes(b"partial")
                return SimpleNamespace(returncode=2)
            run.side_effect = fail
            with self.assertRaisesRegex(module.BridgeError, "IFCCONVERT_EXECUTION_FAILED"):
                module.convert(self.ifc, self.preflight, self.crosswalk, self.assets, self.exe, self.output)
            self.assertFalse((self.output / "ifc-model.glb").exists())

    def _file(self, data):
        path = Path(self.temp.name) / "candidate.glb"
        path.write_bytes(data)
        return path


if __name__ == "__main__":
    unittest.main()
