"""Offline regression coverage for immutable public-source evidence harvesting."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.geospatial import tsm_manifest_builder as mb


def record(**overrides):
    r = {
        "dataset_id": "noaa_mtvi3_test", "agency": "NOAA/NWS",
        "layer_id": "MTVI3",
        "source_url": "https://api.water.noaa.gov/nwps/v1/gauges/MTVI3",
        "resource_kind": "service_metadata_json",
        "declared_epsg": None, "vertical_datum": "GAGE_DATUM",
        "license": "Declared, not validated",
    }
    r.update(overrides)
    return r


class Response:
    def __init__(self, data=None, *, status=200, content_type="application/json",
                 url="https://api.water.noaa.gov/nwps/v1/gauges/MTVI3", chunks=None):
        self.data = json.dumps(data if data is not None else {"lid": "MTVI3"}).encode("utf-8")
        self.status_code = status
        self.url = url
        self.headers = {"Content-Type": content_type}
        self.chunks = chunks
        self.closed = False

    def iter_content(self, chunk_size=65536):
        yield from (self.chunks if self.chunks is not None else [self.data])

    def close(self):
        self.closed = True


class Session:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.response


class ManifestTests(unittest.TestCase):
    def test_accepts_known_host_but_rejects_credential_private_hosts(self):
        for url in ("http://api.water.noaa.gov/nwps/v1/gauges/MTVI3",
                    "https://localhost/file.json", "https://127.0.0.1/file",
                    "https://api.water.noaa.gov.evil.example/a",
                    "https://u:p@api.water.noaa.gov/a",
                    "https://api.water.noaa.gov:443/a",
                    "https://api.water.noaa.gov/a#f"):
            with self.subTest(url=url), self.assertRaises(mb.HarvestError):
                mb.validate_spec(record(source_url=url))
        mb.validate_spec(record())

    def test_schema_requires_unique_identifiers_and_bounded_count(self):
        with self.assertRaises(mb.HarvestError):
            mb.validate_registry({"sources": [record(), record()]})
        with self.assertRaises(mb.HarvestError):
            mb.validate_registry({"sources": []})
        with self.assertRaises(mb.HarvestError):
            mb.validate_spec(record(dataset_id="../danger"))
        with self.assertRaises(mb.HarvestError):
            mb.validate_spec(record(resource_kind="full_tiff"))
        with self.assertRaises(mb.HarvestError):
            mb.validate_spec(record(declared_epsg=True))

    def test_default_plan_never_invokes_network(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch("requests.Session", side_effect=AssertionError("must remain offline")):
                result = mb.build_manifest({"registry_version": "1", "sources": [record()]},
                                           Path(tmp), timestamp="2026-11-11T00:00:00Z")
            self.assertEqual(result["sources"][0]["verification_state"], "REGISTERED_NOT_FETCHED")
            self.assertIsNone(result["sources"][0]["sha256"])
            self.assertEqual(result["total_datasets"], 1)
            self.assertFalse(result["engineeringUse"])
            self.assertFalse(result["regulatoryDetermination"])

    def test_bounded_stream_captures_content_addressed_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            response = Response()
            session = Session(response)
            report = mb.build_manifest({"sources": [record()]}, Path(tmp),
                                       mode="fetch", session=session,
                                       timestamp="2026-11-11T00:00:00Z")
            row = report["sources"][0]
            self.assertEqual(row["verification_state"], "SNAPSHOT_CAPTURED_UNVERIFIED")
            self.assertFalse(row["publisher_hash_verified"])
            self.assertEqual(row["sha256"], hashlib.sha256(response.data).hexdigest())
            self.assertEqual((Path(tmp) / row["snapshot_file"]).read_bytes(), response.data)
            self.assertEqual(row["retrieved_at"] is not None, True)
            self.assertTrue(response.closed)
            self.assertIs(session.calls[0][1]["allow_redirects"], False)
            self.assertTrue(session.calls[0][1]["stream"])
            second = mb.build_manifest({"sources": [record()]}, Path(tmp),
                                       mode="fetch", session=Session(Response()))
            self.assertEqual(second["sources"][0]["sha256"], row["sha256"])
            self.assertEqual(len(list(Path(tmp).glob("*.json"))), 1)

    def test_publisher_hash_is_not_invented(self):
        with tempfile.TemporaryDirectory() as tmp:
            digest = hashlib.sha256(Response().data).hexdigest()
            for expected, state in [(digest, "PUBLISHER_HASH_MATCHED"),
                                    ("a" * 64, "PUBLISHER_HASH_MISMATCH")]:
                r = mb.build_manifest({"sources": [record(publisher_sha256=expected)]},
                                      Path(tmp), mode="fetch", session=Session(Response()))
                self.assertEqual(r["sources"][0]["verification_state"], state)
                self.assertEqual(r["sources"][0]["publisher_hash_verified"], expected == digest)

    def test_rejects_html_error_payload_and_redirect_as_negative_evidence(self):
        for response in (
            Response(content_type="text/html"),
            Response(status=302),
            Response(url="https://evil.example/redirect"),
            Response(data={"error": {"message": "ArcGIS service unavailable"}}),
            Response(chunks=[b""]),
            Response(chunks=[b"{bad json"]),
        ):
            with tempfile.TemporaryDirectory() as tmp:
                row = mb.build_manifest({"sources": [record()]}, Path(tmp),
                                        mode="fetch", session=Session(response))["sources"][0]
                self.assertEqual(row["verification_state"], "SOURCE_UNAVAILABLE_OR_INVALID")
                self.assertIsNone(row["snapshot_file"])
                self.assertEqual(list(Path(tmp).glob("*.json")), [])
                self.assertTrue(response.closed)

    def test_size_bound_fails_without_partial_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            row = mb.build_manifest({"sources": [record()]}, Path(tmp),
                                    mode="fetch", max_bytes=4, session=Session(Response()))["sources"][0]
            self.assertEqual(row["verification_state"], "SOURCE_UNAVAILABLE_OR_INVALID")
            self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_arcgis_observed_crs_requires_actual_service_metadata(self):
        spec = record(source_url="https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer?f=pjson",
                      declared_epsg=4269)
        with tempfile.TemporaryDirectory() as tmp:
            matching = mb.build_manifest({"sources": [spec]}, Path(tmp), mode="fetch",
                                         session=Session(Response(data={"spatialReference": {"wkid": 4269}},
                                                                  url=spec["source_url"])))["sources"][0]
            self.assertEqual(matching["horizontal_crs"]["state"], "SOURCE_METADATA_MATCHES_DECLARATION")
            self.assertFalse(matching["vertical_datum_verified"])
            mismatch = mb.build_manifest({"sources": [spec]}, Path(tmp), mode="fetch",
                                         session=Session(Response(data={"spatialReference": {"wkid": 4326}},
                                                                  url=spec["source_url"])))["sources"][0]
            self.assertEqual(mismatch["verification_state"], "CRS_CONFLICT")
            self.assertEqual(mismatch["horizontal_crs"]["observedEpsg"], 4326)

    def test_declared_epsg_is_not_evidence_of_downloaded_crs(self):
        crs = mb.inspect_declared_crs(6933)
        self.assertTrue(crs["declarationValid"])
        self.assertEqual(crs["state"], "DECLARATION_ONLY")
        self.assertIsNone(crs["observedEpsg"])

    def test_canonical_payload_checksum_stable_given_timestamp_and_registry(self):
        with tempfile.TemporaryDirectory() as tmp:
            registry = {"sources": [record()]}
            a = mb.build_manifest(registry, Path(tmp), timestamp="2026-01-01T00:00:00Z")
            b = mb.build_manifest(registry, Path(tmp), timestamp="2026-01-01T00:00:00Z")
            self.assertEqual(a["manifest_payload_sha256"], b["manifest_payload_sha256"])
            self.assertNotIn("RFC8785", a["canonicalization"].split(" (")[0])

    def test_optional_previous_snapshot_hash_has_no_approval_semantics(self):
        with tempfile.TemporaryDirectory() as tmp:
            old = Path(tmp) / "old.json"
            old.write_text('{"example":1}', encoding="utf-8")
            out = mb.build_manifest({"sources": [record()]}, Path(tmp),
                                    previous_manifest=old)
            self.assertEqual(out["previous_manifest_file_sha256"],
                             hashlib.sha256(old.read_bytes()).hexdigest())
            self.assertFalse(out["regulatoryDetermination"])


if __name__ == "__main__":
    unittest.main()
