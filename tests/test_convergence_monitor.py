from tsm_runtime.convergence_monitor import inspect_hec_ras_log


def test_nominal_log_only_passes_screening(tmp_path):
    path = tmp_path / "nominal.log"
    path.write_text(
        "Unsteady Computation Initialized\n"
        "Iterations: 3, Max WSE Error: 0.0012\n"
        "Iterations: 4, Max WSE Error: 0.0021\n"
        "Unsteady Simulation Completed Normal Termination.\n",
        encoding="utf-8",
    )
    result = inspect_hec_ras_log(path)
    assert result.status == "SCREENED_FOR_REVIEW"
    assert result.max_wse_error == 0.0021
    assert result.max_iterations == 4
    assert result.as_dict()["execution_allowed"] is False


def test_instability_and_warning_lock(tmp_path):
    path = tmp_path / "unstable.log"
    path.write_text(
        "WARNING: HEC-RAS 2D Unsteady dynamic convergence limit hit.\n"
        "Iterations: 20, Max WSE Error: 0.0850\n"
        "Program terminated due to numerical instability matrix overshoot.\n",
        encoding="utf-8",
    )
    result = inspect_hec_ras_log(path)
    assert result.status == "PIPELINE_LOCKED"
    assert result.warning_count == 1
    assert result.instability_count >= 1
    assert result.max_wse_error == 0.085


def test_missing_log_fails_closed(tmp_path):
    result = inspect_hec_ras_log(tmp_path / "missing.log")
    assert result.status == "PIPELINE_LOCKED"
    assert result.max_wse_error is None
