#!/usr/bin/env python3
"""Offline evidence gate: reject unsafe or untraceable scene packages."""
import argparse
import hashlib
import json
import re
from pathlib import Path, PurePosixPath

def validate(root):
    root = Path(root).resolve(strict=True)
    doc = json.loads((root / "scene-contract.json").read_text(encoding="utf-8"))
    errors = []
    if doc.get("schema_version") != "1.0.0":
        errors.append("unsupported schema_version")
    for field in ("horizontal_crs", "vertical_datum", "horizontal_units",
                  "vertical_units", "aoi_id", "origin", "transform_evidence"):
        if not doc.get(field):
            errors.append("missing " + field)
    if str(doc.get("vertical_datum", "")).lower() in ("unknown", "assumed"):
        errors.append("unverified vertical datum")
    origin = doc.get("origin")
    if not isinstance(origin, dict) or any(
        not isinstance(origin.get(k), (int, float)) or isinstance(origin.get(k), bool)
        for k in ("latitude", "longitude", "height_m")
    ):
        errors.append("invalid local origin")
    assets = doc.get("assets")
    if not isinstance(assets, list) or not assets:
        errors.append("assets must be a nonempty list")
        assets = []
    seen = set()
    for i, asset in enumerate(assets):
        if not isinstance(asset, dict):
            errors.append(f"asset {i}: not an object")
            continue
        name = asset.get("path")
        if not isinstance(name, str) or not name or "\\" in name or ":" in name:
            errors.append(f"asset {i}: unsafe path")
            continue
        path = PurePosixPath(name)
        if path.is_absolute() or any(x in (".", "..") for x in name.split("/")) or name in seen:
            errors.append(f"asset {i}: path traversal or duplicate")
            continue
        seen.add(name)
        target = (root / name).resolve()
        if not target.is_relative_to(root) or not target.is_file():
            errors.append(f"asset {i}: missing or escaped asset")
            continue
        digest = asset.get("sha256")
        if not isinstance(digest, str) or not re.fullmatch("[0-9a-f]{64}", digest):
            errors.append(f"asset {i}: invalid digest")
        elif hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            errors.append(f"asset {i}: checksum mismatch")
        for field in ("source_id", "source_uri", "source_crs",
                      "source_vertical_datum", "source_units", "coverage", "evidence_state"):
            if not asset.get(field):
                errors.append(f"asset {i}: missing {field}")
        if asset.get("evidence_state") not in ("VERIFIED", "PENDING", "BLOCKED", "NOT_EVIDENCED"):
            errors.append(f"asset {i}: invalid evidence state")
    return {"ok": not errors, "errors": errors, "asset_count": len(assets),
            "engineering_approved": False}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("scene_dir", type=Path)
    args = parser.parse_args()
    result = validate(args.scene_dir)
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["ok"] else 1)
