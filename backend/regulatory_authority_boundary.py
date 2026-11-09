"""Fail-closed evidence boundary between scientific reproducibility and agency authority.

This module is an *intake* verifier. A source being government-published does not
make a derivative model a legally adopted determination. A hash proves file
integrity against a recorded digest, not the identity of an issuer or approval.
"""
from __future__ import annotations

import hashlib
import math
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

_SHA = frozenset("0123456789abcdef")
_CLASSIFICATIONS = frozenset({"OBSERVED", "DERIVED", "SCENARIO", "REGULATORY_DOCUMENT"})
_DECISION_TYPES = frozenset({"FEMA_LOMA", "FEMA_LOMR", "FEMA_CLOMR", "FLOODWAY_PERMIT", "ENGINEERING_SEAL", "SURVEY_PLAT", "OTHER_AGENCY_DECISION"})


def _sha(value: Any) -> str:
    if not isinstance(value, str) or len(value) != 64 or any(c not in _SHA for c in value):
        raise ValueError("EVIDENCE_SHA256_INVALID")
    return value


def _date(value: Any) -> datetime:
    if not isinstance(value, str):
        raise ValueError("EVIDENCE_DATE_REQUIRED")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("EVIDENCE_DATE_INVALID") from exc
    if parsed.utcoffset() is None:
        raise ValueError("EVIDENCE_DATE_TIMEZONE_REQUIRED")
    return parsed


def _required_string(item: dict, name: str) -> str:
    value = item.get(name)
    if not isinstance(value, str) or not value.strip():
        raise ValueError("EVIDENCE_FIELD_REQUIRED:" + name)
    return value.strip()


def _uri(value: Any) -> str:
    if not isinstance(value, str):
        raise ValueError("EVIDENCE_URI_REQUIRED")
    parts = urlsplit(value)
    if parts.scheme != "https" or not parts.hostname or parts.username or parts.password:
        raise ValueError("EVIDENCE_HTTPS_URI_REQUIRED")
    return value


def _verify_local_artifact(artifact: dict) -> None:
    if not isinstance(artifact, dict):
        raise ValueError("EVIDENCE_ARTIFACT_REQUIRED")
    expected = _sha(artifact.get("sha256"))
    path = Path(_required_string(artifact, "path"))
    if not path.is_file() or path.is_symlink():
        raise ValueError("EVIDENCE_ARTIFACT_MISSING_OR_SYMLINK")
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != expected:
        raise ValueError("EVIDENCE_ARTIFACT_TAMPERED")


def evaluate_authority_packet(packet: dict[str, Any]) -> dict[str, Any]:
    """Inspect source lineage and decision *documents*, never grant legal authority.

    The result distinguishes an evidence packet from an independently confirmed
    agency decision. Even a passing technical run is not a FEMA map change.
    """
    if not isinstance(packet, dict) or packet.get("schemaVersion") != "tsm.authority-packet.v1":
        raise ValueError("AUTHORITY_PACKET_SCHEMA_INVALID")
    if packet.get("approvedForRegulatoryUse") is True:
        raise ValueError("SELF_ASSERTED_REGULATORY_APPROVAL_FORBIDDEN")
    _required_string(packet, "claimId")
    _required_string(packet, "purpose")
    _required_string(packet, "areaOfInterest")
    sources = packet.get("sources")
    if not isinstance(sources, list) or not sources:
        raise ValueError("SOURCE_LINEAGE_REQUIRED")
    source_ids = set()
    for source in sources:
        if not isinstance(source, dict):
            raise ValueError("SOURCE_RECORD_INVALID")
        source_id = _required_string(source, "sourceId")
        if source_id in source_ids:
            raise ValueError("DUPLICATE_SOURCE_ID")
        source_ids.add(source_id)
        _required_string(source, "agency")
        _uri(source.get("uri"))
        _sha(source.get("sha256"))
        _date(source.get("retrievedAt"))
        if source.get("classification") not in _CLASSIFICATIONS:
            raise ValueError("SOURCE_CLASSIFICATION_INVALID")
        _required_string(source, "horizontalCrs")
        _required_string(source, "verticalDatum")
        _required_string(source, "units")
        if "uncertainty" in source:
            uncertainty = source["uncertainty"]
            if isinstance(uncertainty, bool) or not isinstance(uncertainty, (int, float)) or not math.isfinite(uncertainty) or uncertainty < 0:
                raise ValueError("SOURCE_UNCERTAINTY_INVALID")
        if source.get("classification") == "SCENARIO" and source.get("regulatorySource") is True:
            raise ValueError("SCENARIO_CANNOT_BE_REGULATORY_SOURCE")
    technical = packet.get("technicalEvidence")
    if not isinstance(technical, dict):
        raise ValueError("TECHNICAL_EVIDENCE_REQUIRED")
    _required_string(technical, "method")
    _required_string(technical, "methodVersion")
    _sha(technical.get("inputManifestSha256"))
    _sha(technical.get("outputManifestSha256"))
    _sha(technical.get("validationReportSha256"))
    gates = technical.get("checks")
    required = ("datum", "uncertainty", "reproducibility", "massBalance", "benchmark", "humanReview")
    if not isinstance(gates, dict) or any(g not in gates for g in required):
        raise ValueError("TECHNICAL_GATES_INCOMPLETE")
    # These are caller declarations, not independent proof. Never promote them
    # to legal or scientific acceptance without the actual validation artifacts.
    checks_declared_passed = all(gates[g] == "VERIFIED" for g in required)
    decision = packet.get("agencyDecision")
    decision_document_present = False
    if decision is not None:
        if not isinstance(decision, dict) or decision.get("decisionType") not in _DECISION_TYPES:
            raise ValueError("AGENCY_DECISION_TYPE_INVALID")
        for name in ("issuer", "caseId", "scope", "signer", "jurisdiction"):
            _required_string(decision, name)
        _uri(decision.get("officialRegistryUri"))
        _date(decision.get("issuedAt"))
        _date(decision.get("effectiveAt"))
        _verify_local_artifact(decision.get("document"))
        decision_document_present = True
    return {
        "schemaVersion": "tsm.authority-evaluation.v1",
        "claimId": packet["claimId"],
        "sourceLineageRecorded": True,
        "technicalChecksDeclaredPassed": checks_declared_passed,
        "technicalEvidenceIndependentlyReproduced": False,
        "decisionDocumentDigestVerified": decision_document_present,
        "agencyDecisionIndependentlyAuthenticated": False,
        "regulatoryApprovalEstablished": False,
        "status": ("DECISION_DOCUMENT_PRESENT_AWAITING_ISSUER_CONFIRMATION"
                   if decision_document_present else "NO_AGENCY_DECISION_EVIDENCED"),
        "nextAction": ("Verify case, issuer, signature, effective date and spatial scope with the agency; obtain licensed professional review as required."
                       if decision_document_present else "Obtain the applicable signed decision or permit from the authorized agency."),
    }
