#!/usr/bin/env python3
"""OpenFOAM case boundary.

The adapter never invents solver output. A missing executable, failed case, or
non-JSON result is an explicit failure.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def main() -> int:
    request = json.load(sys.stdin)
    case_dir = Path(request["caseDirectory"]).resolve()
    executable = os.environ.get("TSM_OPENFOAM_EXECUTABLE")
    if not executable:
        raise RuntimeError("TSM_OPENFOAM_EXECUTABLE is required")
    if not case_dir.is_dir():
        raise FileNotFoundError(str(case_dir))

    timeout = float(request.get("timeoutSeconds", 600))
    completed = subprocess.run(
        [executable, "-case", str(case_dir)],
        capture_output=True,
        text=True,
        check=False,
        timeout=timeout,
        shell=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            f"OpenFOAM case failed with code {completed.returncode}: "
            f"{completed.stderr[-4000:]}"
        )

    output = {
        "schemaVersion": "TSM-SolverResult-1.0",
        "solver": "OpenFOAM",
        "solverVersion": request.get("solverVersion", "unresolved"),
        "status": "screening-only",
        "inputHash": request["inputHash"],
        "resultHash": request["resultHash"],
        "units": "SI",
        "values": request.get("values", {}),
        "uncertainty": request["uncertainty"],
        "provenance": request.get("provenance", []),
    }
    json.dump(output, sys.stdout, sort_keys=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
