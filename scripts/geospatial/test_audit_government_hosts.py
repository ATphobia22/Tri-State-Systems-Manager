#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import tempfile
import unittest

src=Path(__file__).with_name('audit_government_hosts.py')
spec=importlib.util.spec_from_file_location('audit_government_hosts',src)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class AuditTests(unittest.TestCase):
 def setUp(self):
  d=tempfile.TemporaryDirectory();self.addCleanup(d.cleanup);self.root=Path(d.name)
 def put(self,name,text):
  p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
 def test_gov_domains_not_secret_urls(self):
  self.put('a.md','https://www.fema.gov/forms/secret?token=VERY_SECRET')
  r=m.inventory(self.root)
  self.assertEqual(r['governmentHostCount'],1)
  self.assertNotIn('VERY_SECRET',str(r));self.assertNotIn('/forms',str(r))
 def test_mil_and_aws_registered(self):
  self.put('b.py','https://www.lrl.usace.army.mil/foo and https://registry.opendata.aws/in-elevation/')
  r=m.inventory(self.root);self.assertEqual(r['governmentHostCount'],2)
 def test_no_false_gov_suffix(self):
  self.put('c.md','https://www.fema.gov.example.com/x https://notgov.com')
  self.assertEqual(m.inventory(self.root)['governmentHostCount'],0)
 def test_ignored_node_modules(self):
  self.put('node_modules/fake.json','https://www.fema.gov/x')
  self.assertEqual(m.inventory(self.root)['governmentHostCount'],0)
 def test_https_preferred(self):
  self.put('a.md','http://www.usgs.gov/x')
  self.assertEqual(m.inventory(self.root)['hostsMentionedViaPlainHttp'],['www.usgs.gov'])
 def test_nontext_ignored(self):
  (self.root/'a.bin').write_bytes(b'https://www.fema.gov/private')
  self.assertEqual(m.inventory(self.root)['governmentHostCount'],0)
 def test_oversized_ignored(self):
  self.put('big.txt','https://www.fema.gov/a' + 'x'*(m.MAX_BYTES+10))
  self.assertEqual(m.inventory(self.root)['governmentHostCount'],0)
  self.assertEqual(m.inventory(self.root)['oversizedTextFilesSkipped'],1)
 def test_duplicate_hosts_count_distinct_files(self):
  self.put('a.py','https://www.fema.gov/x https://www.fema.gov/y')
  self.put('b.md','https://www.fema.gov/z')
  r=m.inventory(self.root);self.assertEqual(r['governmentHosts'][0]['fileReferenceCount'],2)
 def test_no_repository_file_paths_in_public_inventory(self):
  self.put('private-history/possible-name-at-address.md','https://www.fema.gov/a?q=SECRET_PRIVATE_QUERY')
  d=m.inventory(self.root)
  text=__import__('json').dumps(d)
  self.assertNotIn('private-history',text)
  self.assertNotIn('possible-name',text)
  self.assertNotIn('SECRET_PRIVATE_QUERY',text)
  self.assertNotIn('sampleFilePaths',text)
  self.assertEqual(d['governmentHosts'][0],{'host':'www.fema.gov','fileReferenceCount':1})

if __name__=='__main__':unittest.main()