import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE=Path(__file__).with_name("verify_unreal_shipping.py")
spec=importlib.util.spec_from_file_location("shipping_verifier",MODULE)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class ShippingArtifactGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
    def write(self, name, data=b"release"):
        p=self.root/name
        p.parent.mkdir(parents=True,exist_ok=True)
        p.write_bytes(data)
    def test_missing_directory(self):
        with self.assertRaises(ValueError):mod.verify(self.root/"missing")
    def test_missing_cooked_content(self):
        self.write("TSM.exe")
        with self.assertRaisesRegex(ValueError,"cooked"):mod.verify(self.root)
    def test_missing_executable(self):
        self.write("Content/TSM.pak")
        with self.assertRaisesRegex(ValueError,"executable"):mod.verify(self.root)
    def test_empty_cooked_content(self):
        self.write("TSM.exe")
        self.write("Content/TSM.pak",b"")
        with self.assertRaisesRegex(ValueError,"Empty"):mod.verify(self.root)
    def test_inventory_is_not_false_engine_attestation(self):
        self.write("TSM.exe")
        self.write("Content/TSM.pak")
        result=mod.verify(self.root)
        self.assertFalse(result["engineVersionVerified"])
        self.assertFalse(result["fullReleaseAccepted"])
        self.assertEqual(result["fileCount"],2)
        self.assertEqual(len(result["files"][0]["sha256"]),64)
    def test_symlinks_forbidden(self):
        self.write("TSM.exe")
        self.write("Content/TSM.pak")
        (self.root/"alias.exe").symlink_to(self.root/"TSM.exe")
        with self.assertRaisesRegex(ValueError,"Symlink"):mod.verify(self.root)

if __name__=="__main__":unittest.main()
