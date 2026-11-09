"""Solver-specific evidence extractors that inspect artifacts, not process responses."""
from __future__ import annotations
import hashlib, json, math
from pathlib import Path
from typing import Any, Mapping
from backend.engineering_evidence import ArtifactDigest, ExecutionState, SolverEvidence, build_solver_evidence, sha256_file
from backend.engineering.hecras_hdf5 import discover_water_surface_datasets
from backend.solvers.geotech import calculate_bishop_factor_of_safety

def inspect_hecras_run(*, run_id: str, solver_version: str, project_hdf: str | Path,
                       computation_log: str | Path, input_paths: list[str | Path]) -> SolverEvidence:
    """Inspect HEC-RAS HDF datasets and computation log; ambiguous logs fail closed."""
    hdf, log = Path(project_hdf), Path(computation_log)
    if not hdf.is_file() or not log.is_file():
        return build_solver_evidence(run_id=run_id,solver="HEC-RAS 2D",solver_version=solver_version,
            input_paths=input_paths,output_paths=[],convergence_evidence=None,
            explicit_state=ExecutionState.NOT_EVALUATED,validation_messages=("HECRAS_HDF_OR_COMPUTATION_LOG_MISSING",))
    try:
        datasets=discover_water_surface_datasets(hdf)
        import h5py
        with h5py.File(hdf,"r") as handle:
            for ref in datasets:
                dataset=handle.get(ref.path)
                if dataset is None or not dataset.shape or any(int(n)<=0 for n in dataset.shape):
                    raise ValueError("HECRAS_REQUIRED_WATER_SURFACE_DATASET_INVALID")
                # Check data in bounded blocks; never silently drop NaN/Inf cells.
                if len(dataset.shape)==2:
                    for start in range(0,dataset.shape[0],64):
                        block=dataset[start:start+64,:]
                        if not __import__("numpy").isfinite(block).all():
                            raise ValueError("HECRAS_WATER_SURFACE_CONTAINS_NONFINITE_VALUES")
    except Exception as exc:
        return build_solver_evidence(run_id=run_id,solver="HEC-RAS 2D",solver_version=solver_version,
            input_paths=input_paths,output_paths=[hdf,log],convergence_evidence=None,
            explicit_state=ExecutionState.FAILED,validation_messages=(f"HECRAS_OUTPUT_VALIDATION_FAILED:{type(exc).__name__}",))
    log_text=log.read_text(encoding="utf-8",errors="replace").casefold()
    fatal_markers=("computation failed","fatal error","failed to converge","abnormal termination")
    if any(marker in log_text for marker in fatal_markers):
        state=ExecutionState.FAILED; convergence=None; messages=("HECRAS_FATAL_OR_NONCONVERGENCE_MARKER_FOUND",)
    elif "computation completed successfully" in log_text:
        state=ExecutionState.VERIFIED; convergence="HEC-RAS computation log contains explicit success marker; HDF datasets independently inspected"; messages=()
    else:
        state=ExecutionState.NOT_EVALUATED; convergence=None; messages=("HECRAS_SUCCESS_MARKER_NOT_FOUND",)
    return build_solver_evidence(run_id=run_id,solver="HEC-RAS 2D",solver_version=solver_version,
        input_paths=input_paths,output_paths=[hdf,log],convergence_evidence=convergence,
        explicit_state=state,validation_messages=messages)

def inspect_modflow6_run(*, run_id: str, solver_version: str, listing_file: str | Path,
                         head_file: str | Path, budget_file: str | Path,
                         mass_balance_report: str | Path, input_paths: list[str | Path],
                         max_relative_mass_balance_error: float) -> SolverEvidence:
    """Verify MODFLOW listing markers, outputs, and explicit machine-readable mass balance."""
    listing, heads, budget, report = map(Path,(listing_file,head_file,budget_file,mass_balance_report))
    required=(listing,heads,budget,report)
    if not all(path.is_file() and path.stat().st_size>0 for path in required):
        return build_solver_evidence(run_id=run_id,solver="MODFLOW 6",solver_version=solver_version,
            input_paths=input_paths,output_paths=[p for p in required if p.is_file()],
            convergence_evidence=None,explicit_state=ExecutionState.NOT_EVALUATED,
            validation_messages=("MODFLOW_REQUIRED_LISTING_HEAD_BUDGET_OR_MASS_BALANCE_REPORT_MISSING",))
    text=listing.read_text(encoding="utf-8",errors="replace").casefold()
    if "failed to converge" in text or "convergence failure" in text:
        state=ExecutionState.NON_CONVERGENT; messages=("MODFLOW_LISTING_REPORTS_NONCONVERGENCE",); convergence=None
    elif "normal termination of simulation" not in text:
        state=ExecutionState.NOT_EVALUATED; messages=("MODFLOW_NORMAL_TERMINATION_MARKER_NOT_FOUND",); convergence=None
    else:
        try:
            balance=json.loads(report.read_text(encoding="utf-8"))
            listing_hash=sha256_file(listing).sha256
            if balance.get("source_listing_sha256") != listing_hash or not str(balance.get("extraction_method","")).strip():
                raise ValueError("mass balance report is not bound to this listing or lacks extraction provenance")
            error=float(balance["relative_mass_balance_error"])
            declared_tolerance=float(balance["tolerance"])
            if not math.isfinite(error) or error<0 or not math.isfinite(declared_tolerance) or declared_tolerance<0:
                raise ValueError("invalid mass balance numeric values")
            if not math.isfinite(max_relative_mass_balance_error) or max_relative_mass_balance_error<0:
                raise ValueError("invalid configured mass-balance threshold")
            if declared_tolerance>max_relative_mass_balance_error:
                raise ValueError("reported tolerance exceeds configured maximum")
            if error>min(declared_tolerance,max_relative_mass_balance_error):
                state=ExecutionState.FAILED; messages=("MODFLOW_MASS_BALANCE_THRESHOLD_EXCEEDED",); convergence=None
            else:
                state=ExecutionState.VERIFIED; messages=(); convergence=f"listing=normal termination; relative_mass_balance_error={error}; tolerance={declared_tolerance}"
        except (KeyError,TypeError,ValueError,json.JSONDecodeError):
            state=ExecutionState.NOT_EVALUATED; messages=("MODFLOW_MASS_BALANCE_REPORT_INVALID_OR_UNVERIFIABLE",); convergence=None
    return build_solver_evidence(run_id=run_id,solver="MODFLOW 6",solver_version=solver_version,
        input_paths=input_paths,output_paths=list(required),convergence_evidence=convergence,
        explicit_state=state,validation_messages=messages)

def verify_bishop_result(*, result: Mapping[str, Any], solver_inputs: Mapping[str, Any],
                         input_artifact_paths: list[str | Path], run_id: str) -> SolverEvidence:
    """Replay the repository's Bishop solver and require exact result agreement."""
    try:
        replay=calculate_bishop_factor_of_safety(**dict(solver_inputs))
        matches=dict(result)==replay
        converged=bool(result.get("converged")) and result.get("status")=="CONVERGED"
        valid_hash=isinstance(result.get("input_sha256"),str) and result["input_sha256"]==replay.get("input_sha256")
    except (TypeError,ValueError,KeyError):
        matches=False; converged=False; valid_hash=False
    state=ExecutionState.VERIFIED if matches and converged and valid_hash else (
        ExecutionState.NON_CONVERGENT if not converged else ExecutionState.FAILED)
    messages=() if state==ExecutionState.VERIFIED else ("BISHOP_REPLAY_OR_CONVERGENCE_VERIFICATION_FAILED",)
    try:
        result_bytes=json.dumps(dict(result),sort_keys=True,separators=(",",":"),allow_nan=False).encode("utf-8")
        input_bytes=json.dumps(dict(solver_inputs),sort_keys=True,separators=(",",":"),allow_nan=False).encode("utf-8")
    except (TypeError, ValueError):
        state=ExecutionState.FAILED
        messages=("BISHOP_RESULT_NOT_CANONICAL_JSON",)
        result_bytes=b"{}"
        input_bytes=b"{}"
    inline_output=ArtifactDigest("output","inline:result.json",len(result_bytes),hashlib.sha256(result_bytes).hexdigest())
    inline_input=ArtifactDigest("input","inline:solver-input.json",len(input_bytes),hashlib.sha256(input_bytes).hexdigest())
    return build_solver_evidence(run_id=run_id,solver="TSM Bishop simplified method",
        solver_version=str(result.get("method_version","unknown")),input_paths=input_artifact_paths,
        output_paths=[],output_digests=[inline_output],input_digests=[inline_input],convergence_evidence="deterministic replay matched solver result" if state==ExecutionState.VERIFIED else None,
        explicit_state=state,validation_messages=messages)


def inspect_swmm_run(*, run_id: str, solver_version: str, input_file: str | Path,
                     report_file: str | Path, output_file: str | Path,
                     max_runoff_continuity_error_percent: float,
                     max_routing_continuity_error_percent: float) -> SolverEvidence:
    """Inspect actual EPA SWMM .rpt continuity sections and a nonempty .out.

    Require unique numerical continuity errors and terminal Analysis ended marker;
    an exit code alone is not evidence of conservation or a calibrated model.
    Reported errors are percentages; configured tolerances are absolute percentages.
    """
    import re
    source, report, output = map(Path, (input_file, report_file, output_file))
    paths = (source, report, output)
    if not all(p.is_file() and p.stat().st_size > 0 for p in paths):
        return build_solver_evidence(
            run_id=run_id, solver="EPA SWMM", solver_version=solver_version,
            input_paths=[p for p in (source,) if p.is_file()],
            output_paths=[p for p in (report, output) if p.is_file()],
            convergence_evidence=None, explicit_state=ExecutionState.NOT_EVALUATED,
            validation_messages=("SWMM_INPUT_REPORT_OR_OUTPUT_MISSING",))
    try:
        tolerances = (float(max_runoff_continuity_error_percent), float(max_routing_continuity_error_percent))
        if not all(math.isfinite(t) and t >= 0 for t in tolerances):
            raise ValueError("invalid SWMM continuity tolerances")
        # EPA SWMM binary output uses a 7-int little-endian header and a
        # six-int trailer with matching magic number (USEPA consts.h).
        # This is an integrity precheck, not a complete physics/output parser.
        import struct
        with output.open("rb") as stream:
            if output.stat().st_size < 76:
                raise ValueError("SWMM_BINARY_OUTPUT_TOO_SMALL")
            header = struct.unpack("<7i", stream.read(28))
            stream.seek(-24, 2)
            offsets_and_status = struct.unpack("<6i", stream.read(24))
        magic = 516114522
        if header[0] != magic or offsets_and_status[-1] != magic:
            raise ValueError("SWMM_OUTPUT_MAGIC_INVALID")
        if header[1] < 50000 or header[2] not in range(6):
            raise ValueError("SWMM_OUTPUT_VERSION_OR_UNITS_INVALID")
        if any(x < 0 for x in header[3:]):
            raise ValueError("SWMM_OUTPUT_NEGATIVE_FEATURE_COUNT")
        if offsets_and_status[-3] <= 0 or offsets_and_status[-2] != 0:
            raise ValueError("SWMM_OUTPUT_NO_PERIODS_OR_ERROR_CODE")
        size = output.stat().st_size
        starts = offsets_and_status[:3]
        if not (28 <= starts[0] <= starts[1] <= starts[2] < size - 24):
            raise ValueError("SWMM_OUTPUT_OFFSETS_INVALID")
        report_text = report.read_text(encoding="utf8", errors="replace")
        if len(report_text) > 20_000_000:
            raise ValueError("SWMM_REPORT_TOO_LARGE")
        if re.search(r"(?im)^\s*(?:ERROR\s+\d+|Simulation\s+failed|Analysis\s+was\s+not\s+completed)", report_text):
            raise ValueError("SWMM_REPORT_EXPLICIT_ERROR")
        if not re.search(r"(?im)^\s*Analysis\s+ended\s+on\s*:", report_text):
            raise ValueError("SWMM_COMPLETION_MARKER_MISSING")
        errors = []
        for section in ("Runoff Quantity Continuity", "Flow Routing Continuity"):
            positions = list(re.finditer(re.escape(section), report_text, re.IGNORECASE))
            if len(positions) != 1:
                raise ValueError("SWMM_REQUIRED_CONTINUITY_SECTION_MISSING_OR_DUPLICATED:" + section)
            tail = report_text[positions[0].end():]
            # Stop before the next named report section. Decorative star lines
            # immediately below each title belong to the current section.
            boundary = re.search(
                r"(?im)^\s*(?:Runoff Quantity Continuity|Flow Routing Continuity|"
                r"Runoff Quality Continuity|Groundwater Continuity|"
                r"Quality Routing Continuity|Highest Flow Instability Indexes|"
                r"Routing Time Step Summary|Analysis ended on:)\b", tail
            )
            block = tail[:boundary.start()] if boundary else tail[:4000]
            values = re.findall(r"(?im)^\s*Continuity\s+Error\s*\(%\)\s*\.+\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)", block)
            if len(values) != 1:
                raise ValueError("SWMM_CONTINUITY_ERROR_NOT_UNIQUE:" + section)
            errors.append(abs(float(values[0])))
        if not all(math.isfinite(e) for e in errors):
            raise ValueError("SWMM_CONTINUITY_NONFINITE")
        passed = all(e <= t for e, t in zip(errors, tolerances))
        state = ExecutionState.VERIFIED if passed else ExecutionState.FAILED
        messages = () if passed else ("SWMM_CONTINUITY_THRESHOLD_EXCEEDED",)
        convergence = (
            f"SWMM report Analysis ended; runoff error={errors[0]:.6f}%; "
            f"routing error={errors[1]:.6f}%; thresholds={tolerances}%"
        ) if passed else None
    except (ValueError, OSError) as exc:
        state = ExecutionState.NOT_EVALUATED
        messages = (f"SWMM_REPORT_UNVERIFIABLE:{exc}",)
        convergence = None
    return build_solver_evidence(
        run_id=run_id, solver="EPA SWMM", solver_version=solver_version,
        input_paths=[source], output_paths=[report, output],
        convergence_evidence=convergence, explicit_state=state,
        validation_messages=messages)
