"""Tests for backend/survey/total_station.py — Leica GSI reader.

Run from the repo root:  python3 -m pytest backend/tests/test_survey_gsi.py -v

The fixture (backend/tests/fixtures/survey/sample.gsi) is SYNTHETIC,
built from the word shapes in Leica's public TPS/DNA documentation:
block 1 is point 1001 (E 1999.507 m, N -213.159 m, H 32.881 m),
block 2 is point 1002 (E/N/H only), block 3 is point 1003
(angles + slope distance only, no coordinates).
"""

from __future__ import annotations

import math
from pathlib import Path

import pytest

from backend.survey.total_station import (
    WORD_INDEX_MEANING,
    gsi_angle_degrees,
    gsi_block_points,
    parse_gsi_text,
    read_gsi,
)

FIXTURE = Path(__file__).parent / "fixtures" / "survey" / "sample.gsi"


def test_word_index_table_covers_core_words():
    for wi in (11, 21, 22, 31, 32, 33, 81, 82, 83, 84, 85, 86, 87, 88):
        assert wi in WORD_INDEX_MEANING


def test_parse_gsi_text_reads_real_token_shapes():
    records = parse_gsi_text("110001+00001001 21.324+34746050 81..00+01999507\n")
    assert [r["word"] for r in records] == [11, 21, 81]
    assert records[0]["value"] == 1001
    assert records[0]["info"] == "0001"
    assert records[1]["value"] == 34746050
    assert records[2]["value"] == 1999507


def test_two_digit_word_index_not_three():
    # Regression: a 3-digit grab would read WI 110 here instead of 11.
    records = parse_gsi_text("110001+00001001")
    assert records[0]["word"] == 11
    assert records[0]["meaning"] == "point number"


def test_fixture_blocks_and_points():
    parsed = read_gsi(FIXTURE)
    assert parsed["block_count"] == 3
    assert parsed["skipped_tokens"] == 0
    points = gsi_block_points(parsed["blocks"])
    assert len(points) == 3
    first = points[0]
    assert first["point_number"] == 1001
    assert first["complete"] is True
    # Token arithmetic at 3 implied decimals: 81..00+01999507 = 1999.507,
    # 82..00-00213159 = -213.159, 83..00+00032881 = 32.881.
    assert math.isclose(first["x"], 1999.507, abs_tol=1e-9)
    assert math.isclose(first["y"], -213.159, abs_tol=1e-9)
    assert math.isclose(first["z"], 32.881, abs_tol=1e-9)
    # Block 3 has angles/distances only — reported, not dropped.
    assert points[2]["complete"] is False
    assert "x" not in points[2]


def test_gsi_angle_gon_conversion():
    # Leica example: 21.102+17920860 = 179.20860 gon.
    degrees = gsi_angle_degrees(17920860, decimals=5, unit="gon")
    assert math.isclose(degrees, 179.20860 * 0.9, rel_tol=1e-9)
    assert math.isclose(gsi_angle_degrees(10000000, decimals=5, unit="deg"), 100.0)
    with pytest.raises(ValueError, match='unit must be'):
        gsi_angle_degrees(100, unit="rad")


def test_unparseable_tokens_counted_not_fatal():
    records = parse_gsi_text("not-a-gsi-token 11....+00000001\n")
    assert len(records) == 1
    assert records[0]["word"] == 11
