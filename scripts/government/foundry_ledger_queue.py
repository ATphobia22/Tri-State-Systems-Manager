#!/usr/bin/env python3
"""Generate a hash-linked Foundry review queue beside, not inside, TSM's immutable ledger.

No automatic append, authorization, agency filing or data verification.
Accepts only a bounded local Government Data Contract Foundry report.
"""
from __future__ import annotations

import argparse
from hashlib import sha256
import json
from pathlib import Path
import re
import sys
from typing import Any

SCHEMA = "tsm.government.foundry-ledger-queue.v1"
HASH = re.compile(r"^[a-f0-9]{64}$")
MAX_BYTES = 16 * 1024 * 1024
MAX_SOURCES = 4096
MAX_REVIEW_ITEMS = 20000


def _read(path: Path) -> tuple[dict[str, Any], str]:
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_BYTES:
        raise ValueError("Foundry report must be a bounded regular local file")
    payload = path.read_bytes()
    if len(payload) > MAX_BYTES:
        raise ValueError("Foundry report too large")
    def unique_pairs(pairs):
        obj = {}
        for key, value in pairs:
            if key in obj:
                raise ValueError("Duplicate JSON property: " + key)
            obj[key] = value
        return obj
    document = json.loads(payload, object_pairs_hook=unique_pairs,
                          parse_constant=lambda v: (_ for _ in ()).throw(ValueError("Nonfinite JSON")))
    if not isinstance(document, dict):
        raise ValueError("Expected a JSON object")
    return document, sha256(payload).hexdigest()


def _name(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value or len(value) > 256:
        raise ValueError("Invalid " + label)
    return value


def _sha(value: Any, label: str) -> str:
    if not isinstance(value, str) or not HASH.fullmatch(value):
        raise ValueError("Invalid " + label + " SHA-256")
    return value


def _entry(source_id: str, kind: str, field: str, payload: dict[str, Any],
           *, planes: list[str] | None = None) -> dict[str, Any]:
    text = json.dumps({"kind": kind, "sourceId": source_id, "field": field,
                       "details": payload}, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=True, allow_nan=False).encode()
    return {
        "entryId": "FDR-" + sha256(text).hexdigest()[:24],
        "sourceId": source_id,
        "kind": kind,
        "field": field,
        "reviewStatus": "PENDING_HUMAN_REVIEW",
        "authorityClass": "DERIVED",
        "sourceBytesIndependentlyVerified": False,
        "affectedPlanes": planes or [],
        "relationshipEvidence": "DECLARED_ONLY",
        "details": payload,
        "entryPayloadSha256": sha256(text).hexdigest(),
    }


def make_queue(foundry: dict[str, Any], file_sha256: str) -> dict[str, Any]:
    _sha(file_sha256, "Foundry input")
    if not isinstance(foundry, dict) or foundry.get("schema") != "tsm.government.contract-foundry.v1":
        raise ValueError("Expected TSM Government Data Contract Foundry report")
    _sha(foundry.get("catalogSha256"), "Source catalog")
    rows = foundry.get("sources")
    if not isinstance(rows, list) or len(rows) > MAX_SOURCES:
        raise ValueError("Invalid Foundry source rows")
    ids = set()
    entries: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Invalid source row")
        source_id = _name(row.get("sourceId"), "sourceId")
        if source_id in ids:
            raise ValueError("Duplicate source identifier: " + source_id)
        ids.add(source_id)
        checks = row.get("requiredReviews", [])
        if not isinstance(checks, list) or len(checks) > 64:
            raise ValueError("Invalid source review checks")
        seen_fields = set()
        for check in checks:
            if not isinstance(check, dict):
                raise ValueError("Invalid metadata review check")
            field = _name(check.get("field"), "review field")
            if field in seen_fields:
                raise ValueError("Duplicate review field: " + field)
            seen_fields.add(field)
            if check.get("state") != "NOT_EVIDENCED":
                raise ValueError("Unexpected review status")
            entry = _entry(source_id, "MISSING_SOURCE_METADATA", field,
                           {"requiredReview": _name(check.get("requiredReview"), "requiredReview"),
                            "state": "NOT_EVIDENCED"})
            entries.append(entry)
    plane_map = foundry.get("planeImpact", {})
    if not isinstance(plane_map, dict):
        raise ValueError("Invalid plane impact map")
    planes = plane_map.get("impacted_planes", [])
    if not isinstance(planes, list) or len(planes) > 128:
        raise ValueError("Invalid plane impacts")
    for item in planes:
        if (not isinstance(item, dict) or item.get("relationship_evidence") != "DECLARED_ONLY"
                or not isinstance(item.get("changed_source_ids"), list)):
            raise ValueError("Only declared plane relationships are eligible")
    drift = foundry.get("drift")
    if drift is not None:
        if not isinstance(drift, dict) or drift.get("schema") != "tsm.government.source-contract-impact.v1":
            raise ValueError("Unexpected drift schema")
        changes = drift.get("changes")
        if not isinstance(changes, list) or len(changes) > MAX_REVIEW_ITEMS:
            raise ValueError("Invalid source drift change list")
        for change in changes:
            if not isinstance(change, dict):
                raise ValueError("Invalid source drift change")
            sid = _name(change.get("source_id"), "drift source_id")
            if sid not in ids and change.get("kind") != "REMOVED":
                raise ValueError("Change not present in current source catalog")
            kind = _name(change.get("kind"), "change kind")
            if kind not in ("ADDED", "REMOVED", "FIELD_CHANGED"):
                raise ValueError("Unrecognized drift kind")
            field = change.get("field") or "_source"
            field = _name(field, "changed field")
            change_planes = sorted({
                _name(p.get("plane_id"), "plane id")
                for p in planes if sid in p.get("changed_source_ids", [])
            })
            # Fields are copied as review evidence only; no official data value is inferred.
            detail = {
                "changeKind": kind,
                "before": change.get("before"),
                "after": change.get("after"),
                "severity": change.get("severity", "REVIEW_REQUIRED"),
            }
            entries.append(_entry(sid, "SOURCE_DRIFT", field, detail, planes=change_planes))
    if len(entries) > MAX_REVIEW_ITEMS:
        raise ValueError("Foundry generated too many advisory entries")
    entries.sort(key=lambda item: (item["sourceId"], item["kind"], item["field"], item["entryId"]))
    if len({item["entryId"] for item in entries}) != len(entries):
        raise ValueError("Duplicate immutable review entry identities")
    return {
        "schema": SCHEMA,
        "classification": "INFORMATIONAL_ONLY",
        "sourceReportSha256": file_sha256,
        "catalogSha256": foundry["catalogSha256"],
        "ledgerSubmissionState": "NOT_SUBMITTED",
        "ledgerMutationPerformed": False,
        "immutableLedgerAcceptance": "NOT_EVIDENCED",
        "dataPlaneLinks": "DECLARED_ONLY",
        "sourceDataIndependentlyVerified": False,
        "humanAuthorityFinal": True,
        "regulatoryDetermination": False,
        "reviewItemCount": len(entries),
        "entries": entries,
        "notice": "Local source-drift/metadata review queue only. Not signed, not inserted into the authoritative immutable ledger, and not an agency decision.",
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--foundry", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        if args.output.resolve() == args.foundry.resolve():
            raise ValueError("Output may not overwrite its input")
        foundry, digest = _read(args.foundry)
        report = make_queue(foundry, digest)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("x", encoding="utf-8") as stream:
            json.dump(report, stream, indent=2, ensure_ascii=False, allow_nan=False)
            stream.write("\n")
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print("Foundry ledger review error: " + str(exc), file=sys.stderr)
        return 2
    print(f"Foundry review queue: {report['reviewItemCount']} advisory items, "
          "NO authoritative ledger append, NO regulatory approval")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
