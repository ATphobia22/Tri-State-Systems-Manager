import importlib.util
import unittest
if importlib.util.find_spec("pyproj") is None:
    raise unittest.SkipTest("optional pyproj not installed")
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'/'geo'))
from tsm_geodetic_adapter import enqueue
from tsm_geodetic_redis_bridge import publish_receipt, STREAM

class TestRedisBridge(unittest.TestCase):
    def test_metadata_only_no_source_leak(self):
        class FakeRedis:
            def xadd(self,key,fields,**kw):
                self.key,self.fields=key,fields
                return b'1-0'
        with TemporaryDirectory() as td:
            out=enqueue(Path(td),'test-layer',{'source_crs':26916,'vertical_datum':'UNVERIFIED','secret_geometry':'do_not_upload'},'visualization')
            c=FakeRedis();r=publish_receipt(c,Path(out['outbox_file']))
            self.assertEqual(c.key,STREAM)
            self.assertEqual(r['redis_id'],'1-0')
            self.assertNotIn('secret_geometry',repr(c.fields))
            self.assertNotIn('manifest',c.fields)
    def test_invalid_route_rejected(self):
        class FakeRedis:
            def xadd(self,*args,**kwargs):raise AssertionError('should not call')
        with TemporaryDirectory() as td:
            f=Path(td)/'FAKE';f.mkdir();p=f/'evt.json'
            p.write_text(json.dumps({'layer_id':'a','destination':'FAKE','route':'INVALID'}))
            with self.assertRaises(ValueError):publish_receipt(FakeRedis(),p)
if __name__=='__main__':unittest.main()
