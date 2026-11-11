#!/usr/bin/env python3
"""Fail-fast offline TSMData scene and hydraulic playback validation (stdlib only)."""
import argparse
import hashlib
import json
import math
from pathlib import Path

def within(root, value):
    path = (root / value).resolve()
    if not path.is_relative_to(root.resolve()) or not path.is_file():
        raise ValueError(f"Missing or escaping local file: {value}")
    return path

def validate(root, manifest):
    root = root.resolve()
    data = json.loads(manifest.read_text(encoding="utf-8"))
    if data.get("schema") != "tsm.offline.scene.v1":
        raise ValueError("Unexpected manifest schema")
    if data.get("vertical_datum") != "NAVD88":
        raise ValueError("Verified NAVD88 vertical datum required")
    if data.get("horizontal_crs") != "EPSG:2966":
        raise ValueError("Expected local CRS EPSG:2966; transform upstream explicitly")
    if data.get("elevation_units") not in ("ftUS", "m"):
        raise ValueError("Explicit elevation units required")
    assets = data.get("assets")
    if not isinstance(assets, list) or not assets:
        raise ValueError("Nonempty asset inventory required")
    kinds = set()
    for asset in assets:
        kind = asset.get("kind")
        if kind not in ("terrain", "buildings", "hydraulic_frame"):
            raise ValueError(f"Unknown asset kind: {kind}")
        kinds.add(kind)
        path = within(root, asset["path"])
        expected = asset.get("sha256", "")
        if len(expected) != 64 or any(c not in "0123456789abcdef" for c in expected):
            raise ValueError(f"Invalid SHA256: {path}")
        h = hashlib.sha256()
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                h.update(chunk)
        if h.hexdigest() != expected:
            raise ValueError(f"Checksum mismatch: {path}")
        if kind == "hydraulic_frame":
            if asset.get("quantity") not in ("depth", "water_surface_elevation", "velocity"):
                raise ValueError("Hydraulic quantity missing/invalid")
            if not isinstance(asset.get("time_utc"), str) or not asset["time_utc"].endswith("Z"):
                raise ValueError("Hydraulic frame requires UTC timestamp")
            if not asset.get("model_id") or not asset.get("nodata"):
                raise ValueError("Hydraulic frame requires model ID and explicit NoData")
            if asset.get("units") not in ("ftUS", "m", "ftUS/s", "m/s"):
                raise ValueError("Hydraulic frame units invalid")
    if not {"terrain", "buildings"}.issubset(kinds):
        raise ValueError("Terrain and buildings required before scene promotion")
    frames = [a for a in assets if a["kind"] == "hydraulic_frame"]
    if frames and [a["time_utc"] for a in frames] != sorted(a["time_utc"] for a in frames):
        raise ValueError("Hydraulic frames must be in chronological order")
    return {"status": "PASS_HEADLESS_ASSET_INTEGRITY_ONLY", "assets": len(assets),
            "hydraulic_frames": len(frames), "note": "Not a UE Shipping, rendered scene, or offline launch attestation"}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(validate(args.root, args.manifest), indent=2))
    except (ValueError, KeyError, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "FAIL", "error": str(exc)}))
        return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
