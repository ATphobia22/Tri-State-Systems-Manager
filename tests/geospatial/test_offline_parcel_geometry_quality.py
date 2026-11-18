"""Synthetic topology tests: do not mistake fixture passes for audited county data."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from scripts.geospatial.audit_offline_parcel_manifest import audit


class OfflineParcelGeometryQualityTests(unittest.TestCase):
    def write_fixture(self, root, coords):
        folder = Path(root) / "posey"
        folder.mkdir()
        filename = "batch-0001.epsg2966.json"
        feature = {
            "type": "Feature",
            "id": 17,
            "properties": {"objectid": 17, "county_fips": "18129"},
            "geometry": {"type": "Polygon", "coordinates": [coords]},
        }
        payload = json.dumps({"type": "FeatureCollection", "features": [feature]}, separators=(",", ":")).encode()
        (folder / filename).write_bytes(payload)
        manifest = {
            "target_crs": "EPSG:2966",
            "vertical_datum": "NOT_APPLICABLE",
            "format": "TSM_PROJECTED_FEATURE_COLLECTION_V1",
            "batches": [{"file": filename, "features": 1, "sha256": hashlib.sha256(payload).hexdigest()}],
            "total_features": 1,
        }
        (folder / "layer-manifest.json").write_text(json.dumps(manifest))
        return folder / filename, payload

    def test_closed_valid_polygon_passes_optional_geometry_gate(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.write_fixture(tmp, [[0, 0], [500, 0], [500, 500], [0, 500], [0, 0]])
            result = audit(Path(tmp), require_parcels=True, check_geometry=True)
            self.assertEqual(result["status"], "PASS", result["findings"])
            self.assertEqual(result["geometry_quality"], "CHECKED")
            self.assertEqual(result["geometry_checked"], 1)
            self.assertEqual(result["geometry_invalid"], 0)

    def test_self_intersection_is_reported_not_auto_repaired(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, original = self.write_fixture(
                tmp, [[0, 0], [500, 500], [0, 500], [500, 0], [0, 0]]
            )
            result = audit(Path(tmp), require_parcels=True, check_geometry=True)
            self.assertEqual(result["status"], "FAIL")
            self.assertEqual(result["geometry_invalid"], 1)
            self.assertIn("objectid 17", " ".join(result["findings"]))
            self.assertIn("make_valid is review-only", " ".join(result["findings"]))
            self.assertEqual(path.read_bytes(), original, "Original parcel must never be rewritten")
            unchecked = audit(Path(tmp), require_parcels=True)
            self.assertEqual(unchecked["geometry_quality"], "NOT_RUN")
            self.assertEqual(unchecked["status"], "PASS", "Legacy checks must not masquerade as topology audit")

    def test_open_ring_is_not_a_certified_valid_parcel(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.write_fixture(tmp, [[0, 0], [500, 0], [500, 500], [0, 500]])
            result = audit(Path(tmp), require_parcels=True, check_geometry=True)
            # GEOS can auto-close a ring; original authoritative coordinates must not be normalized.
            self.assertEqual(result["status"], "FAIL")
            self.assertEqual(result["geometry_checked"], 1)
            self.assertEqual(result["geometry_invalid"], 1)
            self.assertIn("not explicitly closed", " ".join(result["findings"]))
            self.assertEqual(result["geometry_quality"], "CHECKED")


if __name__ == "__main__":
    unittest.main()
