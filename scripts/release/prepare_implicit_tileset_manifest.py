#!/usr/bin/env python3
"""Seal fully validated implicit 3D Tiles for immutable release packaging.

This is a packaging receipt only, not a scientific data acceptance decision.
The source counts, LiDAR height provenance and feature linkage are validated
upstream. Never synthesize missing source records or claim survey certification.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def prepare(source_manifest: Path, implicit_dir: Path) -> dict:
    if not source_manifest.is_file():
        raise ValueError("Missing validated HLOD source manifest")
    if not implicit_dir.is_dir() or implicit_dir.is_symlink():
        raise ValueError("Missing or unsafe implicit 3D Tiles directory")
    metadata = json.loads(source_manifest.read_text(encoding="utf-8"))
    if metadata.get("authorityClass") != "DERIVED" or \
            metadata.get("engineeringUse") is not False or \
            metadata.get("regulatoryUse") is not False:
        raise ValueError("Source manifest fails evidence-authority classification")

    tileset = implicit_dir / "tileset.json"
    if not tileset.is_file() or tileset.is_symlink():
        raise ValueError("Implicit 3D Tiles missing tileset.json")
    payload = json.loads(tileset.read_text(encoding="utf-8"))
    if payload.get("asset", {}).get("version") != "1.1":
        raise ValueError("Expected valid 3D Tiles 1.1 root manifest")
    # The OGC/feature-linkage validators run before this receipts-only stage.
    # Here require nonempty structural content, no synthetic coverage claims.
    glbs = sorted(implicit_dir.rglob("*.glb"))
    if not glbs:
        raise ValueError("No GLB content present in implicit hierarchy")
    manifest_path = implicit_dir / "manifest.json"
    checksums_path = implicit_dir / "SHA256SUMS"
    if manifest_path.exists() or checksums_path.exists():
        raise ValueError("Refusing to overwrite existing packaging evidence")

    files = sorted(p for p in implicit_dir.rglob("*") if p.is_file())
    for file in files:
        if file.is_symlink() or not file.resolve().is_relative_to(implicit_dir.resolve()):
            raise ValueError("Implicit tileset contains external or symlinked files")
    metadata["stage"] = "implicit"
    metadata["content"] = [p.relative_to(implicit_dir).as_posix() for p in glbs]
    metadata["packagingReceipt"] = {
        "schemaVersion": "tsm.implicit-tileset-package.v1",
        "classification": "INFORMATIONAL_ONLY",
        "internalGlbCount": len(glbs),
        "sourceManifestSha256": sha256(source_manifest),
        "heightAndIdentityChecks": "UPSTREAM_VALIDATED_ONLY",
        "surveyCertified": False,
        "regulatoryApproved": False,
    }
    manifest_path.write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n",
                             encoding="utf-8")

    candidates = sorted(
        (p for p in implicit_dir.rglob("*") if p.is_file()
         and p != checksums_path),
        key=lambda p: p.relative_to(implicit_dir).as_posix(),
    )
    checksums_path.write_text(
        "".join(f"{sha256(p)}  {p.relative_to(implicit_dir).as_posix()}\n"
                for p in candidates),
        encoding="utf-8",
    )
    return metadata


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hlod-manifest", type=Path, required=True)
    parser.add_argument("--implicit-dir", type=Path, required=True)
    args = parser.parse_args()
    result = prepare(args.hlod_manifest, args.implicit_dir)
    print(json.dumps({
        "stage": result["stage"],
        "packagingReceipt": result["packagingReceipt"],
        "classification": result["authorityClass"],
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
