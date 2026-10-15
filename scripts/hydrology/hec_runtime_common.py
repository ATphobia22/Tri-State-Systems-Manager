#!/usr/bin/env python3
"""Shared fail-closed helpers for the pinned HEC-HMS/HEC-RAS stage wrappers."""

from __future__ import annotations

import hashlib
import importlib.metadata
import json
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

HMS_PACKAGE_VERSION = "0.4.0"
HMS_PACKAGE_COMMIT = "1404fee5c81820764197f38923764f8c1d1b2fb7"
HMS_PACKAGE_URL = "https://github.com/ATphobia22/hms-commander.git"
RAS_PACKAGE_VERSION = "0.105.0"
RAS_PACKAGE_COMMIT = "574adbc725f9436a196698970febe39d98ef30c5"
RAS_PACKAGE_URL = "https://github.com/gpt-cmdr/ras-commander.git"
SHA256_PATTERN_LENGTH = 64


def sha256_file(path: Path) -> str:
    """Hash file bytes without loading a large model executable into memory."""
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_approved_manifest(path: Path) -> dict[str, Any]:
    """Load the v2 manifest and refuse direct execution of a draft manifest."""
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Cannot read manifest JSON: {exc}") from exc
    if not isinstance(manifest, dict) or manifest.get("schema_version") != "2.0.0":
        raise ValueError("A schema_version 2.0.0 manifest is required")
    approval = manifest.get("approval")
    if not isinstance(approval, dict) or approval.get("status") != "APPROVED":
        raise ValueError("Execution wrapper refuses a manifest without approval.status=APPROVED")
    source_commit = manifest.get("source_commit")
    if not isinstance(source_commit, str) or not re.fullmatch(r"[a-f0-9]{40}", source_commit) or source_commit == "0" * 40:
        raise ValueError("Manifest source_commit must be a real lowercase 40-character Git SHA")
    approval = manifest["approval"]
    if not isinstance(approval.get("approved_by"), str) or approval["approved_by"].strip().upper() in {"", "UNASSIGNED", "TBD"}:
        raise ValueError("Approval must identify an accountable approver")
    if not isinstance(approval.get("evidence_uri"), str) or approval["evidence_uri"].strip().upper() in {"", "UNASSIGNED", "TBD"}:
        raise ValueError("Approval evidence URI is required")
    if not isinstance(approval.get("approved_at"), str) or not approval["approved_at"].strip():
        raise ValueError("Approval timestamp is required")
    aoi = manifest.get("aoi")
    if not isinstance(aoi, dict):
        raise ValueError("Manifest AOI object is missing")
    for key in ("geometry_sha256", "watershed_delineation_sha256"):
        value = aoi.get(key)
        if not isinstance(value, str) or not re.fullmatch(r"[a-f0-9]{64}", value) or value == "0" * 64:
            raise ValueError(f"AOI {key} must be a measured nonzero SHA-256")
    for key in ("geometry_uri", "watershed_delineation_uri", "geometry_workspace_path", "watershed_delineation_workspace_path"):
        value = aoi.get(key)
        if not isinstance(value, str) or not value.strip() or value.strip().upper() in {"UNASSIGNED", "UNVERIFIED", "TBD"}:
            raise ValueError(f"AOI {key} must be explicitly assigned")
    reference_system = manifest.get("reference_system")
    if not isinstance(reference_system, dict):
        raise ValueError("Reference-system evidence is required")
    for key in ("horizontal_crs", "vertical_datum", "units_policy", "datum_evidence_uri"):
        value = reference_system.get(key)
        if not isinstance(value, str) or not value.strip() or value.strip().upper() in {"UNASSIGNED", "UNVERIFIED", "TBD"}:
            raise ValueError(f"Reference-system {key} must be qualified")
    source_inputs = manifest.get("source_inputs")
    if not isinstance(source_inputs, list) or not source_inputs:
        raise ValueError("At least one qualified source input is required")
    for index, item in enumerate(source_inputs):
        if not isinstance(item, dict) or item.get("quality_status") != "QUALIFIED":
            raise ValueError(f"Source input {index} is not qualified")
        for key in ("source_uri", "valid_time", "license_or_terms_uri", "units", "horizontal_crs", "vertical_datum"):
            value = item.get(key)
            if not isinstance(value, str) or not value.strip() or value.strip().upper() in {"UNASSIGNED", "UNVERIFIED", "TBD"}:
                raise ValueError(f"Source input {index} {key} must be qualified")
        digest = item.get("sha256")
        if not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest) or digest == "0" * 64:
            raise ValueError(f"Source input {index} sha256 must be measured")
    return manifest


def sha256_tree(root: Path) -> str:
    """Hash a project tree using the exact cross-language TSM manifest algorithm."""
    root = root.resolve(strict=True)
    if not root.is_dir():
        raise ValueError("Model project package must be a directory")
    digest = hashlib.sha256()

    def walk(directory: Path, relative_root: str = "") -> None:
        for entry in sorted(directory.iterdir(), key=lambda item: item.name.encode("utf-16-be", "surrogatepass")):
            relative = f"{relative_root}/{entry.name}" if relative_root else entry.name
            if entry.is_symlink():
                raise ValueError(f"Model project contains a symbolic link: {relative}")
            if entry.is_dir():
                walk(entry, relative)
            elif entry.is_file():
                digest.update(relative.encode("utf-8"))
                digest.update(bytes([0]))
                digest.update(bytes.fromhex(sha256_file(entry)))
            else:
                raise ValueError(f"Model project contains a non-regular entry: {relative}")

    walk(root)
    return digest.hexdigest()


def verify_project_package_hash(stage: dict[str, Any], project: Path) -> None:
    """Recheck the staged project bytes immediately before invoking HEC."""
    expected = stage.get("project_package_sha256")
    actual = sha256_tree(project)
    if expected != actual:
        raise ValueError(f"Staged project package hash mismatch: expected {expected}, observed {actual}")


def get_stage(manifest: dict[str, Any], stage_name: str) -> dict[str, Any]:
    stage = manifest.get(stage_name)
    if not isinstance(stage, dict):
        raise ValueError(f"Manifest stage {stage_name} is missing")
    for key in ("product_version", "platform", "version_evidence_uri", "project_directory", "output_directory"):
        value = stage.get(key)
        if not isinstance(value, str) or not value.strip() or value.strip().upper() in {"UNASSIGNED", "UNVERIFIED", "UNPINNED", "TBD"}:
            raise ValueError(f"{stage_name}.{key} must be explicitly pinned")
    for key in ("project_package_sha256", "executable_sha256", "runtime_executable_sha256"):
        value = stage.get(key)
        if not isinstance(value, str) or not re.fullmatch(r"[a-f0-9]{64}", value) or value == "0" * 64:
            raise ValueError(f"{stage_name}.{key} must be a measured nonzero SHA-256")
    expected_outputs = stage.get("expected_outputs")
    if not isinstance(expected_outputs, list) or not expected_outputs or any(not isinstance(item, str) or not item.strip() for item in expected_outputs):
        raise ValueError(f"{stage_name}.expected_outputs must list required output files")
    command = stage.get("command")
    if not isinstance(command, list) or not command or any(not isinstance(item, str) or not item for item in command):
        raise ValueError(f"{stage_name}.command must be an explicit argument array")
    return stage


def verify_stage_launcher(stage: dict[str, Any]) -> None:
    """Require the exact Python interpreter used to launch this wrapper."""
    command = stage.get("command")
    if not isinstance(command, list) or not command or not isinstance(command[0], str):
        raise ValueError("Stage command must begin with the pinned Python interpreter")
    configured = Path(command[0]).resolve(strict=True)
    current = Path(sys.executable).resolve(strict=True)
    if configured != current:
        raise ValueError(f"Stage Python interpreter mismatch: expected {configured}, running {current}")
    expected_hash = stage.get("executable_sha256")
    actual_hash = sha256_file(current)
    if expected_hash != actual_hash:
        raise ValueError(f"Stage Python interpreter hash mismatch: expected {expected_hash}, observed {actual_hash}")


def resolve_stage_paths(project_value: str, output_value: str, manifest_path: Path) -> tuple[Path, Path, Path]:
    """Resolve a staged project and output root; never permit in-place execution."""
    project = Path(project_value).resolve(strict=True)
    output = Path(output_value).resolve(strict=True)
    manifest = manifest_path.resolve(strict=True)
    if not project.is_dir() or not output.is_dir() or not manifest.is_file():
        raise ValueError("Project/output must be directories and manifest must be a file")

    def is_within(child: Path, parent: Path) -> bool:
        try:
            child.relative_to(parent)
            return True
        except ValueError:
            return False

    if project == output or is_within(project, output) or is_within(output, project):
        raise ValueError("Project and output paths must be separate, non-nested directories")
    output_project = output / "project-copy"
    if output_project.exists():
        raise FileExistsError(f"Refusing to overwrite prior stage output: {output_project}")
    return project, output, output_project


def verify_runtime_executable(stage: dict[str, Any]) -> Path:
    """Verify the exact HEC executable hash before handing control to a vendor library."""
    raw_path = stage.get("runtime_executable_path")
    expected_hash = stage.get("runtime_executable_sha256")
    if not isinstance(raw_path, str) or not raw_path:
        raise ValueError("runtime_executable_path must be an explicit absolute path")
    executable = Path(raw_path).resolve(strict=True)
    if not executable.is_file():
        raise ValueError("Configured HEC runtime executable is not a file")
    if not isinstance(expected_hash, str) or not re.fullmatch(r"[a-f0-9]{64}", expected_hash) or expected_hash == "0" * 64:
        raise ValueError("runtime_executable_sha256 must be a measured nonzero SHA-256")
    actual_hash = sha256_file(executable)
    if actual_hash != expected_hash:
        raise ValueError(f"HEC executable hash mismatch: expected {expected_hash}, observed {actual_hash}")
    return executable


def verify_pinned_distribution(name: str, expected_version: str, expected_commit: str, expected_url: str) -> None:
    """Require exact package version and PEP 610 VCS source commit provenance."""
    try:
        distribution = importlib.metadata.distribution(name)
        actual_version = distribution.version
        direct_url_text = distribution.read_text("direct_url.json")
    except importlib.metadata.PackageNotFoundError as exc:
        raise RuntimeError(f"Required package {name} is not installed") from exc
    if actual_version != expected_version:
        raise RuntimeError(f"{name} version mismatch: expected {expected_version}, observed {actual_version}")
    if not direct_url_text:
        raise RuntimeError(f"{name} lacks PEP 610 direct_url.json; install the pinned VCS source")
    try:
        direct_url = json.loads(direct_url_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"{name} has invalid direct_url.json") from exc
    vcs_info = direct_url.get("vcs_info", {})
    actual_commit = vcs_info.get("commit_id")
    actual_url = direct_url.get("url", "")
    expected_host_path = urlparse(expected_url)._replace(query="", fragment="").geturl().rstrip("/")
    actual_host_path = urlparse(actual_url)._replace(query="", fragment="").geturl().rstrip("/")
    if vcs_info.get("vcs") != "git" or actual_commit != expected_commit or actual_host_path != expected_host_path:
        raise RuntimeError(
            f"{name} source provenance mismatch: expected {expected_url}@{expected_commit}, "
            f"observed {actual_url}@{actual_commit}"
        )


def write_stage_receipt(output: Path, payload: dict[str, Any]) -> Path:
    """Write an immutable stage receipt; refuse to overwrite an existing receipt."""
    receipt_path = output / "hec-stage-receipt.json"
    with receipt_path.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(payload, stream, indent=2, sort_keys=True)
        stream.write("\n")
    return receipt_path
