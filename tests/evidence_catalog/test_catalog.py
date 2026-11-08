import importlib.util
import hashlib
import unittest
from pathlib import Path
s=importlib.util.spec_from_file_location('catalog',Path(__file__).resolve().parents[2]/'tools/evidence_catalog/catalog.py')
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)

class Tests(unittest.TestCase):
    def seed(self):
        return {'id':'buildings','title':'Buildings','category':'buildings','type':'arcgis-layer',
                'url':'https://gisdata.in.gov/layer?f=json','serviceId':'buildings','layerId':0}

    def test_dates_not_fabricated(self):
        r=m.record(self.seed(),b'{}',{'id':0,'created':1000,'modified':2000,'editingInfo':{'lastEditDate':3000}})
        m.validate(r)
        self.assertIsNone(r['fields']['acquisitionDate']['value'])
        self.assertIsNone(r['fields']['publicationDate']['value'])
        self.assertEqual(r['sourceMetadata']['modified'],2000)

    def test_checksum_scope(self):
        r=m.record(self.seed(),b'actual bytes',{'id':0})
        c=r['fields']['checksum']['value']
        self.assertEqual(c['hex'],hashlib.sha256(b'actual bytes').hexdigest())
        self.assertEqual(c['scope'],'metadata-response')

    def test_crs_and_coverage_preserved(self):
        extent={'xmin':1,'ymin':2,'xmax':3,'ymax':4,'spatialReference':{'wkid':3857}}
        r=m.record(self.seed(),b'{}',{'id':0,'extent':extent,'hasZ':False})
        self.assertEqual(r['fields']['geographicCoverage']['value'],extent)
        self.assertEqual(r['fields']['crs']['value'],{'wkid':3857})
        self.assertIsNone(r['fields']['verticalDatum']['value'])

    def test_identity_and_service_errors(self):
        self.assertEqual(m.record(self.seed(),b'{}',{'id':2})['fields']['verificationStatus']['value'],'IDENTITY_MISMATCH')
        self.assertEqual(m.record(self.seed(),b'{}',{'error':{'code':499}})['fields']['verificationStatus']['value'],'SERVICE_ERROR')

    def test_failure_is_not_empty_success(self):
        r=m.record(self.seed(),error={'message':'timeout'})
        self.assertEqual(r['fields']['verificationStatus']['value'],'FETCH_FAILED')
        self.assertIsNone(r['fields']['checksum']['value'])

    def test_unsafe_urls(self):
        for u in ['http://gisdata.in.gov','https://gisdata.in.gov.evil.test','https://user:pass@gisdata.in.gov','https://127.0.0.1','https://gisdata.in.gov:8080']:
            with self.subTest(u=u),self.assertRaises(ValueError):m.safe_url(u)
        self.assertEqual(m.safe_url('https://gisdata.in.gov/'), 'https://gisdata.in.gov/')

if __name__=='__main__':unittest.main()
