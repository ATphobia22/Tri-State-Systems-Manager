#!/usr/bin/env python3
"""Offline IFC source-byte intake gate for the GeoBIM staging workflow.

Verifies declared metadata and a SHA-256 digest. This is NOT a full IFC parser,
CRS transformation, model approval, or engineering/survey certification.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path


def verify(ifc: Path, metadata: dict) -> dict:
    if not isinstance(metadata, dict):
        raise ValueError("metadata must be an object")
    for field in ("sourceId", "expectedSha256", "horizontalCrs", "verticalDatum", "units", "license", "authorityClass"):
        if not isinstance(metadata.get(field), str) or not metadata[field].strip():
            raise ValueError(f"missing or empty metadata: {field}")
    if metadata["authorityClass"] not in {"DERIVED", "SOURCE_OBSERVATION", "CANDIDATE"}:
        raise ValueError("invalid authorityClass; cannot assert regulatory authority")
    if not re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", metadata["sourceId"]):
        raise ValueError("sourceId is not a bounded identifier")
    if not re.fullmatch(r"[0-9a-fA-F]{64}", metadata["expectedSha256"]):
        raise ValueError("expectedSha256 must be 64 hexadecimal digits")
    if not re.fullmatch(r"EPSG:[0-9]{3,6}", metadata["horizontalCrs"]):
        raise ValueError("horizontalCrs must explicitly name an EPSG code")
    if metadata["verticalDatum"].strip().lower() in {"unknown", "none", "unspecified", "n/a"}:
        raise ValueError("vertical datum requires an explicit documented value")
    if metadata["units"] not in {"m", "ftUS", "ft"}:
        raise ValueError("units must explicitly be m, ftUS, or ft")
    if ifc.is_symlink() or not ifc.is_file() or ifc.suffix.lower() != ".ifc":
        raise ValueError("source must be a regular, non-symlink IFC file")
    if ifc.stat().st_size == 0:
        raise ValueError("empty IFC source")
    digest = hashlib.sha256()
    with ifc.open("rb") as fh:
        prefix = fh.read(4096)
        if not prefix.lstrip(b"\xef\xbb\xbf \t\r\n").startswith(b"ISO-10303-21;"):
            raise ValueError("not an IFC STEP physical file header")
        digest.update(prefix)
        while chunk := fh.read(1024 * 1024):
            digest.update(chunk)
    actual = digest.hexdigest()
    if actual.lower() != metadata["expectedSha256"].lower():
        raise ValueError("source checksum mismatch")
    return {
        "schemaVersion": "tsm.geobim.intake-receipt.v1",
        "sourceId": metadata["sourceId"],
        "sha256": actual,
        "sizeBytes": ifc.stat().st_size,
        "horizontalCrsDeclared": metadata["horizontalCrs"],
        "verticalDatumDeclared": metadata["verticalDatum"],
        "unitsDeclared": metadata["units"],
        "licenseDeclared": metadata["license"],
        "authorityClass": metadata["authorityClass"],
        "sourceBytesVerified": True,
        "ifcSchemaValidated": False,
        "georeferenceVerified": False,
        "surveyCertified": False,
        "regulatoryApproved": False,
        "nativeShippingVerified": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ifc", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    args = parser.parse_args()
    if args.metadata.is_symlink():
        parser.error("metadata symlink not allowed")
    metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
    receipt = verify(args.ifc, metadata)
    if args.receipt.resolve() in {args.ifc.resolve(), args.metadata.resolve()}:
        parser.error("receipt cannot overwrite an input")
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    with args.receipt.open("x", encoding="utf-8") as fh:
        json.dump(receipt, fh, indent=2, sort_keys=True)
        fh.write("\n")
    print(json.dumps({"status": "verified-source-bytes-only", "receipt": str(args.receipt)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
