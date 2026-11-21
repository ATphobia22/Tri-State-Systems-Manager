import importlib.util
import unittest
if importlib.util.find_spec("pyproj") is None:
    raise unittest.SkipTest("optional pyproj not installed")
import os
import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts' / 'geo'))
from tsm_geodetic_adapter import (Engine, GateError, choose_transformer, control_residuals,
                             derive_derived_geojson, route_evidence, verify_grid)


class AdapterContractTests(unittest.TestCase):
    def test_unknown_source_crs_is_quarantined(self):
        with self.assertRaises(GateError):
            choose_transformer(None, 2966)

    def test_nad27_requires_grid_and_never_ballpark(self):
        try:
            transform = choose_transformer(26716, 2966)
        except GateError as error:
            self.assertIn('TRANSFORMATION_UNAVAILABLE', str(error))
        else:
            self.assertNotIn('ballpark', transform.description.lower())

    def test_nad83_utm_to_state_plane_is_reversible(self):
        op = choose_transformer(26916, 2966)
        q = op.transform(440000, 4200000)
        back = choose_transformer(2966, 26916).transform(*q)
        self.assertAlmostEqual(back[0], 440000, places=4)
        self.assertAlmostEqual(back[1], 4200000, places=4)

    def test_unknown_vertical_coordinate_is_rejected(self):
        doc = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {},
          'geometry': {'type': 'Point', 'coordinates': [440000, 4200000, 400]}}]}
        with self.assertRaises(GateError):
            derive_derived_geojson(doc, 26916, 2966)

    def test_external_controls_are_not_roundtrip_samples(self):
        op = choose_transformer(26916, 2966)
        with self.assertRaises(GateError):
            control_residuals(op, [{'id': '1','source_x':440000,'source_y':4200000,
               'target_x':op.transform(440000,4200000)[0],
               'target_y':op.transform(440000,4200000)[1], 'source_url':'generated'}], 1.0)

    def test_no_engineering_route_without_both_vertical_and_control(self):
        record = {'source_crs':26916, 'vertical_datum':'UNVERIFIED',
                  'control_validation':'UNVERIFIED', 'human_approval':False}
        self.assertEqual(route_evidence(record, 'engineering'), 'QUARANTINE')
        self.assertEqual(route_evidence(record, 'visualization'), 'VISUALIZATION_WITH_WARNING')

    def test_engine_records_are_append_only(self):
        with TemporaryDirectory() as td:
            e=Engine(Path(td)/'events.sqlite3')
            e.append('layer-a', {'state':'unreviewed'}, event_type='ingest')
            e.append('layer-a', {'state':'review-needed'}, event_type='correction')
            self.assertEqual(len(e.history('layer-a')), 2)
            self.assertEqual(e.latest('layer-a')['state'], 'review-needed')

    def test_grid_sha_validation_mismatch_fails(self):
        with TemporaryDirectory() as td:
            p=Path(td)/'grid.tif';p.write_bytes(b'fakegrid')
            with self.assertRaises(GateError):
                verify_grid(p, expected_sha256='0'*64)

if __name__ == '__main__':
    unittest.main()

class TransportContractTests(unittest.TestCase):
    def test_outbox_quarantines_unapproved_engineering_delivery(self):
        from tsm_geodetic_adapter import enqueue
        with TemporaryDirectory() as td:
            out=enqueue(Path(td), 'layer/1', {'source_crs':26916,'vertical_datum':'UNVERIFIED'}, 'engineering')
            self.assertEqual(out['destination'], 'QUARANTINE')
            self.assertEqual(len(list((Path(td)/'QUARANTINE').glob('*.json'))),1)
            self.assertFalse((Path(td)/'engineering').exists())
    def test_jsonl_protocol_cannot_assume_missing_crs(self):
        from tsm_geodetic_adapter import dispatch
        result=dispatch({'op':'transform','x':440000,'y':4200000,'src_epsg':None,'target_epsg':2966})
        self.assertEqual(result['status'],'BLOCKED')
    def test_approved_visualization_still_requires_horizontal_crs(self):
        from tsm_geodetic_adapter import enqueue
        with TemporaryDirectory() as td:
            r=enqueue(Path(td),'layer/2',{'source_crs':None},'visualization')
            self.assertEqual(r['destination'],'QUARANTINE')

class NativeDNRIntegrationTests(unittest.TestCase):
    def test_bundle_inventory_matches_originals(self):
        from tsm_geodetic_adapter import inspect_bundle
        bundle=Path(os.environ.get('TSM_DOWORC_SOURCE_BUNDLE', '/nonexistent-doworc-source-bundle.zip'))
        if not bundle.exists(): self.skipTest('source archive not available in CI')
        report=inspect_bundle(bundle)
        self.assertEqual(report['summary']['count'],125)
        self.assertTrue(report['summary']['source_archives_verified'])
        self.assertEqual(report['summary']['epsg_counts'],{'26716':55,'26916':69,'None':1})
    def test_nad27_visualization_is_blocked_when_grid_is_absent(self):
        from tsm_geodetic_adapter import route_evidence
        from pyproj.transformer import TransformerGroup
        from pyproj import CRS
        if TransformerGroup(CRS.from_epsg(26716),CRS.from_epsg(2966),always_xy=True,allow_ballpark=False).best_available:
            self.skipTest('Required grid has been installed')
        self.assertEqual(route_evidence({'source_crs':26716},'visualization'),'QUARANTINE')

class MathematicalKernelTests(unittest.TestCase):
    def test_covariance_is_converted_back_to_metres(self):
        from tsm_geodetic_adapter import propagate_covariance
        r=propagate_covariance(26916,2966,440000,4200000,1.0,1.0)
        self.assertGreater(r['sigma_east_m'],0.95)
        self.assertLess(r['sigma_east_m'],1.05)
        self.assertGreater(r['sigma_north_m'],0.95)
        self.assertLess(r['sigma_north_m'],1.05)
        self.assertFalse(r['independent_control_verified'])
    def test_gradient_requires_identical_and_proven_vertical_datum(self):
        from tsm_geodetic_adapter import hydraulic_gradient
        with self.assertRaises(GateError):
            hydraulic_gradient({'h':10,'vertical_datum':'UNVERIFIED','units':'metre'},
                               {'h':20,'vertical_datum':'NAVD88','units':'metre'}, 100)
    def test_gradient_units_do_not_cancel_implicitly(self):
        from tsm_geodetic_adapter import hydraulic_gradient
        a={'h':100,'vertical_datum':'NAVD88','units':'metre','approved':True}
        b={'h':110,'vertical_datum':'NAVD88','units':'metre','approved':True}
        self.assertAlmostEqual(hydraulic_gradient(a,b,200)['gradient'],0.05,places=10)

class ProvenanceContractTests(unittest.TestCase):
    def test_derived_geojson_contains_unverified_vertical_warning(self):
        from tsm_geodetic_adapter import derive_derived_geojson
        doc={'type':'FeatureCollection','features':[{'type':'Feature','properties':{'Swl_E':370},
           'geometry':{'type':'Point','coordinates':[440000,4200000]}}]}
        result=derive_derived_geojson(doc,26916,2966)
        self.assertEqual(result['tsm_evidence']['vertical_datum'],'UNVERIFIED')
        self.assertFalse(result['tsm_evidence']['engineering_approved'])
        self.assertEqual(result['features'][0]['properties']['Swl_E'],370)
    def test_hash_chain_can_be_verified_after_multiple_edits(self):
        from tsm_geodetic_adapter import Engine
        with TemporaryDirectory() as td:
            e=Engine(Path(td)/'ledger.sqlite3')
            e.append('a',{'c':1},'ingest');e.append('a',{'c':2},'correction')
            self.assertTrue(e.verify_chain()['verified'])
            import sqlite3
            with sqlite3.connect(e.db) as con:
                con.execute("UPDATE events SET body_json = '{\"c\":999}' WHERE event_id = 1")
            self.assertFalse(e.verify_chain()['verified'])
