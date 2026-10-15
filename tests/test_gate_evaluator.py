"""Regression tests for fail-closed TSM gate evaluation."""
import json
import unittest

from src.tsm.gate_evaluator import validate_tsm_payload


def geojson():
    return {"type": "FeatureCollection", "features": [{
        "type": "Feature", "properties": {"geometry_role": "candidate_aoi"},
        "geometry": {"type": "Polygon", "coordinates": [[
            [-87.9, 37.8], [-87.8, 37.8], [-87.8, 37.9], [-87.9, 37.9], [-87.9, 37.8]
        ]]}
    }]}


class GateEvaluatorTests(unittest.TestCase):
    def test_rejects_feature_without_geometry(self):
        result = validate_tsm_payload({"type": "FeatureCollection", "features": [{"type": "Feature"}]}, {})
        self.assertEqual(result["status"], "BLOCKED")
        self.assertFalse(result["execution_allowed"])

    def test_rejects_legacy_crs(self):
        payload = geojson()
        payload["crs"] = {"type": "name", "properties": {"name": "EPSG:4326"}}
        result = validate_tsm_payload(payload, {})
        self.assertEqual(result["status"], "BLOCKED")
        self.assertIn("crs", result["reason"])

    def test_rejects_bad_coordinate_ranges(self):
        payload = geojson()
        payload["features"][0]["geometry"]["coordinates"][0][0] = [999, 999]
        result = validate_tsm_payload(payload, {})
        self.assertEqual(result["status"], "BLOCKED")

    def test_rejects_missing_gates_and_mock_ready_payload(self):
        manifest = {
            "pipeline_execution_id": "TSM-X",
            "aoi_target_id": "AOI-X",
            "gates": {
                "01_TERRAIN_DATA_QUALITY_GATE": {"status": "FAILED"},
                "03_OUTLET_EVIDENCE_GATE": {"status": "FAILED"},
                "04_DOWNSTREAM_MODEL_GATE": {"status": "READY_FOR_EXECUTION", "execution_blocked": False}
            }
        }
        result = validate_tsm_payload(geojson(), manifest)
        self.assertEqual(result["status"], "BLOCKED")
        self.assertFalse(result["execution_allowed"])

    def test_rejects_malformed_json(self):
        result = validate_tsm_payload("{bad", "{}")
        self.assertEqual(result["status"], "BLOCKED")

    def test_rejects_empty_feature_collection(self):
        result = validate_tsm_payload({"type": "FeatureCollection", "features": []}, {})
        self.assertEqual(result["status"], "BLOCKED")


if __name__ == "__main__":
    unittest.main()
