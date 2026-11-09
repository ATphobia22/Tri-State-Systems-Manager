"""Offline I3S archive ingestion tests, using local synthetic SLPK fixtures only."""
from __future__ import annotations

import gzip
import hashlib
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from backend.merkle_evidence import verify_manifest
from scripts.geospatial.import_i3s_slpk import unpack_slpk


class OfflineI3SSLPKTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.archive = self.root / "synthetic.slpk"
        self.target = self.root / "offline-scene"

    def package(self, additions=None, *, scene_metadata=None):
        metadata = scene_metadata or {
            "layerType": "3DObject",
            "profile": "meshpyramids",
            "store": {"id": "synthetic-fixture"},
            "spatialReference": {"wkid": 4326},
            "heightModelInfo": {"heightModel": "gravity_related_height"},
        }
        with zipfile.ZipFile(self.archive, "w", compression=zipfile.ZIP_STORED,
                             allowZip64=True) as output:
            output.writestr("3dSceneLayer.json.gz",
                            gzip.compress(json.dumps(metadata).encode()))
            output.writestr("nodePages/0.json.gz", gzip.compress(b'{"nodes": []}'))
            for name, blob in additions or []:
                output.writestr(name, blob)

    def test_valid_archive_has_deterministic_merkle_root(self):
        self.package()
        catalog = unpack_slpk(self.archive, self.target)
        self.assertEqual(catalog["format"], "I3S-SLPK")
        self.assertEqual(catalog["layerType"], "3DObject")
        self.assertEqual(catalog["resourceCount"], 2)
        self.assertFalse(catalog["verticalDatumVerified"])
        self.assertFalse(catalog["buildingHeightVerified"])
        self.assertFalse(catalog["regulatoryApproval"])
        manifest = json.loads((self.target / "tsm-merkle-manifest.json").read_text())
        self.assertTrue(verify_manifest(self.target, manifest))
        self.assertEqual(manifest["merkleRootSha256"], catalog["merkleRootSha256"])

    def test_zip_slip_rejected(self):
        self.package(additions=[("../escape.txt", b"unsafe")])
        with self.assertRaisesRegex(ValueError, "UNSAFE_ARCHIVE_PATH"):
            unpack_slpk(self.archive, self.target)
        self.assertFalse((self.root / "escape.txt").exists())
        self.assertFalse(self.target.exists())

    def test_symlink_member_rejected(self):
        link = zipfile.ZipInfo("nodes/link")
        link.create_system = 3
        link.external_attr = (0o120777 << 16)
        self.package(additions=[(link, b"../elsewhere")])
        with self.assertRaisesRegex(ValueError, "LINK_OR_SPECIAL_FILE"):
            unpack_slpk(self.archive, self.target)

    def test_case_collision_rejected(self):
        self.package(additions=[("nodePages/0.JSON.GZ", b"duplicate name")])
        with self.assertRaisesRegex(ValueError, "CASE_COLLIDING"):
            unpack_slpk(self.archive, self.target)

    def test_absurd_size_rejected(self):
        self.package(additions=[("nodes/blob.bin", b"X" * 500)])
        with self.assertRaisesRegex(ValueError, "SINGLE_RESOURCE"):
            unpack_slpk(self.archive, self.target, max_single_file=200)

    def test_missing_root_rejected(self):
        with zipfile.ZipFile(self.archive, "w") as file:
            file.writestr("nodePages/0.json.gz", b"test")
        with self.assertRaisesRegex(ValueError, "ROOT_MISSING"):
            unpack_slpk(self.archive, self.target)

    def test_malformed_metadata_rejected(self):
        self.package(scene_metadata={"hello": "world"})
        with self.assertRaisesRegex(ValueError, "DESCRIPTION_INVALID"):
            unpack_slpk(self.archive, self.target)

    def test_existing_destination_never_overwritten(self):
        self.package()
        self.target.mkdir()
        with self.assertRaisesRegex(FileExistsError, "OUTPUT_ALREADY_EXISTS"):
            unpack_slpk(self.archive, self.target)


if __name__ == "__main__":
    unittest.main()
