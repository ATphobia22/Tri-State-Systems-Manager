#!/usr/bin/env python3
"""Inspect actual HEC-RAS unsteady run artifacts without claiming simulation validity.

This reads local files and computes SHA-256 over actual bytes. It does not run
HEC-RAS, interpret hydraulic output, authenticate solver provenance, verify
model calibration, or grant professional/regulatory approval.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile

HDF5_MAGIC = b"\x89HDF\r\n\x1a\n"
HASH_CHUNK = 1024 * 1024
MAX_LOG_BYTES = 64 * 1024 * 1024
ROLES = {
    "project": re.compile(r"\.prj$", re.I),
    "plan": re.compile(r"\.p([0-9]{2})$", re.I),
    "geometry": re.compile(r"\.g[0-9]{2}$", re.I),
    "unsteady": re.compile(r"\.u[0-9]{2}$", re.I),
    "results": re.compile(r"\.p([0-9]{2})\.hdf$", re.I),
    "messages": re.compile(r"\.comp_msgs\.txt$", re.I),
}


def inspect_file(root: Path, path: Path, role: str) -> tuple[dict, list[str]]:
    flags: list[str] = []
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"{role.upper()}_NOT_REGULAR_FILE")
    resolved = path.resolve()
    try:
        resolved.relative_to(root.resolve())
    except ValueError as exc:
        raise ValueError(f"{role.upper()}_OUTSIDE_PROJECT_ROOT") from exc
    if not ROLES[role].search(path.name):
        raise ValueError(f"{role.upper()}_UNEXPECTED_EXTENSION")
    h = hashlib.sha256()
    n = 0
    with path.open("rb") as f:
        # The HDF5 format permits a userblock at byte 0, 512, 1024, ... .
        if role == "results":
            size = path.stat().st_size
            if not any(
                (f.seek(offset) or True) and f.read(len(HDF5_MAGIC)) == HDF5_MAGIC
                for offset in [0, 512, 1024, 2048, 4096, 8192, 16384, 32768]
                if offset + len(HDF5_MAGIC) <= size
            ):
                raise ValueError("RESULTS_MISSING_HDF5_SIGNATURE")
            f.seek(0)
        for chunk in iter(lambda: f.read(HASH_CHUNK), b""):
            n += len(chunk)
            if role == "messages" and n > MAX_LOG_BYTES:
                raise ValueError("COMPUTATIONAL_MESSAGES_EXCEED_LIMIT")
            h.update(chunk)
    if n == 0:
        raise ValueError(f"{role.upper()}_EMPTY")
    if role == "messages":
        body = path.read_text(encoding="utf8", errors="replace")
        # Not an assertion of successful convergence. These merely flag
        # potentially concerning log text for an engineer to review.
        for pattern, marker in (
            (r"\bunstable\b", "UNSTABLE_MENTIONED"),
            (r"\bcomputation terminated\b", "COMPUTATION_TERMINATED_MENTIONED"),
            (r"\bfailed\b", "FAILED_MENTIONED"),
            (r"\bwarning\b", "WARNING_MENTIONED"),
        ):
            if re.search(pattern, body, flags=re.I):
                flags.append(marker)
    return {"role": role, "filename": path.name, "sha256": h.hexdigest(), "size_bytes": n}, flags


def audit(root: Path, files: dict[str, Path]) -> dict:
    if not root.is_dir():
        raise ValueError("PROJECT_ROOT_NOT_DIRECTORY")
    if set(files) != set(ROLES):
        raise ValueError("REQUIRED_UNSTEADY_ARTIFACT_ROLES_MISSING")
    if len({path.resolve() for path in files.values()}) != len(files):
        raise ValueError("DUPLICATE_ARTIFACT_PATH")
    plan_match = ROLES["plan"].search(files["plan"].name)
    result_match = ROLES["results"].search(files["results"].name)
    if not plan_match or not result_match or plan_match.group(1) != result_match.group(1):
        raise ValueError("PLAN_RESULTS_NUMBER_MISMATCH")
    artifacts = []
    warnings = []
    for role in ROLES:
        rec, flags = inspect_file(root, files[role], role)
        artifacts.append(rec)
        warnings.extend(flags)
    return {
        "schema": "tsm.hec-ras-unsteady-artifact-audit.v1",
        "artifact_integrity": "SHA256_COMPUTED_FROM_BYTES",
        "inventory_complete": True,
        "hdf5_signature_found": True,
        "plan_result_number_consistent": True,
        "run_status": "ARTIFACTS_PRESENT_EXECUTION_UNAUTHENTICATED",
        "solver_run_authenticated": False,
        "solver_output_interpreted": False,
        "calibration_verified": False,
        "hydraulic_accuracy_certified": False,
        "regulatory_approval": False,
        "human_approval_verified": False,
        "message_flags_for_engineer_review": sorted(set(warnings)),
        "artifacts": artifacts,
        "note": "This is an integrity inventory, not proof of a completed/stable HEC-RAS run, calibrated water surfaces, or legal flood determination.",
    }


def write_receipt(path: Path, receipt: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tsm-hec-", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf8") as f:
            json.dump(receipt, f, sort_keys=True, separators=(",", ":"), allow_nan=False)
            f.write("\n")
        os.replace(tmp, path)
    finally:
        Path(tmp).unlink(missing_ok=True)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--project-root", required=True, type=Path)
    for key in ROLES:
        p.add_argument("--" + key, required=True, type=Path)
    p.add_argument("--receipt", required=True, type=Path)
    a = p.parse_args()
    files = {role: getattr(a, role) for role in ROLES}
    if any(a.receipt.resolve() == x.resolve() for x in files.values()):
        p.error("Receipt cannot overwrite a solver artifact")
    receipt = audit(a.project_root, files)
    write_receipt(a.receipt, receipt)
    print(json.dumps({"artifacts": len(receipt["artifacts"]),
                      "execution_authenticated": False,
                      "message_flags": receipt["message_flags_for_engineer_review"]}))


if __name__ == "__main__":
    main()
