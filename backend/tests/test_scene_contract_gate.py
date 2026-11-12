import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from scripts.geospatial.validate_scene_contract import validate

class SceneGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "tileset.json").write_text('{"root":{}}')
        self.doc = {
            "schema_version": "1.0.0", "horizontal_crs": "EPSG:2966",
            "vertical_datum": "NAVD88", "horizontal_units": "us-ft",
            "vertical_units": "m", "aoi_id": "synthetic-fixture",
            "origin": {"latitude": 37.9, "longitude": -87.9, "height_m": 0},
            "transform_evidence": "synthetic-fixture-only",
            "assets": [{"path": "tileset.json",
                "sha256": hashlib.sha256((self.root / "tileset.json").read_bytes()).hexdigest(),
                "source_id": "fixture", "source_uri": "fixture:synthetic",
                "source_crs": "EPSG:2966", "source_vertical_datum": "NAVD88",
                "source_units": "m", "coverage": "synthetic", "evidence_state": "PENDING"}]}
        self.save()
    def tearDown(self): self.tmp.cleanup()
    def save(self): (self.root / "scene-contract.json").write_text(json.dumps(self.doc))
    def test_valid_fixture(self): self.assertTrue(validate(self.root)["ok"])
    def test_corruption(self):
        (self.root / "tileset.json").write_text("corrupt")
        self.assertFalse(validate(self.root)["ok"])
    def test_traversal(self):
        self.doc["assets"][0]["path"] = "../escape"
        self.save()
        self.assertFalse(validate(self.root)["ok"])
    def test_unknown_datum(self):
        self.doc["vertical_datum"] = "unknown"
        self.save()
        self.assertFalse(validate(self.root)["ok"])
