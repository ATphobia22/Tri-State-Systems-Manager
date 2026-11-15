#!/usr/bin/env python3
"""Headless contract gate for TSM cinematic shot plans (no render claim)."""
import argparse
import json
import math
import re
from pathlib import Path

REQUIRED = {"terrain-datum", "building-tileset", "roads-source",
            "hydrography-source", "water-surface-provenance",
            "model-calibration", "bridge-inventory"}
LAYERS = {"verified-terrain", "hydrography", "buildings", "roads",
          "bridges", "water-surface", "flood-depth"}
MODES = {"ORBIT", "DRONE", "CINEMA"}
PREVIEW_VIEWS = {"confluence", "mount-vernon", "new-harmony", "overview"}
COMPARISON_EVIDENCE = {"water-surface-provenance", "model-calibration"}


def validate_preview(shot, frame_rate):
    preview = shot.get("preview")
    if "flood-depth" in shot["layers"] or "water-surface" in shot["layers"]:
        if preview is not None or not COMPARISON_EVIDENCE <= set(shot["requiredEvidence"]):
            raise ValueError("flood comparison requires model and water-surface evidence")
        return
    if not isinstance(preview, dict) or preview.get("view") not in PREVIEW_VIEWS:
        raise ValueError("preview needs a known map location")
    hour = preview.get("lightingHourCdt")
    if type(hour) is not int or not 0 <= hour <= 23:
        raise ValueError("invalid preview lighting hour")
    keys = preview.get("keyframes")
    if not isinstance(keys, list) or len(keys) != 2 or not all(isinstance(key, dict) for key in keys):
        raise ValueError("preview needs an opening and a closing keyframe")
    first, last = (key.get("frame") for key in keys)
    if type(first) is not int or first != 0 or type(last) is not int or not 1 <= last < 60 * frame_rate:
        raise ValueError("invalid preview frame range")
    for key in keys:
        for field, low, high in (("headingOffsetDeg", -45, 45), ("rangeScale", 0.5, 2.0)):
            value = key.get(field)
            if type(value) not in (int, float) or not low <= value <= high or not math.isfinite(value):
                raise ValueError(f"invalid preview {field}")


def validate(data):
    if not isinstance(data, dict) or data.get("schemaVersion") != "tsm.cinematic-shot-plan.v1":
        raise ValueError("unsupported shot plan")
    if (data.get("authority") != "VISUALIZATION_ONLY" or data.get("engineeringUse") is not False
            or data.get("regulatoryUse") is not False):
        raise ValueError("cinematic data cannot assert engineering authority")
    if data.get("releaseGate") != "NOT_RENDER_VERIFIED":
        raise ValueError("render evidence cannot be asserted by a shot plan")
    shots = data.get("shots")
    frame_rate = data.get("previewFrameRate")
    if type(frame_rate) is not int or frame_rate != 24:
        raise ValueError("camera preview requires a 24 fps timeline")
    if not isinstance(shots, list) or len(shots) != 6:
        raise ValueError("six scenario definitions required")
    ids = set()
    for shot in shots:
        if not isinstance(shot, dict):
            raise ValueError("invalid shot definition")
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
        validate_preview(shot, frame_rate)
    return {"shot_count": len(shots), "ids": sorted(ids), "render_verified": False}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("plan", type=Path, nargs="?", default=Path(__file__).resolve().parents[2] / "data/cinematic/film-shot-plan.v1.json")
    args = parser.parse_args()
    print(json.dumps(validate(json.loads(args.plan.read_text(encoding="utf-8"))), indent=2))

if __name__ == "__main__":
    main()
