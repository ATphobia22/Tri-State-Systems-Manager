"""Offline regression tests: evidence, not a claim of real flood-event attribution."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from scripts.government import historical_flood_bundles as bundle

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "data/historical-floods/tri-state-catalog-v1.json"


class HistoricalFloodBundleTests(unittest.TestCase):
    def setUp(self):
        self.catalog = json.loads(CATALOG.read_text(encoding="utf-8"))

    def test_six_requested_counties_and_all_three_states(self):
        bundle.validate_catalog(self.catalog)
        counties = {c["fips"]: c["state"] for c in self.catalog["counties"]}
        self.assertEqual(counties, {
            "18129": "IN", "21101": "KY", "21225": "KY",
            "17059": "IL", "17185": "IL", "17193": "IL",
        })

    def test_inventory_without_assets_never_claims_completed(self):
        with tempfile.TemporaryDirectory() as tmp:
            doc = bundle.build_county_bundle(
                self.catalog, "21101", [], Path(tmp), "2026-11-18T00:00:00Z"
            )
        self.assertEqual(doc["evidence_status"], "INVENTORY_ONLY")
        self.assertFalse(doc["county_event_impact_verified"])
        self.assertFalse(doc["regulatory_determination"])
        self.assertEqual(doc["asset_count"], 0)
        self.assertIn("1937_ohio_mississippi", [e["event_id"] for e in doc["event_contexts"]])

    def test_2014_posey_panel_not_rewritten_as_2011_flood_map(self):
        posey_editions = [e for e in self.catalog["map_editions"]
                          if e["county_fips"] == "18129"]
        panel = next(e for e in posey_editions if e["panel_id"] == "18129C0300C")
        self.assertEqual(panel["effective_date"], "2014-11-05")
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "map.pdf"
            p.write_bytes(b"synthetic map; not an official product")
            record = {
                "county_fips": "18129", "event_id": "2011_ohio_wabash",
                "source_id": "fema_msc", "evidence_type": "historical_regulatory_map",
                "relative_path": "map.pdf",
                "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
                "effective_date": "2014-11-05",
                "claim_used_during_event": True,
            }
            with self.assertRaisesRegex(ValueError, "postdates"):
                bundle.build_county_bundle(
                    self.catalog, "18129", [record], Path(tmp), "2026-11-18T00:00:00Z"
                )

    def test_rejects_unsupported_county_and_provenance_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                bundle.build_county_bundle(
                    self.catalog, "99999", [], Path(tmp), "2026-11-18T00:00:00Z")
            p = Path(tmp) / "data.bin"
            p.write_bytes(b"truth")
            record = {
                "county_fips": "17059", "event_id": "2011_ohio_wabash",
                "source_id": "ky_from_above", "evidence_type": "terrain",
                "relative_path": "data.bin", "sha256": "0" * 64,
            }
            with self.assertRaises(ValueError):
                bundle.build_county_bundle(
                    self.catalog, "17059", [record], Path(tmp), "2026-11-18T00:00:00Z"
                )

    def test_paths_and_hashes_are_bounded_and_audited(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "sample.tif"
            p.write_bytes(b"synthetic raster bytes")
            base = {
                "county_fips": "17193", "event_id": "2011_ohio_wabash",
                "source_id": "il_isgs_lidar", "evidence_type": "terrain",
                "relative_path": "sample.tif",
                "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
                "acquisition_date": None, "vertical_datum": "UNKNOWN",
            }
            doc = bundle.build_county_bundle(
                self.catalog, "17193", [base], Path(tmp), "2026-11-18T00:00:00Z"
            )
            self.assertEqual(doc["evidence_status"], "PARTIAL_ASSETS_ATTACHED")
            self.assertEqual(doc["assets"][0]["sha256"], base["sha256"])
            with self.assertRaises(ValueError):
                bundle.build_county_bundle(
                    self.catalog, "17193", [{**base, "relative_path": "../sample.tif"}],
                    Path(tmp), "2026-11-18T00:00:00Z"
                )
            with self.assertRaisesRegex(ValueError, "SHA-256"):
                bundle.build_county_bundle(
                    self.catalog, "17193", [{**base, "sha256": "f" * 64}],
                    Path(tmp), "2026-11-18T00:00:00Z"
                )

    def test_save_writes_six_hash_receipted_bundles_without_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "out"
            files = bundle.save_county_bundles(
                self.catalog, [], Path(tmp), output, "2026-11-18T00:00:00Z"
            )
            self.assertEqual(len(files), 6)
            for f in files:
                digest = hashlib.sha256(f.read_bytes()).hexdigest()
                self.assertEqual((Path(str(f) + ".sha256")).read_text().split()[0], digest)
            with self.assertRaises(FileExistsError):
                bundle.save_county_bundles(
                    self.catalog, [], Path(tmp), output, "2026-11-18T00:00:00Z"
                )

    def test_claims_not_treated_as_building_footprints_or_flood_extent(self):
        for src in self.catalog["sources"]:
            if src["id"] == "openfema_nfip":
                self.assertEqual(src["spatial_authority"], "NONE_ADMINISTRATIVE")
                self.assertFalse(src["parcel_level_join_permitted"])
                break
        else:
            self.fail("Missing OpenFEMA source")


    def test_historic_usgs_quad_quality_is_qualitative_and_post_event(self):
        with tempfile.TemporaryDirectory() as tmp:
            doc = bundle.build_county_bundle(
                self.catalog, "18129", [], Path(tmp), "2026-11-18T00:00:00Z"
            )
        records = {r["quadrangle"]: r for r in doc["historical_map_index_records"]}
        self.assertEqual(records["MOUNT VERNON, IN-KY"]["qualitative_reliability"], "HIGH")
        self.assertEqual(records["UNIONTOWN, IN-KY"]["qualitative_reliability"], "RECON")
        self.assertFalse(records["MOUNT VERNON, IN-KY"]["agency_use_during_1937_verified"])
        self.assertFalse(records["MOUNT VERNON, IN-KY"]["map_geometry_attached"])
        self.assertEqual(records["MOUNT VERNON, IN-KY"]["publication_date"], "1975-03")

    def test_official_flood_event_years_are_retained_as_coarse_windows(self):
        ids = {e["id"]: e for e in self.catalog["events"]}
        self.assertEqual(ids["1913_wabash"]["date_precision"], "MONTH_RANGE")
        self.assertEqual(ids["2005_lower_wabash_ohio"]["date_precision"], "MONTH_RANGE")
        self.assertEqual(ids["2011_ohio_wabash"]["date_precision"],
                         "YEAR_WINDOW_NOT_EVENT_START_END")

if __name__ == "__main__":
    unittest.main()
