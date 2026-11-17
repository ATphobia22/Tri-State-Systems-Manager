import csv
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FILE = ROOT / "scripts/evidence/freeze_milestone_a.py"
spec = importlib.util.spec_from_file_location("freeze_milestone_a", FILE)
mod = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(mod)

class MilestoneA(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.src, self.pub = self.root / "source.csv", self.root / "pub.csv"
        self.recon, self.out = self.root / "recon.csv", self.root / "out"
        self.style = ROOT / "evidence/milestone-a/posey_style.json"
        self.s = [dict(source_object_id=str(i), county_geoid="18129",
            source_agency="IGIO", source_dataset_id="fixture", source_vintage="2020",
            source_crs="EPSG:2966", source_geometry_sha256="a"*64,
            height_m="", height_source="UNAVAILABLE", vertical_datum="",
            record_source_url="") for i in (1,2)]
        self.p = [dict(source_object_id="1", tileset_content_uri="1.glb",
            published_geometry_sha256="a"*64, height_source="DERIVED")]
        self.r = [dict(source_object_id="1", osm_element_type="way", osm_element_id="42",
            match_status="MATCHED_GEOMETRY_VERIFIED", geometry_confidence="",
            source_geometry_sha256="a"*64, osm_geometry_sha256="b"*64,
            geometry_validation_receipt_sha256="c"*64, height_source="DERIVED", notes=""),
          dict(source_object_id="2", osm_element_type="", osm_element_id="",
            match_status="NO_OSM_MATCH", geometry_confidence="",
            source_geometry_sha256="a"*64, osm_geometry_sha256="",
            geometry_validation_receipt_sha256="", height_source="UNAVAILABLE", notes="")]
        self.write()

    def write(self):
        for role,path,rows in (("official_source_csv",self.src,self.s),
                                ("published_buildings_csv",self.pub,self.p),
                                ("posey_reconciliation_csv",self.recon,self.r)):
            with path.open("w", newline="", encoding="utf-8") as target:
                writer=csv.DictWriter(target, fieldnames=mod.FIELDS[role], lineterminator="\n")
                writer.writeheader(); writer.writerows(rows)

    def run_freeze(self):
        return mod.freeze(self.src,self.pub,self.recon,self.style,self.out,
            "f"*40,"https://gisdata.in.gov/arcgis/","2026-11-17T12:00:00Z",2)

    def test_hashes_real_bytes_and_detaches_manifest_checksum(self):
        m=self.run_freeze()
        self.assertFalse(m["independentGeometryVerified"])
        source=next(x for x in m["inputs"] if x["role"]=="official_source_csv")
        self.assertEqual(source["sha256"],hashlib.sha256(self.src.read_bytes()).hexdigest())
        frozen=(self.out/"manifest.milestone-a.json").read_bytes()
        receipt=(self.out/"manifest.milestone-a.sha256.txt").read_text()
        self.assertEqual(receipt,hashlib.sha256(frozen).hexdigest()+"  manifest.milestone-a.json\n")
        self.assertFalse(json.loads(frozen)["regulatoryUseApproved"])
        with self.assertRaisesRegex(ValueError,"may not be overwritten"):self.run_freeze()

    def test_duplicate_source_rejected(self):
        self.s.append(dict(self.s[0])); self.write()
        with self.assertRaisesRegex(ValueError,"duplicate source ID"):self.run_freeze()

    def test_non_posey_source_rejected(self):
        self.s[0]["county_geoid"]="17059"; self.write()
        with self.assertRaisesRegex(ValueError,"Posey County"):self.run_freeze()

    def test_incomplete_reconciliation_rejected(self):
        self.r.pop(); self.write()
        with self.assertRaisesRegex(ValueError,"exactly one row"):self.run_freeze()

    def test_no_invented_verification_receipt(self):
        self.r[0]["geometry_validation_receipt_sha256"]=""; self.write()
        with self.assertRaisesRegex(ValueError,"independent receipt"):self.run_freeze()

    def test_no_empty_template_is_valid_input(self):
        self.s=[]; self.write()
        with self.assertRaisesRegex(ValueError,"no real records"):self.run_freeze()

    def test_extra_published_identity_rejected(self):
        self.p[0]["source_object_id"]="9"; self.write()
        with self.assertRaisesRegex(ValueError,"published IDs absent"):self.run_freeze()

if __name__ == "__main__":unittest.main()
