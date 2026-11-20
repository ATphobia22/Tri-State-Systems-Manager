import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("planning", ROOT / "scripts/acquire_mount_vernon_planning.py")
planning = importlib.util.module_from_spec(spec)
spec.loader.exec_module(planning)

class MunicipalEvidenceContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = json.loads((ROOT / "evidence/municipal/mount-vernon/sources.json").read_text())["sources"]

    def test_unique_source_identifiers(self):
        self.assertEqual(len(self.rows), len({r["id"] for r in self.rows}))

    def test_no_geometry_published_without_official_export(self):
        self.assertTrue(all(r["geometry_publishable"] is False for r in self.rows))

    def test_no_fabricated_hashes_or_crs(self):
        self.assertTrue(all(r["sha256"] is None and r["crs"] is None for r in self.rows))

    def test_official_host_allowlist(self):
        self.assertTrue(planning.allowed(self.rows[0]["url"]))
        for url in ("http://www.poseycountyin.gov/wp-content/uploads/test.pdf",
                    "https://attacker.example/wp-content/uploads/test.pdf",
                    "https://www.poseycountyin.gov.attacker.example/wp-content/uploads/a.pdf",
                    "https://www.poseycountyin.gov/other/test.pdf"):
            self.assertFalse(planning.allowed(url))

    def test_official_map_not_misrepresented(self):
        map_record = next(row for row in self.rows if row["id"] == "posey-official-zoning-map-current")
        self.assertIsNone(map_record["url"])
        self.assertTrue(map_record["verification"].startswith("PENDING"))

if __name__ == "__main__":
    unittest.main()
