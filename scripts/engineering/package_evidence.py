#!/usr/bin/env python3
"""Offline review ZIP: deterministic artifact hashes, no implicit agency certification."""
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

REQUIRED = ("report.pdf", "compliance_results.gpkg", "compliance_ledger.csv",
            "summary_metrics.json", "elevation_distribution.svg")
ALLOWED_SUFFIXES = {".pdf", ".gpkg", ".csv", ".json", ".svg"}
SAFE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$")

def package(source_dir, destination, project, require_complete=True):
    source = Path(source_dir).resolve()
    target = Path(destination).resolve()
    if not source.is_dir():
        raise FileNotFoundError(source)
    if target.exists():
        raise FileExistsError("Refusing to overwrite an existing submission archive")
    if source in target.parents:
        raise ValueError("Archive must be outside input directory")
    missing = [name for name in REQUIRED if not (source / name).is_file()]
    if require_complete and missing:
        raise ValueError("Required artifacts missing: " + ", ".join(missing))
    members = []
    for path in sorted(source.iterdir()):
        if path.is_symlink():
            raise ValueError("Symlinks are prohibited in evidence packages")
        if not path.is_file() or path.name == "submission_manifest.json":
            continue
        if not SAFE.fullmatch(path.name) or path.suffix.lower() not in ALLOWED_SUFFIXES:
            raise ValueError("Unexpected artifact name or format: " + path.name)
        members.append(path)
    if not members:
        raise ValueError("No evidence artifacts to package")
    manifest = {
        "schema": "tsm.review-package.v1",
        "project": project,
        "state": "REVIEW_REQUIRED_NOT_SUBMITTED",
        "complete": not missing,
        "missing_required": missing,
        "regulatory_determination": False,
        "agency_approved": False,
        "artifacts": [
            {"path": "evidence/" + p.name, "size_bytes": p.stat().st_size,
             "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
            for p in members
        ]
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in members:
            archive.write(path, arcname="evidence/" + path.name)
        archive.writestr("evidence/submission_manifest.json", json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    return manifest

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--source", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--project", required=True)
    p.add_argument("--allow-incomplete", action="store_true")
    a = p.parse_args()
    print(json.dumps(package(a.source, a.output, a.project, not a.allow_incomplete), indent=2))
