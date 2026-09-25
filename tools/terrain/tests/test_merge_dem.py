"""Tests for tools/terrain/merge-dem.py.

All tests run in --dry-run mode: synthetic local tiles, zero network access,
zero GDAL dependency. Nothing here touches the network or requires osgeo.
"""
from __future__ import annotations

import importlib.util
import json
import socket
import subprocess
import sys
import urllib.request
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "tools" / "terrain" / "merge-dem.py"
BBOX = ["-87.6", "37.9", "-87.5", "38.0"]


def _load_module():
    spec = importlib.util.spec_from_file_location("merge_dem", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run_dry_run(tmp_path: Path, *extra: str) -> subprocess.CompletedProcess:
    out = tmp_path / "merged.tif"
    workdir = tmp_path / "work"
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--bbox", *BBOX,
         "--out", str(out), "--workdir", str(workdir), "--dry-run", *extra],
        capture_output=True, text=True, timeout=120,
    )


def _manifest(tmp_path: Path) -> dict:
    return json.loads((tmp_path / "work" / "manifest.json").read_text())


# ---------------------------------------------------------------------------
# Manifest structure
# ---------------------------------------------------------------------------

def test_dry_run_manifest_structure(tmp_path):
    proc = _run_dry_run(tmp_path)
    assert proc.returncode == 0, proc.stderr

    manifest = _manifest(tmp_path)
    assert manifest["manifest_version"] == 1
    assert manifest["dry_run"] is True
    assert manifest["bbox"] == [-87.6, 37.9, -87.5, 38.0]
    assert manifest["bbox_crs"] == "EPSG:4326"
    assert manifest["target_crs"] == "EPSG:2966"

    tiles = manifest["tiles"]
    assert len(tiles) == 4  # deterministic 2x2 dry-run grid
    for tile in tiles:
        assert tile["tile_id"]
        assert tile["source_url"].startswith("dry-run://")
        assert tile["fetched_at"]
        assert tile["status"] == "fetched"
        assert tile["bytes"] > 0
        local = Path(tile["local_path"])
        assert local.exists()
        # recorded hash matches the bytes on disk
        import hashlib
        assert tile["sha256"] == hashlib.sha256(local.read_bytes()).hexdigest()

    merge = manifest["merge"]
    assert merge["executed"] is False  # dry-run never executes GDAL
    assert merge["output"].endswith("merged.tif")
    assert len(merge["inputs"]) == 4
    assert "EPSG:2966" in merge["gdal_args"]


def test_tile_ids_are_unique(tmp_path):
    _run_dry_run(tmp_path)
    tiles = _manifest(tmp_path)["tiles"]
    ids = [t["tile_id"] for t in tiles]
    assert len(ids) == len(set(ids))


# ---------------------------------------------------------------------------
# Resume behavior
# ---------------------------------------------------------------------------

def test_resume_second_run_skips_existing_tiles(tmp_path):
    first = _run_dry_run(tmp_path)
    assert first.returncode == 0, first.stderr
    mtimes = {p.name: p.stat().st_mtime
              for p in (tmp_path / "work" / "tiles").iterdir()}

    second = _run_dry_run(tmp_path)
    assert second.returncode == 0, second.stderr

    manifest = _manifest(tmp_path)
    statuses = [t["tile_id"] for t in manifest["tiles"]]
    assert statuses  # entries preserved
    assert all(t["status"] == "skipped" for t in manifest["tiles"])
    for p in (tmp_path / "work" / "tiles").iterdir():
        assert p.stat().st_mtime == mtimes[p.name], "skipped tile was rewritten"
    assert "skipped" in second.stdout


def test_checksum_mismatch_triggers_refetch(tmp_path):
    assert _run_dry_run(tmp_path).returncode == 0
    tiles_dir = tmp_path / "work" / "tiles"
    victim = sorted(tiles_dir.iterdir())[0]
    victim.write_bytes(b"tampered-by-test")  # corrupt on disk; hash now mismatches

    proc = _run_dry_run(tmp_path)
    assert proc.returncode == 0, proc.stderr

    manifest = _manifest(tmp_path)
    by_id = {t["tile_id"]: t for t in manifest["tiles"]}
    refetched = [t for t in manifest["tiles"] if t["status"] == "refetched"]
    assert len(refetched) == 1
    assert refetched[0]["tile_id"] == victim.stem
    # manifest hash again matches the (restored) bytes on disk
    import hashlib
    assert by_id[victim.stem]["sha256"] == hashlib.sha256(victim.read_bytes()).hexdigest()
    assert victim.read_bytes().startswith(b"TSM-DRYRUN-TILE")


# ---------------------------------------------------------------------------
# Fail-closed validation
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("bbox", [
    ["-87.5", "37.9", "-87.6", "38.0"],   # minlon > maxlon
    ["-87.6", "38.0", "-87.5", "37.9"],   # minlat > maxlat
    ["-200", "37.9", "-87.5", "38.0"],    # longitude out of range
    ["-87.6", "-95", "-87.5", "38.0"],    # latitude out of range
    ["abc", "37.9", "-87.5", "38.0"],     # non-numeric
])
def test_invalid_bbox_rejected(tmp_path, bbox):
    out = tmp_path / "merged.tif"
    workdir = tmp_path / "work"
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--bbox", *bbox,
         "--out", str(out), "--workdir", str(workdir), "--dry-run"],
        capture_output=True, text=True, timeout=120,
    )
    assert proc.returncode == 2
    assert "error:" in proc.stderr
    # no partial manifest committed
    assert not (workdir / "manifest.json").exists()


def test_unwritable_out_path_rejected(tmp_path):
    out = tmp_path / "no-such-dir" / "merged.tif"  # parent does not exist
    workdir = tmp_path / "work"
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--bbox", *BBOX,
         "--out", str(out), "--workdir", str(workdir), "--dry-run"],
        capture_output=True, text=True, timeout=120,
    )
    assert proc.returncode == 2
    assert "error:" in proc.stderr
    assert not (workdir / "manifest.json").exists()


def test_corrupt_manifest_fails_closed(tmp_path):
    assert _run_dry_run(tmp_path).returncode == 0
    (tmp_path / "work" / "manifest.json").write_text("{not valid json")
    proc = _run_dry_run(tmp_path)
    assert proc.returncode == 2
    assert "error:" in proc.stderr


# ---------------------------------------------------------------------------
# No network access in dry-run
# ---------------------------------------------------------------------------

def test_dry_run_touches_no_network(tmp_path):
    """Block every network path in-process, then run the pipeline in-process."""
    module = _load_module()

    def _blocked(*args, **kwargs):
        raise AssertionError("network access attempted during dry-run")

    real_socket = socket.socket
    real_urlopen = urllib.request.urlopen
    socket.socket = _blocked  # type: ignore[assignment]
    urllib.request.urlopen = _blocked  # type: ignore[assignment]
    try:
        out = tmp_path / "merged.tif"
        workdir = tmp_path / "work"
        rc = module.main(["--bbox", *BBOX, "--out", str(out),
                          "--workdir", str(workdir), "--dry-run"])
    finally:
        socket.socket = real_socket  # type: ignore[assignment]
        urllib.request.urlopen = real_urlopen
    assert rc == 0
    assert (workdir / "manifest.json").exists()


def test_dry_run_needs_no_gdal(tmp_path, monkeypatch):
    """Prove dry-run never needs the GDAL Python bindings: block osgeo and
    run the full pipeline in-process."""
    import builtins
    real_import = builtins.__import__

    def _blocked_import(name, *args, **kwargs):
        if name == "osgeo" or name.startswith("osgeo."):
            raise ImportError("blocked for test")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", _blocked_import)
    module = _load_module()
    assert module.detect_gdal_backend() in (None, "gdalwarp")
    rc = module.main(["--bbox", *BBOX, "--out", str(tmp_path / "merged.tif"),
                      "--workdir", str(tmp_path / "work"), "--dry-run"])
    assert rc == 0
    manifest = json.loads((tmp_path / "work" / "manifest.json").read_text())
    assert manifest["merge"]["executed"] is False
