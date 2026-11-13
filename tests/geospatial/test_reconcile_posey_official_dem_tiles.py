import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "scripts/geospatial"
sys.path.insert(0, str(ROOT))
spec = importlib.util.spec_from_file_location("official_tiles",ROOT/"reconcile_posey_official_dem_tiles.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def square(x, y, width=0.002):
    return {"type":"Polygon","coordinates":[[
        [x,y],[x+width,y],[x+width,y+width],[x,y+width],[x,y]
    ]]}


def feature(geom, properties):
    return {"type":"Feature","geometry":geom,"properties":properties}


class TestOfficialDemTiles(unittest.TestCase):
    def setUp(self):
        self.buildings={"type":"FeatureCollection","features":[
            feature(square(-88,37.9,0.003),{"igioObjectId":100})]}
        self.tiles={"type":"FeatureCollection","features":[
            feature(square(-88.001,37.899,0.005),{"filename":"IN2020_26700930_12.tif",
                "county":"Posey","image_year":2020})]}

    def test_authoritative_tile_covers_building(self):
        out=mod.reconcile(self.buildings,self.tiles,1)
        self.assertTrue(out["polygonCoverageVerified"])
        self.assertEqual(out["requiredFilenames"],["IN2020_26700930_12.tif"])
        self.assertFalse(out["rasterPixelsVerified"])
        self.assertFalse(out["buildingHeightsVerified"])

    def test_intersection_is_not_full_polygon_coverage(self):
        self.tiles["features"][0]["geometry"]=square(-88.001,37.899,0.003)
        out=mod.reconcile(self.buildings,self.tiles,1)
        self.assertFalse(out["polygonCoverageVerified"])
        self.assertEqual(out["uncoveredObjectIds"],[100])
        self.assertEqual(out["buildingsWithNoTileIntersection"],0)

    def test_missing_tiles_mark_missing(self):
        self.tiles["features"][0]["geometry"]=square(-87.6,38.1)
        out=mod.reconcile(self.buildings,self.tiles,1)
        self.assertFalse(out["polygonCoverageVerified"])
        self.assertEqual(out["buildingsWithNoTileIntersection"],1)

    def test_duplicate_building_id_rejected(self):
        self.buildings["features"].append(
            feature(square(-87.99,37.9),{"igioObjectId":100}))
        with self.assertRaisesRegex(ValueError,"duplicate"):
            mod.reconcile(self.buildings,self.tiles,2)

    def test_other_year_and_county_not_used(self):
        self.tiles["features"][0]["properties"]["county"]="Gibson"
        with self.assertRaisesRegex(ValueError,"lacks"):
            mod.reconcile(self.buildings,self.tiles,1)

    def test_invalid_filename_fails(self):
        self.tiles["features"][0]["properties"]["filename"]="../bad.tif"
        with self.assertRaisesRegex(ValueError,"unsafe"):
            mod.reconcile(self.buildings,self.tiles,1)

    def test_multipart_coverage_is_checked_for_all_parts(self):
        self.buildings["features"][0]["geometry"]={
            "type":"MultiPolygon","coordinates":[
                square(-88,37.9,0.001)["coordinates"],
                square(-87.98,37.9,0.001)["coordinates"]]}
        out=mod.reconcile(self.buildings,self.tiles,1)
        self.assertEqual(out["uncoveredObjectIds"],[100])
        self.assertFalse(out["polygonCoverageVerified"])

if __name__=="__main__":
    unittest.main()
