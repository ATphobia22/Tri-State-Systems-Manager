import json
import unittest
from tsm_runtime.failure_ui_adapter import generate_ui_payload

GOOD = "a" * 64
BAD = "b" * 64

def manifest(action="DISCLOSE_GAP_AND_CONTINUE", expected=GOOD, actual=GOOD, status="DEGRADED"):
    return json.dumps({
        "manifest_id": "ERR-X8201A94",
        "timestamp_utc": "2026-10-15T12:26:00Z",
        "aoi_reference_id": "AOI_WABASH_001",
        "nodes_reporting": [{
            "jurisdiction": "KY", "node_status": status,
            "captured_incidents": [{
                "artifact_type": "TERRAIN_DEM", "source_uri": "https://example.gov/dem.tif",
                "failure_mode": {"code": 503, "message": "Upstream service unavailable"},
                "cryptographic_state": {"expected_hash_sha256": expected, "calculated_hash_sha256": actual, "action_taken": action}
            }]
        }]
    })

class FailureUIAdapterTests(unittest.TestCase):
    def test_degraded_disclosed_gap_does_not_claim_model_ready(self):
        result = generate_ui_payload(manifest())
        self.assertFalse(result["ui_header"]["is_execution_blocked"])
        self.assertEqual(result["ui_header"]["validation_state"], "DEGRADED")
        self.assertIn("does not prove model-readiness", result["ui_header"]["banner_message"])

    def test_hash_mismatch_forces_block_even_if_manifest_says_continue(self):
        result = generate_ui_payload(manifest(expected=GOOD, actual=BAD))
        self.assertTrue(result["ui_header"]["is_execution_blocked"])
        self.assertEqual(result["alert_cards"][0]["badge_label"], "PIPELINE_LOCKED")

    def test_explicit_terminate_blocks(self):
        result = generate_ui_payload(manifest(action="TERMINATE_PIPELINE"))
        self.assertTrue(result["ui_header"]["is_execution_blocked"])

    def test_offline_node_blocks_even_when_action_says_continue(self):
        result = generate_ui_payload(manifest(status="OFFLINE"))
        self.assertTrue(result["ui_header"]["is_execution_blocked"])

    def test_invalid_json_fails_closed(self):
        result = generate_ui_payload("{not json")
        self.assertTrue(result["ui_header"]["is_execution_blocked"])
        self.assertEqual(result["ui_header"]["validation_state"], "INVALID_MANIFEST")

    def test_bad_hash_format_fails_closed(self):
        result = generate_ui_payload(manifest(expected="a3f5...", actual="e9b2..."))
        self.assertTrue(result["ui_header"]["is_execution_blocked"])
        self.assertEqual(result["ui_header"]["validation_state"], "INVALID_MANIFEST")

    def test_invalid_source_scheme_fails_closed(self):
        value = json.loads(manifest())
        value["nodes_reporting"][0]["captured_incidents"][0]["source_uri"] = "file:///etc/passwd"
        result = generate_ui_payload(json.dumps(value))
        self.assertTrue(result["ui_header"]["is_execution_blocked"])

if __name__ == "__main__":
    unittest.main()
