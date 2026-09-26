"""Tests for tools/validation/verify_panel_hashes.py (no live DB required)."""
import hashlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verify_panel_hashes import sha256_file, verify_panel  # noqa: E402


class StubCursor:
    def __init__(self, row):
        self._row = row

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, *args, **kwargs):
        pass

    def fetchone(self):
        return self._row


class StubConn:
    def __init__(self, row=None, explode=False):
        self._row = row
        self._explode = explode

    def cursor(self):
        if self._explode:
            raise RuntimeError("connection lost")
        return StubCursor(self._row)


def test_sha256_file_matches_hashlib(tmp_path):
    target = tmp_path / "panel.tif"
    target.write_bytes(b"fake-panel-bytes-123")
    assert sha256_file(target) == hashlib.sha256(b"fake-panel-bytes-123").hexdigest()


def test_verified_when_hashes_match(tmp_path):
    target = tmp_path / "panel.tif"
    target.write_bytes(b"panel-data")
    digest = hashlib.sha256(b"panel-data").hexdigest()
    result = verify_panel("18129C0265C", target, StubConn(row=(digest,)))
    assert result["outcome"] == "verified"


def test_mismatch_when_hashes_differ(tmp_path):
    target = tmp_path / "panel.tif"
    target.write_bytes(b"panel-data")
    result = verify_panel("18129C0265C", target, StubConn(row=("0" * 64,)))
    assert result["outcome"] == "mismatch"


def test_unverifiable_when_no_log_row(tmp_path):
    target = tmp_path / "panel.tif"
    target.write_bytes(b"panel-data")
    result = verify_panel("18129C0265C", target, StubConn(row=None))
    assert result["outcome"] == "unverifiable"


def test_unverifiable_when_db_unreachable(tmp_path):
    target = tmp_path / "panel.tif"
    target.write_bytes(b"panel-data")
    result = verify_panel("18129C0265C", target, StubConn(explode=True))
    assert result["outcome"] == "unverifiable"


def test_unverifiable_when_file_missing(tmp_path):
    result = verify_panel("18129C0265C", tmp_path / "nope.tif", StubConn())
    assert result["outcome"] == "unverifiable"


def test_unverifiable_when_panel_id_bad(tmp_path):
    target = tmp_path / "panel.tif"
    target.write_bytes(b"x")
    result = verify_panel("", target, StubConn())
    assert result["outcome"] == "unverifiable"
