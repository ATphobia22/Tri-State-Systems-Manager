import json
import pytest

h5py = pytest.importorskip("h5py")
np = pytest.importorskip("numpy")

from tsm_runtime.hec_ras_hdf5_extractor import extract_wse_records


def test_extracts_final_timestep_read_only(tmp_path):
    source = tmp_path / "result.hdf"
    target = tmp_path / "out.json"
    with h5py.File(source, "w") as h5:
        h5.create_dataset("Results/WSE", data=[[374.2, -9999.0], [375.5, 376.2]])
        h5.create_dataset("Geometry/CellCenters", data=[[451200.0, 3811000.0], [451250.0, 3811050.0]])
    result = extract_wse_records(
        source, target,
        water_surface_dataset="Results/WSE",
        cell_center_dataset="Geometry/CellCenters",
    )
    assert result["status"] == "EXTRACTED_FOR_REVIEW"
    payload = json.loads(target.read_text(encoding="utf-8"))
    assert payload["spatial_wse_records"][0]["final_wse"] == 375.5
    assert len(payload["spatial_wse_records"]) == 2


def test_missing_dataset_blocks(tmp_path):
    source = tmp_path / "result.hdf"
    with h5py.File(source, "w") as h5:
        h5.create_dataset("Results/WSE", data=[[1.0]])
    result = extract_wse_records(
        source, tmp_path / "out.json",
        water_surface_dataset="Results/WSE",
        cell_center_dataset="Geometry/CellCenters",
    )
    assert result["status"] == "EXTRACTION_BLOCKED"
