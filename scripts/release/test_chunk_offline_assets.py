#!/usr/bin/env python3
"""Adversarial deterministic chunk/restore checks; no real site data used."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from chunk_offline_assets import pack, unpack, verify, read_manifest


class OfflineArchiveTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="tsm-chunk-validation-")
        self.addCleanup(self.tmp.cleanup)
        self.work = Path(self.tmp.name)
        self.source = self.work / "screening-data"
        self.source.mkdir()
        (self.source / "3d-tiles").mkdir()
        (self.source / "3d-tiles" / "tileset.json").write_text(
            json.dumps({"asset": {"version": "1.1",
                                  "extras": {"authorityClass": "DERIVED",
                                             "engineeringUse": False, "regulatoryUse": False}}},
                       sort_keys=True) + "\n", encoding="utf-8")
        (self.source / "3d-tiles" / "synthetic-building-fixture.glb").write_bytes(
            b"glTF" + bytes(range(256)) * 30)
        (self.source / "evidence-manifest.json").write_text(
            json.dumps({"schemaVersion": "tsm.test-evidence.v1",
                        "classification": "INFORMATIONAL_ONLY",
                        "coordinateValues": "none"}) + "\n", encoding="utf-8")

    def test_lossless_gzip_stream_round_trip_with_chunk_boundaries(self):
        target = self.work / "chunks"
        result = pack(self.source, target, 512, "gzip")
        self.assertEqual(result["schemaVersion"], "tsm.offline-chunk-bundle.v1")
        self.assertGreaterEqual(len(result["parts"]), 2)
        self.assertEqual(result["sourceFileCount"], 3)
        self.assertFalse(result["engineeringUse"])
        self.assertEqual(result["archiveSha256"], verify(target / "manifest.json")["archiveSha256"])
        restored = self.work / "restored"
        unpack(target / "manifest.json", restored)
        for item in result["inventory"]:
            self.assertEqual((restored / item["path"]).read_bytes(),
                             (self.source / item["path"]).read_bytes())
        with self.assertRaisesRegex(ValueError, "must not exist"):
            unpack(target / "manifest.json", restored)

    def test_archive_is_byte_deterministic_on_distinct_runs(self):
        first = self.work / "first"
        second = self.work / "second"
        a = pack(self.source, first, 1024, "gzip")
        b = pack(self.source, second, 1024, "gzip")
        self.assertEqual(a, b)
        self.assertEqual((first / "manifest.json").read_bytes(),
                         (second / "manifest.json").read_bytes())
        for item in a["parts"]:
            self.assertEqual((first / item["name"]).read_bytes(),
                             (second / item["name"]).read_bytes())

    def test_uncompressed_parts_are_restorable_and_independently_hashed(self):
        parts = self.work / "uncompressed"
        m = pack(self.source, parts, 512, "none")
        self.assertGreater(len(m["parts"]), 10)
        restored = self.work / "restored-raw"
        unpack(parts / "manifest.json", restored)
        self.assertEqual(
            (restored / "evidence-manifest.json").read_bytes(),
            (self.source / "evidence-manifest.json").read_bytes(),
        )

    def test_bit_flip_fails_before_any_restore(self):
        parts = self.work / "tampered"
        m = pack(self.source, parts, 512, "none")
        path = parts / m["parts"][0]["name"]
        corrupt = bytearray(path.read_bytes())
        corrupt[0] ^= 0x20
        path.write_bytes(corrupt)
        with self.assertRaisesRegex(ValueError, "corrupted"):
            verify(parts / "manifest.json")
        with self.assertRaisesRegex(ValueError, "corrupted"):
            unpack(parts / "manifest.json", self.work / "corrupt-destination")
        self.assertFalse((self.work / "corrupt-destination").exists())

    def test_reject_path_alias_and_input_symlink(self):
        with self.assertRaisesRegex(ValueError, "inside input"):
            pack(self.source, self.source / "chunks", 512, "none")
        (self.source / "ref").symlink_to(self.source / "3d-tiles", target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "symlink"):
            pack(self.source, self.work / "symlink-bundle", 512, "none")

    def test_reject_invalid_manifest_semantics(self):
        target = self.work / "malformed"
        pack(self.source, target, 512, "none")
        m = read_manifest(target / "manifest.json")
        m["inventory"][0]["path"] = "../outside-tsm"
        (target / "manifest.json").write_text(json.dumps(m), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Unsafe inventory"):
            verify(target / "manifest.json")

    def test_refuse_overwriting_existing_bundle(self):
        target = self.work / "immutable-bundle"
        pack(self.source, target, 512, "none")
        with self.assertRaisesRegex(ValueError, "immutable"):
            pack(self.source, target, 512, "none")


if __name__ == "__main__":
    unittest.main()
