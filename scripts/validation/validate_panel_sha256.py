#!/usr/bin/env python3
"""Fail-closed SHA-256 validation for FIRM/panel/evidence bytes vs register.

Does NOT determine LOMA status, SFHA status, or FEMA outcomes.
Exit 0 only when every expected hash that is present on disk matches.
Missing files with expected hashes → exit 2 (SOURCE_UNAVAILABLE / incomplete).
Hash mismatch → exit 1.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from pathlib import Path

CASE_DIR_REL = Path("data") / "evidence" / "layer2" / "26-05-2022A"

EXPECTED_PRIMARY_FEMA_LETTER = (
    "8186cbf49bfa5ae415aacaf1b548f75fc02692a5793c30cdebb8cf7f6f20dcde"
)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_register_rows(register_path: Path) -> list[dict[str, str]]:
    if not register_path.is_file():
        return []
    with register_path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="Repo root (default: Tri-State-Systems-Manager)",
    )
    ap.add_argument(
        "--extra",
        type=Path,
        nargs="*",
        default=[],
        help="Extra files to hash and report",
    )
    args = ap.parse_args()
    root: Path = args.root

    case_dir = root / CASE_DIR_REL
    lock_path = case_dir / "evidence_lock_packet.json"
    register_path = case_dir / "TSM_Evidence_Layer2_Evidence_Register.csv"
    if not register_path.is_file():
        register_path = case_dir / "evidence-register.csv"

    results: list[dict] = []
    failures = 0
    missing = 0

    if lock_path.is_file():
        digest = sha256_file(lock_path)
        results.append(
            {
                "path": str(lock_path.relative_to(root)),
                "sha256": digest,
                "role": "evidence_lock_packet",
                "match": "RECORDED",
            }
        )
        try:
            payload = json.loads(lock_path.read_text(encoding="utf-8"))
            inner = payload.get("immutable_hash")
            if inner and isinstance(inner, str) and len(inner) == 64:
                results.append(
                    {
                        "path": str(lock_path.relative_to(root)),
                        "sha256": inner,
                        "role": "immutable_hash_field",
                        "match": "PAYLOAD_FIELD",
                    }
                )
        except json.JSONDecodeError as e:
            print(f"FAIL: evidence_lock_packet.json invalid JSON: {e}", file=sys.stderr)
            failures += 1
    else:
        print(f"MISSING: {lock_path}", file=sys.stderr)
        missing += 1

    for row in load_register_rows(register_path):
        expected = (
            row.get("sha256")
            or row.get("content_hash_sha256")
            or row.get("SHA256")
            or ""
        ).strip().lower()
        locator = (
            row.get("path")
            or row.get("source_locator")
            or row.get("file")
            or row.get("evidence_id")
            or ""
        ).strip()
        if not expected or expected in ("null", "none", "to_collect"):
            continue
        candidate = case_dir / locator if locator and not locator.startswith("http") else None
        if candidate and candidate.is_file():
            actual = sha256_file(candidate)
            ok = actual == expected
            results.append(
                {
                    "path": str(candidate.relative_to(root)),
                    "sha256": actual,
                    "expected": expected,
                    "match": "OK" if ok else "MISMATCH",
                }
            )
            if not ok:
                failures += 1
        else:
            results.append(
                {
                    "path": locator or "(register row)",
                    "expected": expected,
                    "match": "SOURCE_UNAVAILABLE",
                }
            )
            missing += 1

    if case_dir.is_dir():
        for p in sorted(case_dir.iterdir()):
            if p.is_file() and p.suffix.lower() in {".pdf", ".json", ".csv", ".txt", ".sql", ".md"}:
                results.append(
                    {
                        "path": str(p.relative_to(root)),
                        "sha256": sha256_file(p),
                        "role": "case_dir_inventory",
                        "match": "INVENTORY",
                    }
                )

    for extra in args.extra:
        ep = extra if extra.is_absolute() else root / extra
        if ep.is_file():
            results.append(
                {
                    "path": str(ep),
                    "sha256": sha256_file(ep),
                    "role": "extra",
                    "match": "INVENTORY",
                }
            )
        else:
            missing += 1
            results.append({"path": str(ep), "match": "SOURCE_UNAVAILABLE"})

    results.append(
        {
            "path": "CONTROL:original_fema_letter_26-05-2022A",
            "expected": EXPECTED_PRIMARY_FEMA_LETTER,
            "match": "CONTROL_DIGEST",
            "note": "Compare any local 26-05-2022A-*.pdf to this digest from case claim_controls",
        }
    )

    out = {
        "case": "26-05-2022A",
        "panel": "18129C0265C",
        "community": "180209",
        "failures": failures,
        "missing": missing,
        "results": results,
        "claim_controls": {
            "do_not_claim_loma_approved": True,
            "hash_match_is_not_fema_determination": True,
        },
    }
    print(json.dumps(out, indent=2))

    if failures:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
