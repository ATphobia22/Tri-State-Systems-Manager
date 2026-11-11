#!/usr/bin/env python3
"""
Tri-State Systems Manager (TSM) - CI ECEF Spatial Bounding Test Suite
Validates 3D Tiles root transform translation vectors against Posey County ECEF bounds.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

POSEY_CO_ECEF_BOUNDS = {
    "x_min": 150000.0,
    "x_max": 210000.0,
    "y_min": -5060000.0,
    "y_max": -5000000.0,
    "z_min": 3870000.0,
    "z_max": 3940000.0,
}


def extract_translation_from_transform(transform: list[float]) -> tuple[float, float, float]:
    if len(transform) != 16:
        raise ValueError(
            f"Invalid transform matrix length: expected 16, found {len(transform)}"
        )
    return float(transform[12]), float(transform[13]), float(transform[14])


def is_within_posey_bounds(tx: float, ty: float, tz: float) -> bool:
    b = POSEY_CO_ECEF_BOUNDS
    return (
        b["x_min"] <= tx <= b["x_max"]
        and b["y_min"] <= ty <= b["y_max"]
        and b["z_min"] <= tz <= b["z_max"]
    )


def test_valid_bonebank_anchor_translation() -> None:
    mock_transform = [
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        175550.80, -5039980.70, 3892024.20, 1.0,
    ]
    tx, ty, tz = extract_translation_from_transform(mock_transform)
    assert is_within_posey_bounds(tx, ty, tz), (
        f"Bonebank anchor ({tx}, {ty}, {tz}) fell outside Posey County bounds."
    )


def test_rejects_negative_x_sign_trap() -> None:
    invalid_transform = [
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        -175550.80, -5039980.70, 3892024.20, 1.0,
    ]
    tx, ty, tz = extract_translation_from_transform(invalid_transform)
    assert not is_within_posey_bounds(tx, ty, tz), (
        "Negative X coordinate incorrectly accepted."
    )


def test_rejects_geographic_displacement() -> None:
    displaced_transform = [
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0,
    ]
    tx, ty, tz = extract_translation_from_transform(displaced_transform)
    assert not is_within_posey_bounds(tx, ty, tz), (
        "Origin-displaced transform incorrectly accepted."
    )


def test_integration_tileset_json_file() -> None:
    tileset_path = Path("tiles/posey_county_offline/tileset.json")
    if not tileset_path.exists():
        pytest.skip("tileset.json not staged; skipping live file integration test.")

    with tileset_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    transform = data.get("root", {}).get("transform")
    if not transform:
        pytest.fail("Staged tileset.json missing root.transform")

    tx, ty, tz = extract_translation_from_transform(transform)
    assert is_within_posey_bounds(tx, ty, tz), (
        f"Staged tileset.json transform ({tx}, {ty}, {tz}) violates Posey bounds."
    )
