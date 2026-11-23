"""Operator-only promotion of reviewed geospatial snapshots to the public read API.

Requires database write permission AND an explicit reviewer-subject allowlist.
Never exposes a public write endpoint or asserts agency/regulatory approval.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path


def publish(asset_id: str, reviewer: str, proof_file: Path, reason: str, connect=None) -> dict:
    subjects = {item.strip() for item in os.getenv(
        "TSM_TWIN_REVIEWER_SUBJECTS", "").split(",") if item.strip()}
    if not subjects or reviewer not in subjects:
        raise PermissionError("EXPLICIT_LOCAL_REVIEWER_ALLOWLIST_REQUIRED")
    if (not asset_id or not reason.strip() or not proof_file.is_file()
            or proof_file.is_symlink() or proof_file.stat().st_size > 1024 * 1024
            or proof_file.stat().st_size < 32):
        raise ValueError("REVIEW_RECEIPT_REQUIRED")
    proof_hash = hashlib.sha256(proof_file.read_bytes()).hexdigest()
    if connect is None:
        import psycopg2
        connect = psycopg2.connect
    dsn = os.getenv("TSM_POSTGIS_DSN")
    if not dsn:
        raise RuntimeError("TSM_POSTGIS_DSN_REQUIRED")
    connection = connect(dsn)
    try:
        with connection.cursor() as cur:
            cur.execute("""
                SELECT validation_status,publication_status,manifest
                  FROM twin_geo.asset WHERE asset_id=%s FOR UPDATE
            """, (asset_id,))
            row = cur.fetchone()
            if row is None:
                raise ValueError("UNKNOWN_ASSET")
            validation, published, manifest = row
            if isinstance(manifest, str):
                manifest = json.loads(manifest)
            if (validation != "PASS" or published != "NOT_APPROVED"
                    or manifest.get("licenseReviewed") is not True
                    or not manifest.get("reviewId")):
                raise ValueError("ASSET_NOT_ELIGIBLE_FOR_PUBLICATION")
            cur.execute("""
               INSERT INTO twin_geo.review_event
                 (asset_id,action,reviewer_subject,reviewer_proof_sha256,reason)
               VALUES (%s,'APPROVE_FOR_VIEW',%s,%s,%s)
            """, (asset_id, reviewer, proof_hash, reason))
            cur.execute("""
               UPDATE twin_geo.asset SET publication_status='APPROVED_FOR_VIEW'
                WHERE asset_id=%s AND validation_status='PASS'
            """, (asset_id,))
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {"assetId": asset_id, "publicationStatus": "APPROVED_FOR_VIEW",
            "reviewReceiptSha256": proof_hash, "regulatoryDetermination": False}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("asset_id")
    parser.add_argument("--reviewer", required=True)
    parser.add_argument("--proof-file", required=True, type=Path)
    parser.add_argument("--reason", required=True)
    args = parser.parse_args()
    print(json.dumps(publish(args.asset_id,args.reviewer,args.proof_file,args.reason), indent=2))


if __name__ == "__main__":
    main()
