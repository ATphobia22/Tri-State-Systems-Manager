"""Regression tests: Point Township AOI cannot be manufactured by unit mistakes."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

import pyproj

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("ptdt_geodetic_clip", HERE / "ptdt_geodetic_clip.py")
assert SPEC is not None and SPEC.loader is not None
clipper = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(clipper)


def envelope(coords: list, *, status: str = "CANDIDATE") -> dict:
    return {
        "schemaVersion": "tsm.projected-aoi.v1",
        "horizontalCrs": "EPSG:2966",
        "horizontalUnit": "ftUS",
        "verticalDatum": "NAVD88",
        "approvalStatus": status,
        "geometry": {"type": "Polygon", "coordinates": [coords]},
    }


class GeodeticGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.aoi = self.root / "aoi.json"

    def write(self, payload):
        self.aoi.write_text(json.dumps(payload), encoding="utf-8")

    def test_supplied_wrong_easting_rectangle_rejected_even_when_called_approved(self):
        self.write(envelope([
            [830000, 930000], [865000, 930000], [865000, 975000],
            [830000, 975000], [830000, 930000],
        ]))
        with self.assertRaisesRegex(clipper.EvidenceError, "outside Posey"):
            clipper.load_aoi(self.aoi, allow_candidate=True)

    def test_valid_location_still_cannot_skip_approval(self):
        self.write(envelope([
            [2700000, 960000], [2710000, 960000], [2710000, 970000],
            [2700000, 970000], [2700000, 960000],
        ]))
        with self.assertRaisesRegex(clipper.EvidenceError, "not approved"):
            clipper.load_aoi(self.aoi)
        payload, polygon = clipper.load_aoi(self.aoi, allow_candidate=True)
        self.assertGreater(polygon.area, 0)
        self.assertEqual(payload["approvalStatus"], "CANDIDATE")

    def test_approved_requires_evidence_not_just_a_label(self):
        self.write(envelope([
            [2700000, 960000], [2710000, 960000], [2710000, 970000],
            [2700000, 970000], [2700000, 960000],
        ], status="APPROVED"))
        with self.assertRaisesRegex(clipper.EvidenceError, "human approval evidence"):
            clipper.load_aoi(self.aoi)

    def test_reject_legacy_geojson_crs_and_missing_vertical_datum(self):
        payload = envelope([
            [2700000, 960000], [2710000, 960000], [2710000, 970000],
            [2700000, 970000], [2700000, 960000],
        ])
        payload["schemaVersion"] = "FeatureCollection"
        self.write(payload)
        with self.assertRaisesRegex(clipper.EvidenceError, "no legacy GeoJSON"):
            clipper.load_aoi(self.aoi, allow_candidate=True)
        payload["schemaVersion"] = "tsm.projected-aoi.v1"
        payload["verticalDatum"] = "NGVD29"
        self.write(payload)
        with self.assertRaisesRegex(clipper.EvidenceError, "NAVD88"):
            clipper.load_aoi(self.aoi, allow_candidate=True)

    def test_synthetic_regional_coordinates_roundtrip_in_posey_envelope(self):
        forward = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:2966", always_xy=True)
        x, y = forward.transform(-87.9, 37.9)
        self.assertGreater(x, 2_600_000)
        self.assertLess(x, 2_800_000)
        self.assertGreater(y, 900_000)
        self.assertLess(y, 1_000_000)

    def test_streamed_las_clip_preserves_header_and_source_provenance(self):
        import laspy
        import numpy as np

        source = self.root / "real-test-input.las"
        target = self.root / "clipped.las"
        report = self.root / "clip-evidence.json"
        metadata = self.root / "source.json"
        header = laspy.LasHeader(point_format=3, version="1.2")
        header.add_crs(pyproj.CRS.from_epsg(2966))
        header.scales = np.array([0.001, 0.001, 0.001])
        header.offsets = np.array([2_700_000.0, 960_000.0, 0.0])
        las = laspy.LasData(header)
        las.x = np.array([2_705_000.0, 2_708_000.0, 2_730_000.0])
        las.y = np.array([965_000.0, 968_000.0, 990_000.0])
        las.z = np.array([380.0, 381.0, 400.0])
        las.write(source)
        self.write(envelope([
            [2_700_000, 960_000], [2_710_000, 960_000],
            [2_710_000, 970_000], [2_700_000, 970_000],
            [2_700_000, 960_000],
        ]))
        metadata.write_text(json.dumps({
            "horizontalCrs": "EPSG:2966", "verticalDatum": "NAVD88",
            "verticalUnit": "ftUS", "sourceSha256": clipper.digest(source),
        }), encoding="utf-8")
        result = clipper.clip(source, target, self.aoi, metadata, report,
                              allow_candidate=True, chunk_size=2)
        self.assertEqual(result["retainedPointCount"], 2)
        self.assertEqual(result["originalPointCount"], 3)
        self.assertFalse(result["surveyGradeCertified"])
        self.assertFalse(result["approvedForEngineering"])
        self.assertEqual(laspy.read(target).header.parse_crs().to_epsg(), 2966)
        self.assertEqual(laspy.read(target).x[0], 2705000.0)
        self.assertEqual(clipper.digest(target), result["outputSha256"])
        self.assertEqual(json.loads(report.read_text())["classification"], "INFORMATIONAL_ONLY")

    def test_source_hash_vertical_and_quality_claims_checked(self):
        source = self.root / "sample.las"
        source.write_bytes(b"mock input for preflight only; not a real LAS")
        metadata = self.root / "meta.json"
        payload = {
            "horizontalCrs": "EPSG:2966",
            "verticalDatum": "NGVD29",
            "verticalUnit": "ftUS",
            "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        }
        metadata.write_text(json.dumps(payload), encoding="utf-8")
        with self.assertRaisesRegex(clipper.EvidenceError, "NAVD88"):
            clipper.validate_source(source, metadata)
        payload["verticalDatum"] = "NAVD88"
        payload["qualityLevel"] = "QL2"
        payload["aggregateNominalPulseDensity"] = 1.5
        metadata.write_text(json.dumps(payload), encoding="utf-8")
        with self.assertRaisesRegex(clipper.EvidenceError, "below 2"):
            clipper.validate_source(source, metadata)
        payload["aggregateNominalPulseDensity"] = 2.0
        with self.assertRaisesRegex(clipper.EvidenceError, "accuracy report"):
            metadata.write_text(json.dumps(payload), encoding="utf-8")
            clipper.validate_source(source, metadata)
        payload["independentAccuracyReportSha256"] = "a" * 64
        metadata.write_text(json.dumps(payload), encoding="utf-8")
        self.assertEqual(clipper.validate_source(source, metadata)["verticalDatum"], "NAVD88")


if __name__ == "__main__":
    unittest.main()
