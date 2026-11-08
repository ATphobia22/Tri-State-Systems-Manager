import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('store',Path(__file__).resolve().parents[2]/'tools/observations/store.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class StoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.c=m.connect(self.root/'test.duckdb');self.addCleanup(self.c.close)
    def load(self,value=10,recorded='2026-11-07T01:00:00Z'):
        doc={'type':'FeatureCollection','features':[{'id':'obs1','properties':{'time_series_id':'series','monitoring_location_id':'USGS-test','parameter_code':'00065','unit_of_measure':'ft','time':'2026-11-07T00:00:00Z','value':value,'approval_status':'Provisional'}}]}
        p=self.root/'input.json';p.write_text(json.dumps(doc));return m.ingest(self.c,p,'https://api.waterdata.usgs.gov/',recorded)
    def query(self,at='2026-11-07T00:30:00Z',known='2026-11-07T01:30:00Z'):
        return m.asof(self.c,'series',at,known,3600)
    def test_ingest_idempotence_and_datum(self):
        self.load();self.load();self.assertEqual(self.c.execute('select count(*) from observations').fetchone()[0],1)
        r=self.query();self.assertEqual(r['value'],10);self.assertEqual(r['datum'],'UNVERIFIED')
    def test_event_and_knowledge_time(self):
        self.load();self.assertEqual(self.query(known='2026-11-07T00:59:00Z')['status'],'SOURCE_UNAVAILABLE')
        self.assertEqual(self.query(at='2026-11-06T23:59:00Z')['status'],'SOURCE_UNAVAILABLE')
        self.assertEqual(self.query(at='2026-11-07T02:00:00Z')['status'],'STALE')
    def test_revisions_and_null_no_fallback(self):
        self.load();self.load(None,'2026-11-07T02:00:00Z')
        self.assertEqual(self.query()['value'],10)
        self.assertEqual(self.query(known='2026-11-07T03:00:00Z')['status'],'SOURCE_UNAVAILABLE')
    def test_export_roundtrip(self):
        self.load();p=self.root/'snapshot.parquet';r=m.export_parquet(self.c,p)
        self.assertEqual(r['rows'],1);self.assertEqual(self.c.execute('select value from read_parquet(?)',[str(p)]).fetchone()[0],10)
        with self.assertRaises(ValueError):m.export_parquet(self.c,p)
    def test_rejects_bad_measurements(self):
        with self.assertRaises(ValueError):self.load(float('nan'))
        with self.assertRaises(ValueError):m.timestamp('2026-11-07T00:00:00')
        self.assertEqual(self.c.execute('select count(*) from sources').fetchone()[0],0)
if __name__=='__main__':unittest.main()
