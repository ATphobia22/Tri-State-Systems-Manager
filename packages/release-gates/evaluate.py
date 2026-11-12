#!/usr/bin/env python3
"""Conservative status gate for local geospatial and UE release evidence.

Never promotes a build from a PASSING CI badge. Records reference observed
artifacts, current scope, and independent validation required for release.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

STATES = {"VERIFIED", "PENDING", "BLOCKED", "NOT_EVIDENCED"}
REQUIRED = (
    "source_integrity", "horizontal_crs", "vertical_datum",
    "building_identity", "native_map", "windows_shipping",
    "offline_startup", "headed_render", "human_review",
)


def evaluate(document: dict) -> dict:
    if document.get("schema") != "tsm.release-evidence.v1":
        raise ValueError("unsupported release-evidence schema")
    checks = document.get("checks")
    if not isinstance(checks, dict) or set(checks) != set(REQUIRED):
        raise ValueError("missing or unexpected release gates")
    for key, item in checks.items():
        if not isinstance(item, dict) or item.get("state") not in STATES:
            raise ValueError("invalid state for " + key)
        sha = item.get("artifact_sha256")
        if item["state"] == "VERIFIED" and (
            not isinstance(sha, str) or not re.fullmatch("[0-9a-f]{64}", sha)
            or not isinstance(item.get("evidence_uri"), str) or not item["evidence_uri"].strip()
        ):
            raise ValueError("VERIFIED gate requires evidence URI and source SHA-256: " + key)
    all_green = all(x["state"] == "VERIFIED" for x in checks.values())
    return {
        "schema": "tsm.release-gate-verdict.v1",
        "verdict": "ELIGIBLE_FOR_HUMAN_RELEASE_REVIEW" if all_green else "NOT_RELEASE_READY",
        "passed": [k for k in REQUIRED if checks[k]["state"] == "VERIFIED"],
        "outstanding": {k: checks[k]["state"] for k in REQUIRED if checks[k]["state"] != "VERIFIED"},
        "disclaimer": "Eligible for review is not an automatic release, regulatory or survey certification."
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("evidence_json", type=Path)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    if args.out.exists():
        p.error("refusing to overwrite prior release verdict")
    outcome = evaluate(json.loads(args.evidence_json.read_text(encoding="utf-8")))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(outcome, indent=2)+"\n", encoding="utf-8")
    print(outcome["verdict"])


if __name__ == "__main__":
    main()
