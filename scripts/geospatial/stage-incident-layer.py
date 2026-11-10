#!/usr/bin/env python3
"""Explicit, offline, human-approved GeoJSON staging for TSM incident overlays."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from backend.geospatial.incident_layers import (  # noqa: E402
    IncidentLayerError, _filename, _manifest, _regular_file,
    _sanitized_features, incident_root, MAX_GEOJSON_BYTES,
)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", type=Path, default=incident_root())
    p.add_argument("--source-file", type=Path, required=True)
    p.add_argument("--id", required=True)
    p.add_argument("--title", required=True)
    p.add_argument("--source-agency", required=True)
    p.add_argument("--source-url", required=True)
    p.add_argument("--source-license", required=True)
    p.add_argument("--acquired-at", required=True, help="e.g. 2026-11-10T10:00:00Z")
    p.add_argument("--attribution", required=True)
    p.add_argument("--authority", choices=["OBSERVATION", "CONTEXT", "PLANNING", "DERIVED"], required=True)
    p.add_argument("--style", choices=["circle", "line", "fill"], required=True)
    p.add_argument("--display-field", action="append", default=[])
    p.add_argument("--license-reviewed", action="store_true")
    p.add_argument("--approved-for-display", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    return p


def stage(args: argparse.Namespace) -> dict:
    root = args.root.resolve()
    if args.source_file.is_symlink():
        raise IncidentLayerError("symlinked staging input is not allowed")
    source = args.source_file.resolve(strict=True)
    if not source.is_file() or source.stat().st_size > MAX_GEOJSON_BYTES:
        raise IncidentLayerError("staging requires a small, regular local GeoJSON file")
    if not (args.approved_for_display and args.license_reviewed):
        raise IncidentLayerError("explicit --license-reviewed and --approved-for-display are required")
    if args.id.startswith(".") or "/" in args.id or "\\" in args.id:
        raise IncidentLayerError("unsafe layer ID")
    _filename(args.id + ".geojson")
    raw = source.read_bytes()
    try:
        doc = json.loads(raw)
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise IncidentLayerError("source file is not GeoJSON JSON") from exc
    sha = hashlib.sha256(raw).hexdigest()
    entry = {
        "id": args.id, "title": args.title, "file": args.id + ".geojson",
        "sha256": sha, "source_agency": args.source_agency,
        "source_url": args.source_url, "source_license": args.source_license,
        "license_reviewed": True, "approved_for_display": True,
        "acquired_at": args.acquired_at, "attribution": args.attribution,
        "authority_class": args.authority, "style": args.style,
        "crs": "EPSG:4326", "vertical_datum": None,
        "display_fields": args.display_field,
    }
    # Validate geometry and the public attribute projection before copying.
    _sanitized_features(doc, entry)
    manifest = root / "layers.json"
    if manifest.is_file():
        existing = _manifest(root)
    else:
        existing = []
    if any(row["id"] == args.id or row["file"] == entry["file"] for row in existing):
        raise IncidentLayerError("layer already exists; no silent overwrite allowed")
    # Validate EVERY candidate before writing to disk.
    candidate = {"schema": "tsm.offline-incident-layers.v1", "layers": [*existing, entry]}
    if len(candidate["layers"]) > 32:
        raise IncidentLayerError("catalog capacity exceeded")
    if args.dry_run:
        return {"status": "DRY_RUN_VERIFIED_NO_WRITE", "sha256": sha, "feature_count": len(doc["features"]),
                "layer_id": args.id}
    root.mkdir(parents=True, exist_ok=True)
    destination = root / entry["file"]
    if destination.exists():
        raise IncidentLayerError("destination exists; no silent replacement allowed")
    temporary = root / (entry["file"] + ".staging")
    completed = False
    try:
        with temporary.open("xb") as handle:
            handle.write(raw)
        if hashlib.sha256(temporary.read_bytes()).hexdigest() != sha:
            raise IncidentLayerError("staging SHA-256 mismatch")
        os.replace(temporary, destination)
        manifest_tmp = root / "layers.json.staging"
        with manifest_tmp.open("x", encoding="utf-8") as handle:
            json.dump(candidate, handle, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(manifest_tmp, manifest)
        completed = True
    except Exception:
        temporary.unlink(missing_ok=True)
        (root / "layers.json.staging").unlink(missing_ok=True)
        # Roll back only the new payload if catalog commit was not completed.
        if not completed:
            destination.unlink(missing_ok=True)
        raise
    return {"status": "STAGED_LOCAL_REQUIRES_HUMAN_RUNTIME_REVIEW",
            "layer_id": args.id, "source_sha256": sha,
            "manifest": str(manifest), "feature_count": len(doc["features"])}


def main() -> int:
    args = build_parser().parse_args()
    try:
        print(json.dumps(stage(args), indent=2))
        return 0
    except (IncidentLayerError, FileNotFoundError, ValueError, OSError) as exc:
        print(f"Rejected incident stage: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
