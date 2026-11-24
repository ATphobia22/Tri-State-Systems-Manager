#!/usr/bin/env python3
"""Source-aware advisory pre-submittal screen — no permits or approvals granted.

Uses TSM's verified-source rule registry to enumerate review pathways, not
to assert that a proposed project meets regulatory requirements.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / "data" / "regulatory" / "tsm-floodway-rules-v1.json"
SHA256 = re.compile(r"^[0-9a-f]{64}$")
STATES = {"IN": "Indiana 811", "IL": "JULIE / Illinois 811", "KY": "Kentucky 811"}
WORK_TYPES = {"earthwork", "utility-excavation", "road-raise",
              "levee-modification", "building-construction"}
SUBSURFACE_WORK = {"earthwork", "utility-excavation", "road-raise", "levee-modification"}


def digest(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                                     allow_nan=False).encode("utf-8")).hexdigest()


def intersection(value: Any, name: str) -> tuple[str, bool]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} must have an intersection record")
    finding = value.get("intersects")
    if finding not in ("yes", "no", "unknown") or type(finding) is not str:
        raise ValueError(f"{name} requires yes/no/unknown, not a truthy guess")
    receipt = value.get("sourceSha256")
    if receipt is not None and (not isinstance(receipt, str) or not SHA256.fullmatch(receipt)):
        raise ValueError(f"{name} sourceSha256 must be a valid lower-case SHA-256")
    # A claimed hash is *not* proof the source was downloaded or verified.
    return finding, bool(receipt)


def screen_project(project: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(project, dict) or project.get("schemaVersion") != "tsm.pre-submittal-screen.v1":
        raise ValueError("unsupported pre-submittal schema")
    project_id = project.get("projectId")
    if not isinstance(project_id, str) or not 1 <= len(project_id) <= 128:
        raise ValueError("projectId must be a nonempty stable identifier")
    state = project.get("jurisdiction")
    if type(state) is not str or state not in STATES:
        raise ValueError("jurisdiction must be an explicitly identified IN, IL or KY")
    work = project.get("workType")
    if type(work) is not str or work not in WORK_TYPES:
        raise ValueError("unsupported or missing workType")
    floodway, floodway_receipt = intersection(project.get("floodway"), "floodway")
    levee, levee_receipt = intersection(project.get("usaceLevee"), "usaceLevee")

    registry = json.loads(REGISTRY_PATH.read_text("utf-8"))
    source_candidates = sorted(
        [rule for rule in registry.get("rules", []) if
         rule.get("jurisdiction") == state and
         rule.get("status") == "VERIFIED_OFFICIAL_SOURCE"],
        key=lambda row: row["id"],
    )
    blockers = [
        "REGULATORY_APPLICABILITY_AND_EXEMPTIONS_NOT_DETERMINED",
        "QUALIFIED_HUMAN_REVIEW_REQUIRED",
        "AGENCY_DECISION_OR_AUTHORIZATION_NOT_PROVIDED",
    ]
    if floodway == "unknown" or not floodway_receipt:
        blockers.append("FLOODWAY_INTERSECTION_EVIDENCE_REQUIRED")
    if floodway == "yes":
        blockers.append("FEMA_FLOODWAY_ENCROACHMENT_REVIEW_REQUIRED")
        blockers.append("HYDRAULIC_BASE_AND_PROPOSED_RUNS_REQUIRED")
    if levee == "unknown" or not levee_receipt:
        blockers.append("USACE_LEVEE_INTERSECTION_EVIDENCE_REQUIRED")
    if levee == "yes":
        blockers.append("USACE_SECTION_408_APPLICABILITY_REVIEW_REQUIRED")
    if work == "levee-modification":
        blockers.append("FEMA_44_CFR_65_10_LEVEE_DOCUMENTATION_REVIEW_REQUIRED")
    if work in SUBSURFACE_WORK:
        blockers.append("UTILITY_LOCATION_AND_ONE_CALL_REVIEW_REQUIRED")
        blockers.append("SUBSURFACE_QUALITY_LEVEL_AND_AS_BUILT_REVIEW_REQUIRED")
    if state == "IN":
        blockers.append("INDIANA_IC_14_28_1_AND_312_IAC_10_APPLICABILITY_REVIEW_REQUIRED")
    elif state == "IL":
        blockers.append("ILLINOIS_17_IAC_PART_3700_APPLICABILITY_REVIEW_REQUIRED")
    else:
        blockers.append("KENTUCKY_STREAM_CONSTRUCTION_RULE_APPLICABILITY_REVIEW_REQUIRED")

    result = {
        "schemaVersion": "tsm.pre-submittal-result.v1",
        "projectId": project_id,
        "jurisdiction": state,
        "workType": work,
        "inputSha256": digest(project),
        "ruleRegistrySha256": digest(registry),
        "authorityClass": "DERIVED",
        "sourceVerification": "RECEIPTS_UNVERIFIED",
        "governanceStatus": "human_review_required",
        "decision": "HUMAN_REVIEW_REQUIRED",
        "candidateRules": [rule["id"] for rule in source_candidates],
        "candidateRuleSources": [{"ruleId": rule["id"], "sourceUrl": rule["sourceUrl"]}
                                 for rule in source_candidates],
        "floodwayIntersection": floodway,
        "leveeIntersection": levee,
        "oneCallProvider": STATES[state] if work in SUBSURFACE_WORK else None,
        "blockers": sorted(set(blockers)),
        "permitApproved": False,
        "engineeringApproved": False,
        "agencyApproved": False,
        "engineerSealed": False,
        "excavationCleared": False,
        "hydraulicModelValidated": False,
        "limitations": [
            "Spatial intersection values and hashes are operator declarations, not independent verification.",
            "Rule IDs are candidates for qualified applicability review; no automatic threshold or exception decision.",
            "Never issue excavation clearance, utility-location assurance or agency authorization from this screen.",
            "No real utility, CEII, parcel, hydraulic or jurisdiction-specific model files were loaded.",
        ],
    }
    result["screenSha256"] = digest(result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True, type=Path)
    args = parser.parse_args()
    raw = args.project.read_bytes()
    if len(raw) > 500_000:
        parser.error("project proposal is too large")
    try:
        project = json.loads(raw, parse_constant=lambda val: (_ for _ in ()).throw(ValueError(val)))
        result = screen_project(project)
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        parser.error(str(error))
    print(json.dumps(result, indent=2, sort_keys=True, allow_nan=False))


if __name__ == "__main__":
    main()
