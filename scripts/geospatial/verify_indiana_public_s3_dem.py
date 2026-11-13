#!/usr/bin/env python3
"""Verify official Indiana 2020 DEM objects against a spatially covered IGIO tile plan.

Online acquisition utility only. Never used as a UE5.8 Windows Shipping
runtime dependency. HEAD does NOT prove complete raster bytes, vertical
metadata, building heights, or countywide image coverage. Requires an
authoritative polygon coverage report as its input.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

BUCKET = "giselevationingov"
REGION = "us-east-2"
PREFIX = "demoptimized/statewide/2020/SPW/2.5ft/"
SERVICE = ("https://gisdata.in.gov/server/rest/services/Hosted/"
           "Indiana_DEM_Tile_Footprints/FeatureServer/0")
NAME = re.compile(r"IN2020_[0-9]{8}_12[.]tif\Z", re.IGNORECASE)
MAX_OBJECT_BYTES = 2 * 1024**3
MAX_TOTAL_BYTES = 80 * 1024**3
MAX_TILES = 1500
TIFF_MAGIC = {
    bytes((0x49, 0x49, 0x2A, 0x00)),
    bytes((0x4D, 0x4D, 0x00, 0x2A)),
    bytes((0x49, 0x49, 0x2B, 0x00)),
    bytes((0x4D, 0x4D, 0x00, 0x2B)),
}


def required_names(report: dict) -> list[str]:
    if (not isinstance(report, dict)
            or report.get("schemaVersion") != "tsm.posey-official-dem-tiles.v1"
            or report.get("sourceService") != SERVICE
            or report.get("sourceLayer") != 0
            or report.get("county") != "Posey"
            or report.get("sourceYear") != 2020
            or report.get("authoritativeBuildingCount") != 23082
            or report.get("polygonCoverageVerified") is not True
            or report.get("buildingsWithoutCompletePolygonCoverage") != 0):
        raise ValueError("source polygon coverage is not verified for 23,082 Posey buildings")
    names = report.get("requiredFilenames")
    if (not isinstance(names, list) or not 1 <= len(names) <= MAX_TILES
            or report.get("requiredFilenameCount") != len(names)
            or names != sorted(set(names))):
        raise ValueError("invalid or noncanonical authoritative tile inventory")
    if any(not isinstance(n, str) or not NAME.fullmatch(n) for n in names):
        raise ValueError("unsafe or unexpected 2020 DEM source filename")
    return names


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def survey_s3_objects(report: dict, client, *, output_dir: Path | None = None) -> dict:
    names = required_names(report)
    if output_dir is not None:
        if output_dir.is_symlink() or not output_dir.is_dir():
            raise ValueError("output_dir must exist and must not be a symlink")
        if any((output_dir / n).exists() or (output_dir / (n + ".part")).exists()
               for n in names):
            raise ValueError("refusing to overwrite existing staged source objects")
    receipts = []
    total = 0
    for name in names:
        key = PREFIX + name
        record = {"filename": name, "s3Key": key, "status": "NOT_VERIFIED",
                  "byteSha256Verified": False, "rasterPixelValuesVerified": False,
                  "verticalDatumVerified": False, "buildingHeightsVerified": False}
        try:
            response = client.head_object(Bucket=BUCKET, Key=key)
            size = response.get("ContentLength")
            if type(size) is not int or size < 8 or size > MAX_OBJECT_BYTES:
                raise ValueError("invalid S3 object ContentLength")
            total += size
            if total > MAX_TOTAL_BYTES:
                raise ValueError("total DEM source budget exceeded")
            record["contentLength"] = size
            record["s3ETagNotSha256"] = str(response.get("ETag", ""))
            record["status"] = "HEAD_VERIFIED"
            if output_dir is not None:
                dest = output_dir / name
                temporary = output_dir / (name + ".part")
                try:
                    with temporary.open("xb") as handle:
                        client.download_fileobj(BUCKET, key, handle)
                        handle.flush()
                        os.fsync(handle.fileno())
                    if (temporary.stat().st_size != size
                            or temporary.open("rb").read(4) not in TIFF_MAGIC):
                        raise ValueError("downloaded source is incomplete or not TIFF")
                    digest = sha256_file(temporary)
                    os.replace(temporary, dest)
                    record["byteSha256Verified"] = True
                    record["sha256"] = digest
                    record["status"] = "DOWNLOADED_HASHED_TIFF_MAGIC_ONLY"
                finally:
                    if temporary.exists():
                        temporary.unlink()
        except Exception as exc:
            record["status"] = "ERROR_UNVERIFIED"
            record["errorType"] = type(exc).__name__
            record["byteSha256Verified"] = False
        receipts.append(record)

    successes = sum(r["status"] != "ERROR_UNVERIFIED" for r in receipts)
    return {
        "schemaVersion": "tsm.posey-dem-source-s3-receipt.v1",
        "sourceBucket": BUCKET,
        "sourceRegion": REGION,
        "sourcePrefix": PREFIX,
        "sourceTileFootprintsService": SERVICE,
        "requiredObjectCount": len(names),
        "verifiedObjectCount": successes,
        "failedObjectCount": len(names) - successes,
        "sourceObjectsHeadVerified": successes == len(names),
        "allBytesAcquiredAndSha256Verified": (
            successes == len(names) and
            all(r["byteSha256Verified"] for r in receipts)
        ),
        "tilePolygonCoverageInputVerified": True,
        "rasterPixelValuesVerified": False,
        "verticalDatumVerified": False,
        "poseyBuildingHeightsVerified": False,
        "releaseCertified": False,
        "observedAtUtc": datetime.now(timezone.utc).isoformat(),
        "objects": receipts,
        "note": "S3 ETag is not SHA256. A downloaded TIFF header is not numeric DEM or datum QA.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tile-polygon-report", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--download-dir", type=Path)
    args = parser.parse_args()
    if args.receipt.exists() or args.receipt.resolve() == args.tile_polygon_report.resolve():
        parser.error("refusing to overwrite source or existing evidence")
    raw = args.tile_polygon_report.read_bytes()
    if len(raw) > 2 * 1024**2:
        parser.error("source report exceeds 2 MiB")
    report = json.loads(raw)
    required_names(report)  # fail before network access or staging
    import boto3
    from botocore import UNSIGNED
    from botocore.config import Config
    client = boto3.client("s3", region_name=REGION, config=Config(signature_version=UNSIGNED))
    receipt = survey_s3_objects(report, client, output_dir=args.download_dir)
    receipt["polygonReportSha256"] = hashlib.sha256(raw).hexdigest()
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    with args.receipt.open("x", encoding="utf-8") as dst:
        json.dump(receipt, dst, indent=2, sort_keys=True)
        dst.write("\n")
    print(json.dumps({k: receipt[k] for k in
                      ("requiredObjectCount", "verifiedObjectCount",
                       "allBytesAcquiredAndSha256Verified")}))
    return 0 if receipt["allBytesAcquiredAndSha256Verified"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
