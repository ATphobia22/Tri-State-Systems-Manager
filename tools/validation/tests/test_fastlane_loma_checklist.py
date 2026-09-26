"""Tests for tools/validation/fastlane_loma_checklist.py."""

import hashlib
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastlane_loma_checklist import run_checklist  # noqa: E402


def make_package(tmp_path: Path, *, expired_cert=False, tampered_original=False,
                 drop_item: str | None = None) -> Path:
    pkg = tmp_path / "case-pkg"
    pkg.mkdir()
    original = b"original fema pdf bytes"
    if tampered_original:
        original = b"tampered bytes"
    (pkg / "26-05-2022A-092226.pdf").write_bytes(original)
    control = hashlib.sha256(b"original fema pdf bytes").hexdigest()
    for name in ("deed.pdf", "assessor-map.pdf", "elev-cert.pdf", "fema-confirmation.pdf"):
        (pkg / name).write_bytes(b"%s content" % name.encode())
    items = {
        "deed_plat": {"file": "deed.pdf"},
        "assessor_map": {"file": "assessor-map.pdf"},
        "elevation_doc": {
            "file": "elev-cert.pdf",
            "certified_by": "PE",
            "expires": "2020-01-01" if expired_cert else "2030-01-01",
        },
        "fema_form_confirmation": {"file": "fema-confirmation.pdf"},
        "original_fema_pdf": {"file": "26-05-2022A-092226.pdf"},
    }
    if drop_item:
        del items[drop_item]
    manifest = {
        "case_id": "26-05-2022A",
        "fema_letter_date": "2026-09-22",
        "response_deadline": "2026-12-21",
        "control_sha256": control,
        "items": items,
    }
    (pkg / "case.json").write_text(json.dumps(manifest))
    return pkg


def test_ready_package_verdict_ready():
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        pkg = make_package(Path(tmp))
        result = run_checklist(pkg, date(2026, 9, 26))
        assert result["verdict"] == "READY"
        assert all(i["status"] == "PASS" for i in result["items"])
        assert result["deadline"]["days_remaining"] == 86
        assert result["deadline"]["track_status"] == "OPEN"


def test_missing_item_yields_not_ready():
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        pkg = make_package(Path(tmp), drop_item="deed_plat")
        result = run_checklist(pkg, date(2026, 9, 26))
        assert result["verdict"] == "NOT_READY"
        deed = next(i for i in result["items"] if i["key"] == "deed_plat")
        assert deed["status"] == "MISSING"


def test_expired_certification_fails():
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        pkg = make_package(Path(tmp), expired_cert=True)
        result = run_checklist(pkg, date(2026, 9, 26))
        assert result["verdict"] == "NOT_READY"
        elev = next(i for i in result["items"] if i["key"] == "elevation_doc")
        assert elev["status"] == "FAIL"
        assert "expired" in elev["detail"]


def test_tampered_original_pdf_fails():
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        pkg = make_package(Path(tmp), tampered_original=True)
        result = run_checklist(pkg, date(2026, 9, 26))
        assert result["verdict"] == "NOT_READY"
        orig = next(i for i in result["items"] if i["key"] == "original_fema_pdf")
        assert orig["status"] == "FAIL"
        assert "control hash" in orig["detail"]


def test_expired_deadline_track_status():
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        pkg = make_package(Path(tmp))
        result = run_checklist(pkg, date(2027, 1, 5))
        assert result["deadline"]["track_status"] == "EXPIRED"
        assert result["deadline"]["days_remaining"] < 0


def test_missing_case_json_not_ready():
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        result = run_checklist(Path(tmp), date(2026, 9, 26))
        assert result["verdict"] == "NOT_READY"
        assert "case.json" in result["error"]
