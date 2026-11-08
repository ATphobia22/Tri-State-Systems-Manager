"""Tests for backend/survey/adjustment.py — least-squares wrappers.

Run from the repo root:  python3 -m pytest backend/tests/test_survey_adjustment.py -v

Textbook regression values are pySurveying's upstream cases from
Song Lijie, 《测量平差程序设计》 §§3.1.5/3.2.5, reproduced here so
the wrappers are checked against published numbers, not our own.
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from backend.survey.adjustment import (
    adjust_control_network,
    weighted_least_squares,
)

SONG_QXX = np.array(
    [
        [0.3888888889, 0.2777777778, 0.0555555556],
        [0.2777777778, 0.5555555556, 0.1111111111],
        [0.0555555556, 0.1111111111, 0.2222222222],
    ]
)


def test_weighted_mean():
    result = weighted_least_squares(
        [[1.0], [1.0], [1.0]], [10.01, 9.99, 10.00]
    )
    assert result["parameters"] == [pytest.approx(10.0)]
    assert result["dof"] == 2
    assert result["provisional"] is True
    assert result["weights_recorded"] is None


def test_song_lijie_3_1_5_independent_weights():
    a = np.array(
        [
            [1.0, 0.0, 0.0],
            [-1.0, 0.0, 0.0],
            [-1.0, 1.0, 0.0],
            [0.0, 1.0, -1.0],
            [0.0, 0.0, 1.0],
            [0.0, 0.0, 1.0],
        ]
    )
    result = weighted_least_squares(
        a, [0.0, -6.0, 0.0, 3.0, 0.0, -9.0],
        weights=[1.0, 1.0, 2.0, 1.0, 2.0, 2.0],
    )
    assert np.allclose(result["parameters"], [2.0, 1.0, -4.0], atol=1e-10)
    assert np.allclose(
        result["residuals"], [2.0, 4.0, -1.0, 2.0, -4.0, 5.0], atol=1e-10
    )
    assert math.isclose(result["sigma0"], 6.0, abs_tol=1e-10)
    assert np.allclose(result["qxx"], SONG_QXX, atol=1e-8)
    assert result["weights_recorded"] == [1.0, 1.0, 2.0, 1.0, 2.0, 2.0]


def test_song_lijie_3_2_5_correlated_weights():
    a = np.array(
        [
            [1.0, 0.0, 0.0],
            [-2.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [1.0, 0.0, -1.0],
            [0.0, -1.0, 2.0],
            [0.0, 0.0, 1.0],
        ]
    )
    p = np.array(
        [
            [7.5, 6.5, 5.5, 3.5, 2.5, 0.5],
            [6.5, 6.5, 5.5, 3.5, 2.5, 0.5],
            [5.5, 5.5, 5.5, 3.5, 2.5, 0.5],
            [3.5, 3.5, 3.5, 3.5, 2.5, 0.5],
            [2.5, 2.5, 2.5, 2.5, 2.5, 0.5],
            [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        ]
    )
    result = weighted_least_squares(
        a, [0.0, -6.0, 6.0, 3.0, -3.0, -18.0], weights=p
    )
    assert np.allclose(result["parameters"], [2.0, 1.0, -4.0], atol=1e-10)
    assert np.allclose(
        result["residuals"], [2.0, 2.0, -5.0, 3.0, -6.0, 14.0], atol=1e-10
    )
    assert math.isclose(result["sigma0"], 6.0, abs_tol=1e-10)


def test_distance_network_recovers_point():
    # pySurveying upstream network case: P is at (40, 30); the
    # approximate (39, 31) must adjust to the true position.
    points = [
        {"name": "A", "x": 0.0, "y": 0.0, "fixed": True},
        {"name": "B", "x": 100.0, "y": 0.0, "fixed": True},
        {"name": "C", "x": 0.0, "y": 100.0, "fixed": True},
        {"name": "P", "x": 39.0, "y": 31.0},
    ]
    observations = [
        {"kind": "distance", "from_point": "A", "to_point": "P",
         "value": 50.0, "sigma": 0.01},
        {"kind": "distance", "from_point": "B", "to_point": "P",
         "value": math.hypot(60.0, 30.0), "sigma": 0.01},
        {"kind": "distance", "from_point": "C", "to_point": "P",
         "value": math.hypot(40.0, 70.0), "sigma": 0.01},
    ]
    result = adjust_control_network(points, observations)
    assert result["converged"] is True
    x, y = result["adjusted_points"]["P"]
    assert math.isclose(x, 40.0, abs_tol=1e-6)
    assert math.isclose(y, 30.0, abs_tol=1e-6)
    assert result["provisional"] is True
    assert result["observation_sigmas_recorded"] == [0.01, 0.01, 0.01]
    # Precision table carries an error ellipse for the unknown point.
    assert result["precision"][0]["name"] == "P"
    assert result["precision"][0]["sigma_position"] >= 0.0
    assert result["flagged_observations"] == []


def test_outlier_flagged_by_standardized_residual():
    # Ten observations of 10.0 plus one blunder at 20.0: with enough
    # redundancy the blunder's standardized residual exceeds 3.
    result = weighted_least_squares([[1.0]] * 11, [10.0] * 10 + [20.0])
    assert result["outlier_indices_threshold_3"] == [10]


def test_network_blunder_shows_as_large_raw_residual():
    # A 5-ft blunder on a redundant fourth distance. Note the honest
    # limitation this test documents: the blunder inflates sigma0
    # (~259), which shrinks every standardized residual below the
    # flagging threshold — so the network table does NOT flag it, but
    # the raw residual in feet and the pulled adjusted point do expose
    # it. Reviewers must read raw residuals, not only flags.
    points = [
        {"name": "A", "x": 0.0, "y": 0.0, "fixed": True},
        {"name": "B", "x": 100.0, "y": 0.0, "fixed": True},
        {"name": "C", "x": 0.0, "y": 100.0, "fixed": True},
        {"name": "P", "x": 40.0, "y": 30.0},
    ]
    observations = [
        {"kind": "distance", "from_point": "A", "to_point": "P",
         "value": 50.0, "sigma": 0.01},
        {"kind": "distance", "from_point": "B", "to_point": "P",
         "value": math.hypot(60.0, 30.0), "sigma": 0.01},
        {"kind": "distance", "from_point": "C", "to_point": "P",
         "value": math.hypot(40.0, 70.0), "sigma": 0.01},
        {"kind": "distance", "from_point": "A", "to_point": "P",
         "value": 55.0, "sigma": 0.01},
    ]
    result = adjust_control_network(points, observations)
    blunder = result["quality_table"][3]
    assert abs(blunder["residual_observation_unit"]) > 2.0
    assert result["sigma0"] > 100.0  # inflated by the blunder
    x, y = result["adjusted_points"]["P"]
    assert math.hypot(x - 40.0, y - 30.0) > 1.0  # point pulled off truth


def test_non_positive_sigma_rejected():
    with pytest.raises(ValueError, match="positive sigma"):
        adjust_control_network(
            [{"name": "A", "x": 0.0, "y": 0.0, "fixed": True},
             {"name": "P", "x": 1.0, "y": 1.0}],
            [{"kind": "distance", "from_point": "A", "to_point": "P",
              "value": 1.0, "sigma": 0.0}],
        )
