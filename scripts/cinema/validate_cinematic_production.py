#!/usr/bin/env python3
"""Validate a real-data UE5.8 cinematic render contract before invoking Movie Render Queue.

No placeholder terrain, fake flood elevations, assumed roof heights or unverified
geospatial transforms are permitted to pass as evidence-backed runtime footage.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

ASSET = re.compile(r"^/Game/[A-Za-z0-9_/-]+(?:\.[A-Za-z0-9_]+)?$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
SHOTS = {"regional", "county_map", "terrain", "buildings", "water", "timeline",
         "provenance", "community", "outro"}
EVIDENCE = {"OBSERVED", "DERIVED", "SCENARIO", "PRESENTATION"}
COUNTIES = {"18129", "21091", "21225", "17193", "17185", "17059"}  # Posey; Henderson; Union; White; Wabash; Gallatin


class ContractError(ValueError):
    pass


def reject(reason: str) -> None:
    raise ContractError(reason)


def read_manifest(path: Path) -> dict:
    document = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(document, dict) or document.get("schema") != "tsm.cinematic.production.v1":
        reject("invalid production schema")
    return document


def verify(manifest: dict, data_root: Path) -> dict:
    if manifest.get("fps") not in (24, 30, 60):
        reject("unsupported cinematic frame rate")
    if manifest.get("resolution") not in ([1920, 1080], [3840, 2160]):
        reject("only 1080p/4K outputs are allowed")
    if manifest.get("engine") != "Unreal Engine 5.8":
        reject("must target Unreal Engine 5.8")
    if manifest.get("map") != "/Game/TSM/Maps/TSMNative":
        reject("must use the canonical TSMNative map")
    for prop in ("sequence", "preset"):
        if not isinstance(manifest.get(prop), str) or not ASSET.fullmatch(manifest[prop]):
            reject("invalid or missing Unreal " + prop + " asset")
    if set(manifest.get("county_fips", [])) != COUNTIES or len(manifest["county_fips"]) != 6:
        reject("only the six approved tri-state counties may be declared")
    assets = manifest.get("source_assets")
    if not isinstance(assets, list) or not assets:
        reject("no physical source data declared")
    kinds = set()
    verified_assets = []
    root = data_root.resolve(strict=True)
    for row in assets:
        if not isinstance(row, dict):
            reject("invalid source asset entry")
        logical = row.get("name")
        rel = row.get("relative_path")
        digest = row.get("sha256")
        kind = row.get("kind")
        if not isinstance(logical, str) or not logical or not isinstance(rel, str):
            reject("missing source asset identity or path")
        if not isinstance(digest, str) or not SHA256.fullmatch(digest):
            reject("missing measured SHA-256")
        if kind not in ("terrain", "buildings", "water", "metadata", "imagery"):
            reject("unrecognized asset kind")
        path = root / rel
        if path.is_symlink() or not path.resolve().is_relative_to(root):
            reject("asset escapes authorized local TSMData")
        if not path.is_file():
            reject("missing real local asset: " + rel)
        h = hashlib.sha256()
        with path.open("rb") as file:
            for block in iter(lambda: file.read(1024 * 1024), b""):
                h.update(block)
        if h.hexdigest() != digest:
            reject("asset checksum mismatch: " + rel)
        if kind in ("terrain", "water"):
            if not all(row.get(x) for x in ("horizontal_crs", "vertical_datum", "vertical_units", "source_id")):
                reject("terrain/water require independently verified CRS, vertical datum, units and source")
        if kind == "buildings":
            if not row.get("source_id") or not row.get("height_evidence"):
                reject("buildings must record source and height-evidence class")
        kinds.add(kind)
        verified_assets.append({"name": logical, "sha256": digest, "kind": kind})
    if not {"terrain", "buildings"}.issubset(kinds):
        reject("real terrain and building assets are both mandatory")
    shots = manifest.get("shots")
    if not isinstance(shots, list) or len(shots) < 8:
        reject("at least eight sequenced shots required")
    next_frame = 0
    names = set()
    for shot in shots:
        if not isinstance(shot, dict) or shot.get("kind") not in SHOTS:
            reject("invalid shot type")
        name = shot.get("id")
        if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9_-]{2,64}", name) or name in names:
            reject("invalid or duplicate shot ID")
        names.add(name)
        if not isinstance(shot.get("start_frame"), int) or shot["start_frame"] != next_frame:
            reject("gap or overlap in timeline at " + name)
        frames = shot.get("frames")
        if not isinstance(frames, int) or frames < manifest["fps"] * 4:
            reject("shot shorter than four seconds")
        next_frame += frames
        keys = shot.get("camera_keys")
        if not isinstance(keys, list) or len(keys) < 2:
            reject("each cinematic shot must have at least two real UE world-space camera keys")
        last = -1
        for key in keys:
            f = key.get("frame")
            p = key.get("world_cm")
            rot = key.get("rotation_deg")
            if not isinstance(f, int) or not last < f < frames:
                reject("invalid or unordered camera key frames")
            if not isinstance(p, list) or len(p) != 3 or not all(isinstance(v, (int, float)) and abs(v) < 1e9 for v in p):
                reject("camera location must use real finite UE world-centimeter coordinates")
            if not isinstance(rot, list) or len(rot) != 3 or not all(isinstance(v, (int, float)) and abs(v) <= 360 for v in rot):
                reject("invalid camera rotations")
            last = f
        if shot.get("evidence_class") not in EVIDENCE:
            reject("missing shot evidence classification")
        if shot["kind"] in ("water", "timeline") and shot["evidence_class"] == "OBSERVED":
            if not shot.get("verified_observation_manifest_sha256"):
                reject("observed water/timeline requires independent source receipt")
        if shot["kind"] == "water" and shot["evidence_class"] != "PRESENTATION":
            if "water" not in kinds:
                reject("simulated or observed water needs an actual verified water asset")
            if not shot.get("scenario_id"):
                reject("water scenario must identify its model")
    if next_frame < 300 * manifest["fps"]:
        reject("community movie must be at least five minutes long")
    if not any(x["kind"] == "water" for x in shots):
        reject("time-aware water scene missing")
    return {
        "schema": "tsm.cinematic.preflight.v1",
        "result": "SOURCE_CHECKSUMS_VALIDATED_ONLY",
        "seconds": next_frame / manifest["fps"],
        "expected_frames": next_frame,
        "asset_sha256": verified_assets,
        "shot_count": len(shots),
        "note": "Physical bytes validated; Unreal map assets, render quality and scientific claims still require independent checks.",
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest", type=Path, required=True)
    p.add_argument("--data-root", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    args = p.parse_args()
    if args.report.exists():
        reject("refusing to replace an existing evidence report")
    summary = verify(read_manifest(args.manifest), args.data_root)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(summary, sort_keys=True))


if __name__ == "__main__":
    main()
