"""Resilient adapter from regional failure manifests to safe UI alert payloads."""
from __future__ import annotations
import json
import re
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

_SHA256 = re.compile(r"^[a-fA-F0-9]{64}$")
_MANIFEST_ID = re.compile(r"^ERR-[A-Z0-9]{8}$")
_JURISDICTIONS = {"IN", "IL", "KY", "FED"}
_STATUSES = {"OPERATIONAL", "DEGRADED", "OFFLINE"}
_ARTIFACTS = {"TERRAIN_DEM", "HYDROGRAPHY_FLOWLINE", "NFHL_SHAPEFILE", "GAUGE_TELEMETRY"}
_ACTIONS = {"DISCLOSE_GAP_AND_CONTINUE", "TERMINATE_PIPELINE"}
_TITLES = {"TERRAIN_DEM": "Terrain elevation data", "HYDROGRAPHY_FLOWLINE": "Hydrography data", "NFHL_SHAPEFILE": "Flood hazard mapping data", "GAUGE_TELEMETRY": "Gauge telemetry"}

class ManifestValidationError(ValueError):
    """Manifest is malformed or unsafe to consume."""

def _validate(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ManifestValidationError("root")
    if not {"manifest_id", "timestamp_utc", "aoi_reference_id", "nodes_reporting"} <= value.keys():
        raise ManifestValidationError("required")
    if not isinstance(value["manifest_id"], str) or not _MANIFEST_ID.fullmatch(value["manifest_id"]):
        raise ManifestValidationError("manifest_id")
    if not isinstance(value["aoi_reference_id"], str) or not value["aoi_reference_id"].strip():
        raise ManifestValidationError("aoi_reference_id")
    if not isinstance(value["nodes_reporting"], list):
        raise ManifestValidationError("nodes_reporting")
    try:
        stamp = datetime.fromisoformat(value["timestamp_utc"].replace("Z", "+00:00"))
        if stamp.tzinfo is None:
            raise ValueError
    except (ValueError, AttributeError, TypeError):
        raise ManifestValidationError("timestamp_utc") from None
    for node in value["nodes_reporting"]:
        if not isinstance(node, dict) or node.get("jurisdiction") not in _JURISDICTIONS or node.get("node_status") not in _STATUSES or not isinstance(node.get("captured_incidents"), list):
            raise ManifestValidationError("node")
        for incident in node["captured_incidents"]:
            if not isinstance(incident, dict) or incident.get("artifact_type") not in _ARTIFACTS:
                raise ManifestValidationError("incident")
            uri = urlparse(incident.get("source_uri", ""))
            if uri.scheme not in {"http", "https"} or not uri.netloc:
                raise ManifestValidationError("source_uri")
            failure, crypto = incident.get("failure_mode"), incident.get("cryptographic_state")
            if not isinstance(failure, dict) or not isinstance(failure.get("code"), int) or isinstance(failure.get("code"), bool) or not isinstance(failure.get("message"), str):
                raise ManifestValidationError("failure_mode")
            if not isinstance(crypto, dict) or crypto.get("action_taken") not in _ACTIONS:
                raise ManifestValidationError("cryptographic_state")
            for key in ("expected_hash_sha256", "calculated_hash_sha256"):
                digest = crypto.get(key)
                if digest is not None and (not isinstance(digest, str) or not _SHA256.fullmatch(digest)):
                    raise ManifestValidationError(key)
            expected, actual = crypto.get("expected_hash_sha256"), crypto.get("calculated_hash_sha256")
            if expected and actual and expected.lower() != actual.lower():
                crypto["action_taken"] = "TERMINATE_PIPELINE"
    return value

def generate_ui_payload(raw_manifest_json: str) -> dict[str, Any]:
    """Parse and validate JSON; malformed manifests always return a blocking alert."""
    try:
        manifest = _validate(json.loads(raw_manifest_json))
    except (json.JSONDecodeError, ManifestValidationError, TypeError, AttributeError):
        return {"ui_header": {"manifest_id": None, "timestamp": None, "is_execution_blocked": True, "banner_message": "Analysis blocked: the evidence-failure manifest is invalid. Correct it and rerun validation.", "validation_state": "INVALID_MANIFEST"}, "alert_cards": []}
    cards: list[dict[str, Any]] = []
    blocked = False
    affected: set[str] = set()
    for node in manifest["nodes_reporting"]:
        state, jurisdiction = node["node_status"], node["jurisdiction"]
        if state != "OPERATIONAL":
            affected.add(f"{jurisdiction} ({state})")
        for index, incident in enumerate(node["captured_incidents"]):
            crypto = incident["cryptographic_state"]
            mismatch = bool(crypto.get("expected_hash_sha256") and crypto.get("calculated_hash_sha256") and crypto["expected_hash_sha256"].lower() != crypto["calculated_hash_sha256"].lower())
            incident_blocked = state == "OFFLINE" or crypto["action_taken"] == "TERMINATE_PIPELINE" or mismatch
            blocked = blocked or incident_blocked
            cards.append({"id": f"ALERT-{jurisdiction}-{incident['artifact_type']}-{index + 1}", "ui_severity": "CRITICAL_BLOCK" if incident_blocked else {"DEGRADED": "WARNING_GAP", "OPERATIONAL": "INFO", "OFFLINE": "CRITICAL_BLOCK"}[state], "display_title": f"{_TITLES[incident['artifact_type']]}: {jurisdiction}", "context_summary": f"The source reported error code {incident['failure_mode']['code']}.", "action_guidance": "Downstream modeling is blocked. Restore the source or provide independently verified replacement evidence, then rerun integrity and readiness checks." if incident_blocked else "This gap is disclosed. Continue only independent analyses whose required inputs are complete; do not infer missing values.", "badge_label": "PIPELINE_LOCKED" if incident_blocked else "FALLBACK_ACTIVE", "source_uri": incident["source_uri"], "failure_message": incident["failure_mode"]["message"], "artifact_type": incident["artifact_type"]})
    state = "BLOCKED" if blocked else "DEGRADED" if affected else "NO_REPORTED_FAILURES"
    banner = "Analysis blocked: required evidence is unavailable or failed integrity checks." if blocked else "Partial data coverage: independent work may continue, but affected analyses remain gated." if affected else "No reported source failures. This does not prove model-readiness gates passed."
    return {"ui_header": {"manifest_id": manifest["manifest_id"], "timestamp": manifest["timestamp_utc"], "aoi_reference_id": manifest["aoi_reference_id"], "is_execution_blocked": blocked, "banner_message": banner, "validation_state": state}, "alert_cards": cards}
