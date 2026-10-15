"""Regression tests for regional AOI claims and evidence-gated model readiness."""
import unittest

from src.tsm.gate_evaluator import validate_tsm_payload


def candidate_geojson():
    return {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {
                "declared_jurisdictions_to_test": ["IN", "IL", "KY"],
                "approval_status": "UNAPPROVED",
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-88.05, 37.95], [-87.9, 37.95],
                    [-87.9, 37.8], [-88.05, 37.8], [-88.05, 37.95]
                ]],
            },
        }],
    }


class RegionalAOIContractTests(unittest.TestCase):
    def test_declared_state_labels_do_not_prove_intersection(self):
        manifest = {
            "pipeline_execution_id": "TSM-TEST-1",
            "aoi_target_id": "AOI-TEST-1",
            "gates": {},
        }
        result = validate_tsm_payload(candidate_geojson(), manifest, require_all_states=True)
        self.assertEqual(result["status"], "BLOCKED")
        self.assertFalse(result["execution_allowed"])

    def test_mock_ready_manifest_fails_closed(self):
        manifest = {
            "pipeline_execution_id": "TSM-TEST-2",
            "aoi_target_id": "AOI-TEST-2",
            "gates": {
                "01_TERRAIN_DATA_QUALITY_GATE": {"status": "PASSED"},
                "02_JURISDICTION_SOURCE_GATE": {"status": "PASSED"},
                "03_OUTLET_EVIDENCE_GATE": {"status": "PASSED"},
                "04_DOWNSTREAM_MODEL_GATE": {
                    "status": "READY_FOR_EXECUTION",
                    "dependencies": [
                        "01_TERRAIN_DATA_QUALITY_GATE",
                        "02_JURISDICTION_SOURCE_GATE",
                        "03_OUTLET_EVIDENCE_GATE",
                    ],
                    "execution_blocked": False,
                },
            },
        }
        result = validate_tsm_payload(candidate_geojson(), manifest)
        self.assertEqual(result["status"], "BLOCKED")
        self.assertFalse(result["execution_allowed"])

    def test_candidate_has_valid_geojson_envelope_and_geometry(self):
        result = validate_tsm_payload(candidate_geojson(), {
            "pipeline_execution_id": "TSM-TEST-3",
            "aoi_target_id": "AOI-TEST-3",
            "gates": {},
        })
        # The geometry passes its structural check; missing gates still block the run.
        self.assertEqual(result["status"], "BLOCKED")
        self.assertIn("Required gate records", result["reason"])


if __name__ == "__main__":
    unittest.main()
