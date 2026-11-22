"""Regression: metadata-only CityGML imports are not renderable OGC 3D Tiles."""
import importlib.util
import json
from pathlib import Path
import pytest

CONVERTER = Path(__file__).resolve().parents[2] / "scripts/geospatial/citygml_to_3dtiles.py"
spec = importlib.util.spec_from_file_location("citygml_staging", CONVERTER)
module = importlib.util.module_from_spec(spec)
import sys
sys.modules[spec.name] = module
spec.loader.exec_module(module)


def test_staging_never_emits_counterfeit_tileset(tmp_path):
    building = module.Space(gml_id="test-building-001", space_type="Building")
    module.write_tileset([building], tmp_path)
    assert not (tmp_path / "tileset.json").exists()
    assert not list(tmp_path.glob("*.glb"))
    candidate = json.loads((tmp_path / "citygml-features.candidate.json").read_text())
    assert candidate["renderable"] is False
    assert candidate["valid3DTiles"] is False
    assert candidate["featureCount"] == 1
    assert "GLB_GEOMETRY_NOT_GENERATED" in candidate["blockers"]
    assert candidate["features"][0]["id"] == "test-building-001"


def test_existing_tileset_is_not_removed_or_misrepresented(tmp_path):
    old = tmp_path / "tileset.json"
    old.write_bytes(b"immutable old production asset")
    with pytest.raises(ValueError, match="tileset.json"):
        module.write_tileset([], tmp_path)
    assert old.read_bytes() == b"immutable old production asset"
    assert not (tmp_path / "citygml-features.candidate.json").exists()


def test_staging_never_silently_overwrites_previous_candidate(tmp_path):
    module.write_tileset([], tmp_path)
    with pytest.raises(FileExistsError):
        module.write_tileset([], tmp_path)
