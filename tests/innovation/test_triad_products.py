#!/usr/bin/env python3
"""Three connected TSM innovations, tested with local synthetic evidence only."""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
import tempfile
import unittest
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from scripts.geospatial import geotruth_inspector as geo
from scripts.government import contract_foundry as foundry
from scripts.public_interest import evidence_kit as kit
from scripts.public_interest import evidence_packet_export as exporter

ROOT = Path(__file__).resolve().parents[2]
CANDIDATE_CATALOG = ROOT / "data/schemas/tsm-indiana-data-catalog-v1.json"
PLANE_MAP = ROOT / "data/acquisitions/tsm-data-plane-integration-v1.json"


def building_feature(identifier, height=None):
    props = {"sourceObjectId": identifier}
    if height is not None:
        props["height_m"] = height
    return {"type": "Feature", "properties": props,
            "geometry": {"type": "Polygon", "coordinates": [
                [[-88, 38], [-88.0001, 38], [-88.0001, 38.0001], [-88, 38]]] }}


class GeoTruthTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.published = self.root / "buildings.geojson"
        self.pin = self.root / "pinned.json"
        self.features = [building_feature(101, 6.0), building_feature(103)]
        self.write_inputs()

    def write_inputs(self):
        self.published.write_text(json.dumps({"type": "FeatureCollection", "features": self.features}), encoding="utf-8")
        self.pin.write_text(json.dumps({
            "schemaVersion": "tsm.posey.archived-igio-building-id-delta.v1",
            "sourceFeatureCount": 3, "sourceAssetSha256": "a" * 64,
            "publishedFeatureCount": len(self.features),
            "publishedAssetSha256": sha256(self.published.read_bytes()).hexdigest(),
            "missingArchivedSourceObjectIds": [102],
        }), encoding="utf-8")

    def test_pinned_counts_and_missing_ids_are_not_geometry_verification(self):
        result, layer = geo.inspect(self.published, self.pin, include_geojson=True)
        self.assertEqual(result["archivedMissingObjectIdsIfPinnedBytesMatch"], [102])
        self.assertEqual(result["identityCoverageStatus"], "PINNED_ARCHIVED_DELTA")
        self.assertEqual(result["heightEvidenceCounts"]["HEIGHT_NOT_EVIDENCED"], 1)
        self.assertEqual(result["heightEvidenceCounts"]["HEIGHT_ESTIMATE_UNVERIFIED"], 1)
        self.assertFalse(result["sourceHeightAccuracyVerified"])
        self.assertFalse(result["meshGlbValidated"])
        self.assertEqual(len(layer["features"]), 2)
        self.assertEqual(layer["features"][0]["geometry"], self.features[0]["geometry"])
        self.assertEqual(set(layer["features"][0]["properties"]), {
            "sourceObjectId", "qaStatus", "heightEstimateM",
            "verticalDatumVerified", "sourceLineageIndependentlyVerified"})

    def test_published_mutation_disables_archived_missing_id_claims(self):
        self.features[0]["properties"]["height_m"] = 8
        self.published.write_text(json.dumps({"type": "FeatureCollection", "features": self.features}), encoding="utf-8")
        result, _ = geo.inspect(self.published, self.pin)
        self.assertEqual(result["identityCoverageStatus"], "SOURCE_ID_SET_UNVERIFIED")
        self.assertIsNone(result["archivedMissingObjectIdsIfPinnedBytesMatch"])

    def test_invalid_height_is_flagged_not_clamped_or_fabricated(self):
        self.features[0]["properties"]["height_m"] = -3
        self.write_inputs()
        report, _ = geo.inspect(self.published, self.pin)
        self.assertEqual(report["heightEvidenceCounts"]["HEIGHT_INVALID"], 1)
        self.assertIsNone(report["missingOrInvalidHeightEstimates"][0]["height_m"])

    def test_pin_cannot_omit_stable_ids_or_contain_duplicates(self):
        pin = json.loads(self.pin.read_text())
        pin["missingArchivedSourceObjectIds"] = [102, 102]
        self.pin.write_text(json.dumps(pin), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "duplicate pinned"):
            geo.inspect(self.published, self.pin)

    def test_cli_never_silently_overwrites_existing_report(self):
        out = self.root / "qa.json"
        self.assertEqual(geo.main(["--published", str(self.published), "--pinned-delta",
                                   str(self.pin), "--output", str(out)]), 0)
        with self.assertRaises(SystemExit) as raised:
            geo.main(["--published", str(self.published), "--pinned-delta",
                      str(self.pin), "--output", str(out)])
        self.assertEqual(raised.exception.code, 2)


class PassportExportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "snapshot"
        (self.source / "assets").mkdir(parents=True)
        payload = b'{"source":"synthetic"}'
        (self.source / "assets" / "source.json").write_bytes(payload)
        source_sha = sha256(payload).hexdigest()
        (self.source / "snapshot.json").write_text(json.dumps({
            "schema": "tsm.public-evidence.snapshot.v1",
            "snapshotId": "synthetic-2026-11-17",
            "capturedAt": "2026-11-17T12:00:00Z",
            "sources": [{
                "sourceId": "synthetic-source", "sourceUrl": "https://example.gov/data",
                "agency": "SYNTHETIC TEST DATA", "dataRole": "OBSERVATION",
                "status": "BYTES_VERIFIED", "assetPath": "assets/source.json",
                "sha256": source_sha, "horizontalCrs": "EPSG:4326",
                "verticalDatum": None, "units": "m",
                "retrievedAt": "2026-11-17T11:00:00Z",
                "acquisitionDate": None, "publicationDate": None,
                "serviceLayerId": "fixture", "license": "Synthetic fixture",
            }],
        }), encoding="utf-8")
        self.parcel = kit.passport(kit.audit_snapshot(self.source), {
            "schema": "tsm.public-evidence.parcel-input.v1",
            "parcelId": "SYNTH-18129", "countyFips": "18129",
            "owner": "SECRET OWNER MUST NOT EXPORT",
            "facts": [{
                "sourceId": "synthetic-source", "sourceSha256": source_sha,
                "dataRole": "OBSERVATION", "label": "Spreadsheet formula",
                "value": "=HYPERLINK(\"https://untrusted.example\")",
                "units": "m", "verticalDatum": "NAVD88",
                "requiresVerticalDatum": True, "observedAt": "2026-11-17T10:00:00Z",
            }],
        }, "2026-11-17T12:00:00Z")
        self.path = self.root / "passport.json"
        self.path.write_text(json.dumps(self.parcel), encoding="utf-8")

    def test_docx_xlsx_are_valid_xml_zip_and_formula_is_inert_text(self):
        data, digest = exporter.load_passport(self.path)
        receipt = exporter.export(data, digest, self.root / "passport-package")
        self.assertEqual(receipt["passportIntegritySha256"], self.parcel["integritySha256"])
        docx = self.root / "passport-package.docx"
        xlsx = self.root / "passport-package.xlsx"
        with ZipFile(docx) as archive:
            self.assertIsNone(archive.testzip())
            document = archive.read("word/document.xml").decode()
            ET.fromstring(document)
            self.assertIn("UNRESOLVED_DATUM", document)
            self.assertNotIn("SECRET OWNER", document)
        with ZipFile(xlsx) as archive:
            self.assertIsNone(archive.testzip())
            xml = archive.read("xl/worksheets/sheet1.xml").decode()
            ET.fromstring(xml)
            self.assertIn('t="inlineStr"', xml)
            self.assertIn("HYPERLINK", xml)
            self.assertNotIn("<f>", xml)
            self.assertNotIn("SECRET OWNER", xml)
        self.assertEqual(receipt["outputs"]["docx"]["sha256"], sha256(docx.read_bytes()).hexdigest())
        with self.assertRaisesRegex(ValueError, "collision"):
            exporter.export(data, digest, self.root / "passport-package")

    def test_dotted_export_prefix_preserves_full_filename_in_receipt(self):
        data, digest = exporter.load_passport(self.path)
        prefix = self.root / "parcel-v1.2"
        receipt = exporter.export(data, digest, prefix)
        for ext in ("docx", "xlsx"):
            target = self.root / ("parcel-v1.2." + ext)
            self.assertTrue(target.is_file())
            self.assertEqual(receipt["outputs"][ext]["name"], target.name)
            self.assertEqual(receipt["outputs"][ext]["sha256"], sha256(target.read_bytes()).hexdigest())
        self.assertTrue((self.root / "parcel-v1.2.receipt.json").is_file())
        self.assertEqual(exporter.main(["--passport", str(self.path),
                                        "--out-prefix", str(self.root / "parcel-v1.3")]), 0)

    def test_openxml_package_parts_use_standard_default_namespaces(self):
        data, digest = exporter.load_passport(self.path)
        exporter.export(data, digest, self.root / "namespace-test")
        samples = {
            ".docx": ["[Content_Types].xml", "_rels/.rels"],
            ".xlsx": ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml",
                       "xl/_rels/workbook.xml.rels", "xl/worksheets/sheet1.xml"],
        }
        for extension, parts in samples.items():
            with ZipFile(self.root / ("namespace-test" + extension)) as archive:
                for part in parts:
                    body = archive.read(part)
                    self.assertNotIn(b"ns0:", body, msg=part)
                    ET.fromstring(body)

    def test_civic_ci_watches_reused_sources_and_published_buildings(self):
        workflow = (ROOT / ".github/workflows/tsm-civic-innovation-triad.yml").read_text()
        for source in (
            "scripts/geospatial/reconcile_published_buildings.py",
            "scripts/government/source_contract_impact.py",
            "scripts/public_interest/evidence_kit.py",
            "data/schemas/tsm-indiana-data-catalog-v1.json",
            "data/acquisitions/tsm-data-plane-integration-v1.json",
            "data/buildings/POSEY-ARCHIVED-IGIO-IDENTITY-DELTA-2026-10-25.json",
            "tsm-console/public/3d-tiles/buildings-3d.json",
        ):
            self.assertIn("'" + source + "'", workflow)

    def test_tampering_with_fact_fails_integrity_validation(self):
        edited = deepcopy(self.parcel)
        edited["facts"][0]["value"] = "APPROVED"
        self.path.write_text(json.dumps(edited), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "integrity digest mismatch"):
            exporter.load_passport(self.path)

    def test_cannot_export_passport_claiming_regulatory_determination(self):
        edited = deepcopy(self.parcel)
        edited["regulatoryDetermination"] = True
        without_hash = {k: v for k, v in edited.items() if k != "integritySha256"}
        edited["integritySha256"] = sha256(json.dumps(
            without_hash, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()).hexdigest()
        self.path.write_text(json.dumps(edited), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "informational"):
            exporter.load_passport(self.path)


class FoundryTests(unittest.TestCase):
    def setUp(self):
        self.catalog = json.loads(CANDIDATE_CATALOG.read_text(encoding="utf-8"))
        self.planes = json.loads(PLANE_MAP.read_text(encoding="utf-8"))

    def test_compiles_real_tsm_catalog_but_no_source_freshness_approval(self):
        report = foundry.compile_catalog(self.catalog, "a" * 64)
        self.assertEqual(report["catalogSourceCount"], 26)
        self.assertGreater(report["contractChecksMissingCount"], 0)
        self.assertTrue(any(
            r["sourceId"] == "indiana-elevation-2016-2020" and
            any(x["field"] == "vertical_datum" for x in r["requiredReviews"])
            for r in report["sources"]))
        self.assertFalse(report["sourceDataVerifiedByCompilation"])
        self.assertFalse(report["releaseBlocking"])

    def test_drift_maps_only_to_declared_tsm_plane_source_ids(self):
        modified = deepcopy(self.catalog)
        target = next(x for x in modified["sources"] if x["id"] == "usgs-3dep-index")
        target["url"] = "https://example.gov/new"
        result = foundry.compile_catalog(
            modified, "b" * 64, previous=self.catalog,
            previous_sha256="a" * 64, plane_map=self.planes,
            plane_map_sha256="c" * 64)
        self.assertEqual(result["drift"]["change_count"], 1)
        self.assertTrue(any(x["plane_id"] == "terrain"
                            for x in result["planeImpact"]["impacted_planes"]))
        self.assertFalse(result["planeImpact"]["impacted_planes"][0]["geometry_or_runtime_impact_verified"])
        self.assertTrue(result["planeImpact"]["unresolved_plane_source_ids"])

    def test_rejects_credentials_in_endpoint_url(self):
        catalog = {"sources": [{"id": "test", "url": "https://example.gov/?token=EXPOSED"}]}
        with self.assertRaisesRegex(ValueError, "clean public HTTPS"):
            foundry.compile_catalog(catalog, "0" * 64)

    def test_duplicate_source_identifiers_are_not_silently_accepted(self):
        one = {"id": "same", "url": "https://example.gov/layer"}
        with self.assertRaisesRegex(ValueError, "duplicate"):
            foundry.compile_catalog({"sources": [one, one]}, "0" * 64)


if __name__ == "__main__":
    unittest.main()
