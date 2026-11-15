#!/usr/bin/env python3
"""Headless contract gate for TSM cinematic shot plans (no render claim)."""
import argparse
import json
import re
from pathlib import Path

REQUIRED = {"terrain-datum", "building-tileset", "roads-source",
            "hydrography-source", "water-surface-provenance",
            "model-calibration", "bridge-inventory"}
LAYERS = {"verified-terrain", "hydrography", "buildings", "roads",
          "bridges", "water-surface", "flood-depth"}
MODES = {"ORBIT", "DRONE", "CINEMA"}

def validate(data):
    if not isinstance(data, dict) or data.get("schemaVersion") != "tsm.cinematic-shot-plan.v1":
        raise ValueError("unsupported shot plan")
    if data.get("engineeringUse") is not False or data.get("regulatoryUse") is not False:
        raise ValueError("cinematic data cannot assert engineering authority")
    if data.get("releaseGate") != "NOT_RENDER_VERIFIED":
        raise ValueError("render evidence cannot be asserted by a shot plan")
    shots = data.get("shots")
    if not isinstance(shots, list) or len(shots) != 6:
        raise ValueError("six scenario definitions required")
    ids = set()
    for shot in shots:
        ident = shot.get("id")
        if not isinstance(ident, str) or not re.fullmatch(r"[0-9]{2}-[a-z-]+", ident) or ident in ids:
            raise ValueError("invalid or duplicate shot id")
        ids.add(ident)
        if shot.get("mode") not in MODES:
            raise ValueError("unknown camera mode")
        for field, allowed in (("layers", LAYERS), ("requiredEvidence", REQUIRED)):
            values = shot.get(field)
            if not isinstance(values, list) or not values or len(set(values)) != len(values) or not set(values) <= allowed:
                raise ValueError("invalid " + field)
        if not isinstance(shot.get("effects"), list) or not shot["effects"]:
            raise ValueError("effects required")
    return {"shot_count": len(shots), "ids": sorted(ids), "render_verified": False}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("plan", type=Path, nargs="?", default=Path(__file__).resolve().parents[2] / "data/cinematic/film-shot-plan.v1.json")
    args = parser.parse_args()
    print(json.dumps(validate(json.loads(args.plan.read_text(encoding="utf-8"))), indent=2))

if __name__ == "__main__":
    main()
