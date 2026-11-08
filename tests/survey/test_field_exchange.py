import importlib.util
import json
import math
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location('field_exchange', Path(__file__).resolve().parents[2] / 'tools/survey/field_exchange.py')
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)


class FieldExchangeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def file(self, text, name='input.txt'):
        p = self.root / name
        p.write_text(text, encoding='utf-8')
        return p

    def test_csv_axis_description_and_roundtrip(self):
        p = self.file('001,100,200,10,"BM, monument"\n')
        result = m.import_points(p, 'PNEZD', 'USSurveyFoot')
        self.assertEqual(result['points']['001'], [200, 100, 10])
        self.assertEqual(result['descriptions']['001'], 'BM, monument')
        out = self.root / 'out.csv'
        m.export_points(result, out, 'PENZD')
        self.assertEqual(m.import_points(out, 'PENZD', 'USSurveyFoot')['points'], result['points'])
        self.assertEqual(result['sourceSha256'], m.digest(p))

    def test_csv_bad_values_and_duplicate_ids(self):
        for text in ('A,1,2,nan,x', 'A,1,2,3,x\nA,4,5,6,y', 'A,1,2,3,x,y', ''):
            with self.subTest(text=text), self.assertRaises(ValueError):
                m.import_points(self.file(text), 'PNEZD', 'meter')

    def test_rw5_preserves_observations_and_unknowns(self):
        p = self.file('MO,UN1\nSP,PN100,N 5002,E 5000,EL100,--PP\nSS,OP1,FP2,AR0.0044,ZE86.0133,SD10.313750\nXX,vendor-data\n')
        r = m.import_rw5(p, 'meter')
        self.assertEqual(r['points']['100'], [5000, 5002, 100])
        self.assertIn('AR0.0044', r['records'][2]['raw'])
        self.assertEqual(r['records'][3]['interpretation'], 'PRESERVED_ONLY')
        self.assertEqual(r['observationReduction'], 'NOT_PERFORMED')
        with self.assertRaises(ValueError):
            m.import_rw5(p, 'foot')

    def test_rw5_repeated_points_never_select_last(self):
        p = self.file('SP,PN1,N 1,E 2,EL3\nSP,PN1,N 4,E 5,EL6')
        r = m.import_rw5(p, 'meter')
        self.assertEqual(r['points'], {})
        self.assertEqual(len(r['pointRecords']), 2)

    def test_rw5_malformed_and_ambiguous_units(self):
        for text in ('SP,PN1,N 1,E 2', 'SP,PN1,N 1,N 2,E 2,EL3', 'MO,UN9'):
            with self.subTest(text=text), self.assertRaises(ValueError):
                m.import_rw5(self.file(text), 'meter')
        self.assertTrue(m.import_rw5(self.file('MO,UN0'), 'USSurveyFoot')['warnings'])

    def test_link_traverse_known_error(self):
        r = m.traverse_closure({'linearUnit': 'meter', 'startEN': [0, 0],
                               'endEN': [100, 100], 'legs': [
                                   {'azimuthDegrees': 0, 'horizontalDistance': 100},
                                   {'azimuthDegrees': 90, 'horizontalDistance': 100.01}]})
        self.assertAlmostEqual(r['linearMisclosure'], .01)
        self.assertAlmostEqual(r['relativePrecisionDenominator'], 20001, places=5)
        self.assertEqual(r['adjustment'], 'NOT_PERFORMED')

    def test_evidence_digest_and_escape(self):
        self.file('record bytes', 'deed.pdf')
        p = self.file(json.dumps({'records': [{'id': 'R1', 'path': 'deed.pdf', 'role': 'deed'}]}), 'evidence.json')
        self.assertEqual(m.evidence_manifest(p)['records'][0]['authenticity'], 'NOT_VERIFIED')
        p.write_text(json.dumps({'records': [{'id': 'R1', 'path': '../outside.pdf', 'role': 'deed'}]}))
        with self.assertRaises(ValueError):
            m.evidence_manifest(p)
        p.write_text(json.dumps({'records': [{'id': 'R1', 'path': 'deed.pdf', 'role': 'deed', 'expectedSha256': '0' * 64}]}))
        with self.assertRaises(ValueError):
            m.evidence_manifest(p)

    def test_dxf_units_and_partial_geometry(self):
        import ezdxf
        doc = ezdxf.new('R2013', units=6)
        doc.modelspace().add_point((200, 100, 10), dxfattribs={'layer': 'BM'})
        doc.modelspace().add_line((0, 0, 0), (10, 20, 30))
        doc.modelspace().add_circle((0, 0), 5)
        p = self.root / 'test.dxf'; doc.saveas(p)
        r = m.import_dxf(p, 'meter')
        self.assertIn([200, 100, 10], list(r['points'].values()))
        self.assertEqual(r['unsupportedEntities'], {'CIRCLE': 1})
        with self.assertRaises(ValueError):
            m.import_dxf(p, 'USSurveyFoot')

    def test_las_laz_scaled_bounds_classifications(self):
        import laspy
        import numpy as np
        header = laspy.LasHeader(point_format=3, version='1.2')
        header.scales = np.array([.001, .001, .001])
        header.offsets = np.array([100000, 200000, 0])
        las = laspy.LasData(header)
        las.x = [100001, 100002]; las.y = [200003, 200004]; las.z = [10, 20]
        las.classification = [2, 6]
        for suffix in ('.las', '.laz'):
            p = self.root / ('cloud' + suffix); las.write(p)
            r = m.inventory_las(p)
            self.assertEqual(r['pointCount'], 2)
            self.assertEqual(r['bounds'], [[100001, 200003, 10], [100002, 200004, 20]])
            self.assertEqual(r['classificationCounts'], {'2': 1, '6': 1})
            self.assertIsNone(r['sourceCRSWkt'])


if __name__ == '__main__':
    unittest.main()
