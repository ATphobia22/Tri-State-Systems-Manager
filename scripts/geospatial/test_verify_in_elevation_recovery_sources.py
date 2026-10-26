#!/usr/bin/env python3
"""Synthetic no-network tests for official Indiana elevation source discovery."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

MOD_PATH = Path(__file__).with_name("verify_in_elevation_recovery_sources.py")
spec = importlib.util.spec_from_file_location("igio_elevation_inventory", MOD_PATH)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class HeadersResponse:
    def __init__(self, headers):
        self.headers = headers
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False


class ArchiveTests(unittest.TestCase):
    def make_list(self, contents):
        d = tempfile.TemporaryDirectory()
        self.addCleanup(d.cleanup)
        path = Path(d.name) / "tiles.txt"
        path.write_text(contents, encoding="utf-8")
        return path

    @staticmethod
    def tile(grid="26850945"):
        return m.HOST + "/copc/statewide/2020/SPW/ql2/IN2020_" + grid + "_12.copc.laz"

    def test_verified_registry_names(self):
        f = self.make_list(self.tile() + "\n")
        report = m.inventory(f, layers=("2020_NDHM", "2020_DEM", "2013_NDHM"))
        self.assertEqual(report["objects"][0]["key"],
                         "ndhmoptimized/statewide/2020/SPW/5ft/IN2020_26850945_12_ndhm.tif")
        self.assertEqual(report["objects"][1]["key"],
                         "demoptimized/statewide/2020/SPW/2.5ft/IN2020_26850945_12.tif")
        self.assertEqual(report["objects"][2]["key"],
                         "ndhmoptimized/statewide/2013/SPW/5ft/in2013_26850945_12_ndhm.tif")
        self.assertFalse(report["buildingHeightAccepted"])

    def test_all_archive_product_variants(self):
        f = self.make_list(self.tile() + "\n")
        report = m.inventory(f, layers=tuple(m.LAYER_TEMPLATES))
        self.assertEqual(report["candidateObjectCount"], 6)
        self.assertTrue(report["objects"][3]["key"].startswith("las/statewide/2020/"))

    def test_duplicates_are_sorted_once(self):
        f = self.make_list(self.tile("26900945") + "\n" + self.tile() + "\n" + self.tile() + "\n")
        self.assertEqual(m.parse_copc_tile_list(f), ["26850945", "26900945"])

    def test_untrusted_host_rejected(self):
        with self.assertRaises(ValueError):
            m.parse_copc_tile_list(self.make_list("https://attacker.invalid/copc/foo"))

    def test_invalid_grid_rejected(self):
        with self.assertRaises(ValueError):
            m.parse_copc_tile_list(self.make_list(self.tile("26860945") + "\n"))

    def test_empty_inventory_rejected(self):
        with self.assertRaises(ValueError):
            m.parse_copc_tile_list(self.make_list("# nothing\n"))

    def test_max_tiles_enforced(self):
        with self.assertRaises(ValueError):
            m.parse_copc_tile_list(
                self.make_list(self.tile() + "\n" + self.tile("26900945") + "\n"), max_tiles=1)

    def test_disallow_unknown_layers_or_duplicates(self):
        with self.assertRaises(ValueError):
            m.expected_objects(["26850945"], ("WRONG",))
        with self.assertRaises(ValueError):
            m.expected_objects(["26850945"], ("2020_NDHM", "2020_NDHM"))

    def test_anonymous_head_has_no_accepted_sha(self):
        response = HeadersResponse({"Content-Length": "3000000", "ETag": '"part-4"'})
        with patch.object(m, "urlopen", return_value=response) as urlopen:
            result = m.head_object("ndhmoptimized/statewide/2020/SPW/5ft/test.tif")
        self.assertEqual(result["status"], "PRESENT")
        self.assertNotIn("contentSha256", result)
        self.assertIn("etagNotSha256", result)
        self.assertEqual(urlopen.call_args.args[0].get_method(), "HEAD")

    def test_404_is_not_found(self):
        with patch.object(m, "urlopen", side_effect=HTTPError("url", 404, "missing", {}, None)):
            self.assertEqual(m.head_object("some/key")["status"], "NOT_FOUND")

    def test_403_is_unverified(self):
        with patch.object(m, "urlopen", side_effect=HTTPError("url", 403, "denied", {}, None)):
            self.assertEqual(m.head_object("some/key")["status"], "UNVERIFIED_HTTP")

    def test_500_is_unverified(self):
        with patch.object(m, "urlopen", side_effect=HTTPError("url", 500, "backend", {}, None)):
            self.assertEqual(m.head_object("some/key")["status"], "UNVERIFIED_HTTP")

    def test_network_error_redacted(self):
        with patch.object(m, "urlopen", side_effect=URLError("private token")):
            self.assertEqual(m.head_object("some/key"), {"status": "SOURCE_UNREACHABLE"})

    def test_default_is_offline(self):
        f = self.make_list(self.tile() + "\n")
        with patch.object(m, "urlopen", side_effect=AssertionError("No network expected")):
            report = m.inventory(f)
        self.assertEqual(report["productAvailability"]["2020_NDHM"], {"NOT_PROBED": 1})

    def test_verify_uses_metadata_only(self):
        f = self.make_list(self.tile() + "\n")
        with patch.object(m, "head_object", return_value={"status": "PRESENT", "sizeBytes": 1}):
            report = m.inventory(f, verify=True, layers=("2020_NDHM",))
        self.assertFalse(report["buildingHeightAccepted"])
        self.assertEqual(report["productAvailability"]["2020_NDHM"], {"PRESENT": 1})

    def test_cli_never_overwrites_source(self):
        f = self.make_list(self.tile() + "\n")
        with patch("sys.argv", ["x", "--tile-list", str(f), "--out", str(f)]):
            self.assertEqual(m.main(), 2)
        self.assertIn("IN2020_", f.read_text())


if __name__ == "__main__":
    unittest.main()
