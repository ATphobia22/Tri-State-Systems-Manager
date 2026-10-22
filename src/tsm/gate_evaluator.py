"""Resilient evaluator for TSM AOI and hydrology execution manifests.

This module validates evidence claims; it does not acquire authoritative data, prove
that a cited source is genuine, or replace geospatial overlay/engineering review.
A model can never be authorized solely by user-controlled status strings.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
USGS_GAGE_RE = re.compile(r"^\d{8}$")
PASS = "PASSED"
BLOCKED = "BLOCKED"


def _blocked(reason: str, *, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"status": BLOCKED, "execution_allowed": False, "reason": reason, "details": details or {}}


def _read_json(value: str | dict[str, Any], label: str) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    try:
        result = json.loads(value)
    except (json.JSONDecodeError, TypeError) as exc:
        raise ValueError(f"{label} is not valid JSON: {exc}") from exc
    if not isinstance(result, dict):
        raise ValueError(f"{label} root must be a JSON object")
    return result


def sha256_file(path: str | Path) -> str:
    """Hash exact file bytes without decoding or rewriting the artifact."""
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _validate_geojson(document: dict[str, Any]) -> tuple[bool, str]:
    if document.get("type") != "FeatureCollection":
        return False, "AOI must be a GeoJSON FeatureCollection."
    features = document.get("features")
    if not isinstance(features, list) or not features:
        return False, "GeoJSON FeatureCollection must contain at least one feature."

    # RFC 7946 GeoJSON coordinates are WGS84 longitude/latitude. Legacy "crs"
    # members are not accepted because they are inconsistently interpreted.
    if "crs" in document:
        return False, "Legacy GeoJSON 'crs' member is prohibited; reproject coordinates to RFC 7946 WGS84."

    for index, feature in enumerate(features):
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            return False, f"features[{index}] must be a GeoJSON Feature."
        geometry = feature.get("geometry")
        if not isinstance(geometry, dict) or geometry.get("type") not in {
            "Point", "MultiPoint", "LineString", "MultiLineString",
            "Polygon", "MultiPolygon", "GeometryCollection"
        }:
            return False, f"features[{index}] has missing or unsupported geometry."
        if geometry.get("type") != "GeometryCollection" and not geometry.get("coordinates"):
            return False, f"features[{index}] geometry coordinates are empty."
        props = feature.get("properties")
        if props is not None and not isinstance(props, dict):
            return False, f"features[{index}].properties must be an object or null."

        # Coordinate range and numeric checks; full topology requires the geometry
        # adapter (for example, Shapely/GEOS) in the orchestrator.
        stack = [geometry.get("coordinates", [])]
        while stack:
            item = stack.pop()
            if isinstance(item, list):
                if len(item) >= 2 and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in item[:2]):
                    lon, lat = item[:2]
                    if not (-180 <= lon <= 180 and -90 <= lat <= 90):
                        return False, f"features[{index}] contains coordinates outside longitude/latitude ranges."
                    if any(not isinstance(v, (int, float)) for v in item):
                        return False, f"features[{index}] contains non-numeric coordinate values."
                else:
                    stack.extend(item)
            elif item is not None:
                return False, f"features[{index}] contains malformed coordinates."
    return True, "GeoJSON structure and coordinate ranges passed; topology and spatial overlay remain separate gates."


def _gate(gates: dict[str, Any], name: str) -> dict[str, Any]:
    value = gates.get(name)
    return value if isinstance(value, dict) else {}


def validate_tsm_payload(
    geojson_payload: str | dict[str, Any],
    gate_payload: str | dict[str, Any],
    *,
    require_all_states: bool = False,
) -> dict[str, Any]:
    """Evaluate an AOI and gate manifest, failing closed on absent/contradictory evidence.

    require_all_states is intended only for the declared regional-domain boundary,
    not an arbitrary user's local AOI.
    """
    try:
        geo = _read_json(geojson_payload, "GeoJSON")
        manifest = _read_json(gate_payload, "gate manifest")
    except ValueError as exc:
        return _blocked(str(exc))

    ok, message = _validate_geojson(geo)
    if not ok:
        return _blocked(message)

    if not manifest.get("pipeline_execution_id") or not manifest.get("aoi_target_id"):
        return _blocked("pipeline_execution_id and aoi_target_id are required.")
    gates = manifest.get("gates")
    if not isinstance(gates, dict):
        return _blocked("gates must be an object.")

    required = [
        "01_TERRAIN_DATA_QUALITY_GATE",
        "02_JURISDICTION_SOURCE_GATE",
        "03_OUTLET_EVIDENCE_GATE",
        "04_DOWNSTREAM_MODEL_GATE",
    ]
    missing = [name for name in required if not isinstance(gates.get(name), dict)]
    if missing:
        return _blocked("Required gate records are missing.", details={"missing_gates": missing})

    terrain = _gate(gates, required[0])
    sources = _gate(gates, required[1])
    outlet = _gate(gates, required[2])
    model = _gate(gates, required[3])

    # A status string is not evidence. Every passed upstream gate must include
    # machine-verifiable evidence records with hashes and source identity.
    for name, record in ((required[0], terrain), (required[1], sources), (required[2], outlet)):
        if record.get("status") != PASS:
            return _blocked(f"{name} is not PASSED.", details={"gate_status": record.get("status", "MISSING")})
        evidence = record.get("evidence")
        if not isinstance(evidence, list) or not evidence:
            return _blocked(f"{name} claims PASSED but has no evidence list.")
        for index, item in enumerate(evidence):
            if not isinstance(item, dict) or not item.get("source_id") or not item.get("artifact_uri"):
                return _blocked(f"{name} evidence[{index}] lacks source_id or artifact_uri.")
            digest = item.get("sha256")
            if not isinstance(digest, str) or not SHA256_RE.fullmatch(digest):
                return _blocked(f"{name} evidence[{index}] has no valid SHA-256.")
            if item.get("verified") is not True:
                return _blocked(f"{name} evidence[{index}] has not been verified against stored bytes.")

    invariants = terrain.get("invariants")
    if not isinstance(invariants, dict) or not invariants.get("horizontal_crs") or not invariants.get("vertical_datum"):
        return _blocked("Terrain CRS and vertical datum must be explicit.")
    if terrain.get("metrics", {}).get("missing_data_pixels", 1) != 0:
        return _blocked("Terrain contains missing pixels or the missing-data metric is absent.")
    if terrain.get("metrics", {}).get("data_averaging_anomalies_detected") is not False:
        return _blocked("Terrain averaging/anomaly assessment is absent or failed.")

    jurisdiction_evidence = sources.get("jurisdiction_intersection_evidence")
    if not isinstance(jurisdiction_evidence, list) or not jurisdiction_evidence:
        return _blocked("Jurisdiction intersections must be computed from versioned boundary overlays, not asserted labels.")
    observed_states = {item.get("state") for item in jurisdiction_evidence if isinstance(item, dict) and item.get("verified") is True}
    if require_all_states and not {"IN", "IL", "KY"}.issubset(observed_states):
        return _blocked("Regional AOI does not have verified intersections with IN, IL, and KY.", details={"verified_states": sorted(str(s) for s in observed_states)})

    outlet_evidence = outlet.get("outlet_evidence")
    if not isinstance(outlet_evidence, dict) or outlet_evidence.get("verified") is not True:
        return _blocked("A physically and spatially verified outlet record is required.")
    if not outlet_evidence.get("outlet_id") or not outlet_evidence.get("method") or not outlet_evidence.get("reviewer"):
        return _blocked("Outlet evidence must identify outlet, verification method, and reviewer.")
    if outlet_evidence.get("datum_verified") is not True:
        return _blocked("Outlet datum is not verified.")

    dependencies = model.get("dependencies")
    if not isinstance(dependencies, list) or not set(required[:3]).issubset(set(dependencies)):
        return _blocked("Downstream model gate does not declare all upstream dependencies.")
    if model.get("status") != "READY_FOR_EXECUTION" or model.get("execution_blocked") is not True:
        # This evaluator authorizes readiness only; a separate approval record and
        # execution service must explicitly transition the job to executable.
        return _blocked("Model must remain blocked until a separate approval and execution authorization service clears it.")

    approval = model.get("approval")
    if not isinstance(approval, dict) or approval.get("approved") is not True or not approval.get("approver_id") or not approval.get("approved_scope_hash"):
        return _blocked("A separately recorded, scope-bound human approval is required.")
    return {
        "status": "READY_FOR_REVIEW",
        "execution_allowed": False,
        "execution_id": manifest["pipeline_execution_id"],
        "aoi_target_id": manifest["aoi_target_id"],
        "message": "Evidence gates passed. This evaluator does not launch HEC-HMS/HEC-RAS; execution service must revalidate artifacts and authorization.",
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--geojson", required=True, help="Path to RFC 7946 GeoJSON")
    parser.add_argument("--gates", required=True, help="Path to gate manifest JSON")
    parser.add_argument("--require-all-states", action="store_true", help="Require regional boundary to intersect IN/IL/KY")
    args = parser.parse_args()
    try:
        geo_text = Path(args.geojson).read_text(encoding="utf-8")
        gate_text = Path(args.gates).read_text(encoding="utf-8")
    except OSError as exc:
        print(json.dumps(_blocked(f"Unable to read input: {exc}"), indent=2))
        raise SystemExit(2)
    result = validate_tsm_payload(geo_text, gate_text, require_all_states=args.require_all_states)
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["status"] == "READY_FOR_REVIEW" else 2)
