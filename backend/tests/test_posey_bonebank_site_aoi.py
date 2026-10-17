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

    def test_user_selected_address_supersedes_legacy_point_for_candidate_aoi_only(self) -> None:
        selection = self.evidence["coordinate_reconciliation"]
        self.assertEqual("ADDRESS_SELECTED_FOR_CANDIDATE_AOI_ONLY", selection["status"])
        self.assertEqual(self.evidence["address"], selection["selected_address"])
        self.assertEqual("NOT_APPROVED", self.evidence["approval"]["status"])
        self.assertGreater(selection["legacy_conflicting_point"]["distance_from_selected_parcel_centroid_km"], 6.4)
        self.assertEqual("UNVERIFIED_LEGACY_ASSERTION_NOT_USED_FOR_THIS_AOI", selection["legacy_conflicting_point"]["status"])
        self.assertEqual(
            "SURVEY_REQUIRED_BEFORE_ENGINEERING_DESIGN_OR_REGULATORY_SUBMISSION",
            selection["engineering_use_guard"],
        )

    def test_full_parcel_polygon_flood_intersections_are_recorded_without_inventing_bfe(self) -> None:
        parcel_sha = self.evidence["parcel"]["geometry_sha256"]
        for key in ("fema_nfhl_parcel_intersection", "indiana_dnr_parcel_intersection"):
            result = self.evidence[key]
            self.assertEqual(parcel_sha, result["geometry_source_sha256"])
            self.assertEqual(1, result["returned_feature_count"])
            self.assertEqual("AE", result["intersecting_features"][0]["flood_zone"])
            self.assertTrue(result["intersecting_features"][0]["special_flood_hazard_area"])
            self.assertIsNone(result["intersecting_features"][0]["normalized_static_bfe"])

    def test_huc12_is_context_not_local_hec_hms_catchment(self) -> None:
        from hashlib import sha256

        context = self.evidence["hydrologic_context"]
        huc_path = ROOT / context["source_geometry_path"]
        self.assertTrue(huc_path.is_file())
        self.assertEqual(context["source_geometry_sha256"], sha256(huc_path.read_bytes()).hexdigest())
        huc = json.loads(huc_path.read_text(encoding="utf-8"))["features"][0]["properties"]
        self.assertEqual("051201130904", huc["huc12"])
        self.assertEqual("Willow Pond Slough-Wabash River", huc["name"])
        self.assertTrue(context["parcel_centroid_within_huc12"])
        self.assertEqual("NOT_DELINEATED", self.evidence["watershed_delineation"]["status"])
        self.assertIsNone(self.evidence["watershed_delineation"]["area_sq_mi"])

    def test_coupled_model_is_blocked_and_not_run(self) -> None:
        readiness = self.evidence["coupled_model_readiness"]
        self.assertEqual("BLOCKED_NOT_RUN", readiness["status"])
        self.assertEqual("NOT_RUN", readiness["hec_hms_execution"])
        self.assertEqual("NOT_RUN", readiness["hec_ras_execution"])
        self.assertGreater(len(readiness["blockers"]), 0)



    def test_state_layer_is_not_independent_of_fema_nfhl(self) -> None:
        dnr = self.evidence["indiana_dnr_flood_hazard_crosscheck"]
        self.assertEqual("NFHL", dnr["source_dnr"])
        self.assertEqual("NOT_INDEPENDENT_SOURCE_DNR_NFHL", dnr["independence_status"])
        self.assertIn("not independent flood evidence", dnr["interpretation"])

    def test_source_conflict_remains_open_and_not_promoted_to_aoi(self) -> None:
        conflict = self.evidence["source_conflicts"]
        self.assertEqual("CONFLICT_UNRESOLVED", conflict["status"])
        action = conflict["action"].casefold()
        self.assertTrue("must not" in action or "do not" in action)
        self.assertEqual("NOT_APPROVED", self.evidence["approval"]["status"])

    def test_huc_context_is_never_mistaken_for_site_catchment(self) -> None:
        context = self.evidence["hydrologic_unit_context"]
        self.assertEqual("CONTEXT_ONLY_NOT_SITE_CATCHMENT", context["status"])
        self.assertTrue(context["parcel_centroid_contained"])
        self.assertEqual("NOT_DELINEATED", self.evidence["watershed_delineation"]["status"])
        self.assertIn("not an HEC-HMS basin model", context["limitation"])

    def test_cached_parcel_overlay_is_explicitly_reference_only(self) -> None:
        overlay = self.evidence["parcel_floodplain_overlay"]
        self.assertEqual("OBSERVED_CACHED_GIS_OVERLAY", overlay["status"])
        self.assertEqual("AE", overlay["flood_zone"])
        self.assertTrue(overlay["special_flood_hazard_area"])
        self.assertEqual("NFHL", overlay["source_dnr"])
        self.assertEqual(100, overlay["computed_parcel_overlap_percent"])
        self.assertIsNone(overlay["normalized_bfe_ft"])
        self.assertIsNone(overlay["vertical_datum"])
        self.assertIn("not independent confirmation", overlay["limitation"])

    def test_dem_and_epqs_point_values_have_traceable_provenance_but_not_survey_status(self) -> None:
        terrain = self.evidence["raster_crosscheck"]
        dem_path = ROOT / terrain["source_raster_path"]
        self.assertEqual(terrain["source_raster_sha256"], hashlib.sha256(dem_path.read_bytes()).hexdigest())
        self.assertEqual("EPSG:4269", terrain["source_raster_horizontal_crs"])
        self.assertLess(abs(terrain["difference_raster_minus_epqs_m"]), 0.01)
        self.assertIn("does not establish survey accuracy", terrain["interpretation"])
        self.assertIn("does not embed units or vertical datum", terrain["metadata_note"])

    def test_water_sources_are_classified_by_intended_use(self) -> None:
        sources = {item["source_id"]: item for item in self.evidence["water_source_inventory"]}
        wabash = sources["USGS-03378500"]
        self.assertEqual("AVAILABLE_REGIONAL_REFERENCE", wabash["status"])
        self.assertIn("not a published gage-zero-to-water-surface conversion", wabash["altitude_note"])
        self.assertTrue(any("validated hydraulic profile" in text for text in wabash["limitations"]))
        hovey = sources["USGS-03322300"]
        self.assertEqual("HISTORICAL_CONTEXT_ONLY", hovey["status"])
        nws = sources["NWS-POINT-PAH-151-91"]
        self.assertEqual("AVAILABLE_FORECAST_CONTEXT", nws["status"])
        self.assertTrue(any("dBZ" in text for text in nws["limitations"]))

if __name__ == "__main__":
    unittest.main()
