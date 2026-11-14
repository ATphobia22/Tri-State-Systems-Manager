"""Tiny in-memory tar fixtures; production Posey assets are never bundled to CI."""
import importlib.util
import io
import json
from pathlib import Path
import struct
import tarfile
import unittest

PATH = Path(__file__).with_name("audit_posey_glb_archive.py")
spec = importlib.util.spec_from_file_location("tsm_posey_archive_audit", PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def bundle(with_bad_glb=False, declared_count=1, include_escape=False):
    io_buf = io.BytesIO()
    manifest = {
        "source": {"sourceFeatureCount": declared_count},
        "input": {"featureCount": declared_count, "tileCount": declared_count,
                  "heightSources": {"OBSERVED": declared_count, "DERIVED": 0,
                                    "ESTIMATED_FALLBACK_INFORMATIONAL_ONLY": 0},
                  "geojsonSha256": "a" * 64},
        "authorityClass": "DERIVED",
    }
    hdr = struct.pack("<4sIIII", b"FAIL" if with_bad_glb else b"glTF", 2, 20, 0, 0x4E4F534A)
    with tarfile.open(fileobj=io_buf, mode="w") as stream:
        for name, data in (
            ("flat/manifest.json", json.dumps(manifest).encode()),
            ("flat/12345.glb", hdr),
        ):
            entry = tarfile.TarInfo(name)
            entry.size = len(data)
            stream.addfile(entry, io.BytesIO(data))
        symlink = tarfile.TarInfo("flat-local/12345.glb")
        symlink.type = tarfile.SYMTYPE
        symlink.linkname = "../flat/12345.glb"
        stream.addfile(symlink)
        if include_escape:
            danger = tarfile.TarInfo("../escape.glb")
            danger.size = 20
            stream.addfile(danger, io.BytesIO(hdr))
    io_buf.seek(0)
    return io_buf


class PoseyArchiveAuditTests(unittest.TestCase):
    def test_valid_subset_container_but_never_survey_certified(self):
        receipt = module.inspect_tar(bundle())
        self.assertEqual(receipt["primaryGlbHeadersVerified"], 1)
        self.assertEqual(receipt["unfollowedArchiveLinks"], 1)
        self.assertEqual(receipt["sourceClassCountsDeclared"]["OBSERVED"], 1)
        self.assertFalse(receipt["fullGltfGeometryValidated"])
        self.assertFalse(receipt["independentHeightVerification"])
        self.assertFalse(receipt["independentObjectIdReconciliation"])

    def test_broken_glb_is_not_accepted(self):
        with self.assertRaisesRegex(module.ArchiveAuditError, "MISMATCH"):
            module.inspect_tar(bundle(with_bad_glb=True))

    def test_manifest_mismatch_fails(self):
        with self.assertRaisesRegex(module.ArchiveAuditError, "MISMATCH"):
            module.inspect_tar(bundle(declared_count=2))

    def test_path_traversal_is_rejected_even_without_extraction(self):
        with self.assertRaisesRegex(module.ArchiveAuditError, "UNSAFE_ARCHIVE_PATH"):
            module.inspect_tar(bundle(include_escape=True))


if __name__ == "__main__":
    unittest.main()
