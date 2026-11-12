import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from scripts.geospatial.audit_offline_parcel_manifest import audit

class OfflineParcelAuditTests(unittest.TestCase):
    def test_missing_data_is_not_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            result = audit(Path(temp), require_parcels=True)
            self.assertEqual(result["status"], "FAIL")

    def test_checksums_and_duplicates(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            features = [{"type": "Feature", "properties": {"objectid": 1, "county_fips": "18129"}, "geometry": {"type": "Polygon", "coordinates": [[[2700000, 960000], [2700001, 960000], [2700001, 960001], [2700000, 960000]]]}}]
            payload = json.dumps({"type": "FeatureCollection", "features": features}).encode()
            (root / "batch.epsg2966.json").write_bytes(payload)
            manifest = {"target_crs": "EPSG:2966", "format": "TSM_PROJECTED_FEATURE_COLLECTION_V1", "vertical_datum": "NOT_APPLICABLE", "total_features": 1, "batches": [{"file": "batch.epsg2966.json", "features": 1, "sha256": hashlib.sha256(payload).hexdigest()}]}
            (root / "layer-manifest.json").write_text(json.dumps(manifest))
            self.assertEqual(audit(root, require_parcels=True)["status"], "PASS")
            (root / "batch.epsg2966.json").write_bytes(payload + b" ")
            self.assertEqual(audit(root, require_parcels=True)["status"], "FAIL")

if __name__ == "__main__":
    unittest.main()
