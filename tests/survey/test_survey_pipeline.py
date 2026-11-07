import importlib.util
import json
import struct
import tempfile
import unittest
from pathlib import Path

SPEC=importlib.util.spec_from_file_location('survey_pipeline',Path(__file__).resolve().parents[2]/'tools/survey/survey_pipeline.py')
m=importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(m)
XML='''<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2"><Units><Metric linearUnit="meter"/></Units><CgPoints><CgPoint name="BM1">100 200 10</CgPoint></CgPoints><Surfaces><Surface name="ground"><Definition surfType="TIN"><Pnts><P id="1">100 200 10</P><P id="2">100 210 10</P><P id="3">110 200 12</P></Pnts><Faces><F>1 2 3</F></Faces></Definition></Surface></Surfaces><Alignments name="original"/></LandXML>'''

class SurveyTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.path=Path(self.temp.name)/'survey.xml'; self.path.write_text(XML)

    def test_import_preserves_identifiers_axis_and_faces(self):
        d=m.import_landxml(self.path)
        self.assertEqual(d['points']['BM1'],[200,100,10])
        self.assertEqual(d['surfaces'][0]['faces'],[['1','2','3']])
        self.assertEqual(len(d['preservedXml']['Alignments']),1)
        self.assertEqual(d['schema']['status'],'NOT_VALIDATED')
        self.assertEqual(d['verticalDatum'],'UNVERIFIED')

    def test_rejects_entities_duplicate_ids_missing_faces_and_nonfinite(self):
        variants=[XML.replace('<LandXML','<!DOCTYPE LandXML [<!ENTITY x SYSTEM "file:///etc/passwd">]><LandXML',1),
                  XML.replace('id="2"','id="1"'),XML.replace('<F>1 2 3','<F>1 2 9'),
                  XML.replace('100 200 10','nan 200 10'),XML.replace('linearUnit="meter"','linearUnit="furlong"')]
        for v in variants:
            with self.subTest(v=v):
                self.path.write_text(v)
                with self.assertRaises(ValueError):m.import_landxml(self.path)

    def test_glb_retains_local_origin_and_triangle(self):
        d=m.import_landxml(self.path); out=Path(self.temp.name)/'ground.glb'
        m.export_glb(d['surfaces'][0],d['linearUnit'],out)
        data=out.read_bytes(); self.assertEqual(struct.unpack_from('<I',data,8)[0],len(data))
        n=struct.unpack_from('<I',data,12)[0]; doc=json.loads(data[20:20+n]); binary=data[28+n:]
        self.assertEqual(doc['extras']['sourceOriginENZ'],[200,100,10])
        self.assertEqual(struct.unpack_from('<3f',binary,24),(0,2,-10))
        self.assertEqual(struct.unpack_from('<3I',binary,36),(0,1,2))

    def test_cogo_cardinal_and_quadrant_roundtrip(self):
        for angle in (0,90,180,270,37):
            p=m.forward((100,200),angle,50); inv=m.inverse((100,200),p)
            self.assertAlmostEqual(inv['distance'],50); self.assertAlmostEqual(inv['azimuthDegrees'],angle)
        with self.assertRaises(ValueError):m.inverse((0,0),(0,0))

    def test_weighted_adjustment_reference(self):
        r=m.adjust([[1],[1]],[10,12],[[1,0],[0,4]])
        self.assertAlmostEqual(r['parameters'][0],10.4)
        self.assertAlmostEqual(r['parameterCovarianceFromInput'][0][0],.8)
        self.assertAlmostEqual(r['varianceFactor'],.8)
        self.assertEqual(r['degreesOfFreedom'],1)
        with self.assertRaises(ValueError):m.adjust([[1,1],[2,2]],[1,2],[[1,0],[0,1]])

    def test_correlated_adjustment(self):
        r=m.adjust([[1],[1]],[10,12],[[1,.5],[.5,4]])
        self.assertAlmostEqual(r['parameters'][0],10.25)
        self.assertAlmostEqual(r['parameterCovarianceFromInput'][0][0],.9375)

    def test_proj_offline_and_no_vertical_claim(self):
        r=m.transform_xy([[0,0]],'EPSG:4326','EPSG:3857')
        self.assertEqual(r['points'],[[0,0]])
        self.assertFalse(r['networkEnabled']); self.assertEqual(r['verticalTransformation'],'NOT_PERFORMED')
        with self.assertRaises(ValueError):m.transform_xy([[0,0,0]],'EPSG:4979','EPSG:4978')

    def test_leveling_loop_and_disconnected_network(self):
        r=m.leveling_network([['BM','A',1,.001],['A','B',2,.001],['BM','B',3.003,.001]],{'BM':100})
        self.assertAlmostEqual(r['adjustedHeights']['A'],101.001)
        self.assertAlmostEqual(r['adjustedHeights']['B'],103.002)
        with self.assertRaises(ValueError):m.leveling_network([['A','B',1,.01]],{'BM':100})

    def test_external_execution_does_not_claim_adjustment(self):
        import sys
        r=m.execute_solver(sys.executable,self.path,['-c','print("fixture execution")'])
        self.assertEqual(r['returncode'],0)
        self.assertEqual(r['scientificAcceptance'],'NOT_ESTABLISHED')

    def test_geodesic_known_equatorial_degree(self):
        self.assertAlmostEqual(m.geodesic((0,0),(0,1))['s12'],111319.49079327357,places=6)

if __name__=='__main__':unittest.main()
