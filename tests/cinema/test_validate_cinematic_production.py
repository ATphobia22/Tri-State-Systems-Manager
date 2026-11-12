"""Unit tests for fail-closed offline cinematic production manifest."""
import copy
import hashlib
import tempfile
import unittest
from pathlib import Path

from scripts.cinema.validate_cinematic_production import ContractError, verify


class CinematicManifestTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        assets = []
        for kind in ("terrain", "buildings"):
            name = kind + ".bin"
            raw = (kind + ":verified-test-fixture").encode()
            (self.root / name).write_bytes(raw)
            row = {
                "name": kind, "relative_path": name, "sha256": hashlib.sha256(raw).hexdigest(),
                "kind": kind, "source_id": "TEST_FIXTURE_NOT_REAL_GIS"
            }
            if kind == "terrain":
                row.update(horizontal_crs="EPSG:2968", vertical_datum="TEST_ONLY",
                           vertical_units="TEST_ONLY")
            else:
                row["height_evidence"] = "ESTIMATED"
            assets.append(row)
        kinds = ["regional", "county_map", "terrain", "buildings",
                 "water", "timeline", "provenance", "community", "outro"]
        shots = []
        for index, kind in enumerate(kinds):
            shots.append({
                "id": "shot%02d" % index, "kind": kind,
                "start_frame": index * 24 * 40, "frames": 24 * 40,
                "evidence_class": "PRESENTATION",
                "camera_keys": [
                    {"frame": 0, "world_cm": [0, 0, 500], "rotation_deg": [0, 0, 0]},
                    {"frame": 24 * 40 - 1, "world_cm": [100, 0, 500], "rotation_deg": [0, 10, 0]}
                ]
            })
        self.data = {
            "schema": "tsm.cinematic.production.v1",
            "engine": "Unreal Engine 5.8",
            "map": "/Game/TSM/Maps/TSMNative",
            "sequence": "/Game/TSM/Cinematics/LS_TSMCommunity.LS_TSMCommunity",
            "preset": "/Game/TSM/Cinematics/MRQ_TSMCommunity.MRQ_TSMCommunity",
            "fps": 24,
            "resolution": [1920, 1080],
            "county_fips": ["18129", "21101", "21225", "17193", "17185", "17059"],
            "source_assets": assets, "shots": shots
        }

    def test_valid_five_minute_manifest(self):
        report = verify(self.data, self.root)
        self.assertEqual(report["expected_frames"], 8640)
        self.assertEqual(report["seconds"], 360.0)

    def test_tamper_detected(self):
        self.data["source_assets"][0]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ContractError, "checksum mismatch"):
            verify(self.data, self.root)

    def test_no_bbox_only_scope_or_unapproved_county(self):
        self.data["county_fips"][1] = "21091"
        with self.assertRaises(ContractError):
            verify(self.data, self.root)

    def test_sequence_gaps_rejected(self):
        self.data["shots"][3]["start_frame"] += 1
        with self.assertRaisesRegex(ContractError, "gap or overlap"):
            verify(self.data, self.root)

    def test_missing_source_fails(self):
        (self.root / "terrain.bin").unlink()
        with self.assertRaisesRegex(ContractError, "missing real local asset"):
            verify(self.data, self.root)

    def test_without_camera_motion_fails(self):
        self.data["shots"][0]["camera_keys"] = self.data["shots"][0]["camera_keys"][:1]
        with self.assertRaises(ContractError):
            verify(self.data, self.root)

    def test_real_water_requires_file(self):
        self.data["shots"][4]["evidence_class"] = "SCENARIO"
        self.data["shots"][4]["scenario_id"] = "example"
        with self.assertRaisesRegex(ContractError, "actual verified water asset"):
            verify(self.data, self.root)

    def test_no_unverified_observed_hydrology(self):
        self.data["shots"][4]["evidence_class"] = "OBSERVED"
        with self.assertRaises(ContractError):
            verify(self.data, self.root)

    def test_no_path_traversal(self):
        self.data["source_assets"][0]["relative_path"] = "../outside.dat"
        with self.assertRaises(ContractError):
            verify(self.data, self.root)


if __name__ == "__main__":
    unittest.main()
