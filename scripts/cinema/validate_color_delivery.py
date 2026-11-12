#!/usr/bin/env python3
"""Inspect a pinned OCIO production manifest without inventing ACES proof.

This verifies declared contract fields and hashes; it DOES NOT inspect EXR channel
metadata, evaluate a display-view transform, or certify HDR output.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

HEX = re.compile(r"^[0-9a-f]{64}$")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for part in iter(lambda: f.read(1024 * 1024), b""):
            h.update(part)
    return h.hexdigest()


def validate(record: dict, root: Path) -> dict:
    if not isinstance(record, dict) or record.get("schema") != "tsm.cinema.color-delivery.v1":
        raise ValueError("invalid color delivery schema")
    if record.get("workflow") != "scene_linear_acescg" or record.get("working_space") != "ACEScg":
        raise ValueError("this contract requires ACEScg scene-linear workflow")
    if record.get("science_pass_treatment") != "raw_non_color_no_display_transform":
        raise ValueError("scientific data must bypass artistic color transforms")
    if record.get("exr_pixel_type") != "FLOAT":
        raise ValueError("float32 EXR pixel encoding required")
    if record.get("output_display") not in ("Rec.1886 Rec.709", "sRGB - Display", "Rec.2100-PQ"):
        raise ValueError("output display is unrecognized")
    if not record.get("ocio_config_version") or not record.get("output_view"):
        raise ValueError("OCIO version and view name are required")
    source_root = root.resolve(strict=True)
    for kind in ("ocio_config", "render_frame_receipt", "output"):
        relative = record.get(f"{kind}_path")
        expected = record.get(f"{kind}_sha256")
        if not isinstance(relative, str) or not relative or not isinstance(expected, str) or not HEX.fullmatch(expected):
            raise ValueError(f"{kind}: a real relative path and measured digest are required")
        candidate = source_root / relative
        if candidate.is_symlink() or not candidate.resolve().is_relative_to(source_root) or not candidate.is_file():
            raise ValueError(f"{kind}: path must be a regular local file under artifact root")
        if sha256(candidate) != expected:
            raise ValueError(f"{kind}: SHA-256 mismatch")
    if record.get("output_display") == "Rec.2100-PQ":
        if record.get("output_codec") not in ("HEVC Main10", "AV1 10-bit"):
            raise ValueError("PQ requires a supported high-bit-depth output codec")
        if record.get("hdr10_metadata_provenance") != "MEASURED":
            raise ValueError("HDR mastering metadata must be measured")
    elif record.get("output_codec") not in ("H.264", "H.265"):
        raise ValueError("SDR requires an identified encoder")
    return {
        "schema": "tsm.cinema.color-preflight.v1",
        "status": "MANIFEST_AND_FILE_HASHES_CHECKED_ONLY",
        "files_verified": 3,
        "requires": [
            "OCIO config/view enumeration and live transform evaluation",
            "EXR float32 and primaries/channel metadata inspection",
            "display mastering, stream color tag and frame QC",
            "scientific raster non-color independence",
            "human visual review",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--artifact-root", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    if args.report.exists():
        parser.error("refusing to overwrite evidence receipt")
    report = validate(json.loads(args.manifest.read_text(encoding="utf8")), args.artifact_root)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    print(json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
