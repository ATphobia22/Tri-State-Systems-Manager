import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/native/export-engineering-evidence-pdf.py"
spec = importlib.util.spec_from_file_location("evidence_export", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class EvidenceContractTests(unittest.TestCase):
    def test_missing_provenance_rejected(self):
        with self.assertRaisesRegex(ValueError, "requires provenance"):
            module.validate({"project": "Mount Vernon", "evidence": [
                {"layer": "potable_water", "status": "VERIFIED",
                 "description": "Pipe segment", "sha256": "a" * 64}]})

    def test_unverified_sources_remain_visible(self):
        rows = module.validate({"project": "Mount Vernon", "evidence": [
            {"layer": "sanitary_sewer", "status": "NOT_EVIDENCED",
             "description": "No authoritative as-built provided"}]})
        self.assertEqual(rows[0]["status"], "NOT_EVIDENCED")

    def test_pdf_renders_offline(self):
        try:
            import reportlab
        except ImportError:
            self.skipTest("ReportLab unavailable; install reportlab to test PDF rendering")
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "evidence.pdf"
            module.create_pdf({"project": "Mount Vernon", "evidence": [
                {"layer": "roads", "status": "PENDING", "description": "Source survey pending"}]},
                output, "f" * 64)
            self.assertTrue(output.read_bytes().startswith(b"%PDF"))


if __name__ == "__main__":
    unittest.main()
