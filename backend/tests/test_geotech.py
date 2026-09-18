import pytest

from backend.solvers.geotech import calculate_bishop_factor_of_safety


def test_bishop_solver_is_deterministic_and_provenance_bearing() -> None:
    kwargs = {
        "cohesion_kpa": 12.0,
        "friction_angle_deg": 28.0,
        "slice_weights_kn": [100.0, 120.0, 110.0],
        "slice_widths_m": [2.0, 2.0, 2.0],
        "alpha_angles_deg": [8.0, 12.0, 10.0],
        "pore_pressure_kpa": [4.0, 5.0, 4.5],
    }
    first = calculate_bishop_factor_of_safety(**kwargs)
    second = calculate_bishop_factor_of_safety(**kwargs)
    assert first == second
    assert first["method_version"] == "TSM-BISHOP-SIMPLIFIED-V35.1"
    assert len(first["input_sha256"]) == 64


@pytest.mark.parametrize(
    "field,value",
    [
        ("slice_widths_m", [2.0, 0.0]),
        ("slice_weights_kn", [100.0, -1.0]),
        ("pore_pressure_kpa", [1.0, float("nan")]),
    ],
)
def test_bishop_solver_rejects_invalid_slice_data(field: str, value: list[float]) -> None:
    kwargs = {
        "cohesion_kpa": 10.0,
        "friction_angle_deg": 25.0,
        "slice_weights_kn": [100.0, 100.0],
        "slice_widths_m": [2.0, 2.0],
        "alpha_angles_deg": [10.0, 10.0],
        "pore_pressure_kpa": [2.0, 2.0],
    }
    kwargs[field] = value
    with pytest.raises(ValueError):
        calculate_bishop_factor_of_safety(**kwargs)


def test_bishop_solver_rejects_mismatched_lengths() -> None:
    with pytest.raises(ValueError):
        calculate_bishop_factor_of_safety(
            10.0, 25.0, [100.0, 100.0], [2.0], [10.0, 10.0], [2.0, 2.0]
        )
