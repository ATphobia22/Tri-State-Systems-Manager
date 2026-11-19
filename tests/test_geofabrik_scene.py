"""Headless regression checks for GeoFabrik local centimetre conversion."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

P = Path(__file__).resolve().parents[1] / "scripts/geospatial/prepare_geofabrik_ue_scene.py"
spec = importlib.util.spec_from_file_location("mv_geofabrik", P)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


@unittest.skipUnless(importlib.util.find_spec("pyproj"), "pyproj optional")
class GeofabrikTests(unittest.TestCase):
    def make_input(self, root, invalid=False):
        input_file = root / "osm.geojson"
        input_file.write_text(json.dumps({"type":"FeatureCollection","features":[
            {"type":"Feature","properties":{"@type":"way","@id": "100", "building":"yes"},
             "geometry":{"type":"Polygon","coordinates":[[
                 [-87.895,37.932],[-87.8949,37.932],[-87.8949,37.9321],
                 [-87.895,37.9321],[-87.895,37.932]]]}},
            {"type":"Feature","properties":{"@type":"way","@id":"200","highway":"residential"},
             "geometry":{"type":"LineString","coordinates":[[-87.895,37.932],[-87.894,37.932]]}},
            {"type":"Feature","properties":{"@type":"node","@id": "300", "natural":"tree"},
             "geometry":{"type":"Point","coordinates":[-87.8945,37.932]}}
        ]}))
        if invalid:
            doc = json.loads(input_file.read_text())
            doc["features"][0]["properties"].pop("@id")
            input_file.write_text(json.dumps(doc))
        return input_file

    def test_geofabrik_preserves_ids_and_explicit_datum(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            src = self.make_input(root)
            from pyproj import Transformer
            x, y = Transformer.from_crs("EPSG:4326","EPSG:2966", always_xy=True).transform(-87.895,37.932)
            manifest = module.to_local_geojson(
                src, root / "output", crs="EPSG:2966",
                easting=x, northing=y, units="us_survey_foot",
                bounds=(-87.942, 37.896, -87.849, 37.969))
            self.assertEqual(manifest["counts"],{"buildings":1,"roads":1,"trees":1})
            self.assertEqual(manifest["vertical_datum"], "UNVERIFIED")
            self.assertEqual(manifest["source"]["license"], "ODbL-1.0")
            b=json.loads((root/"output"/"buildings.geojson").read_text())["features"][0]
            self.assertEqual(b["properties"]["id"], "osm-way-100")
            self.assertNotIn("height_cm", b["properties"])

    def test_untrusted_features_must_have_stable_osm_ids(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            src=self.make_input(root,invalid=True)
            from pyproj import Transformer
            x,y=Transformer.from_crs("EPSG:4326","EPSG:2966",always_xy=True).transform(-87.895,37.932)
            with self.assertRaisesRegex(ValueError, "@type and @id"):
                module.to_local_geojson(src,root/"output",crs="EPSG:2966",
                                        easting=x,northing=y,units="us_survey_foot",
                                        bounds=(-87.942,37.896,-87.849,37.969))
