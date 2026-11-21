#!/usr/bin/env python3
"""Stage the verified Posey LoD1 preview and its missing-height footprint overlay."""

from __future__ import annotations

import argparse
from hashlib import sha256
import json
from pathlib import Path, PurePosixPath
import re
import tarfile
import tempfile
from zipfile import ZipFile

from pyproj import Transformer

from compile_tri_state_offline_layers import sha256 as file_sha256
from tsm_geodesy import GeoidGrid, GEOID18_GRID_SHA256, default_geoid_grid_path
from validate_feature_linkage import implicit_glb_object_ids
from validate_spatial_coherence import check_implicit

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE_DIR = ROOT / "data/fabrics/downloads/posey-preview-2026-11-13"
ARCHIVE_DIGEST = "b82c1bca02e176f57e97ef7b5d46830091f02564ad4898c46ad30f6f0ff3b7ac"
DRIVE_PREVIEW_DIGEST = "ee0fcc542c6b17469e4e949608dc6aab60191552349a05c18652979fe8e880ee"
TILESET_DIGEST = "c0b76826ac97079b59064c57dd56eced9500b45dbd7f346dbd076bca957ee784"
FOOTPRINT_DIGEST = "d8a46b86616becfdea9c9164e7a219317d5963b86fba47e4c1f8f880ccbb559f"
FOOTPRINT_SOURCE = ("https://github.com/ATphobia22/Tri-State-Systems-Manager/releases/download/"
                    "igio-posey-20261006/posey-buildings-igio-23082.geojson")
FOOTPRINT_LAYER = "https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0"
MESH_COUNT = 20517
FOOTPRINT_COUNT = 23082
MESH_FILE_COUNT = 861
SUBTREE_COUNT = 493
ASSET_PATH = re.compile(r"tileset\.json|content/\d+/\d+/\d+\.glb|subtrees/\d+/\d+/\d+\.(subtree|bin)")


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n",
                    encoding="utf-8")


def unpack_drive_preview(archive_path: Path, output: Path) -> None:
    if file_sha256(archive_path) != DRIVE_PREVIEW_DIGEST:
        raise ValueError("Posey Drive preview ZIP digest mismatch")
    with ZipFile(archive_path) as archive:
        files = set()
        for member in archive.infolist():
            if member.is_dir() or not member.filename.startswith("tiles/"):
                continue
            name = member.filename.removeprefix("tiles/")
            if not ASSET_PATH.fullmatch(name) or name in files:
                raise ValueError(f"Unexpected preview ZIP entry: {member.filename}")
            files.add(name)
            target = output / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(member))


def unpack_preview(output: Path) -> None:
    parts = [ARCHIVE_DIR / f"posey-preview.tar.xz.{index:02d}.part" for index in range(9)]
    archive_bytes = b"".join(part.read_bytes() for part in parts)
    if sha256(archive_bytes).hexdigest() != ARCHIVE_DIGEST:
        raise ValueError("Posey 3D preview archive digest mismatch")
    with tempfile.TemporaryFile() as packed:
        packed.write(archive_bytes)
        packed.seek(0)
        with tarfile.open(fileobj=packed, mode="r:xz") as archive:
            files = set()
            for member in archive:
                if member.isdir():
                    continue
                name = PurePosixPath(member.name).as_posix()
                if not member.isfile() or not ASSET_PATH.fullmatch(name) or name in files:
                    raise ValueError(f"Unexpected preview archive entry: {member.name}")
                files.add(name)
                target = output / name
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(member) as payload:
                    target.write_bytes(payload.read())


def mesh_ids(directory: Path, tileset: dict) -> set[int]:
    violations = []
    check_implicit(tileset, directory, violations)
    contents = sorted((directory / "content").rglob("*.glb"))
    subtrees = sorted((directory / "subtrees").rglob("*.subtree"))
    if len(contents) != MESH_FILE_COUNT or len(subtrees) != SUBTREE_COUNT:
        raise ValueError("Posey preview tile inventory mismatch")
    seen = set()
    for path in contents:
        object_ids = implicit_glb_object_ids(path, violations)
        if not object_ids or not seen.isdisjoint(object_ids):
            raise ValueError(f"Missing or duplicate Posey building IDs in {path}")
        seen.update(object_ids)
    if violations or len(seen) != MESH_COUNT:
        raise ValueError(f"Posey mesh evidence mismatch ({len(seen)} IDs): {violations[:8]}")
    return seen


def align_for_terrain(tileset: dict) -> dict:
    grid_path = default_geoid_grid_path()
    if file_sha256(grid_path) != GEOID18_GRID_SHA256:
        raise ValueError("GEOID18 grid digest mismatch")
    grid = GeoidGrid(grid_path)
    transform = tileset["root"]["transform"]
    ecef_to_geographic = Transformer.from_crs(4978, 4979, always_xy=True)
    lon, lat, _ = ecef_to_geographic.transform(*transform[12:15])
    separation = grid.sample(lat, lon)
    # The rebuild's local up used NAVD88 orthometric heights as a display offset.
    # Move the full bounding hierarchy and meshes together into the terrain's
    # approximate ellipsoidal display frame, retaining the original GLB bytes.
    for i in range(3):
        transform[12 + i] += separation * transform[8 + i]
    return {
        "purpose": "Approximate visualization alignment with Cesium USGS terrain",
        "sourceVerticalDatum": "NAVD88",
        "targetVerticalReference": "Approximate ellipsoidal display height",
        "geoidModel": "GEOID18",
        "geoidSha256": GEOID18_GRID_SHA256,
        "anchorLonLat": [lon, lat],
        "rootLocalUpOffsetM": separation,
        "method": "Single GEOID18 separation at the Posey tileset origin",
        "engineeringUse": False,
    }


def stage(footprints: Path, output: Path, preview_zip: Path | None = None) -> None:
    if file_sha256(footprints) != FOOTPRINT_DIGEST:
        raise ValueError("Posey footprint inventory digest mismatch")
    source = json.loads(footprints.read_bytes())["features"]
    source_ids = {f["properties"]["objectid"] for f in source}
    if len(source) != len(source_ids) or len(source_ids) != FOOTPRINT_COUNT:
        raise ValueError("Posey footprint inventory or identity count mismatch")
    archive_digest = ARCHIVE_DIGEST
    if preview_zip is None:
        unpack_preview(output)
    else:
        unpack_drive_preview(preview_zip, output)
        archive_digest = DRIVE_PREVIEW_DIGEST
    if file_sha256(output / "tileset.json") != TILESET_DIGEST:
        raise ValueError("Original Posey preview tileset digest mismatch")
    tileset = json.loads((output / "tileset.json").read_bytes())
    seen = mesh_ids(output, tileset)
    if seen - source_ids:
        raise ValueError("Posey mesh OBJECTID is absent from the archived Indiana GIO inventory")
    alignment = align_for_terrain(tileset)
    tileset["asset"]["tilesetVersion"] = "posey-preview-20261113-geoid18"
    tileset["asset"]["extras"]["tsm"].update({
        "previewMeshCount": len(seen), "footprintCount": len(source_ids),
        "engineeringUse": False, "displayAlignment": alignment,
    })
    write_json(output / "tileset.json", tileset)
    missing = [{
        "type": "Feature",
        "geometry": f["geometry"],
        "properties": {"source_objectid": f["properties"]["objectid"]},
    } for f in source if f["properties"]["objectid"] not in seen]
    write_json(output / "missing-height-footprints.json", {
        "type": "FeatureCollection",
        "metadata": {"featureCount": len(missing), "heightStatus": "UNAVAILABLE_IN_PREVIEW",
                     "sourceFootprintSha256": FOOTPRINT_DIGEST, "sourceLayer": FOOTPRINT_LAYER},
        "features": missing,
    })
    write_json(output / "sources.json", {
        "classification": "VISUALIZATION_ONLY", "engineeringUse": False, "regulatoryUse": False,
        "sourceLayer": FOOTPRINT_LAYER, "sourceFootprintArchive": FOOTPRINT_SOURCE,
        "sourceFootprintSha256": FOOTPRINT_DIGEST, "footprintCount": len(source_ids),
        "meshCount": len(seen), "footprintOnlyCount": len(missing),
        "previewArchiveSha256": archive_digest, "originalTilesetSha256": TILESET_DIGEST,
        "displayAlignment": alignment,
    })
    print(f"Posey {len(seen)} preview meshes and {len(missing)} footprint-only IDs reconciled to {len(source_ids)} source IDs")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--footprints", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--preview-zip", type=Path, help="Use the pinned Posey Drive preview ZIP")
    args = parser.parse_args()
    stage(args.footprints, args.output, args.preview_zip)


if __name__ == "__main__":
    main()
