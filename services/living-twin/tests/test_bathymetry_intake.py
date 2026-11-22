"""No synthetic bathymetric bed may masquerade as USACE/USGS design evidence."""
import hashlib
from copy import deepcopy

import pytest

from twin.bathymetry_intake import SCHEMA, inspect


def fixture(tmp_path):
    raw = b"SYNTHETIC_SONAR_SAMPLE_NOT_REAL"
    (tmp_path / "soundings.xyz").write_bytes(raw)
    entry = {
        "schema": SCHEMA, "source_uri": "https://www.sam.usace.army.mil/Missions/Spatial-Data-Branch/eHydro/",
        "survey_id": "SYNTHETIC-SURVEY-1", "authority": "USACE",
        "acquired_at": "2024-05-01T12:00:00Z", "published_at": "2024-07-01T12:00:00Z",
        "retrieved_at": "2026-11-22T12:00:00Z",
        "horizontal_crs": "EPSG:2966", "horizontal_units": "ftUS",
        "vertical_datum": "OHIO_RIVER_DATUM", "vertical_units": "ft",
        "z_semantics": "POSITIVE_DEPTH_BELOW_REFERENCE",
        "survey_bbox_wgs84": [-88.1, 37.6, -87.7, 38.0],
        "survey_method": "MULTIBEAM_SONAR",
        "source_sha256": hashlib.sha256(raw).hexdigest(), "source_file": "soundings.xyz",
        "uncertainty_95_vertical_ft": 0.4,
        "grid_quality_reviewed": False, "independent_control_reviewed": False
    }
    return entry


def test_ohio_river_datum_depth_requires_both_datum_and_depth_conversion(tmp_path):
    entry = fixture(tmp_path)
    result = inspect(entry, tmp_path, [-88, 37.7, -87.9, 37.9])
    assert result["status"] == "WITHHELD_SOURCE_EVIDENCE"
    assert "NAVD88_TRANSFORMATION_NOT_REVIEWED" in result["blockers"]
    assert "DEPTH_TO_ELEVATION_CONVERSION_NOT_ESTABLISHED" in result["blockers"]
    assert result["analysis"] == "NO_RIVERBED_RASTER_GENERATED"
    assert result["engineeringCertification"] is False


def test_local_byte_tampering_does_not_pass(tmp_path):
    entry = fixture(tmp_path)
    (tmp_path / "soundings.xyz").write_bytes(b"mutated")
    result = inspect(entry, tmp_path, [-88, 37.7, -87.9, 37.9])
    assert "SOURCE_SHA256_MISMATCH" in result["blockers"]


def test_bbox_and_survey_date_must_match(tmp_path):
    entry = fixture(tmp_path)
    entry["published_at"] = "2020-01-01T00:00:00Z"
    result = inspect(entry, tmp_path, [-86.0, 38.0, -85.0, 39.0])
    assert "SURVEY_DATE_ORDER_INVALID" in result["blockers"]
    assert "SURVEY_DOES_NOT_INTERSECT_AOI" in result["blockers"]


def test_source_file_traversal_and_fake_authority_rejected(tmp_path):
    entry = fixture(tmp_path)
    entry["source_file"] = "../secret"
    entry["source_uri"] = "https://usace.army.mil.evil.example/soundings.xyz"
    result = inspect(entry, tmp_path, [-88, 37.7, -87.9, 37.9])
    assert "UNSAFE_SOURCE_PATH" in result["blockers"]
    assert "SOURCE_AUTHORITY_NOT_PRIMARY_VERIFIED" in result["blockers"]


def test_preliminary_reviewable_not_certified_even_all_metadata_present(tmp_path):
    entry = fixture(tmp_path)
    entry["vertical_datum"] = "NAVD88"
    entry["z_semantics"] = "BOTTOM_ELEVATION"
    entry["grid_quality_reviewed"] = True
    entry["independent_control_reviewed"] = True
    result = inspect(entry, tmp_path, [-88, 37.7, -87.9, 37.9])
    assert result["status"] == "REVIEWABLE_SOURCE_METADATA"
    assert result["engineeringCertification"] is False
    assert result["regulatoryDetermination"] is False
    assert result["surveySha256"] == entry["source_sha256"]


def test_incorrect_crs_and_missing_uncertainty_not_adopted(tmp_path):
    entry = fixture(tmp_path)
    entry["horizontal_crs"] = "EPSG:3857"
    entry["uncertainty_95_vertical_ft"] = None
    report = inspect(entry, tmp_path, [-88, 37.7, -87.9, 37.9])
    assert "UNREVIEWED_HORIZONTAL_CRS_UNITS" in report["blockers"]
    assert "VERTICAL_UNCERTAINTY_NOT_EVIDENCED" in report["blockers"]


def test_epsg_and_horizontal_axis_units_cannot_contradict(tmp_path):
    entry = fixture(tmp_path)
    entry["horizontal_crs"] = "EPSG:4326"
    entry["horizontal_units"] = "ftUS"
    report = inspect(entry, tmp_path, [-88, 37.7, -87.9, 37.9])
    assert "HORIZONTAL_CRS_UNIT_CONTRADICTION" in report["blockers"]


def test_kentucky_epsg_3089_uses_us_survey_feet_not_meters(tmp_path):
    entry = fixture(tmp_path)
    entry["horizontal_crs"] = "EPSG:3089"
    entry["horizontal_units"] = "ftUS"
    correct = inspect(entry, tmp_path, [-88, 37.7, -87.9, 37.9])
    assert "HORIZONTAL_CRS_UNIT_CONTRADICTION" not in correct["blockers"]
    entry["horizontal_units"] = "m"
    incorrect = inspect(entry, tmp_path, [-88, 37.7, -87.9, 37.9])
    assert "HORIZONTAL_CRS_UNIT_CONTRADICTION" in incorrect["blockers"]
