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

    def test_verified_original_plans_have_source_sha256_and_receipts(self):
        observed = {
            "mount-vernon-comprehensive-plan-2023": ("64cf65b02140967c8993e82b8d5a2ed48065fc88270b28a5d666f9d189742f2c", 16295926),
            "posey-county-comprehensive-plan-2024": ("165629f385e2c02dd9018bdb2552d9f63032e639ec84f21befa98ee688e281b3", 19915009),
        }
        for row in self.rows:
            self.assertIsNone(row["crs"])
            self.assertFalse(row["geometry_publishable"])
            if row["id"] in observed:
                sha, byte_count = observed[row["id"]]
                self.assertEqual(row["sha256"], sha)
                self.assertEqual(row["original_bytes"], byte_count)
                self.assertTrue(row["retrieved_utc"].startswith("2026-11-20T05:26:"))
                self.assertEqual(row["verification"], "OFFICIAL_DOCUMENT_BYTES_SHA256_VERIFIED_PRIVATE_ARCHIVE")
            else:
                self.assertIsNone(row["sha256"])
                self.assertNotIn("original_bytes", row)
                self.assertNotIn("retrieved_utc", row)

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
