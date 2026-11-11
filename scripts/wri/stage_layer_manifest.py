#!/usr/bin/env python3
"""Verify a WRI asset against its acquisition receipt and stage an INACTIVE layer.

No CRS inference, geospatial clipping, regulatory approval or runtime network calls.
The output is a discovered-layer descriptor, not evidence of rendered GIS coverage.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re

SHA256 = re.compile(r"^[0-9a-f]{64}$")
MAX_BYTES = 512 * 1024 * 1024


def prepare_manifest(*, registry: dict, receipt: dict, asset: Path) -> dict:
    by_id = {item["id"]: item for item in registry.get("datasets", [])}
    source_id = receipt.get("source_id")
    if not isinstance(source_id, str) or source_id not in by_id:
        raise ValueError("Unknown WRI source ID")
    row = by_id[source_id]
    if receipt.get("status") != "ACQUIRED_UNREVIEWED":
        raise ValueError("Acquisition receipt not in the expected state")
    if receipt.get("authority") != "World Resources Institute":
        raise ValueError("Receipt authority mismatch")
    source_url = receipt.get("source_url")
    if not isinstance(source_url, str) or not source_url.startswith("https://"):
        raise ValueError("Invalid source URL")
    from acquire_offline_asset import validate_url
    validate_url(source_url)
    expected = receipt.get("sha256")
    if not isinstance(expected, str) or SHA256.fullmatch(expected) is None:
        raise ValueError("Invalid receipt SHA-256")
    if asset.is_symlink() or not asset.is_file():
        raise ValueError("Asset missing or is a symlink")
    if receipt.get("local_path") != asset.name:
        raise ValueError("Receipt file name does not match the supplied asset")
    expected_bytes = receipt.get("bytes")
    if not isinstance(expected_bytes, int) or not (0 < expected_bytes <= MAX_BYTES):
        raise ValueError("Invalid byte count in receipt")
    if asset.stat().st_size != expected_bytes:
        raise ValueError("Asset size differs from receipt")
    digest = hashlib.sha256()
    count = 0
    with asset.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            count += len(block)
            if count > MAX_BYTES:
                raise ValueError("Asset exceeds safety cap")
            digest.update(block)
    if count != expected_bytes or digest.hexdigest() != expected:
        raise ValueError("Asset SHA-256 does not match acquisition receipt")
    # No absolute machine paths or copied claims about source accuracy.
    return {
        "schema": "tsm.wri.offline-layer.v1",
        "id": source_id,
        "name": row["title"],
        "catalog_page": row["page"],
        "authority": "World Resources Institute",
        "source_url": source_url,
        "asset_filename": asset.name,
        "asset_sha256": expected,
        "asset_bytes": count,
        "render_layer": row["renderLayer"],
        "source_class": "SUPPLEMENTARY_NONREGULATORY",
        "evidence_state": "ACQUIRED_UNREVIEWED",
        "license": row.get("license", "REVIEW_REQUIRED"),
        "license_review": "REQUIRED",
        "source_crs": "UNVERIFIED",
        "source_vertical_datum": "UNVERIFIED",
        "coverage": "UNVERIFIED_FOR_AOI",
        "aoi_clipped": False,
        "render_ready": False,
        "enabled": False,
        "engineering_authority": False,
        "regulatory_use": False,
        "ui_disclaimer": "Comparative WRI source; not FEMA, survey, or calibrated hydraulics.",
        "required_gates": [
            "LICENSE_AND_ATTRIBUTION_REVIEW",
            "SOURCE_SCHEMA_CRS_UNITS_COVERAGE_VALIDATION",
            "OFFICIAL_AOI_CLIP_AND_GEOMETRY_VALIDATION",
            "RENDER_TILE_HASH_AND_HEADFUL_VERIFICATION",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, default=Path(__file__).resolve().parents[2] /
                        "data/registries/wri-environmental-catalog-v1.json")
    parser.add_argument("--asset", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    registry = json.loads(args.registry.read_text(encoding="utf-8"))
    receipt = json.loads(args.receipt.read_text(encoding="utf-8"))
    manifest = prepare_manifest(registry=registry, receipt=receipt, asset=args.asset)
    if args.output.resolve() in {args.asset.resolve(), args.receipt.resolve(), args.registry.resolve()}:
        raise ValueError("Output may not overwrite a source or receipt")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "STAGED_DISABLED", "layer": manifest["id"],
                      "sha256": manifest["asset_sha256"]}, sort_keys=True))


if __name__ == "__main__":
    main()
