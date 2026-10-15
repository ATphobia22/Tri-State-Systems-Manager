import json
import tempfile
import unittest
from pathlib import Path

from backend.engineering.hec_hms_ras_workflow import (
    ContentAddressedArtifactStore, ReadinessError, canonical_json, readiness_blockers,
    run_workflow, validate_geojson_polygon, validate_hydrograph_csv, validate_manifest,
)

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = ROOT / "data/schemas/hec-hms-ras-workflow-v1.schema.json"
EXAMPLE = ROOT / "data/schemas/examples/hec-hms-ras-workflow-v1.example.json"


class TestHecHmsRasWorkflow(unittest.TestCase):
    def test_example_schema_valid_but_not_approved(self):
        manifest = json.loads(EXAMPLE.read_text(encoding="utf-8"))
        self.assertEqual(validate_manifest(manifest, SCHEMA), [])
        self.assertEqual(manifest["pilot_area"]["approval"]["status"], "NOT_APPROVED")
        self.assertTrue(manifest["execution"]["human_review_required"])

    def test_schema_rejects_unknown_top_level_property(self):
        manifest = json.loads(EXAMPLE.read_text(encoding="utf-8"))
        manifest["allow_synthetic_flow"] = True
        self.assertTrue(validate_manifest(manifest, SCHEMA))

    def test_canonical_json_is_key_order_independent(self):
        self.assertEqual(canonical_json({"b": 2, "a": {"y": 1, "x": 0}}),
                         canonical_json({"a": {"x": 0, "y": 1}, "b": 2}))

    def test_geojson_ring_validation(self):
        validate_geojson_polygon({"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]})
        with self.assertRaises(ValueError):
            validate_geojson_polygon({"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1]]]})

    def test_hydrograph_format_and_trapezoid_volume(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "flow.csv"
            path.write_text("timestamp_utc,flow_cfs\n2026-01-01T00:00:00Z,100\n2026-01-01T01:00:00Z,200\n", encoding="utf-8")
            result = validate_hydrograph_csv(path, "timestamp_utc", "flow_cfs")
            self.assertEqual(result["point_count"], 2)
            self.assertEqual(result["trapezoidal_volume_ft3"], 540000.0)
            self.assertEqual(result["status"], "FORMAT_VALIDATED_HYDROLOGY_UNVALIDATED")

    def test_hydrograph_rejects_non_utc_negative_nan_and_unsorted_times(self):
        invalid = [
            "timestamp_utc,flow_cfs\n2026-01-01T00:00:00,1\n2026-01-01T01:00:00Z,2\n",
            "timestamp_utc,flow_cfs\n2026-01-01T00:00:00Z,-1\n2026-01-01T01:00:00Z,2\n",
            "timestamp_utc,flow_cfs\n2026-01-01T00:00:00Z,NaN\n2026-01-01T01:00:00Z,2\n",
            "timestamp_utc,flow_cfs\n2026-01-01T01:00:00Z,1\n2026-01-01T00:00:00Z,2\n",
        ]
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "flow.csv"
            for contents in invalid:
                path.write_text(contents, encoding="utf-8")
                with self.assertRaises(ValueError):
                    validate_hydrograph_csv(path, "timestamp_utc", "flow_cfs")


    def test_readiness_fails_closed_before_artifact_store_creation(self):
        manifest = json.loads(EXAMPLE.read_text(encoding="utf-8"))
        blockers = readiness_blockers(manifest, EXAMPLE)
        self.assertTrue(any("approval.status must be APPROVED" in item for item in blockers))
        with self.assertRaises(ReadinessError):
            run_workflow(EXAMPLE, SCHEMA)
        self.assertFalse((EXAMPLE.parent / "artifacts").exists())

    def test_artifact_store_deduplicates_and_verifies_content(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source.bin"
            source.write_bytes(b"known-artifact")
            store = ContentAddressedArtifactStore(root / "store")
            first = store.put_file(source, "test")
            second = store.put_file(source, "test")
            self.assertEqual(first["sha256"], second["sha256"])
            self.assertEqual(first["storage_uri"], second["storage_uri"])
            self.assertEqual(Path(first["storage_uri"].removeprefix("file://")).read_bytes(), b"known-artifact")


if __name__ == "__main__":
    unittest.main()
