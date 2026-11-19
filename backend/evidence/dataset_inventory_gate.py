"""Offline provenance/inventory preflight. Never grants engineering or regulatory approval."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

SHA = re.compile(r"^[0-9a-f]{64}$")
EPSG = re.compile(r"^EPSG:[0-9]{3,6}$")
FIPS = re.compile(r"^[0-9]{5}$")
USES = {"VISUALIZATION", "ENGINEERING", "REGULATORY_SCREENING"}


def _timestamp(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).utcoffset() is not None
    except (ValueError, AttributeError):
        return False


def _artifact(root: Path, entry: object, label: str, errors: list[str], *, read=False):
    """Stream hashes for huge originals; load only a bounded ID index."""
    if not isinstance(entry, dict):
        errors.append(f"{label}: MISSING_ARTIFACT_RECORD")
        return None
    path, expected = entry.get("path"), entry.get("sha256")
    if not isinstance(path, str) or not path or not isinstance(expected, str) or not SHA.fullmatch(expected):
        errors.append(f"{label}: PATH_OR_SHA256_INVALID")
        return None
    relative = Path(path)
    if relative.is_absolute() or ".." in relative.parts:
        errors.append(f"{label}: UNSAFE_PATH")
        return None
    base = root.resolve()
    if any((base.joinpath(*relative.parts[:i])).is_symlink() for i in range(1, len(relative.parts) + 1)):
        errors.append(f"{label}: SYMLINK_FORBIDDEN")
        return None
    target = (base / relative).resolve()
    if not target.is_relative_to(base) or not target.is_file():
        errors.append(f"{label}: ARTIFACT_MISSING_OR_OUTSIDE_ROOT")
        return None
    digest = hashlib.sha256()
    with target.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != expected:
        errors.append(f"{label}: SHA256_MISMATCH")
        return None
    if entry.get("bytes") != target.stat().st_size:
        errors.append(f"{label}: SIZE_MISMATCH")
        return None
    if read:
        if target.stat().st_size > 64 * 1024 * 1024:
            errors.append(f"{label}: IDENTIFIER_INVENTORY_TOO_LARGE")
            return None
        return target.read_bytes()
    return b"verified"


def preflight(manifest: dict, root: Path) -> dict:
    """Reconcile physical source + feature-ID index without self-certification."""
    errors: list[str] = []
    empty = {"status": "NOT_RECONCILED", "inventoryReconciled": False,
             "engineeringReviewReady": False, "engineeringConsumptionAuthorized": False,
             "regulatoryDetermination": None}
    if not isinstance(manifest, dict) or manifest.get("schema") != "tsm-dataset-inventory-reconciliation-v1":
        return {**empty, "errors": ["SCHEMA_INVALID"]}
    source, inventory = manifest.get("source"), manifest.get("inventory")
    if not isinstance(source, dict) or not isinstance(inventory, dict):
        errors.append("SOURCE_AND_INVENTORY_REQUIRED")
        source = source if isinstance(source, dict) else {}
        inventory = inventory if isinstance(inventory, dict) else {}
    for field in ("datasetId", "authority", "serviceLayerId", "releaseId", "limitations", "units"):
        if not isinstance(source.get(field), str) or not source[field].strip():
            errors.append(f"source.{field}: REQUIRED")
    uri = source.get("sourceUri")
    parts = urlsplit(uri) if isinstance(uri, str) else None
    if not parts or parts.scheme != "https" or not parts.hostname or parts.username or parts.password:
        errors.append("source.sourceUri: HTTPS_REQUIRED")
    for field in ("retrievedAtUtc", "publicationAtUtc", "acquiredAtUtc"):
        if not _timestamp(source.get(field)):
            errors.append(f"source.{field}: TIMEZONE_REQUIRED")
    crs = source.get("horizontalCrs")
    if not isinstance(crs, str) or not EPSG.fullmatch(crs):
        errors.append("source.horizontalCrs: EPSG_REQUIRED")
    datum = source.get("verticalDatum")
    if not isinstance(datum, str) or not datum.strip():
        errors.append("source.verticalDatum: REQUIRED_USE_NOT_APPLICABLE_FOR_2D")
    usage = manifest.get("intendedUse")
    if usage not in USES:
        errors.append("intendedUse: INVALID")
    expected, observed = inventory.get("expectedCount"), inventory.get("observedCount")
    if any(isinstance(v, bool) or not isinstance(v, int) or v <= 0 for v in (expected, observed)):
        errors.append("inventory: POSITIVE_INTEGER_COUNTS_REQUIRED")
    elif expected != observed:
        errors.append(f"inventory: COUNT_MISMATCH expected={expected} observed={observed}")
    scope = inventory.get("expectedCountyFips")
    if (not isinstance(scope, list) or not scope
            or any(not isinstance(v, str) or not FIPS.fullmatch(v) for v in scope)
            or len(scope) != len(set(scope))):
        errors.append("inventory: UNIQUE_FIVE_DIGIT_FIPS_REQUIRED")
    snapshot = _artifact(root, source.get("snapshot"), "source.snapshot", errors)
    id_bytes = _artifact(root, inventory.get("featureIdInventory"), "inventory.featureIdInventory",
                         errors, read=True)
    if id_bytes is not None:
        try:
            ids = json.loads(id_bytes)
            if not isinstance(ids, dict) or ids.get("schema") != "tsm-feature-id-inventory-v1":
                errors.append("inventory: FEATURE_ID_SCHEMA_INVALID")
            else:
                keys = ids.get("featureIds")
                if (not isinstance(keys, list) or not keys
                        or any(isinstance(x, bool) or not isinstance(x, (str, int)) or not str(x) for x in keys)):
                    errors.append("inventory: FEATURE_IDS_INVALID")
                else:
                    if len(set(map(str, keys))) != len(keys):
                        errors.append("inventory: DUPLICATE_FEATURE_IDS")
                    if len(keys) != observed:
                        errors.append("inventory: OBSERVED_ID_COUNT_MISMATCH")
                if ids.get("datasetId") != source.get("datasetId") or ids.get("releaseId") != source.get("releaseId"):
                    errors.append("inventory: DATASET_OR_RELEASE_MISMATCH")
                if ids.get("countyFips") != scope:
                    errors.append("inventory: COUNTY_COVERAGE_MISMATCH")
        except (TypeError, ValueError):
            errors.append("inventory: FEATURE_ID_JSON_INVALID")
    review = manifest.get("review")
    review = review if isinstance(review, dict) else {}
    if review.get("sourceIdentityIndependentlyReviewed") is True:
        errors.append("review: SELF_ATTESTED_INDEPENDENT_AUTHORITY_NOT_ACCEPTED")
    review_bytes = (_artifact(root, review["evidence"], "review.evidence", errors)
                    if "evidence" in review else None)
    reconciled = not errors and snapshot is not None and id_bytes is not None
    review_ready = reconciled and review_bytes is not None and datum not in ("UNKNOWN", "NONE", "NOT_APPLICABLE")
    if usage in {"ENGINEERING", "REGULATORY_SCREENING"} and not review_ready:
        errors.append("usage: ENGINEERING_HANDOFF_REQUIRES_RECONCILED_DATUM_AND_REVIEW_EVIDENCE")
    if usage == "REGULATORY_SCREENING":
        errors.append("usage: EFFECTIVE_FEMA_LOMC_BFE_AND_AGENCY_REVIEW_NOT_ESTABLISHED")
    return {
        "schema": "tsm-dataset-inventory-reconciliation-result-v1",
        "datasetId": source.get("datasetId"),
        "status": ("RECONCILED_FOR_PREVIEW" if reconciled and usage == "VISUALIZATION"
                   else "RECONCILED_SOURCE_RESTRICTED" if reconciled else "NOT_RECONCILED"),
        "inventoryReconciled": reconciled,
        "engineeringReviewReady": bool(review_ready),
        "engineeringConsumptionAuthorized": False,
        "regulatoryDetermination": None,
        "independentAuthorityEstablished": False,
        "errors": errors,
        "limitations": "File checksums and local review records do not authenticate government issuance, science, or professional approval.",
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--require-reconciled", action="store_true")
    args = parser.parse_args(argv)
    result = preflight(json.loads(args.manifest.read_text(encoding="utf-8")), args.root)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 2 if args.require_reconciled and (not result["inventoryReconciled"] or result["errors"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
