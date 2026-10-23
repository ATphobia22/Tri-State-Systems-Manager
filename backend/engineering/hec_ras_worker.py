"""Isolated HEC-RAS worker boundary with deterministic package manifests.

The tree hash deliberately matches scripts/hydrology/hec_runtime_common.py:
UTF-16BE name ordering, POSIX relative paths, a NUL path separator, and raw
SHA-256 file digests. Symlinks and non-regular entries are rejected so a model
manifest cannot silently include files outside its declared package.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
from pathlib import Path
from typing import Sequence


def sha256_file(path: Path) -> str:
    """Hash file bytes without loading a large model file into memory."""
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _name_sort_key(path: Path) -> bytes:
    """Match the cross-platform UTF-16BE ordering used by the coupled runner."""
    return path.name.encode("utf-16-be", "surrogatepass")


def sha256_tree(root: Path) -> str:
    """Return the canonical SHA-256 for a directory tree, rejecting unsafe entries."""
    root = root.resolve(strict=True)
    if not root.is_dir():
        raise ValueError("Model package must be a directory")

    digest = hashlib.sha256()

    def walk(directory: Path, relative_root: str = "") -> None:
        for entry in sorted(directory.iterdir(), key=_name_sort_key):
            relative = f"{relative_root}/{entry.name}" if relative_root else entry.name
            if entry.is_symlink():
                raise ValueError(f"Model package contains a symbolic link: {relative}")
            if entry.is_dir():
                walk(entry, relative)
            elif entry.is_file():
                digest.update(relative.replace(os.sep, "/").encode("utf-8"))
                digest.update(b"\0")
                digest.update(bytes.fromhex(sha256_file(entry)))
            else:
                raise ValueError(f"Model package contains a non-regular entry: {relative}")

    walk(root)
    return digest.hexdigest()


def _paths_overlap(first: Path, second: Path) -> bool:
    """Return true when either resolved path is the same as or nested in the other."""
    return first == second or first in second.parents or second in first.parents


def run_worker(
    executable: Sequence[str],
    model_package: Path,
    output_directory: Path,
    *,
    timeout_seconds: int = 3600,
) -> dict[str, object]:
    """Execute an operator-provided worker without shell interpolation or stale outputs."""
    if (
        isinstance(executable, (str, bytes))
        or not executable
        or any(not isinstance(part, str) or not part.strip() for part in executable)
    ):
        raise ValueError("executable must be a non-empty sequence of non-blank strings")
    if (
        not isinstance(timeout_seconds, int)
        or isinstance(timeout_seconds, bool)
        or timeout_seconds < 1
        or timeout_seconds > 86_400
    ):
        raise ValueError("timeout_seconds must be an integer between 1 and 86400")

    package = model_package.resolve(strict=True)
    if not package.is_dir():
        raise ValueError("model_package must be a directory")

    output_directory.mkdir(parents=True, exist_ok=True)
    output = output_directory.resolve(strict=True)
    if not output.is_dir():
        raise ValueError("output_directory must be a directory")
    if _paths_overlap(package, output):
        raise ValueError("model_package and output_directory must be separate, non-nested directories")
    if any(output.iterdir()):
        raise ValueError("output_directory must be empty before worker execution")

    input_hash = sha256_tree(package)
    completed = subprocess.run(
        list(executable),
        cwd=package,
        check=False,
        shell=False,
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
        env={"PATH": os.environ.get("PATH", "")},
    )
    result_hash = sha256_tree(output) if any(output.iterdir()) else None
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
    """Write a machine-readable worker receipt."""
    path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
