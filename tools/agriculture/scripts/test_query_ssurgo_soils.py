#!/usr/bin/env python3
"""Offline contract and adversarial tests for bounded NRCS SDA client."""
from __future__ import annotations
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SOURCE = Path(__file__).with_name("query-ssurgo-soils.py")
spec = importlib.util.spec_from_file_location("tsm_soil_sda", SOURCE)
assert spec and spec.loader
sda = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sda)


def snapshot(header: list[str], rows: list[list[object]]) -> bytes:
    return json.dumps({"Table": [header, *rows]}).encode("utf-8")


MU_HEADER = ["mukey", "musym", "muname", "muacres"]
CO_HEADER = ["mukey", "musym", "cokey", "compname", "comppct_r", "drainagecl", "hydgrp", "slope_r", "elev_r"]
MU = snapshot(MU_HEADER, [["11", "A", "Alluvial soil", "10.5"], ["12", "B", "Floodplain soil", "20"]])
CO = snapshot(CO_HEADER, [["11", "A", "111", "Comp 1", "65", "poorly drained", "C/D", None, None],
                         ["12", "B", "121", "Comp 2", "90", None, None, None, None]])


class SoilDataAccessContractTests(unittest.TestCase):
    def test_official_legend_mapunit_component_joins_and_ordering(self):
        q1 = sda.query_text("mapunits", "IN129", 500)
        q2 = sda.query_text("components", "IN129", 500)
        self.assertIn("mu.lkey = l.lkey", q1)
        self.assertIn("l.areasymbol = 'IN129'", q1)
        self.assertNotIn("WHERE areasymbol", q1)
        self.assertIn("c.mukey = mu.mukey", q2)
        self.assertIn("TOP 500", q2)
        self.assertIn("ORDER BY mu.mukey, c.cokey", q2)

    def test_injection_and_unbounded_requests_rejected(self):
        for value in ("IN129';DROP TABLE mapunit;--", "in129", "IN12", "IN129 ", ""):
            with self.subTest(value=value), self.assertRaises(ValueError):
                sda.query_text("mapunits", value)
        for num in (-1, 0, 10001, 1.2, True):
            with self.subTest(num=num), self.assertRaises(ValueError):
                sda.query_text("mapunits", "IN129", num)

    def test_json_plus_columnname_frozen_replay(self):
        doc = sda.build_record("IN129", MU, CO, acquisition="OFFLINE_REPLAY", max_rows=500)
        self.assertEqual(doc["counts"], {"mapunits": 2, "components": 2})
        self.assertEqual(len(doc["snapshotsSha256"]["mapunits"]), 64)
        self.assertEqual(doc["soilDepthVerticalReference"], "BELOW_LOCAL_SURFACE_NOT_NAVD88")
        self.assertEqual(doc["components"][0]["hydgrp"], "C/D")
        self.assertIsNone(doc["components"][1]["hydgrp"])
        self.assertFalse(doc["regulatoryUse"])

    def test_header_and_truncation_fail(self):
        with self.assertRaisesRegex(ValueError, "missing columns"):
            sda.decode_snapshot(snapshot(["mukey"], [["1"]]), sda.MAPUNIT_FIELDS)
        with self.assertRaisesRegex(ValueError, "row cap"):
            sda.decode_snapshot(MU, sda.MAPUNIT_FIELDS, max_rows=2)
        with self.assertRaisesRegex(ValueError, "column cardinality"):
            sda.decode_snapshot(snapshot(MU_HEADER, [["1", "A"]]), sda.MAPUNIT_FIELDS)

    def test_conflicting_identities_are_rejected(self):
        dup_mu = snapshot(MU_HEADER, [["11", "A", "x", "1"], ["11", "B", "y", "2"]])
        with self.assertRaisesRegex(ValueError, "duplicate source map-unit"):
            sda.build_record("IN129", dup_mu, CO, acquisition="OFFLINE_REPLAY", max_rows=500)
        unknown = snapshot(CO_HEADER, [["99", "Z", "999", "x", None, None, None, None, None]])
        with self.assertRaisesRegex(ValueError, "absent"):
            sda.build_record("IN129", MU, unknown, acquisition="OFFLINE_REPLAY", max_rows=500)

    def test_non_numeric_source_keys_rejected(self):
        bad = snapshot(MU_HEADER, [["not-a-number", "A", "x", "1"]])
        with self.assertRaisesRegex(ValueError, "mukey"):
            sda.decode_snapshot(bad, sda.MAPUNIT_FIELDS)

    def test_raises_on_malformed_and_nonfinite_server_encoding(self):
        for payload in (b"<error>not-json</error>", b"{broken", b"{}", b"[]"):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                sda.decode_snapshot(payload, sda.MAPUNIT_FIELDS)

    def test_offline_cli_has_no_network_and_emits_hashes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            a, b, out = root / "mu.json", root / "co.json", root / "saved.json"
            a.write_bytes(MU)
            b.write_bytes(CO)
            with patch.object(sda, "fetch_snapshot", side_effect=AssertionError("network must not be called")):
                import sys
                with patch.object(sys, "argv", [str(SOURCE), "--offline-mapunits", str(a),
                                                "--offline-components", str(b), "--out", str(out)]):
                    self.assertEqual(sda.main(), 0)
            self.assertTrue(out.with_suffix(".json.sha256").is_file())
            self.assertEqual(json.loads(out.read_text())["acquisitionMode"], "OFFLINE_REPLAY")

    def test_missing_offline_response_is_unavailable_not_empty_soils(self):
        with tempfile.TemporaryDirectory() as folder:
            import sys
            with patch.object(sys, "argv", [str(SOURCE), "--offline-mapunits", "missing.json",
                                            "--out", str(Path(folder) / "result.json")]):
                self.assertEqual(sda.main(), 2)


if __name__ == "__main__":
    unittest.main()
