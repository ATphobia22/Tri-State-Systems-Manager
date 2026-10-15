"""Regression tests for the user-selected Bonebank Road candidate AOI."""
from __future__ import annotations

import hashlib
import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

from backend.engineering.hec_hms_ras_workflow import validate_geojson_polygon

ROOT = Path(__file__).resolve().parents[2]
AOI_PATH = ROOT / "data/posey-county/aoi/13101-bonebank-road-parcel.geojson"
EVIDENCE_PATH = ROOT / "data/posey-county/evidence/13101-bonebank-road-site-aoi-v1.json"
SCHEMA_PATH = ROOT / "data/schemas/posey-site-aoi-v1.schema.json"


class TestPoseyBonebankSiteAOI(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.geometry_bytes = AOI_PATH.read_bytes()
        cls.geometry = json.loads(cls.geometry_bytes)
        cls.evidence = json.loads(EVIDENCE_PATH.read_text(encoding="utf-8"))
        cls.schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    def test_evidence_matches_schema(self) -> None:
        Draft202012Validator.check_schema(self.schema)
        errors = list(Draft202012Validator(self.schema, format_checker=FormatChecker()).iter_errors(self.evidence))
        self.assertEqual([], [f"{'.'.join(map(str, e.absolute_path))}: {e.message}" for e in errors])

    def test_candidate_polygon_is_closed_and_valid_for_workflow_ring_contract(self) -> None:
        validate_geojson_polygon(self.geometry)
        self.assertEqual("Polygon", self.geometry["geometry"]["type"])
        ring = self.geometry["geometry"]["coordinates"][0]
        self.assertEqual(ring[0], ring[-1])
        self.assertEqual(5, len(ring))

    def test_polygon_sha256_and_parcel_identifiers_are_pinned(self) -> None:
        self.assertEqual(
            self.evidence["parcel"]["geometry_sha256"],
            hashlib.sha256(self.geometry_bytes).hexdigest(),
        )
        properties = self.geometry["properties"]
        self.assertEqual(properties["parcel_id"], self.evidence["parcel"]["parcel_id"])
        self.assertEqual(properties["state_parcel_id"], self.evidence["parcel"]["state_parcel_id"])
        self.assertEqual("18129", properties["county_fips"])
        self.assertEqual("EPSG:4326", properties["source_horizontal_crs"])
        self.assertEqual("2025-08-28", properties["source_load_date"])

    def test_approval_and_hydrologic_watershed_remain_unapproved(self) -> None:
        self.assertEqual("USER_SELECTED_CANDIDATE_NOT_ENGINEERING_APPROVED", self.evidence["record_status"])
        self.assertEqual("NOT_APPROVED", self.evidence["approval"]["status"])
        self.assertTrue(self.evidence["human_review_required"])
        self.assertEqual("NOT_DELINEATED", self.evidence["watershed_delineation"]["status"])
        self.assertIsNone(self.evidence["watershed_delineation"]["area_sq_mi"])
        self.assertIsNone(self.evidence["watershed_delineation"]["outlet_coordinates"])

    def test_flood_zone_observation_does_not_claim_a_base_flood_elevation(self) -> None:
        fema = self.evidence["fema_nfhl_centroid_intersection"]
        self.assertEqual("AE", fema["flood_zone"])
        self.assertTrue(fema["special_flood_hazard_area"])
        self.assertEqual(-9999, fema["raw_static_bfe"])
        self.assertIsNone(fema["normalized_static_bfe"])
        dnr = self.evidence["indiana_dnr_flood_hazard_crosscheck"]
        self.assertEqual("AE", dnr["flood_zone"])
        self.assertTrue(dnr["special_flood_hazard_area"])
        self.assertIsNone(dnr["normalized_depth"])
        self.assertIsNone(dnr["normalized_velocity"])

    def test_terrain_is_a_single_point_sample_not_a_surface(self) -> None:
        terrain = self.evidence["terrain_sample"]
        self.assertEqual(361.99838690218945, terrain["value"])
        self.assertEqual("NAVD88", terrain["vertical_datum"])
        self.assertIn("One point sample only", terrain["limitation"])

    def test_coupled_model_is_blocked_and_not_run(self) -> None:
        readiness = self.evidence["coupled_model_readiness"]
        self.assertEqual("BLOCKED_NOT_RUN", readiness["status"])
        self.assertEqual("NOT_RUN", readiness["hec_hms_execution"])
        self.assertEqual("NOT_RUN", readiness["hec_ras_execution"])
        self.assertGreater(len(readiness["blockers"]), 0)


if __name__ == "__main__":
    unittest.main()
