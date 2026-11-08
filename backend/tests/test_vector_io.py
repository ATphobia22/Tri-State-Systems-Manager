"""Tests for backend/geospatial/vector_io.py — GeoPandas vector layer.

Run from the repo root:
    python3 -m pytest backend/tests/test_vector_io.py -v

Requires GeoPandas (``geopandas>=1.2,<2`` in backend/requirements.txt).
The whole module is skipped — not failed — when GeoPandas is absent,
so a checkout without the optional vector dependency still passes its
other tests. The fixtures (backend/tests/fixtures/vector/*.geojson)
are SYNTHETIC: parcel rectangles around the rounded public reference
(-88.01, 37.85, Point Township, Posey County, Indiana) and a synthetic
SFHA-like flood extent. No real parcel, owner, or flood data is used.

Expected join geometry (synthetic parcels fixture):
  * P-001 lies fully inside the flood extent  -> in flood, full overlap
  * P-002 is cut in half by the flood edge    -> in flood, partial overlap
  * P-003 and P-004 lie outside               -> not in flood, zero overlap
Expected join geometry (Posey-shaped fixture):
  * POSEY-01 and POSEY-02 are each half-covered by the flood strip
  * POSEY-03 lies outside
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import pytest

gpd = pytest.importorskip("geopandas", reason="GeoPandas not installed")

from backend.geospatial.vector_io import (
    BFE_FT_NAVD88,
    PROVISIONAL,
    WORKING_CRS,
    WORKING_EPSG,
    join_summary,
    parcel_flood_join,
    provenance_report,
    read_vector,
    sha256_file,
    to_working_crs,
    validate_geometries,
    write_geojson,
)

FIXTURES = Path(__file__).parent / "fixtures" / "vector"
PARCELS = FIXTURES / "parcels.geojson"
FLOOD = FIXTURES / "flood_extent.geojson"
POSEY_PARCELS = FIXTURES / "parcels_posey.geojson"
POSEY_FLOOD = FIXTURES / "flood_posey.geojson"


# --- read / CRS / provenance -----------------------------------------------

def test_read_vector_reprojects_to_epsg2966():
    gdf = read_vector(PARCELS, source="synthetic parcels", vintage="synthetic")
    assert gdf.crs.to_epsg() == WORKING_EPSG
    assert len(gdf) == 4
    assert set(gdf["parcel_id"]) == {"P-001", "P-002", "P-003", "P-004"}


def test_read_vector_records_provenance():
    gdf = read_vector(PARCELS, source="synthetic parcels", vintage="synthetic")
    report = provenance_report(gdf)
    assert report["status"] == "OBSERVED"
    assert report["source"] == "synthetic parcels"
    assert report["vintage"] == "synthetic"
    assert report["source_crs"] == "EPSG:4326"
    assert report["working_crs"] == WORKING_CRS
    assert report["provisional"] is True
    assert report["sha256"] == sha256_file(PARCELS)


def test_provenance_report_unavailable_without_read_vector():
    gdf = gpd.GeoDataFrame(geometry=[], crs="EPSG:4326")
    report = provenance_report(gdf)
    assert report["status"] == "UNAVAILABLE"


def test_read_vector_missing_file():
    with pytest.raises(FileNotFoundError):
        read_vector(FIXTURES / "does-not-exist.geojson")


def test_read_vector_unsupported_format(tmp_path):
    bad = tmp_path / "notes.txt"
    bad.write_text("not a vector file", encoding="utf-8")
    with pytest.raises(ValueError, match="unsupported vector format"):
        read_vector(bad)


def test_to_working_crs_refuses_missing_crs():
    from shapely.geometry import Point

    frame = gpd.GeoDataFrame(geometry=[Point(0, 0)], crs=None)
    with pytest.raises(ValueError, match="no CRS"):
        to_working_crs(frame)


def test_to_working_crs_is_noop_when_already_2966():
    gdf = read_vector(PARCELS)
    again = to_working_crs(gdf)
    assert again.crs.to_epsg() == WORKING_EPSG
    assert len(again) == 4


# --- geometry validation ----------------------------------------------------

def test_validate_geometries_all_valid():
    gdf = read_vector(PARCELS)
    report = validate_geometries(gdf)
    assert report["status"] == "OBSERVED"
    assert report["feature_count"] == 4
    assert report["valid_count"] == 4
    assert report["invalid_count"] == 0
    assert report["geometry_types"] == ["Polygon"]
    assert report["crs"] == WORKING_CRS
    # Bounds are in EPSG:2966 (US ft) — a Posey-shaped envelope, not degrees.
    xmin, ymin, xmax, ymax = report["bounds_epsg2966"]
    assert xmax > xmin and ymax > ymin
    assert xmin > 1_000_000  # State Plane West eastings are ~2.6M ft here


def test_validate_geometries_flags_bowtie():
    from shapely.geometry import Polygon

    bowtie = Polygon([(0, 0), (1, 1), (1, 0), (0, 1), (0, 0)])
    assert not bowtie.is_valid
    gdf = gpd.GeoDataFrame(geometry=[bowtie], crs=WORKING_CRS)
    report = validate_geometries(gdf)
    assert report["status"] == "INVALID_GEOMETRIES"
    assert report["invalid_count"] == 1
    assert report["invalid"][0]["row"] == 0
    assert report["invalid"][0]["reason"]


# --- parcel / flood join ----------------------------------------------------

def _joined():
    parcels = read_vector(PARCELS)
    flood = read_vector(FLOOD)
    return parcel_flood_join(parcels, flood)


def test_parcel_flood_join_counts():
    joined = _joined()
    assert len(joined) == 4  # every parcel kept, in flood or not
    summary = join_summary(joined)
    assert summary["parcel_count"] == 4
    assert summary["in_flood_count"] == 2
    assert summary["outside_count"] == 2
    assert summary["provisional"] is True


def test_parcel_flood_join_full_and_partial_overlap():
    joined = _joined().set_index("parcel_id")
    inside = joined.loc["P-001"]
    assert bool(inside["in_flood_extent"])
    assert inside["flood_zone"] == "AE"
    # Fully inside: overlap equals the parcel's own area, to within
    # the reprojection edge effect. Both polygons are reprojected
    # from EPSG:4326 to EPSG:2966 independently, so a shared lon/lat
    # edge becomes two very slightly different projected edges
    # (observed relative difference ~1e-5 here) — not an exact match.
    assert math.isclose(
        inside["overlap_area_sqft"], inside["parcel_area_sqft"], rel_tol=1e-4
    )
    partial = joined.loc["P-002"]
    assert bool(partial["in_flood_extent"])
    assert partial["flood_zone"] == "AE"
    # Half covered: overlap is strictly between zero and the full area.
    assert 0.0 < partial["overlap_area_sqft"] < partial["parcel_area_sqft"]
    assert math.isclose(
        partial["overlap_area_sqft"],
        partial["parcel_area_sqft"] / 2.0,
        # Same independent-reprojection edge effect as above (~1e-5).
        rel_tol=1e-4,
    )
    for parcel_id in ("P-003", "P-004"):
        outside = joined.loc[parcel_id]
        assert not bool(outside["in_flood_extent"])
        assert outside["flood_zone"] is None
        assert outside["overlap_area_sqft"] == 0.0


def test_parcel_flood_join_refuses_wrong_crs():
    parcels = read_vector(PARCELS)
    flood_wgs84 = gpd.read_file(FLOOD)  # EPSG:4326, not reprojected
    assert flood_wgs84.crs.to_epsg() == 4326
    with pytest.raises(ValueError, match="must already be in EPSG:2966"):
        parcel_flood_join(parcels, flood_wgs84)


def test_parcel_flood_join_empty_flood_keeps_all_parcels():
    parcels = read_vector(PARCELS)
    empty_flood = gpd.GeoDataFrame(
        {"flood_zone": []}, geometry=[], crs=WORKING_CRS
    )
    joined = parcel_flood_join(parcels, empty_flood)
    assert len(joined) == 4
    assert join_summary(joined)["in_flood_count"] == 0


def test_posey_shaped_fixture_join():
    parcels = read_vector(POSEY_PARCELS, source="synthetic Posey parcels")
    flood = read_vector(POSEY_FLOOD, source="synthetic Posey flood strip")
    joined = parcel_flood_join(parcels, flood).set_index("parcel_id")
    summary = join_summary(parcel_flood_join(parcels, flood))
    assert summary["in_flood_count"] == 2
    assert summary["outside_count"] == 1
    for parcel_id in ("POSEY-01", "POSEY-02"):
        assert bool(joined.loc[parcel_id]["in_flood_extent"])
        assert joined.loc[parcel_id]["flood_zone"] == "AE"
        assert 0.0 < joined.loc[parcel_id]["overlap_area_sqft"]
    assert not bool(joined.loc["POSEY-03"]["in_flood_extent"])
    assert joined.loc["POSEY-03"]["overlap_area_sqft"] == 0.0


# --- GeoJSON write / round-trip ---------------------------------------------

def test_write_geojson_round_trip(tmp_path):
    joined = _joined()
    out_path = tmp_path / "joined.geojson"
    receipt = write_geojson(joined, out_path)
    assert receipt["status"] == "OBSERVED"
    assert receipt["feature_count"] == 4
    assert receipt["crs"] == "EPSG:4326"
    assert receipt["sha256"] == sha256_file(out_path)
    assert receipt["provisional"] is True
    reread = json.loads(out_path.read_text(encoding="utf-8"))
    assert reread["type"] == "FeatureCollection"
    assert len(reread["features"]) == 4
    zones = {
        f["properties"]["parcel_id"]: f["properties"]["in_flood_extent"]
        for f in reread["features"]
    }
    assert zones == {"P-001": True, "P-002": True, "P-003": False, "P-004": False}


# --- module constants ---------------------------------------------------------

def test_reference_values():
    assert BFE_FT_NAVD88 == 369.1
    assert PROVISIONAL is True
