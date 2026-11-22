#!/usr/bin/env python3
"""Assemble the repository's source-backed terrain and Posey meshes for offline review."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from audit_local_3d_tiles import audit, clean_uri

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "geospatial"))
from stage_cesium_posey_buildings import file_sha256, stage as stage_buildings  # noqa: E402

TERRAIN = ROOT / "tsm-console" / "public" / "3d-tiles" / "terrain-3dep"
MANIFEST_TOOL = ROOT / "scripts" / "native" / "native-data-manifest.mjs"


def stage_terrain(output: Path) -> dict:
    expected = {}
    for line in (TERRAIN / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
        digest, name = line.split(maxsplit=1)
        name = clean_uri(name)
        if name in expected:
            raise ValueError(f"Duplicate terrain source path: {name}")
        expected[name] = digest
    verified = audit(TERRAIN, TERRAIN / "tileset.json")
    reachable = {entry["path"]: entry["sha256"] for entry in verified["files"]}
    if expected != {**reachable, "manifest.json": file_sha256(TERRAIN / "manifest.json")}:
        raise ValueError("Terrain inventory differs from the committed SHA256SUMS")
    for name in expected:
        source = TERRAIN / name
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        if file_sha256(target) != expected[name]:
            raise ValueError(f"Staged terrain hash mismatch: {name}")
    shutil.copyfile(TERRAIN / "SHA256SUMS", output / "SHA256SUMS")
    return verified


def build_snapshot(footprints: Path, output: Path) -> dict:
    if output.exists() or output.is_symlink():
        raise ValueError("Review snapshot output must be a new directory")
    with tempfile.TemporaryDirectory(prefix=".tsm-world-review-", dir=output.parent) as workspace:
        staging = Path(workspace) / "snapshot"
        terrain = stage_terrain(staging / "terrain")
        buildings_root = staging / "buildings"
        stage_buildings(footprints, buildings_root)
        buildings = audit(buildings_root, buildings_root / "tileset.json")
        sources = json.loads((buildings_root / "sources.json").read_text(encoding="utf-8"))
        receipt = {
            "schema": "tsm.native.world-review.v1",
            "classification": "VISUALIZATION_ONLY",
            "coverage": "Committed regional terrain subset and partial Posey County LoD1",
            "engineeringUse": False,
            "regulatoryUse": False,
            "countywideBuildingCoverage": False,
            "shippingAccepted": False,
            "headedOfflineRuntimeVerified": False,
            "layers": {
                "terrain": {
                    "tileset": "terrain/tileset.json",
                    "tilesetSha256": file_sha256(staging / "terrain" / "tileset.json"),
                    "meshPayloads": terrain["payloads"],
                    "sourceMetadata": "terrain/manifest.json",
                },
                "buildings": {
                    "tileset": "buildings/tileset.json",
                    "tilesetSha256": file_sha256(buildings_root / "tileset.json"),
                    "meshPayloads": buildings["implicitContents"],
                    "meshObjectIds": sources["meshCount"],
                    "archivedFootprintObjectIds": sources["footprintCount"],
                    "footprintOnlyObjectIds": sources["footprintOnlyCount"],
                    "sourceMetadata": "buildings/sources.json",
                },
            },
        }
        (staging / "world-review.json").write_text(
            json.dumps(receipt, indent=2) + "\n", encoding="utf-8"
        )
        manifest = staging / "data-manifest.json"
        for command in ("generate", "verify"):
            subprocess.run(["node", str(MANIFEST_TOOL), command, str(staging), str(manifest)],
                           check=True)
        staging.rename(output)
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--footprints", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    options = parser.parse_args()
    receipt = build_snapshot(options.footprints, options.output)
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
