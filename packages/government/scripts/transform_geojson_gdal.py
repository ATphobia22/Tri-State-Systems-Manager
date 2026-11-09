#!/usr/bin/env python3
"""Hash-gated agency GeoJSON -> normalized WGS84 GeoJSON via native ogr2ogr.

Runs only on connected ingestion/workstation. Never elevates a dataset to PASS.
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MAX_SIZE = 100_000_000
EPSG = re.compile(r"^EPSG:[1-9][0-9]{3,5}$")


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def transform(
    input_path: str, manifest_path: str, output_path: str, *,
    ogr2ogr: str | None = None,
) -> dict[str, Any]:
    input_file, output_file = Path(input_path).resolve(), Path(output_path).resolve()
    if input_file == output_file:
        raise ValueError("GDAL_INPUT_AND_OUTPUT_MUST_DIFFER")
    if not input_file.is_file() or input_file.stat().st_size > MAX_SIZE:
        raise ValueError("GDAL_SOURCE_MISSING_OR_TOO_LARGE")
    raw = input_file.read_bytes()
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf8"))
    if not isinstance(manifest, dict):
        raise ValueError("GDAL_MANIFEST_NOT_OBJECT")
    if _sha256(raw) != manifest.get("sha256") or len(raw) != manifest.get("byteLength"):
        raise ValueError("GDAL_INPUT_EVIDENCE_HASH_INVALID")
    source_crs = manifest.get("horizontalCrs")
    if not isinstance(source_crs, str) or not EPSG.fullmatch(source_crs):
        raise ValueError("GDAL_EXPLICIT_SOURCE_EPSG_REQUIRED")
    parsed = json.loads(raw)
    if parsed.get("type") != "FeatureCollection" or not isinstance(parsed.get("features"), list):
        raise ValueError("GDAL_GEOJSON_FEATURE_COLLECTION_REQUIRED")
    binary = ogr2ogr or shutil.which("ogr2ogr")
    if not binary:
        raise RuntimeError("GDAL_OGR2OGR_NOT_INSTALLED")
    if output_file.exists() or Path(str(output_file) + ".manifest.json").exists():
        raise FileExistsError("GDAL_OUTPUT_ALREADY_EXISTS")
    output_file.parent.mkdir(parents=True, exist_ok=True)
    command = [
        binary, "-f", "GeoJSON", "-s_srs", source_crs,
        "-t_srs", "EPSG:4326", str(output_file), str(input_file),
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True, timeout=600)
        output = output_file.read_bytes()
        if not output or len(output) > MAX_SIZE:
            raise ValueError("GDAL_OUTPUT_EMPTY_OR_TOO_LARGE")
        result = json.loads(output)
        if result.get("type") != "FeatureCollection":
            raise ValueError("GDAL_OUTPUT_NOT_GEOJSON")
        transformed_manifest = {
            **manifest, "sha256": _sha256(output), "byteLength": len(output),
            "horizontalCrs": "EPSG:4326",
            "sourceVersion": str(manifest.get("sourceVersion", "")) + "/GDAL-transform",
            "derivedFromSha256": _sha256(raw),
            "transformation": {"tool": "GDAL ogr2ogr", "sourceCrs": source_crs,
                               "targetCrs": "EPSG:4326", "preservesVerticalDatumClaim": False},
            "validationStatus": "UNVERIFIED",
            "transformedAt": datetime.now(timezone.utc).isoformat(),
        }
        # Never upgrade a source claim to an approved or survey-accurate derivative.
        if "verticalDatum" in transformed_manifest:
            transformed_manifest["verticalDatum"] = manifest["verticalDatum"]
        manifest_output = Path(str(output_file) + ".manifest.json")
        with manifest_output.open("x", encoding="utf8") as writer:
            json.dump(transformed_manifest, writer, sort_keys=True, indent=2)
            writer.write("\n")
        return {"output": str(output_file), "manifest": str(manifest_output),
                "sha256": transformed_manifest["sha256"], "validationStatus": "UNVERIFIED"}
    except BaseException:
        output_file.unlink(missing_ok=True)
        Path(str(output_file) + ".manifest.json").unlink(missing_ok=True)
        raise


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit("Usage: transform_geojson_gdal.py input.geojson input.manifest.json output.geojson")
    try:
        print(json.dumps(transform(*sys.argv[1:]), indent=2))
    except Exception as exc:
        print(f"GDAL_TRANSFORM_FAILED: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
