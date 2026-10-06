from __future__ import annotations

import hashlib
import json
import struct
import subprocess
import sys
from pathlib import Path


VALIDATOR = Path(__file__).with_name("validate-building-3d-tiles.py")


def make_glb(path: Path) -> None:
    positions = [(0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)]
    normals = [(0.0, 0.0, 1.0)] * 3
    pos = b"".join(struct.pack("<3f", *v) for v in positions)
    nrm = b"".join(struct.pack("<3f", *v) for v in normals)
    binary = pos + nrm
    doc = {
        "asset": {"version": "2.0"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "mode": 4}]}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(pos)},
            {"buffer": 0, "byteOffset": len(pos), "byteLength": len(nrm)},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3"},
            {"bufferView": 1, "componentType": 5126, "count": 3, "type": "VEC3"},
        ],
    }
    raw = json.dumps(doc, separators=(",", ":")).encode()
    raw += b" " * ((4 - len(raw) % 4) % 4)
    binary += b"\0" * ((4 - len(binary) % 4) % 4)
    data = (
        struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(raw) + 8 + len(binary))
        + struct.pack("<I4s", len(raw), b"JSON") + raw
        + struct.pack("<I4s", len(binary), b"BIN\0") + binary
    )
    path.write_bytes(data)


def write_hashes(root: Path) -> None:
    paths = [root / "tileset.json", root / "manifest.json", *sorted(root.glob("*.glb"))]
    (root / "SHA256SUMS").write_text(
        "".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n" for p in paths)
    )


def make_tileset(tmp_path: Path) -> Path:
    root = tmp_path / "tiles"
    root.mkdir()
    make_glb(root / "building.glb")
    tileset = {
        "asset": {
            "version": "1.1",
            "extras": {"tsm": {"authorityClass": "DERIVED", "engineeringUse": False, "regulatoryUse": False}},
        },
        "geometricError": 1,
        "root": {
            "boundingVolume": {"box": [0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2]},
            "geometricError": 1,
            "refine": "REPLACE",
            "content": {"uri": "building.glb"},
            "extras": {"tsm": {"sourceObjectId": 1}},
        },
    }
    (root / "tileset.json").write_text(json.dumps(tileset))
    (root / "manifest.json").write_text(json.dumps({
        "authorityClass": "DERIVED",
        "engineeringUse": False,
        "regulatoryUse": False,
        "content": ["building.glb"],
    }))
    write_hashes(root)
    return root


def run_validator(root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(VALIDATOR), "--tileset", str(root / "tileset.json"), *args],
        text=True,
        capture_output=True,
        check=False,
    )


def test_validator_accepts_valid_artifact(tmp_path: Path) -> None:
    result = run_validator(make_tileset(tmp_path), "--expected-buildings", "1", "--expected-glbs", "1")
    assert result.returncode == 0, result.stderr


def test_validator_rejects_path_traversal(tmp_path: Path) -> None:
    root = make_tileset(tmp_path)
    tileset = json.loads((root / "tileset.json").read_text())
    tileset["root"]["content"]["uri"] = "../building.glb"
    (root / "tileset.json").write_text(json.dumps(tileset))
    write_hashes(root)
    result = run_validator(root)
    assert result.returncode != 0
    assert "unsafe" in result.stderr
