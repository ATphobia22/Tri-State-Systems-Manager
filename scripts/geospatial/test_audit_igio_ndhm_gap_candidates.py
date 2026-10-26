import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import numpy as np
from shapely.geometry import box, mapping
from pyproj import Transformer
import rasterio
from rasterio.transform import from_origin

src=Path(__file__).with_name('audit_igio_ndhm_gap_candidates.py')
spec=importlib.util.spec_from_file_location('ndhm_audit',src)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class NdhmTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.tiles=self.root/'tiles'; self.tiles.mkdir()
        self.tif=self.tiles/'IN2020_26850945_12_ndhm.tif'
        self.f=mapping(self.building())
    def building(self):
        x,y=2685000,945000
        transform=Transformer.from_crs('EPSG:2966','EPSG:4326',always_xy=True).transform
        from shapely.ops import transform as st
        return st(transform,box(x+20,y+20,x+70,y+70))
    def write_raster(self,value=20,unit='US survey foot',epsg=2966):
        arr=np.full((100,100),value,dtype='float32')
        with rasterio.open(self.tif,'w',driver='GTiff',height=100,width=100,count=1,
                           dtype='float32',crs=f'EPSG:{epsg}',transform=from_origin(2685000,945100,1,1)) as ds:
            ds.write(arr,1);ds.set_band_unit(1,unit)
    def write_geojson(self, feats):
        path=self.root/'source.geojson'
        path.write_text(json.dumps({'type':'FeatureCollection','features':feats}))
        return path
    def feature(self,oid=1,status='UNAVAILABLE',geometry=None):
        return {'type':'Feature','properties':{'objectid':oid,'lidarHeightStatus':status,'privateName':'DO_NOT_PUBLISH'},'geometry':geometry if geometry is not None else self.f}
    def test_review_candidate_not_accepted(self):
        self.write_raster()
        d=m.audit(self.write_geojson([self.feature()]),self.tiles)
        self.assertEqual(d['acceptedRoofHeightCount'],0)
        self.assertTrue(d['noAutomaticHeightPromotion'])
        self.assertEqual(d['reviewRows'][0]['reviewStatus'],'REVIEW_ROOF_VS_VEGETATION')
        self.assertEqual(d['reviewRows'][0]['heightCandidateMedianFtUS'],20)
        self.assertNotIn('DO_NOT_PUBLISH',json.dumps(d))
        self.assertNotIn('coordinates',json.dumps(d))
    def test_negative_and_low_height_rejected(self):
        self.write_raster(-3)
        d=m.audit(self.write_geojson([self.feature()]),self.tiles)
        self.assertEqual(d['reviewRows'][0]['reviewStatus'],'NDHM_PIXEL_QA_UNSUITABLE')
    def test_unit_not_declared(self):
        self.write_raster(unit='metre')
        with self.assertRaises(ValueError):
            m.audit(self.write_geojson([self.feature()]),self.tiles)
    def test_only_gaps_processed(self):
        self.write_raster()
        d=m.audit(self.write_geojson([self.feature(1,'OK'),self.feature(2)]),self.tiles)
        self.assertEqual(d['missingLiDARHeightCount'],1)
        self.assertEqual(d['reviewedCount'],1)
        self.assertEqual(d['reviewRows'][0]['sourceObjectId'],2)
    def test_invalid_polygon(self):
        self.write_raster()
        bowtie={'type':'Polygon','coordinates':[[[-88,38],[-87,39],[-88,39],[-87,38],[-88,38]]]}
        d=m.audit(self.write_geojson([self.feature(geometry=bowtie)]),self.tiles)
        self.assertEqual(d['reviewRows'][0]['reviewStatus'],'INVALID_FOOTPRINT_TOPOLOGY')
    def test_duplicate_identity_rejected(self):
        self.write_raster()
        with self.assertRaises(ValueError):m.audit(self.write_geojson([self.feature(),self.feature()]),self.tiles)
    def test_conflicting_alias_rejected(self):
        self.write_raster()
        f=self.feature();f['properties']['igioObjectId']=2
        with self.assertRaises(ValueError):m.audit(self.write_geojson([f]),self.tiles)
    def test_limit_marks_partial(self):
        self.write_raster()
        d=m.audit(self.write_geojson([self.feature(1),self.feature(2)]),self.tiles,limit=1)
        self.assertTrue(d['reviewTruncated'])
    def test_missing_rasters_rejected(self):
        with self.assertRaises(ValueError):m.audit(self.write_geojson([self.feature()]),self.tiles)
    def test_empty_tile_rejected(self):
        self.write_raster()
        d=m.audit(self.write_geojson([self.feature(geometry=mapping(box(-80,28,-79,29)))]),self.tiles)
        self.assertEqual(d['reviewRows'][0]['reviewStatus'],'NO_USABLE_NDHM_PIXELS')
    def test_more_than_1000_tiles_is_rejected(self):
        self.write_raster()
        for i in range(1001): (self.tiles/f'IN2020_{i:08d}_12_ndhm.tif').touch()
        with self.assertRaises(ValueError):m.audit(self.write_geojson([self.feature()]),self.tiles)

    def test_far_away_tiff_excluded_by_spatial_index(self):
        self.write_raster()
        second=self.tiles/'IN2020_27850945_12_ndhm.tif'
        arr=np.full((100,100),90,dtype='float32')
        with rasterio.open(second,'w',driver='GTiff',height=100,width=100,count=1,
                           dtype='float32',crs='EPSG:2966',
                           transform=from_origin(2785000,945100,1,1)) as ds:
            ds.write(arr,1)
            ds.set_band_unit(1,'US survey foot')
        report=m.audit(self.write_geojson([self.feature()]),self.tiles)
        self.assertEqual(report['rasterIndexedCount'],2)
        self.assertEqual(report['rasterMetadataRejectedCount'],0)
        self.assertEqual(report['uniqueRasterDigestsComputed'],1)
        self.assertEqual(len(report['reviewRows'][0]['sourceTileDigests']),1)
        self.assertEqual(report['reviewRows'][0]['heightCandidateMedianFtUS'],20)

    def test_raster_hash_cached_across_buildings(self):
        self.write_raster()
        report=m.audit(self.write_geojson([self.feature(1),self.feature(2)]),self.tiles)
        self.assertEqual(report['reviewedCount'],2)
        self.assertEqual(report['uniqueRasterDigestsComputed'],1)

    def test_invalid_source_metadata_recorded_but_valid_tile_usable(self):
        self.write_raster()
        second=self.tiles/'IN2020_27850945_12_ndhm.tif'
        arr=np.full((10,10),20,dtype='float32')
        with rasterio.open(second,'w',driver='GTiff',height=10,width=10,count=1,
                           dtype='float32',crs='EPSG:2966',
                           transform=from_origin(2785000,945100,1,1)) as ds:
            ds.write(arr,1)
            ds.set_band_unit(1,'metre')
        report=m.audit(self.write_geojson([self.feature()]),self.tiles)
        self.assertEqual(report['rasterMetadataRejectedCount'],1)
        self.assertEqual(report['rasterInputStatus'],'PARTIAL_SOURCE_METADATA')
        self.assertEqual(report['acceptedRoofHeightCount'],0)


if __name__=='__main__':unittest.main()