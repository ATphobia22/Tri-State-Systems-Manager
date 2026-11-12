import importlib.util
from pathlib import Path
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[2] / "scripts/native/audit_shipping_artifacts.py"
spec = importlib.util.spec_from_file_location("audit_shipping_artifacts", MODULE)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class ArtifactInventoryTests(unittest.TestCase):
    def test_empty_directory_does_not_claim_release(self):
        with tempfile.TemporaryDirectory() as folder:
            report = audit.inventory(folder)
            self.assertEqual(report["gates"]["shipping_executable_present"], "NOT_EVIDENCED")
            self.assertEqual(report["gates"]["offline_windows_11_startup"], "NOT_EVIDENCED")
            self.assertEqual(report["files"], [])

    def test_executable_hash_and_size(self):
        with tempfile.TemporaryDirectory() as folder:
            exe = Path(folder) / "TSMNative.exe"
            exe.write_bytes(b"test-only-not-a-real-exe")
            report = audit.inventory(folder)
            self.assertEqual(report["files"][0]["sha256"], audit.sha256_file(exe))
            self.assertEqual(report["files"][0]["bytes"], len(exe.read_bytes()))
            self.assertEqual(report["gates"]["shipping_executable_present"], "PRESENT_UNVERIFIED")
            self.assertEqual(report["gates"]["authenticode_signature"], "NOT_EVIDENCED")

    def test_symlink_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "target.txt"
            target.write_text("a")
            link = Path(folder) / "link.txt"
            try:
                link.symlink_to(target)
            except (OSError, NotImplementedError):
                self.skipTest("symlinks not available")
            with self.assertRaises(ValueError):
                audit.inventory(folder)

if __name__ == "__main__":
    unittest.main()
