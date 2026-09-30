"""Controlled local execution boundary for HEC-RAS 6.x.

TSM never guesses an executable location and never labels an execution as
successful unless the process exits zero and the expected result artifact exists.
"""

from __future__ import annotations

import hashlib
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence


class ExecutionError(RuntimeError):
    """Raised when a hydraulic execution cannot be proven successful."""


@dataclass(frozen=True)
class ExecutionReceipt:
    command_sha256: str
    exit_code: int
    result_path: str
    stdout: str
    stderr: str


def _sha256_text(parts: Sequence[str]) -> str:
    return hashlib.sha256("\0".join(parts).encode("utf-8")).hexdigest()


def execute_hec_ras(
    executable: str,
    project: str,
    *,
    working_directory: str | None = None,
    timeout_seconds: int = 3600,
) -> ExecutionReceipt:
    if os.name != "nt":
        # The command-line path is retained for future HEC-RAS 2025/container
        # execution. HEC-RAS 6.x GUI/COM installations are Windows-only.
        raise ExecutionError("HEC-RAS 6.x execution requires a Windows installation")

    exe = Path(executable)
    prj = Path(project)
    if not exe.is_file():
        raise ExecutionError(f"HEC-RAS executable not found: {exe}")
    if not prj.is_file() or prj.suffix.lower() != ".prj":
        raise ExecutionError(f"HEC-RAS project file not found or invalid: {prj}")

    command = [str(exe), str(prj)]
    command_hash = _sha256_text(command)
    try:
        completed = subprocess.run(
            command,
            cwd=working_directory,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise ExecutionError("HEC-RAS execution timed out") from exc

    if completed.returncode != 0:
        raise ExecutionError(
            f"HEC-RAS failed with exit code {completed.returncode}: {completed.stderr[-2000:]}"
        )

    candidates = sorted(prj.parent.glob(f"{prj.stem}.p*.hdf"))
    if not candidates:
        raise ExecutionError("HEC-RAS exited successfully but produced no .p*.hdf result artifact")

    result = candidates[-1]
    return ExecutionReceipt(
        command_sha256=command_hash,
        exit_code=completed.returncode,
        result_path=str(result),
        stdout=completed.stdout,
        stderr=completed.stderr,
    )
