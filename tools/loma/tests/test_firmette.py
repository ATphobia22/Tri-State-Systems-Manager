"""Tests for tools/loma/firmette.py — offline fail-closed paths only.

No network calls are made by these tests: every generation uses
base_map_mode="offline".
"""

import hashlib
import importlib.util
import json
from pathlib import Path

import pytest

FIRMETTE_PATH = Path(__file__).resolve().parent.parent / "firmette.py"


def load_firmette():
    spec = importlib.util.spec_from_file_location("firmette", FIRMETTE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


firmette = load_firmette()

POLYGON = [
    [-87.912, 38.012],
    [-87.905, 38.012],
    [-87.905, 38.018],
    [-87.912, 38.018],
]
PARCEL_ID = "TEST-PARCEL-001"
ADDRESS = "123 Test Lane, Posey County, IN"
BFE = 375.0


def make_package(tmp_path, **overrides):
    kwargs = dict(
        polygon=POLYGON,
        parcel_id=PARCEL_ID,
        address=ADDRESS,
        bfe_ft=BFE,
        owner_label="Test Owner",
        annotation="Test annotation for the parcel.",
        output_dir=tmp_path,
        base_map_mode="offline",
    )
    kwargs.update(overrides)
    return firmette.generate_firmette(**kwargs)


def read_document(result):
    return Path(result["document"]).read_text(encoding="utf-8")


def test_offline_package_has_unavailable_base_map_watermark(tmp_path):
    # Text assertions run against the HTML renderer (the PDF renderer emits
    # binary; PDF validity is covered by test_pdf_renderer_produces_valid_pdf).
    result = make_package(tmp_path, renderer="html")
    assert result["base_map_available"] is False
    document = read_document(result)
    assert firmette.BASE_MAP_UNAVAILABLE_MARK in document
    manifest = json.loads(Path(result["manifest_path"]).read_text(encoding="utf-8"))
    assert manifest["provenance"]["base_map"] == "placeholder_offline"


def test_manifest_sha256_values_verify_against_actual_files(tmp_path):
    result = make_package(tmp_path)
    manifest = json.loads(Path(result["manifest_path"]).read_text(encoding="utf-8"))
    assert manifest["artifacts"], "manifest must list at least one artifact"
    out = Path(result["output_dir"])
    for item in manifest["artifacts"]:
        path = out / item["path"]
        assert path.is_file(), f"artifact missing: {item['path']}"
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        assert digest.hexdigest() == item["sha256"], f"sha256 mismatch: {item['path']}"
        assert item["bytes"] == path.stat().st_size


def test_annotations_present_in_output(tmp_path):
    result = make_package(tmp_path, renderer="html")
    document = read_document(result)
    assert ADDRESS in document
    assert "375" in document and "NAVD88" in document
    assert PARCEL_ID in document
    assert "Test Owner" in document
    assert "Test annotation for the parcel." in document


def test_renderer_recorded_in_manifest(tmp_path):
    result = make_package(tmp_path)
    manifest = json.loads(Path(result["manifest_path"]).read_text(encoding="utf-8"))
    renderer = manifest["provenance"]["renderer"]
    assert renderer in ("reportlab_pdf", "html_fallback")
    if importlib.util.find_spec("reportlab") is None:
        assert renderer == "html_fallback"
        assert result["document"].endswith(".html")


@pytest.mark.parametrize(
    "polygon",
    [
        [[-87.9, 38.0], [-87.89, 38.0]],  # fewer than 3 points
        [],  # empty
        [[-87.9, 38.0], [-87.89, 38.0], [float("nan"), 38.01]],  # NaN lon
        [[-87.9, 38.0], [-87.89, float("inf")], [-87.89, 38.01]],  # inf lat
        [[-87.9, 38.0], [-87.89], [-87.89, 38.01]],  # malformed point
    ],
)
def test_invalid_polygons_raise(tmp_path, polygon):
    with pytest.raises(ValueError):
        make_package(tmp_path, polygon=polygon)


@pytest.mark.parametrize(
    "kwargs",
    [
        {"parcel_id": ""},
        {"parcel_id": "   "},
        {"address": ""},
        {"address": None},
        {"bfe_ft": None},
        {"bfe_ft": "375"},
        {"bfe_ft": float("nan")},
    ],
)
def test_missing_or_invalid_required_inputs_raise(tmp_path, kwargs):
    with pytest.raises(ValueError):
        make_package(tmp_path, **kwargs)


@pytest.mark.skipif(
    importlib.util.find_spec("reportlab") is None, reason="reportlab not installed"
)
def test_pdf_renderer_produces_valid_pdf(tmp_path):
    result = make_package(tmp_path, renderer="pdf")
    assert result["document"].endswith(".pdf")
    pdf_path = Path(result["document"])
    assert pdf_path.read_bytes()[:5] == b"%PDF-"
    manifest = json.loads(Path(result["manifest_path"]).read_text(encoding="utf-8"))
    assert manifest["provenance"]["renderer"] == "reportlab_pdf"
    assert any(item["path"].endswith(".pdf") for item in manifest["artifacts"])


def test_no_determination_claims(tmp_path):
    result = make_package(tmp_path, renderer="html")
    manifest = json.loads(Path(result["manifest_path"]).read_text(encoding="utf-8"))
    assert manifest["regulatory_determination"] is False
    assert manifest["package_status"] == "DRAFT_ANNOTATION_HUMAN_REVIEW_REQUIRED"
    document = read_document(result)
    assert "not a FEMA determination" in document
