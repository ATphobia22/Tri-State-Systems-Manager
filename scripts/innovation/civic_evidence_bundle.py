#!/usr/bin/env python3
"""TSM Civic Evidence Bundle: independent, offline join of three advisory outputs.

Produces a hash-bound review manifest; it is not a regulatory approval,
source-data validation, verified geometry join, or cryptographic signature.
"""
from __future__ import annotations

import argparse
from hashlib import sha256
import json
from pathlib import Path
import re
import sys

SCHEMA = "tsm.civic-innovation.evidence-bundle.v1"
SHA = re.compile(r"^[a-f0-9]{64}$")
MAX_JSON_BYTES = 16 * 1024 * 1024
MAX_PACKAGE_BYTES = 64 * 1024 * 1024


def _sha(path: Path, limit: int) -> str:
    if path.is_symlink() or not path.is_file() or path.stat().st_size > limit:
        raise ValueError("Evidence must be a bounded regular non-symlink file")
    digest = sha256()
    size = 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            size += len(chunk)
            if size > limit:
                raise ValueError("Evidence file exceeded size bound")
            digest.update(chunk)
    return digest.hexdigest()


def _json(path: Path) -> tuple[dict, str]:
    # The parsed object and receipt hash must describe exactly the same bytes.
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_JSON_BYTES:
        raise ValueError("Evidence must be a bounded regular non-symlink JSON file")
    with path.open("rb") as stream:
        raw = stream.read(MAX_JSON_BYTES + 1)
    if len(raw) > MAX_JSON_BYTES:
        raise ValueError("Evidence file exceeded size bound")
    digest = sha256(raw).hexdigest()
    def unique_pairs(pairs):
        out = {}
        for k, val in pairs:
            if k in out:
                raise ValueError("Duplicate JSON property: " + k)
            out[k] = val
        return out
    data = json.loads(raw, object_pairs_hook=unique_pairs,
                      parse_constant=lambda v: (_ for _ in ()).throw(ValueError("Nonfinite JSON")))
    if not isinstance(data, dict):
        raise ValueError("Evidence document root must be an object")
    return data, digest


def _require_schema(data: dict, expected: str):
    if data.get("schema") != expected:
        raise ValueError("Unexpected evidence schema: " + str(data.get("schema")))


def bundle(geotruth_path: Path, contract_path: Path, *,
           passport_path: Path | None = None,
           receipt_path: Path | None = None) -> dict:
    geo, geo_sha = _json(geotruth_path)
    contracts, contracts_sha = _json(contract_path)
    _require_schema(geo, "tsm.geotruth.building-qa.v1")
    _require_schema(contracts, "tsm.government.contract-foundry.v1")
    if (passport_path is None) != (receipt_path is None):
        raise ValueError("Passport JSON and its receipt must be supplied together")
    review = []
    count_gap = geo.get("expectedMinusPublishedCount")
    if type(count_gap) is not int:
        raise ValueError("GeoTruth count gap must be an integer")
    if count_gap != 0:
        review.append("BUILDING_SOURCE_IDENTITY_RECONCILIATION")
    if geo.get("publishedPinMatchesActualBytes") is not True:
        review.append("BUILDING_PIN_CHANGED_REVALIDATE_SOURCE_IDS")
    meta_gap = contracts.get("contractChecksMissingCount")
    if type(meta_gap) is not int or meta_gap < 0:
        raise ValueError("Foundry metadata review count is invalid")
    if meta_gap:
        review.append("AGENCY_SOURCE_METADATA_INCOMPLETE")
    result = {
        "schema": SCHEMA,
        "classification": "INFORMATIONAL_ONLY",
        "geotruth": {
            "inputSha256": geo_sha,
            "publishedAssetSha256": geo.get("publishedSha256"),
            "expectedArchivedCount": geo.get("expectedArchivedSourceFeatureCount"),
            "publishedCount": geo.get("publishedFeatureCount"),
            "countGap": count_gap,
            "status": geo.get("identityCoverageStatus"),
        },
        "governmentContracts": {
            "inputSha256": contracts_sha,
            "catalogSha256": contracts.get("catalogSha256"),
            "catalogSourceCount": contracts.get("catalogSourceCount"),
            "missingMetadataReviewCount": meta_gap,
            "dataPlaneImpacts": contracts.get("planeImpact", {}).get("impacted_planes", [])
                                 if isinstance(contracts.get("planeImpact"), dict) else [],
        },
        "passport": {"status": "NOT_EVIDENCED"},
        "reviewRequired": review,
        "humanAuthorityFinal": True,
        "sourceDataIndependentlyVerifiedByBundle": False,
        "geospatialAlignmentIndependentlyVerified": False,
        "scientificCalibrationVerified": False,
        "renderingValidated": False,
        "windowsOfflineShippingVerified": False,
        "regulatoryDetermination": False,
        "surveyCertification": False,
        "notice": "A bundle checksum proves local byte integrity only. Human review and independent source/model/render validation remain required.",
    }
    if passport_path is not None and receipt_path is not None:
        passport, passport_sha = _json(passport_path)
        receipt, receipt_sha = _json(receipt_path)
        _require_schema(passport, "tsm.public-evidence.passport.v1")
        _require_schema(receipt, "tsm.civic-evidence-passport.export-receipt.v1")
        if (receipt.get("inputPassportFileSha256") != passport_sha
                or receipt.get("passportIntegritySha256") != passport.get("integritySha256")):
            raise ValueError("Passport and export receipt hashes disagree")
        if (passport.get("regulatoryDetermination") is not False
                or passport.get("engineeringUse") is not False
                or passport.get("surveyCertification") is not False):
            raise ValueError("Public passport is not explicitly informational")
        exports = receipt.get("outputs")
        if not isinstance(exports, dict) or set(exports) != {"docx", "xlsx"}:
            raise ValueError("Expected docx and xlsx receipt records")
        checked = {}
        for kind, record in sorted(exports.items()):
            if not isinstance(record, dict):
                raise ValueError("Invalid exported package record")
            name, expected = record.get("name"), record.get("sha256")
            if (not isinstance(name, str) or name != Path(name).name
                    or not isinstance(expected, str) or not SHA.fullmatch(expected)
                    or not name.endswith("." + kind)):
                raise ValueError("Unsafe or invalid export record")
            path = receipt_path.parent / name
            actual = _sha(path, MAX_PACKAGE_BYTES)
            if expected != actual:
                raise ValueError("Document hash mismatch: " + kind)
            checked[kind] = {"name": name, "sha256": actual}
        result["passport"] = {
            "status": "LOCAL_EXPORT_BYTES_MATCH_RECEIPT_ONLY",
            "inputSha256": passport_sha,
            "exportReceiptSha256": receipt_sha,
            "parcelId": passport["parcelId"],
            "snapshotId": passport["snapshotId"],
            "outputs": checked,
            "parcelGeometryJoinVerified": False,
        }
    else:
        review.append("PASSPORT_EXPORT_NOT_SUPPLIED")
    return result


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--geotruth", required=True, type=Path)
    p.add_argument("--contracts", required=True, type=Path)
    p.add_argument("--passport", type=Path)
    p.add_argument("--passport-receipt", type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args(argv)
    inputs = [x for x in (args.geotruth, args.contracts, args.passport,
                          args.passport_receipt) if x is not None]
    if args.output.resolve() in {x.resolve() for x in inputs}:
        p.error("Output must not overwrite any evidence input")
    try:
        report = bundle(args.geotruth, args.contracts, passport_path=args.passport,
                        receipt_path=args.passport_receipt)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("x", encoding="utf-8") as file:
            json.dump(report, file, indent=2, ensure_ascii=False, allow_nan=False)
            file.write("\n")
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print("Evidence bundle failed: " + str(exc), file=sys.stderr)
        return 2
    print("TSM evidence bundle emitted; " + str(len(report["reviewRequired"])) +
          " open review areas; no independent scientific/Windows/rendering verification")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
