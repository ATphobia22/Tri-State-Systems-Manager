import copy
import importlib.util
import json
from pathlib import Path
import unittest

module = Path(__file__).with_name("validate_funding_source_registry.py")
spec = importlib.util.spec_from_file_location("grant_registry_validator", module)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
source = json.loads(m.REGISTRY.read_text())

class GrantRegistryTests(unittest.TestCase):
    def test_valid(self): self.assertTrue(m.validate(source))
    def test_duplicate_ids(self):
        d=copy.deepcopy(source);d["sources"][1]["id"]=d["sources"][0]["id"]
        with self.assertRaises(AssertionError):m.validate(d)
    def test_fake_active_award(self):
        d=copy.deepcopy(source);d["sources"][0]["isCurrentAwardOpportunity"]=True
        with self.assertRaises(AssertionError):m.validate(d)
    def test_fabricated_auto_submission(self):
        d=copy.deepcopy(source);d["sources"][0]["allowsAutomatedSubmission"]=True
        with self.assertRaises(AssertionError):m.validate(d)
    def test_unapproved_applicant(self):
        d=copy.deepcopy(source);d["sources"][0]["isApprovedApplicant"]=True
        with self.assertRaises(AssertionError):m.validate(d)
    def test_unsupported_host(self):
        d=copy.deepcopy(source);d["sources"][0]["url"]="http://example.com/award"
        with self.assertRaises(AssertionError):m.validate(d)
    def test_credentials_rejected(self):
        d=copy.deepcopy(source);d["sources"][0]["url"]="https://secret@example.com/path"
        with self.assertRaises(AssertionError):m.validate(d)
    def test_simpler_api_is_read_only(self):
        d=copy.deepcopy(source);next(x for x in d["sources"] if x["id"]=="simpler-grants")["capability"]="api_submit"
        with self.assertRaises(AssertionError):m.validate(d)
    def test_cannot_conflate_rebate_and_award(self):
        d=copy.deepcopy(source);d["examples"][-1]["status"]="OPEN_GRANT"
        with self.assertRaises(AssertionError):m.validate(d)

if __name__=="__main__": unittest.main()
