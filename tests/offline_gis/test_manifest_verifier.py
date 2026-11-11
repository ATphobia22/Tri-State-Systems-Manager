import importlib.util
from pathlib import Path
import tempfile
import unittest
import json

HERE = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("verify_offline", HERE / "scripts/geospatial/verify_tri_state_offline_layers.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class OfflineManifestVerificationTests(unittest.TestCase):
    def test_refuse_incomplete_inventory(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/"offline-layers-manifest.json"
            p.write_text(json.dumps({"schema":"tsm.tristate.offline-screening-layers.v1",
                "hydrologic_aoi_approved":False,"regulatory_use":False,
                "counties":{},"vector_assets":[],"posey_raster":{}}))
            with self.assertRaises(ValueError):
                m.verify(p)

    def test_refuse_false_approval(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/"offline-layers-manifest.json"
            p.write_text(json.dumps({"schema":"tsm.tristate.offline-screening-layers.v1",
                "hydrologic_aoi_approved":True,"regulatory_use":True,
                "counties":{},"vector_assets":[],"posey_raster":{}}))
            with self.assertRaises(ValueError):
                m.verify(p)

if __name__=="__main__": unittest.main()
