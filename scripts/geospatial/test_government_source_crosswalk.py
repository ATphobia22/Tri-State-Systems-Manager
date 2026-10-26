#!/usr/bin/env python3
"""No-secret and correct-authority contract for Posey government crosswalk."""
import json,re
from pathlib import Path
from urllib.parse import urlparse
import unittest

PATH=Path(__file__).resolve().parents[2] / 'data/registries/government_source_crosswalk_2026-10-26.json'

class CrosswalkTests(unittest.TestCase):
 def setUp(self):
  self.data=json.loads(PATH.read_text(encoding='utf-8'))
 def test_region(self):self.assertEqual(self.data['region']['countyFips'],'18129')
 def test_unique_sources(self):
  ids=[x['id'] for x in self.data['sourceEntries']];self.assertEqual(len(ids),len(set(ids)))
 def test_known_official_domains_only(self):
  domains={'registry.opendata.aws','gisdata.in.gov','www.fema.gov','www.lrd.usace.army.mil',
  'www.iwr.usace.army.mil','ndc.ops.usace.army.mil','www.fws.gov','www.nrcs.usda.gov',
  'sdmdataaccess.nrcs.usda.gov','www.ngs.noaa.gov','www.usgs.gov'}
  for x in self.data['sourceEntries']:
   p=urlparse(x['url']);self.assertEqual(p.scheme,'https');self.assertIn(p.hostname,domains)
 def test_all_catalog_entries_never_accept_building_heights(self):
  self.assertTrue(all(x['releaseAcceptance'] is False for x in self.data['sourceEntries']))
 def test_private_documentation_not_leaked(self):
  s=PATH.read_text(encoding='utf-8')
  self.assertNotRegex(s,r'\b\d{4,6}\s+(?:[a-z]+\s+){1,3}(?:road|rd|lane|ln|street|st)\b')
  self.assertNotRegex(s,r'\b[A-Z]{2}\d{5,}\b')
  self.assertNotIn('POLICY NUMBER',s)
 def test_no_original_media_published(self):
  self.assertTrue(all(x['rawImageCommitted'] is False for x in self.data['uploadedEvidenceDisposition']))
 def test_no_authority_promotion(self):
  p=self.data['governance'];self.assertTrue(all(x is True for x in p.values()))

if __name__=='__main__':unittest.main()