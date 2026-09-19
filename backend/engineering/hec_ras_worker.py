"""Isolated HEC-RAS worker boundary.

This module never constructs a shell command. The operator supplies an executable
and immutable model package directory. Inputs and results are SHA-256 hashed so
a downstream evidence record can prove exactly what was executed.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
from pathlib import Path
from typing import Sequence


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_tree(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        digest.update(str(path.relative_to(root)).replace(os.sep, "/").encode())
        digest.update(bytes.fromhex(sha256_file(path)))
    return digest.hexdigest()


def run_worker(
    executable: Sequence[str],
    model_package: Path,
    output_directory: Path,
    *,
    timeout_seconds: int = 3600,
) -> dict[str, object]:
    """Execute an operator-provided HEC-RAS worker without shell interpolation."""
    if not executable or any(not isinstance(part, str) or not part for part in executable):
        raise ValueError("executable must be a non-empty sequence of strings")
    if not model_package.is_dir():
        raise ValueError("model_package must be a directory")
    if timeout_seconds <= 0 or timeout_seconds > 86_400:
        raise ValueError("timeout_seconds must be between 1 and 86400")
    output_directory.mkdir(parents=True, exist_ok=True)
    input_hash = sha256_tree(model_package)
    completed = subprocess.run(
        list(executable), cwd=model_package, check=False, shell=False,
        capture_output=True, text=True, timeout=timeout_seconds,
        env={"PATH": os.environ.get("PATH", "")},
    )
    result_hash = sha256_tree(output_directory) if any(output_directory.iterdir()) else None
    return {
        "return_code": completed.returncode,
        "input_manifest_sha256": input_hash,
        "result_sha256": result_hash,
        "stdout": completed.stdout[-8192:],
        "stderr": completed.stderr[-8192:],
        "validation_state": "unvalidated",
        "human_review_required": True,
    }


def write_result(path: Path, result: dict[str, object]) -> None:
    path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
