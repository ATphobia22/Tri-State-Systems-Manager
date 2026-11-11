#!/usr/bin/env python3
"""Synthetic no-network tests for evidence time machine, uncertainty and passports."""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
import tempfile
import unittest

from scripts.public_interest import evidence_kit as kit


CREATED = "2026-11-11T08:00:00Z"
RETRIEVED = "2026-11-10T12:00:00Z"
DATA = b'{"type":"FeatureCollection","features":[]}'


def snapshot(base: Path, name: str = "day1", body: bytes = DATA):
    root = base / name
    (root / "assets").mkdir(parents=True)
    (root / "assets" / "data.json").write_bytes(body)
    record = {
        "sourceId": "usgs-waterdata",
        "sourceUrl": "https://api.waterdata.usgs.gov/ogcapi/v1/",
        "agency": "USGS",
        "dataRole": "OBSERVATION",
        "status": "BYTES_VERIFIED",
        "assetPath": "assets/data.json",
        "sha256": sha256(body).hexdigest(),
        "horizontalCrs": "EPSG:4326",
        "verticalDatum": "NAVD88",
        "units": "ftUS",
        "retrievedAt": RETRIEVED,
        "acquisitionDate": "2026-11-10",
        "publicationDate": None,
        "serviceLayerId": "latest-continuous",
        "license": "US federal public data",
    }
    manifest = {
        "schema": kit.SCHEMA,
        "snapshotId": name,
        "capturedAt": CREATED,
        "sources": [record],
    }
    (root / "snapshot.json").write_text(json.dumps(manifest), encoding="utf-8")
    return root, manifest


def save(root, manifest):
    (root / "snapshot.json").write_text(json.dumps(manifest), encoding="utf-8")


def parcel(facts=None):
    return {
        "schema": "tsm.public-evidence.parcel-input.v1",
        "parcelId": "SYNTH-001",
        "countyFips": "18129",
        "owner": "Must Never Appear in Output",
        "facts": facts or [],
    }


def observation(digest=sha256(DATA).hexdigest(), **extra):
    return dict({
        "sourceId": "usgs-waterdata",
        "sourceSha256": digest,
        "dataRole": "OBSERVATION",
        "label": "Synthetic sample gauge stage",
        "value": 12.5,
        "units": "ft",
        "requiresVerticalDatum": False,
        "observedAt": "2026-11-10T08:00:00Z",
    }, **extra)


class EvidenceKitTests(unittest.TestCase):
    def test_hashes_local_bytes_not_scientific_claims(self):
        with tempfile.TemporaryDirectory() as directory:
            root, manifest = snapshot(Path(directory))
            audited = kit.audit_snapshot(root)
            self.assertEqual(audited["verifiedByteSourceCount"], 1)
            self.assertEqual(audited["sources"][0]["sha256"], sha256(DATA).hexdigest())
            self.assertFalse(audited["sources"][0]["verticalDatumVerified"])
            self.assertFalse(audited["sources"][0]["scientificInterpretationVerified"])
            self.assertFalse(audited["regulatoryDetermination"])
            (root / "assets" / "data.json").write_bytes(DATA + b"x")
            with self.assertRaisesRegex(kit.EvidenceError, "SHA-256 mismatch"):
                kit.audit_snapshot(root)

    def test_unavailable_source_requires_absent_path_and_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            root, data = snapshot(Path(directory))
            entry = data["sources"][0]
            entry.update(status="SOURCE_UNAVAILABLE", assetPath=None, sha256=None)
            save(root, data)
            self.assertEqual(kit.audit_snapshot(root)["verifiedByteSourceCount"], 0)
            entry["sha256"] = sha256(DATA).hexdigest()
            save(root, data)
            with self.assertRaises(kit.EvidenceError):
                kit.audit_snapshot(root)

    def test_source_path_traversal_and_symlinks_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root, doc = snapshot(Path(directory))
            for unsafe in ("../outside.txt", "/etc/passwd", "assets/../../etc/passwd",
                           "C:/windows/config", r"assets\file.json"):
                doc["sources"][0]["assetPath"] = unsafe
                save(root, doc)
                with self.subTest(path=unsafe), self.assertRaises(kit.EvidenceError):
                    kit.audit_snapshot(root)
            doc["sources"][0]["assetPath"] = "assets/link.json"
            (root / "assets" / "link.json").symlink_to(root / "assets" / "data.json")
            save(root, doc)
            with self.assertRaises(kit.EvidenceError):
                kit.audit_snapshot(root)

    def test_rejects_duplicate_ids_and_fake_urls(self):
        with tempfile.TemporaryDirectory() as directory:
            root, doc = snapshot(Path(directory))
            doc["sources"].append(deepcopy(doc["sources"][0]))
            save(root, doc)
            with self.assertRaises(kit.EvidenceError):
                kit.audit_snapshot(root)
            doc["sources"].pop()
            doc["sources"][0]["sourceUrl"] = "https://api.waterdata.usgs.gov/?token=secret"
            save(root, doc)
            with self.assertRaises(kit.EvidenceError):
                kit.audit_snapshot(root)

    def test_registry_constrains_id_and_origin(self):
        with tempfile.TemporaryDirectory() as directory:
            root, doc = snapshot(Path(directory))
            path = Path(directory) / "registry.json"
            path.write_text(json.dumps({"sources": [{
                "id": "usgs-waterdata",
                "url": "https://api.waterdata.usgs.gov/ogcapi/v1/",
            }]}), encoding="utf-8")
            self.assertEqual(kit.audit_snapshot(root, path)["sourceCount"], 1)
            doc["sources"][0]["sourceUrl"] = "https://untrusted.example/ogcapi/v1/"
            save(root, doc)
            with self.assertRaisesRegex(kit.EvidenceError, "does not match registry"):
                kit.audit_snapshot(root, path)

    def test_reject_duplicate_json_keys_and_nonfinite_json(self):
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory) / "bad.json"
            p.write_text('{"schema":"x","schema":"y"}')
            with self.assertRaisesRegex(kit.EvidenceError, "Duplicate JSON"):
                kit._read_json(p)
            p.write_text('{"value":NaN}')
            with self.assertRaises(kit.EvidenceError):
                kit._read_json(p)

    def test_timeline_reports_hash_and_datum_changes_not_physical_change(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            earlier, _ = snapshot(base, "older")
            later, record = snapshot(base, "newer", DATA + b" ")
            record["capturedAt"] = "2026-11-11T09:00:00Z"
            record["sources"][0]["verticalDatum"] = None
            save(later, record)
            result = kit.timeline(kit.audit_snapshot(earlier), kit.audit_snapshot(later))
            self.assertEqual(result["changeCount"], 1)
            self.assertEqual(result["changes"][0]["change"], "REVISED")
            self.assertIn("sha256", result["changes"][0]["fields"])
            self.assertIn("verticalDatum", result["changes"][0]["fields"])
            self.assertIn("not proof", result["interpretation"])
            self.assertFalse(result["engineeringUse"])

    def test_passport_does_not_expose_owner_and_does_not_certify(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _ = snapshot(Path(directory))
            data = kit.passport(kit.audit_snapshot(root), parcel([observation()]), CREATED)
            self.assertEqual(data["facts"][0]["evidenceState"], "VALUE_UNREVIEWED")
            self.assertNotIn("owner", json.dumps(data).lower())
            self.assertFalse(data["regulatoryDetermination"])
            self.assertFalse(data["surveyCertification"])
            self.assertFalse(data["facts"][0]["valueIndependentlyValidated"])
            self.assertRegex(data["integritySha256"], r"^[0-9a-f]{64}$")

    def test_uncertainty_lens_distinguishes_stale_datum_and_modeled(self):
        with tempfile.TemporaryDirectory() as directory:
            root, doc = snapshot(Path(directory))
            audited = kit.audit_snapshot(root)
            stale = observation(observedAt="2025-11-01T08:00:00Z")
            uncertain = observation(requiresVerticalDatum=True, verticalDatum="EGM2008")
            unavailable = observation(value=None)
            self.assertEqual(kit.passport(audited, parcel([stale]), CREATED)["facts"][0]["evidenceState"],
                             "STALE_OBSERVATION")
            self.assertEqual(kit.passport(audited, parcel([uncertain]), CREATED)["facts"][0]["evidenceState"],
                             "UNRESOLVED_DATUM")
            self.assertEqual(kit.passport(audited, parcel([unavailable]), CREATED)["facts"][0]["evidenceState"],
                             "VALUE_UNAVAILABLE")
            mismatch = observation(digest="a"*64)
            self.assertEqual(kit.passport(audited, parcel([mismatch]), CREATED)["facts"][0]["evidenceState"],
                             "EVIDENCE_UNLINKED")
            doc["sources"][0]["dataRole"] = "MODELED"
            save(root, doc)
            modeled = observation(dataRole="MODELED")
            self.assertEqual(kit.passport(kit.audit_snapshot(root), parcel([modeled]), CREATED)["facts"][0]["evidenceState"],
                             "MODELED_UNCALIBRATED")

    def test_static_html_escapes_input_and_never_fetches_network(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _ = snapshot(Path(directory))
            data = kit.passport(kit.audit_snapshot(root), parcel([observation(label="<script>alert(1)</script>")]), CREATED)
            page = kit.render_html(data)
            self.assertNotIn("<script>", page)
            self.assertIn("&lt;script&gt;", page)
            self.assertIn("Content-Security-Policy", page)
            self.assertIn("no credential", page.lower())

    def test_cli_creates_receipts_and_rejects_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            root, _ = snapshot(base)
            p = base / "parcel.json"
            p.write_text(json.dumps(parcel([observation()])), encoding="utf-8")
            out, html = base / "passport.json", base / "passport.html"
            args = ["passport", str(root), str(p), "--as-of", CREATED,
                    "--out", str(out), "--html", str(html)]
            self.assertEqual(kit.main(args), 0)
            self.assertTrue(html.read_text().startswith("<!doctype html>"))
            self.assertEqual(kit.main(args), 2)


if __name__ == "__main__":
    unittest.main()
