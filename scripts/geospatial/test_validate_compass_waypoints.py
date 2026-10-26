"""Adversarial waypoint evidence tests using synthetic locations only."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/geospatial/validate_compass_waypoints.py"
SPEC = importlib.util.spec_from_file_location("tsm_waypoint_gate", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)
SCHEMA = json.loads((ROOT / "schemas/compass-waypoint.schema.json").read_text(encoding="utf-8"))


def sample() -> dict:
    return {
        "id": "synthetic-waypoint-1",
        "label": "synthetic example",
        "coordinates": {"latitude": 38.0, "longitude": -88.0},
        "coordinateReferenceSystem": "EPSG:4326",
        "source": {"deviceClass": "manual-entry", "method": "coordinate-entry"},
        "recordedAt": "2026-10-01T12:00:00Z",
        "reviewStatus": "candidate",
        "engineeringUse": "not-authorized",
    }


class WaypointEvidenceTests(unittest.TestCase):
    def validate(self, payload):
        return gate.validate_batch(payload, SCHEMA)

    def test_valid_geographic_waypoint_remains_informational(self):
        result = self.validate(sample())
        self.assertEqual(result["valid"], 1)
        self.assertEqual(result["invalid"], 0)
        self.assertFalse(result["surveyCertification"])
        self.assertFalse(result["datumTransformationExecuted"])

    def test_projected_state_plane_coordinates_cannot_be_called_latlon(self):
        record = sample()
        record["coordinateReferenceSystem"] = "EPSG:2966"
        issue = self.validate(record)["issues"][0]["codes"]
        self.assertIn("PROJECTED_CRS_WITH_LATITUDE_LONGITUDE_FIELDS", issue)

    def test_elevation_requires_explicit_compatible_datum_and_units(self):
        record = sample()
        record["coordinates"]["elevation"] = 380.0
        codes = self.validate(record)["issues"][0]["codes"]
        self.assertIn("ELEVATION_UNIT_REQUIRED", codes)
        self.assertIn("VERTICAL_DATUM_REQUIRED_FOR_ELEVATION", codes)
        record["coordinates"].update(elevationUnit="ft", verticalDatum="NGVD29")
        self.assertIn("VERTICAL_DATUM_TRANSFORMATION_REQUIRED_NOT_EXECUTED",
                      self.validate(record)["issues"][0]["codes"])
        record["coordinates"]["verticalDatum"] = "NAVD88"
        self.assertEqual(self.validate(record)["invalid"], 0)

    def test_nad83_2011_requires_epoch_when_provided(self):
        record = sample()
        record["coordinateReferenceSystem"] = "EPSG:6318"
        codes = self.validate(record)["issues"][0]["codes"]
        self.assertIn("NAD83_2011_COORDINATE_EPOCH_REQUIRED", codes)
        record["coordinateEpoch"] = 2010.0
        self.assertEqual(self.validate(record)["valid"], 1)

    def test_nonfinite_values_and_unapproved_promotion_rejected(self):
        record = sample()
        record["coordinates"].update(elevation=float("nan"), elevationUnit="m", verticalDatum="NAVD88")
        self.assertIn("ELEVATION_NONFINITE_OR_NONNUMERIC",
                      self.validate(record)["issues"][0]["codes"])
        record["coordinates"]["elevation"] = 380
        record["engineeringUse"] = "certified"
        self.assertEqual(self.validate(record)["invalid"], 1)

    def test_batch_report_has_no_identifying_values(self):
        record = sample()
        record["id"] = "PRIVATE_USER_WAYPOINT_ID"
        record["label"] = "do not echo this location"
        record["coordinateReferenceSystem"] = "EPSG:2966"
        result = self.validate([sample(), record])
        self.assertEqual(result["records"], 2)
        self.assertEqual(result["invalid"], 1)
        output = json.dumps(result)
        self.assertNotIn("PRIVATE_USER_WAYPOINT_ID", output)
        self.assertNotIn("do not echo", output)
        self.assertNotIn("-88.0", output)

    def test_cli_uses_redacted_reports_and_fails_nonzero_on_invalid(self):
        record = sample()
        record["coordinateReferenceSystem"] = "EPSG:2966"
        with tempfile.TemporaryDirectory() as d:
            src, out = Path(d) / "input.json", Path(d) / "report.json"
            src.write_text(json.dumps(record), encoding="utf-8")
            cmd = [sys.executable, str(SCRIPT), "--input", str(src), "--report", str(out)]
            proc = subprocess.run(cmd, text=True, capture_output=True, check=False)
            self.assertEqual(proc.returncode, 1, proc.stderr)
            self.assertEqual(json.loads(out.read_text())["invalid"], 1)
            self.assertNotIn("synthetic example", proc.stdout)


if __name__ == "__main__":
    unittest.main()
