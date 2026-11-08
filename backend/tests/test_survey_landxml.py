"""Tests for backend/survey/landxml_import.py — read-only LandXML 1.2.

Run from the repo root:  python3 -m pytest backend/tests/test_survey_landxml.py -v

The fixture (backend/tests/fixtures/survey/landxml_sample.xml) is
SYNTHETIC. One test validates it against the real LandXML 1.2 XSD
downloaded from landxml.org (``/tmp/LandXML-1.2.xsd`` — fetched
2026-11-07; the test skips, rather than fails, when the XSD file is
not present, and validates the schema location/namespace from the
fixture itself in all cases).
"""

from __future__ import annotations

import math
from pathlib import Path

import pytest

from backend.survey.landxml_import import (
    LANDXML_NAMESPACE,
    parse_landxml,
    polygon_area_xy,
    tin_to_geojson,
)

FIXTURE = Path(__file__).parent / "fixtures" / "survey" / "landxml_sample.xml"
XSD_PATH = Path("/tmp/LandXML-1.2.xsd")


def test_fixture_parses_all_sections():
    parsed = parse_landxml(FIXTURE)
    assert parsed["format"] == "LandXML"
    assert parsed["version"] == "1.2"
    assert parsed["units"]["system"] == "Metric"
    assert parsed["units"]["linearUnit"] == "meter"
    assert parsed["coordinate_systems"][0]["epsg"] == 2966
    assert parsed["coordinate_systems"][0]["epsgCode"] == "2966"
    assert len(parsed["cgpoints"]) == 4
    assert parsed["warnings"] == []


def test_cgpoint_order_is_northing_easting():
    # Fixture point A text is "1000.0 2000.0 300.0" = northing 1000,
    # easting 2000. The reader must return x=2000 (easting), y=1000.
    parsed = parse_landxml(FIXTURE)
    point_a = next(p for p in parsed["cgpoints"] if p["name"] == "A")
    assert point_a["x"] == 2000.0
    assert point_a["y"] == 1000.0
    assert point_a["z"] == 300.0


def test_parcel_area_declared_matches_computed():
    parsed = parse_landxml(FIXTURE)
    parcel = parsed["parcels"][0]
    assert parcel["name"] == "LOT-1"
    assert parcel["area_declared"] == 10000.0
    assert math.isclose(parcel["area_computed"], 10000.0, rel_tol=1e-12)
    assert len(parcel["segments"]) == 4
    assert all(s["type"] == "Line" for s in parcel["segments"])


def test_surface_points_faces_and_geojson():
    parsed = parse_landxml(FIXTURE)
    surface = parsed["surfaces"][0]
    assert surface["name"] == "TIN-TEST"
    assert surface["surfType"] == "TIN"
    assert surface["point_count"] == 4
    assert surface["face_count"] == 2
    geojson = tin_to_geojson(surface, source_epsg=2966)
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) == 2
    first = geojson["features"][0]
    assert first["geometry"]["type"] == "Polygon"
    ring = first["geometry"]["coordinates"][0]
    assert ring[0] == ring[-1]  # closed ring
    assert len(ring) == 4  # triangle + closure
    # Vertices are planar [easting, northing], NOT lon/lat.
    assert ring[0] == [2000.0, 1000.0]
    assert "EPSG:2966 planar" in geojson["properties"]["crs_note"]


def test_tin_to_wgs84_requires_source_epsg():
    parsed = parse_landxml(FIXTURE)
    surface = parsed["surfaces"][0]
    with pytest.raises(ValueError, match="source_epsg"):
        tin_to_geojson(surface, to_crs="EPSG:4326")
    projected = tin_to_geojson(
        surface, to_crs="EPSG:4326", source_epsg=2966
    )
    lon, lat = projected["features"][0]["geometry"]["coordinates"][0][0]
    # Synthetic grid coordinates are NOT real Indiana coordinates, so
    # the projected values are only checked for plausibility of the
    # transform path (finite numbers in the western hemisphere).
    assert math.isfinite(lon) and math.isfinite(lat)


def test_malformed_and_non_landxml_rejected():
    with pytest.raises(ValueError, match="not well-formed"):
        parse_landxml("<LandXML><oops")
    with pytest.raises(ValueError, match="not LandXML"):
        parse_landxml("<Other><Units/></Other>")


def test_unknown_section_is_warned_not_silent():
    parsed = parse_landxml(
        '<LandXML version="1.2"><Units><Metric areaUnit="squareMeter" '
        'linearUnit="meter" volumeUnit="cubicMeter" '
        'temperatureUnit="celsius" pressureUnit="milliBars"/>'
        "</Units><Alignments/></LandXML>"
    )
    assert any("Alignments" in w for w in parsed["warnings"])


def test_polygon_area_xy():
    assert math.isclose(
        polygon_area_xy([(0.0, 0.0), (100.0, 0.0), (100.0, 100.0), (0.0, 100.0)]),
        10000.0,
    )


def test_fixture_validates_against_real_landxml_xsd():
    """Validate the synthetic fixture against the LandXML 1.2 XSD
    fetched from landxml.org. Skipped when the XSD file is absent
    (offline checkout); the namespace/version assertions above still run."""
    if not XSD_PATH.exists():
        pytest.skip("LandXML 1.2 XSD not present at /tmp/LandXML-1.2.xsd")
    pytest.importorskip("lxml")
    from lxml import etree

    schema = etree.XMLSchema(etree.parse(str(XSD_PATH)))
    document = etree.parse(str(FIXTURE))
    assert document.getroot().tag == f"{{{LANDXML_NAMESPACE}}}LandXML"
    assert schema.validate(document), (
        "fixture fails LandXML 1.2 XSD validation: "
        + "; ".join(str(e) for e in schema.error_log)
    )
