"""Synthetic tests for the non-certifying Posey DEM evidence gate."""
from pathlib import Path
import importlib.util
import numpy as np
import rasterio
from rasterio.transform import from_origin

source = Path(__file__).with_name("verify_posey_dem_gate.py")
spec = importlib.util.spec_from_file_location("verify_posey_dem_gate", source)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def make_raster(path, epsg):
    with rasterio.open(path, "w", driver="GTiff", width=2, height=2,
                       count=1, dtype="float32", crs=f"EPSG:{epsg}",
                       transform=from_origin(2670000, 935000, 2.5, 2.5)) as dataset:
        dataset.write(np.ones((2, 2), dtype="float32"), 1)


def test_good_source_still_not_navd88_certified(tmp_path):
    path = tmp_path / "tile.tiff"
    make_raster(path, 2968)
    result = gate.inspect([path], {path.name: gate.sha256(path)})
    assert result["all_source_integrity_pass"]
    assert not result["safe_for_navd88_engineering"]
    assert not result["rasters"][0]["vertical_datum_verified"]


def test_wrong_hash_blocks(tmp_path):
    path = tmp_path / "tile.tiff"
    make_raster(path, 2968)
    assert not gate.inspect([path], {path.name: "0" * 64})["all_source_integrity_pass"]


def test_wrong_crs_blocks(tmp_path):
    path = tmp_path / "tile.tiff"
    make_raster(path, 2966)
    assert not gate.inspect([path], {path.name: gate.sha256(path)})["all_source_integrity_pass"]


def test_missing_pin_blocks(tmp_path):
    path = tmp_path / "tile.tiff"
    make_raster(path, 2968)
    assert not gate.inspect([path], {})["all_source_integrity_pass"]
