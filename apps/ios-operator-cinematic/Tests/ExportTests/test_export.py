import json
import tempfile
import unittest
from pathlib import Path
import sys
import base64
import hashlib

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from export_offline_scene import export

class ExportTests(unittest.TestCase):
    def test_bound_footprint_export_and_sha(self):
        feature = {"type": "Feature", "id": "building-12",
                   "properties": {"h_ft": 32.8},
                   "geometry": {"type": "Polygon", "coordinates": [[
                       [100, 100], [110, 100], [110, 120], [100, 120], [100, 100]]]}}
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "input.geojson"
            source.write_text(json.dumps({"type":"FeatureCollection", "features":[feature]}))
            dest = Path(tmp) / "out"
            summary = export(source, dest, "h_ft", 100, 100, "test authority")
            self.assertEqual(summary["included"], 1)
            envelope = json.loads((dest / summary["tiles"][0]["path"]).read_text())
            data = base64.b64decode(envelope["payloadBase64"])
            self.assertEqual(hashlib.sha256(data).hexdigest(), envelope["payloadSHA256"])
            building = json.loads(data)["buildings"][0]
            self.assertAlmostEqual(building["eastMeters"], 5 * 1200/3937)
            self.assertAlmostEqual(building["heightMeters"], 32.8 * 1200/3937)
    def test_does_not_fabricate_missing_height(self):
        feature = {"type": "Feature", "id":"1", "properties":{},
                   "geometry": {"type":"Polygon", "coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}}
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp)/"f.geojson"
            source.write_text(json.dumps({"type":"FeatureCollection", "features":[feature]}))
            summary = export(source, Path(tmp)/"out", "h_ft", 0, 0, "test")
            self.assertEqual(summary["included"], 0)
            self.assertEqual(summary["skipped"]["missing_height"], 1)

if __name__ == "__main__":
    unittest.main()
