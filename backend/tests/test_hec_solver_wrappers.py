from __future__ import annotations

import hashlib
import importlib.metadata
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "hydrology"))

from hec_runtime_common import (  # noqa: E402
    load_approved_manifest,
    resolve_stage_paths,
    sha256_file,
    verify_pinned_distribution,
    verify_runtime_executable,
    write_stage_receipt,
)


def qualified_manifest() -> dict[str, object]:
    digest = "a" * 64
    return {
        "schema_version": "2.0.0",
        "run_id": "test-run-001",
        "source_commit": "1" * 40,
        "approval": {"status": "APPROVED", "approved_by": "reviewer", "evidence_uri": "https://example.invalid/approval"},
        "aoi": {
            "geometry_sha256": digest,
            "watershed_delineation_sha256": "b" * 64,
            "geometry_uri": "https://example.invalid/aoi.geojson",
            "watershed_delineation_uri": "https://example.invalid/watershed.geojson",
            "geometry_workspace_path": "inputs/aoi.geojson",
            "watershed_delineation_workspace_path": "inputs/watershed.geojson",
        },
        "reference_system": {
            "horizontal_crs": "EPSG:26916",
            "vertical_datum": "NAVD88",
            "units_policy": "US customary; CFS/feet",
            "datum_evidence_uri": "https://example.invalid/datum",
        },
        "source_inputs": [{
            "quality_status": "QUALIFIED",
            "source_uri": "https://example.invalid/rainfall.csv",
            "valid_time": "2026-10-15T00:00:00Z",
            "license_or_terms_uri": "https://example.invalid/terms",
            "units": "inches per interval",
            "horizontal_crs": "EPSG:26916",
            "vertical_datum": "not-applicable",
            "sha256": "c" * 64,
        }],
    }


def test_draft_manifest_is_rejected_by_direct_stage_wrapper(tmp_path: Path) -> None:
    manifest = qualified_manifest()
    manifest["approval"] = {"status": "DRAFT"}
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="APPROVED"):
        load_approved_manifest(path)


def test_approved_manifest_requires_non_placeholder_watershed_hash(tmp_path: Path) -> None:
    manifest = qualified_manifest()
    manifest["aoi"]["watershed_delineation_sha256"] = "0" * 64  # type: ignore[index]
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="watershed_delineation_sha256"):
        load_approved_manifest(path)


def test_runtime_executable_hash_is_verified(tmp_path: Path) -> None:
    executable = tmp_path / "fake-hec.exe"
    executable.write_bytes(b"test executable bytes")
    expected = hashlib.sha256(executable.read_bytes()).hexdigest()
    stage = {"runtime_executable_path": str(executable), "runtime_executable_sha256": expected}
    assert verify_runtime_executable(stage) == executable.resolve()
    executable.write_bytes(b"modified executable bytes")
    with pytest.raises(ValueError, match="hash mismatch"):
        verify_runtime_executable(stage)


def test_source_and_output_project_must_be_isolated(tmp_path: Path) -> None:
    project = tmp_path / "project"
    output = project / "output"
    project.mkdir()
    output.mkdir()
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text("{}", encoding="utf-8")
    with pytest.raises(ValueError, match="separate"):
        resolve_stage_paths(str(project), str(output), manifest_path)


def test_pinned_distribution_requires_expected_vcs_commit(monkeypatch: pytest.MonkeyPatch) -> None:
    expected_url = "https://github.com/ATphobia22/hms-commander.git"
    expected_commit = "d" * 40

    class FakeDistribution:
        version = "0.4.0"

        @staticmethod
        def read_text(name: str) -> str:
            assert name == "direct_url.json"
            return json.dumps({
                "url": expected_url,
                "vcs_info": {"vcs": "git", "commit_id": expected_commit},
            })

    monkeypatch.setattr(importlib.metadata, "distribution", lambda _name: FakeDistribution())
    verify_pinned_distribution("hms-commander", "0.4.0", expected_commit, expected_url)
    with pytest.raises(RuntimeError, match="source provenance mismatch"):
        verify_pinned_distribution("hms-commander", "0.4.0", "e" * 40, expected_url)


def test_stage_receipt_is_immutable(tmp_path: Path) -> None:
    receipt = write_stage_receipt(tmp_path, {"stage": "hec_hms", "status": "COMPUTE_SUCCEEDED"})
    assert json.loads(receipt.read_text(encoding="utf-8"))["status"] == "COMPUTE_SUCCEEDED"
    with pytest.raises(FileExistsError):
        write_stage_receipt(tmp_path, {"stage": "hec_hms", "status": "OVERWRITTEN"})


def test_sha256_file_streams_exact_bytes(tmp_path: Path) -> None:
    path = tmp_path / "source.bin"
    path.write_bytes(b"source")
    assert sha256_file(path) == hashlib.sha256(b"source").hexdigest()


def test_stage_launcher_is_bound_to_exact_python_executable() -> None:
    from hec_runtime_common import verify_stage_launcher

    executable = Path(sys.executable).resolve()
    stage = {"command": [str(executable)], "executable_sha256": sha256_file(executable)}
    verify_stage_launcher(stage)
    stage["executable_sha256"] = "0" * 64
    with pytest.raises(ValueError, match="interpreter hash mismatch"):
        verify_stage_launcher(stage)


def test_project_tree_hash_is_deterministic_and_rejects_symlinks(tmp_path: Path) -> None:
    from hec_runtime_common import sha256_tree

    project = tmp_path / "project"
    nested = project / "nested"
    nested.mkdir(parents=True)
    (project / "a.txt").write_bytes(b"a")
    (nested / "b.txt").write_bytes(b"b")
    first = sha256_tree(project)
    assert first == sha256_tree(project)
    (nested / "b.txt").write_bytes(b"changed")
    assert sha256_tree(project) != first
    link = project / "symlink"
    try:
        link.symlink_to(nested / "b.txt")
    except (OSError, NotImplementedError):
        pytest.skip("Symlink creation is not available on this platform")
    with pytest.raises(ValueError, match="symbolic link"):
        sha256_tree(project)


def test_stage_output_directory_must_be_empty(tmp_path: Path) -> None:
    project = tmp_path / "project"
    output = tmp_path / "output"
    project.mkdir()
    output.mkdir()
    (output / "stale-output.bin").write_bytes(b"stale")
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text("{}", encoding="utf-8")
    with pytest.raises(ValueError, match="must be empty"):
        resolve_stage_paths(str(project), str(output), manifest_path)


def test_runtime_executable_path_must_be_absolute(tmp_path: Path) -> None:
    from hec_runtime_common import verify_runtime_executable

    with pytest.raises(ValueError, match="must be absolute"):
        verify_runtime_executable({"runtime_executable_path": "relative.exe", "runtime_executable_sha256": "a" * 64})


def test_installed_environment_fingerprint_is_stable_sha256() -> None:
    from hec_runtime_common import installed_environment_fingerprint

    first = installed_environment_fingerprint()
    second = installed_environment_fingerprint()
    assert len(first) == 64
    assert first == second
