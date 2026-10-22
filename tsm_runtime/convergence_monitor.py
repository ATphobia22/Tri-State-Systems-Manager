"""Resilient HEC-RAS text-log screening.

Log tokens are version/configuration dependent. A clean parse is only a screening
result and is not proof of numerical convergence or a successful HEC-RAS run.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
import math
from pathlib import Path
import re
from typing import Any


_WSE_ERROR = re.compile(r"Max WSE Error:\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)", re.IGNORECASE)
_ITERATIONS = re.compile(r"Iterations:\s*(\d+)", re.IGNORECASE)
_UNSTABLE_TERMS = (
    "numerical instability",
    "convergence limit hit",
    "failed to converge",
    "computation aborted",
    "fatal error",
    "normal termination not achieved",
)


@dataclass(frozen=True)
class ConvergenceReport:
    status: str
    log_path: str
    lines_scanned: int
    max_wse_error: float | None
    max_iterations: int | None
    warning_count: int
    instability_count: int
    termination_confirmed: bool
    errors: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["errors"] = list(self.errors)
        result["execution_allowed"] = False
        return result


def inspect_hec_ras_log(
    log_path: str | Path,
    *,
    max_wse_error: float = 0.005,
    max_iterations: int = 20,
    require_normal_termination: bool = True,
) -> ConvergenceReport:
    """Screen a text log; any parse gap, instability marker, or threshold breach blocks."""
    errors: list[str] = []
    path = Path(log_path)
    if not math.isfinite(max_wse_error) or max_wse_error < 0:
        raise ValueError("max_wse_error must be finite and non-negative")
    if max_iterations < 1:
        raise ValueError("max_iterations must be >= 1")
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        return ConvergenceReport(
            "PIPELINE_LOCKED", str(path), 0, None, None, 0, 0, False,
            (f"unable to read runtime log: {exc}",),
        )

    lines = text.splitlines()
    max_error: float | None = None
    max_iter: int | None = None
    warnings = 0
    instability = 0
    for line in lines:
        upper = line.upper()
        if "WARNING:" in upper or "WARNING " in upper:
            warnings += 1
        if any(term in line.lower() for term in _UNSTABLE_TERMS):
            instability += 1
        error_match = _WSE_ERROR.search(line)
        if error_match:
            value = float(error_match.group(1))
            if not math.isfinite(value) or value < 0:
                errors.append("log contains invalid WSE error metric")
            else:
                max_error = value if max_error is None else max(max_error, value)
        iteration_match = _ITERATIONS.search(line)
        if iteration_match:
            value = int(iteration_match.group(1))
            max_iter = value if max_iter is None else max(max_iter, value)

    termination_confirmed = "normal termination" in text.lower()
    if max_error is None:
        errors.append("no recognized Max WSE Error metric found")
    elif max_error > max_wse_error:
        errors.append(f"maximum WSE error {max_error:g} exceeds screening threshold {max_wse_error:g}")
    if max_iter is None:
        errors.append("no recognized iteration metric found")
    elif max_iter > max_iterations:
        errors.append(f"maximum iterations {max_iter} exceeds screening limit {max_iterations}")
    if warnings:
        errors.append(f"runtime log contains {warnings} warning line(s)")
    if instability:
        errors.append(f"runtime log contains {instability} numerical-instability marker(s)")
    if require_normal_termination and not termination_confirmed:
        errors.append("normal termination marker is missing")

    return ConvergenceReport(
        status="SCREENED_FOR_REVIEW" if not errors else "PIPELINE_LOCKED",
        log_path=str(path),
        lines_scanned=len(lines),
        max_wse_error=max_error,
        max_iterations=max_iter,
        warning_count=warnings,
        instability_count=instability,
        termination_confirmed=termination_confirmed,
        errors=tuple(dict.fromkeys(errors)),
    )
