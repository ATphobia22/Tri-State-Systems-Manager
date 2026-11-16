"""Synthetic GDAL JSON fixtures only; NO real DEM/MSHR evidence exists in these tests."""
import copy
import importlib.util
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location("lbs_pair",ROOT / "scripts/geospatial/lbs_raster_pair_gate.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
BASE={"size":[100,100],"geoTransform":[100,1,0,200,0,-1],
      "coordinateSystem":{"wkt":"PROJCS[synthetic projected data]"},
      "bands":[{"noDataValue":-9999}],
      "metadata":{"":{"AREA_OR_POINT":"Area"}}}
class LidarRasterPairTests(unittest.TestCase):
    def test_matching_synthetic_pair_is_not_certification(self):
        r=mod.check_raster_pair(BASE,copy.deepcopy(BASE))
        self.assertFalse(r["certified"])
        self.assertFalse(r["originalGeoKeyBytesInspected"])
        self.assertFalse(r["mappingReportVerified"])
        self.assertEqual(r["noDataValue"],-9999)
    def test_mshr_nodata_mismatch(self):
        b=copy.deepcopy(BASE);b["bands"][0]["noDataValue"]=-32768
        with self.assertRaisesRegex(ValueError,"NoData mismatch"):mod.check_raster_pair(BASE,b)
    def test_geotiff_geokey_area_point_mismatch(self):
        b=copy.deepcopy(BASE);b["metadata"][""]["AREA_OR_POINT"]="Point"
        with self.assertRaisesRegex(ValueError,"AREA_OR_POINT mismatch"):mod.check_raster_pair(BASE,b)
    def test_missing_area_or_point_not_invented(self):
        b=copy.deepcopy(BASE);b.pop("metadata")
        with self.assertRaisesRegex(ValueError,"AREA_OR_POINT metadata absent"):mod.check_raster_pair(BASE,b)
    def test_crs_mismatch(self):
        b=copy.deepcopy(BASE);b["coordinateSystem"]["wkt"]="PROJCS[synthetic other]"
        with self.assertRaisesRegex(ValueError,"CRS WKT mismatch"):mod.check_raster_pair(BASE,b)
    def test_size_mismatch(self):
        b=copy.deepcopy(BASE);b["size"]=[100,99]
        with self.assertRaisesRegex(ValueError,"grid size mismatch"):mod.check_raster_pair(BASE,b)
    def test_geotransform_mismatch(self):
        b=copy.deepcopy(BASE);b["geoTransform"][0]+=1
        with self.assertRaisesRegex(ValueError,"geotransform mismatch"):mod.check_raster_pair(BASE,b)
    def test_nonfinite_nodata_refused(self):
        b=copy.deepcopy(BASE);b["bands"][0]["noDataValue"]=float("nan")
        with self.assertRaisesRegex(ValueError,"NoData value"):mod.check_raster_pair(BASE,b)
    def test_missing_crs_refused(self):
        b=copy.deepcopy(BASE);b.pop("coordinateSystem")
        with self.assertRaisesRegex(ValueError,"Missing CRS WKT"):mod.check_raster_pair(BASE,b)
if __name__=="__main__":
    unittest.main()
