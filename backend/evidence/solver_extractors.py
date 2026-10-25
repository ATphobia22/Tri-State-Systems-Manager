"""Solver evidence extractors: HEC-RAS, MODFLOW 6, slope stability.

All extractors operate on EXISTING outputs or explicitly labeled fixtures.
HEC-RAS cannot execute on this VM (Windows-only binary, no container
runtime), so nothing here runs a solver or claims execution. Success is
proven by output artifacts and validation, never by a process exit code.

Resilient policy: an extractor never blocks the caller. A failed, crashed,
or non-convergent run yields a sealed evidence record with a failure status
(FAILED / NON_CONVERGENT / DATA_ERROR / UNIT_MISMATCH / DATUM_MISMATCH) and
the caller decides what to do with it. Missing inputs are UNAVAILABLE, never
interpolated.

Corrections to the pasted other-AI extractors:
- An HDF5 file signature is only a byte-level preflight, not HEC-RAS output
  validation. A caller-provided profile-presence boolean is NOT proof of
  profile contents or numerical convergence. Non-fatal records remain
  UNVERIFIED unless an independent parser and validated model evidence exist.
- A MODFLOW mass-balance scalar supplied by the caller is NOT a parsed cell
  budget. Threshold screening is advisory; passing it never yields VERIFIED.
- Hardcoded durationMs/iterations in the paste are NOT measurements. This
  module takes no fabricated metrics: execution metrics are caller-supplied
  and labeled, or omitted.
- The pasted slope "solver" wraps a caller-supplied safetyFactor. Here the
  slope extractor runs the REAL deterministic Simplified Bishop solver in
  backend/engineering/bishop.py over caller-supplied slices; the factor of
  safety is computed, not supplied.
"""

from __future__ import annotations

import math
from typing import Any, Sequence

from backend.engineering.bishop import BishopSlice, bishop_factor_of_safety
from backend.evidence.canonical_hash import hash_bytes, hash_payload, seal_evidence

HDF5_MAGIC = bytes((0x89, 0x48, 0x44, 0x46, 0x0D, 0x0A, 0x1A, 0x0A))

# Mass-balance acceptance threshold for MODFLOW 6 evidence, percent.
MODFLOW_MASS_BALANCE_THRESHOLD_PCT = 1.0

EVIDENCE_STATUSES = (
    "VERIFIED",
    "UNVERIFIED",
    "FAILED",
    "NON_CONVERGENT",
    "DATA_ERROR",
    "UNIT_MISMATCH",
    "DATUM_MISMATCH",
    "TIMEOUT",
    "CANCELLED",
    "UNAVAILABLE",
)


def _spatial_metadata(crs: str, vertical_datum: str, unit: str) -> dict[str, Any]:
    return {"crs": crs, "vertical_datum": vertical_datum, "unit": unit}


def _validate_spatial(crs: str, vertical_datum: str, unit: str) -> str | None:
    """Return a failure status string, or None when spatial metadata is valid."""
    if not crs or not str(crs).startswith("EPSG:"):
        return "DATA_ERROR"
    if vertical_datum != "NAVD88":
        return "DATUM_MISMATCH"
    if not unit:
        return "UNIT_MISMATCH"
    return None


def extract_hec_ras_evidence(
    run_id: str,
    hdf_bytes: bytes,
    computation_messages: Sequence[str],
    crs: str,
    vertical_datum: str,
    unit: str,
    *,
    required_profiles_present: bool,
    solver_version: str = "6.3.1",
    execution_metrics: dict[str, Any] | None = None,
    fixture_label: str | None = None,
) -> dict[str, Any]:
    """Build sealed HEC-RAS evidence from an existing HDF output buffer.

    ``fixture_label`` must be set when ``hdf_bytes`` is a test fixture rather
    than a real solver output; the label travels in the sealed record so a
    fixture can never be mistaken for a real run.
    """
    spatial_error = _validate_spatial(crs, vertical_datum, unit)
    has_hdf_magic = bytes(hdf_bytes[:8]) == HDF5_MAGIC
    fatal_messages = [
        m for m in computation_messages
        if "FATAL" in m.upper() or "ERROR" in m.upper()
    ]
    if spatial_error is not None:
        status = spatial_error
    elif not has_hdf_magic:
        status = "DATA_ERROR"
    elif fatal_messages:
        status = "NON_CONVERGENT"
    elif not required_profiles_present:
        status = "UNVERIFIED"
    else:
        # HDF5 magic and caller-asserted profiles do not establish that the
        # file opens as HDF5, contains supported HEC-RAS datasets or that the
        # hydraulic calculation converged. A separate evidence-bearing parser
        # and independent validation are required for VERIFIED.
        status = "UNVERIFIED"
    body: dict[str, Any] = {
        "run_id": run_id,
        "solver_name": "HEC-RAS",
        "solver_version": solver_version,
        "input_manifest_hash": hash_payload({"solver": "HEC-RAS", "run_id": run_id}),
        "config_hash": hash_payload({"crs": crs, "vertical_datum": vertical_datum, "unit": unit}),
        "output_artifact_hashes": {"output.hdf": hash_bytes(bytes(hdf_bytes))},
        "status": status,
        "hdf_magic_present": has_hdf_magic,
        "fatal_computation_messages": fatal_messages,
        "required_profiles_present": required_profiles_present,
        "verification_scope": "HDF5_SIGNATURE_ONLY; PROFILE_FLAG_CALLER_SUPPLIED; NO_NUMERICAL_VALIDATION",
        "spatial_metadata": _spatial_metadata(crs, vertical_datum, unit),
        "fixture_label": fixture_label,
    }
    if execution_metrics is not None:
        body["execution_metrics"] = {"supplied_by_caller": True, **execution_metrics}
    return seal_evidence(body)


def extract_modflow_evidence(
    run_id: str,
    head_bytes: bytes,
    budget_bytes: bytes,
    mass_balance_error_pct: float,
    crs: str,
    vertical_datum: str,
    unit: str,
    *,
    solver_version: str = "6.4.1",
    execution_metrics: dict[str, Any] | None = None,
    fixture_label: str | None = None,
) -> dict[str, Any]:
    """Build sealed MODFLOW 6 evidence from existing head/budget outputs."""
    spatial_error = _validate_spatial(crs, vertical_datum, unit)
    if spatial_error is not None:
        status = spatial_error
    elif (not isinstance(head_bytes, bytes) or not head_bytes
          or not isinstance(budget_bytes, bytes) or not budget_bytes):
        status = "DATA_ERROR"
    elif (not isinstance(mass_balance_error_pct, (int, float))
          or isinstance(mass_balance_error_pct, bool)
          or not math.isfinite(float(mass_balance_error_pct))):
        status = "DATA_ERROR"
    elif abs(float(mass_balance_error_pct)) > MODFLOW_MASS_BALANCE_THRESHOLD_PCT:
        status = "NON_CONVERGENT"
    else:
        # Caller-supplied mass balance is not verified against a parsed binary
        # budget or solver listing. Data cannot be certified by this function.
        status = "UNVERIFIED"
    body: dict[str, Any] = {
        "run_id": run_id,
        "solver_name": "MODFLOW-6",
        "solver_version": solver_version,
        "input_manifest_hash": hash_payload({"solver": "MODFLOW-6", "run_id": run_id}),
        "config_hash": hash_payload({"crs": crs, "vertical_datum": vertical_datum, "unit": unit}),
        "output_artifact_hashes": {
            "modflow.hds": hash_bytes(bytes(head_bytes)),
            "modflow.cbc": hash_bytes(bytes(budget_bytes)),
        },
        "status": status,
        "mass_balance_error_pct": mass_balance_error_pct,
        "mass_balance_threshold_pct": MODFLOW_MASS_BALANCE_THRESHOLD_PCT,
        "mass_balance_provenance": "CALLER_SUPPLIED_NOT_PARSED",
        "verification_scope": "ARTIFACT_HASHES_AND_CALLER_THRESHOLD_ONLY; NO_BINARY_BUDGET_VALIDATION",
        "spatial_metadata": _spatial_metadata(crs, vertical_datum, unit),
        "fixture_label": fixture_label,
    }
    if execution_metrics is not None:
        body["execution_metrics"] = {"supplied_by_caller": True, **execution_metrics}
    return seal_evidence(body)


def extract_bishop_evidence(
    run_id: str,
    slices: Sequence[BishopSlice],
    crs: str,
    vertical_datum: str,
    unit: str,
    *,
    tolerance: float = 1e-7,
    max_iterations: int = 200,
    fixture_label: str | None = None,
) -> dict[str, Any]:
    """Run the real Simplified Bishop solver and seal its evidence.

    The factor of safety is COMPUTED from the slices, never supplied by the
    caller. Non-convergence yields NON_CONVERGENT evidence, not an exception
    that blocks the caller (invalid slice inputs still raise ValueError, as
    they indicate a programming error, not a solver outcome).
    """
    spatial_error = _validate_spatial(crs, vertical_datum, unit)
    if spatial_error is not None:
        return seal_evidence({
            "run_id": run_id,
            "solver_name": "SLOPE-STABILITY-BISHOP",
            "solver_version": "bishop-simplified-1.0",
            "input_manifest_hash": hash_payload({"solver": "BISHOP", "run_id": run_id}),
            "config_hash": hash_payload({"crs": crs, "vertical_datum": vertical_datum, "unit": unit}),
            "output_artifact_hashes": {},
            "status": spatial_error,
            "factor_of_safety": None,
            "converged": False,
            "iterations": 0,
            "spatial_metadata": _spatial_metadata(crs, vertical_datum, unit),
            "fixture_label": fixture_label,
        })
    result = bishop_factor_of_safety(tuple(slices), tolerance=tolerance, max_iterations=max_iterations)
    return seal_evidence({
        "run_id": run_id,
        "solver_name": "SLOPE-STABILITY-BISHOP",
        "solver_version": result.method_version,
        "input_manifest_hash": result.input_sha256,
        "config_hash": hash_payload({"tolerance": tolerance, "max_iterations": max_iterations}),
        "output_artifact_hashes": {
            "bishop_results.json": hash_payload({"factor_of_safety": result.factor_of_safety,
                                                 "converged": result.converged,
                                                 "iterations": result.iterations}),
        },
        "status": "VERIFIED" if result.converged else "NON_CONVERGENT",
        "factor_of_safety": result.factor_of_safety,
        "converged": result.converged,
        "iterations": result.iterations,
        "tolerance": result.tolerance,
        "spatial_metadata": _spatial_metadata(crs, vertical_datum, unit),
        "fixture_label": fixture_label,
    })
