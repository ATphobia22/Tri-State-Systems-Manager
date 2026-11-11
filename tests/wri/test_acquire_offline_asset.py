import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

TARGET=Path(__file__).resolve().parents[2]/"scripts"/"wri"/"acquire_offline_asset.py"
spec=importlib.util.spec_from_file_location("wri_acquire",TARGET)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
REG={"datasets":[{"id":"wri.aqueduct40.basins","downloadPolicy":"OFFICIAL_ZIP_MANUAL_URL_SELECTION"},
                 {"id":"wri.dynamic-world","downloadPolicy":"EARTH_ENGINE_AUTHENTICATED_EXPORT_REQUIRED"}]}

class FakeResponse:
    headers={"Content-Length":"4"}
    def __init__(self): self.payload=io.BytesIO(b"data")
    def __enter__(self): return self
    def __exit__(self,*args): return False
    def geturl(self): return "https://files.wri.org/aqueduct/example.zip"
    def read(self,n): return self.payload.read(n)

class FakeOpener:
    def open(self,*args,**kwargs):return FakeResponse()

class WRIContracts(unittest.TestCase):
    def test_reject_redirect_or_external_origin(self):
        for u in ["http://files.wri.org/foo","https://evil.example/file",
                  "https://files.wri.org:443/x","https://user:pass@files.wri.org/x",
                  "https://files.wri.org/file?token=abcd"]:
            with self.assertRaises(ValueError):m.validate_url(u)

    def test_acquire_has_unreviewed_receipt(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/"asset.zip"
            x=m.acquire(url="https://files.wri.org/aqueduct/example.zip",
                        destination=p,source_id="wri.aqueduct40.basins",
                        registry=REG,opener=FakeOpener())
            self.assertEqual(p.read_bytes(),b"data")
            self.assertEqual(x["status"],"ACQUIRED_UNREVIEWED")
            self.assertFalse(x["render_ready"])
            self.assertEqual(x["sha256"],"3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7")

    def test_mismatch_never_publishes(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/"asset.zip"
            with self.assertRaises(ValueError):
                m.acquire(url="https://files.wri.org/aqueduct/example.zip",
                          destination=p,source_id="wri.aqueduct40.basins",
                          registry=REG,expected_sha256="0"*64,opener=FakeOpener())
            self.assertFalse(p.exists())

    def test_unverified_download_contract_blocked(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(ValueError):
                m.acquire(url="https://files.wri.org/aqueduct/x",
                          destination=Path(td)/"x",source_id="wri.dynamic-world",
                          registry=REG,opener=FakeOpener())

if __name__=="__main__": unittest.main()
