#!/usr/bin/env python3
"""TSM human-decision record validator; never signs, approves or files itself."""
from __future__ import annotations
import json
import re
import argparse
from pathlib import Path

HASH = re.compile(r"^[0-9a-f]{64}$")
SCOPES = {"CINEMATIC_PUBLICATION", "ENGINEERING_REVIEW", "RELEASE_CANDIDATE", "REGULATORY_PRECHECK"}


def inspect_approval(record: dict) -> dict:
    if record.get("schema") != "tsm.human-approval.v1":
        raise ValueError("unsupported human approval schema")
    scope = record.get("scope")
    if scope not in SCOPES:
        raise ValueError("unsupported approval scope")
    artifact = record.get("artifact_sha256")
    if not isinstance(artifact, str) or not HASH.fullmatch(artifact):
        raise ValueError("approval must bind to the exact SHA-256 artifact")
    decision = record.get("decision")
    if decision not in ("APPROVED", "REJECTED", "PENDING"):
        raise ValueError("invalid decision")
    reviewer = record.get("reviewer")
    if decision == "APPROVED" and (
        not isinstance(reviewer, dict) or
        not reviewer.get("identity_verification_evidence_uri") or
        not reviewer.get("human_asserted_at") or
        not reviewer.get("authorization_scope") == scope or
        not record.get("reviewed_source_evidence_sha256") or
        not HASH.fullmatch(str(record.get("reviewed_source_evidence_sha256")))
    ):
        raise ValueError("cannot accept unsourced or unauthenticated purported approval")
    # Even complete user-supplied fields cannot cryptographically establish
    # authenticity; a separate authenticated review service must validate.
    return {
        "schema": "tsm.human-approval-inspection.v1",
        "artifact_sha256": artifact,
        "scope": scope,
        "recorded_decision": decision,
        "authorization": "UNVERIFIED_EXTERNAL_REVIEW_REQUIRED",
        "may_auto_publish": False,
        "may_auto_file": False,
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("record", type=Path)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    if args.out.exists():
        p.error("refusing to overwrite a prior approval inspection")
    result = inspect_approval(json.loads(args.record.read_text(encoding="utf-8")))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2)+"\n", encoding="utf-8")
    print(result["authorization"])


if __name__ == "__main__":
    main()
