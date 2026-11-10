"""HEC-RAS project artifact integrity receipt tests; no fake solver-run approvals."""
from __future__ import annotations

import hashlib
import importlib.util
from pathlib import Path
import pytest

TARGET = Path(__file__).resolve().parents[2] / "scripts/geospatial/audit_hec_ras_unsteady_artifacts.py"
SPEC = importlib.util.spec_from_file_location("hec_artifact_audit", TARGET)
assert SPEC and SPEC.loader
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


def fixture_files(tmp_path: Path) -> dict[str, Path]:
    payloads = {
        "project": ("Model.prj", b"Proj Title=Fixture\n"),
        "plan": ("Model.p01", b"Plan Title=Test only\n"),
        "geometry": ("Model.g01", b"Geom Title=Test only\n"),
        "unsteady": ("Model.u01", b"Flow Title=Test only\n"),
        "results": ("Model.p01.hdf", mod.HDF5_MAGIC + b"not a valid real HDF5 dataset"),
        "messages": ("Model.p01.comp_msgs.txt", b"Computation Warning: fixture\n"),
    }
    out = {}
    for role, (filename, data) in payloads.items():
        p = tmp_path / filename
        p.write_bytes(data)
        out[role] = p
    return out


def test_artifact_inventory_checks_real_bytes_but_not_authenticity(tmp_path):
    paths = fixture_files(tmp_path)
    out = mod.audit(tmp_path, paths)
    assert out["inventory_complete"] is True
    assert out["solver_run_authenticated"] is False
    assert out["calibration_verified"] is False
    assert out["regulatory_approval"] is False
    assert out["message_flags_for_engineer_review"] == ["WARNING_MENTIONED"]
    assert out["run_status"] == "ARTIFACTS_PRESENT_EXECUTION_UNAUTHENTICATED"
    by_role = {rec["role"]: rec for rec in out["artifacts"]}
    assert by_role["results"]["sha256"] == hashlib.sha256(paths["results"].read_bytes()).hexdigest()


def test_bad_hdf_signature_is_blocked(tmp_path):
    files = fixture_files(tmp_path)
    files["results"].write_bytes(b"not_hdf5")
    with pytest.raises(ValueError, match="HDF5_SIGNATURE"):
        mod.audit(tmp_path, files)


def test_plan_number_must_match_results_file(tmp_path):
    files = fixture_files(tmp_path)
    other = tmp_path / "Model.p02.hdf"
    other.write_bytes(files["results"].read_bytes())
    files["results"] = other
    with pytest.raises(ValueError, match="PLAN_RESULTS_NUMBER_MISMATCH"):
        mod.audit(tmp_path, files)


def test_missing_unsteady_flow_is_rejected(tmp_path):
    files = fixture_files(tmp_path)
    files.pop("unsteady")
    with pytest.raises(ValueError, match="ROLES_MISSING"):
        mod.audit(tmp_path, files)


def test_bad_steady_flow_substitution_rejected(tmp_path):
    files = fixture_files(tmp_path)
    new = tmp_path / "Model.f01"
    new.write_bytes(files["unsteady"].read_bytes())
    files["unsteady"] = new
    with pytest.raises(ValueError, match="UNSTEADY_UNEXPECTED_EXTENSION"):
        mod.audit(tmp_path, files)


def test_external_artifact_path_is_rejected(tmp_path):
    root = tmp_path / "model"
    root.mkdir()
    files = fixture_files(root)
    ext = tmp_path / "other.g01"
    ext.write_bytes(b"geom")
    files["geometry"] = ext
    with pytest.raises(ValueError, match="GEOMETRY_OUTSIDE_PROJECT_ROOT"):
        mod.audit(root, files)


def test_empty_log_is_rejected(tmp_path):
    files = fixture_files(tmp_path)
    files["messages"].write_bytes(b"")
    with pytest.raises(ValueError, match="MESSAGES_EMPTY"):
        mod.audit(tmp_path, files)


def test_hdf5_userblock_signature_supported(tmp_path):
    files = fixture_files(tmp_path)
    files["results"].write_bytes(b"\x00" * 512 + mod.HDF5_MAGIC + b"\x00" * 50)
    receipt = mod.audit(tmp_path, files)
    assert receipt["hdf5_signature_found"] is True
    assert receipt["solver_output_interpreted"] is False
