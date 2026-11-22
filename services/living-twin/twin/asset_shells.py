"""Versioned infrastructure events and optional AAS 3.x-style export.

The twin event store remains authoritative. AAS is a serialized interoperability
projection, not a second mutable source of truth or a certified BaSyx service.
"""
from __future__ import annotations

import re
from uuid import UUID, NAMESPACE_URL, uuid5

from .contracts import canonical, validate

KINDS = frozenset({"bridge", "levee", "gauge", "pump_station", "road", "port"})
RELATIONS = frozenset({"part_of", "connected_to", "upstream_of", "downstream_of",
                       "crosses", "monitors", "protects", "supplies", "located_in"})


def _uuid(value) -> str:
    return str(UUID(str(value)))


def _relationships(rows, own_id: str) -> list[dict]:
    if not isinstance(rows, list):
        raise ValueError("relationships must be an array")
    relationships = []
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"type", "target_asset_id"}:
            raise ValueError("Each relationship requires type and target_asset_id")
        if row["type"] not in RELATIONS:
            raise ValueError("Unknown asset relationship type")
        target = _uuid(row["target_asset_id"])
        if target == own_id:
            raise ValueError("Self-referential infrastructure relationship")
        relationships.append({"type": row["type"], "target_asset_id": target})
    canonical_rows = sorted(relationships, key=lambda item: (item["type"], item["target_asset_id"]))
    if len({(item["type"], item["target_asset_id"]) for item in canonical_rows}) != len(canonical_rows):
        raise ValueError("Duplicate infrastructure relationship")
    return canonical_rows


def make_event(*, asset_id, asset_type, name, version, source, valid_from,
               geometry=None, properties=None, relationships=None, timeline="observed",
               branch="main") -> dict:
    asset_id = _uuid(asset_id)
    if asset_type not in KINDS:
        raise ValueError("Unsupported infrastructure asset type")
    if not isinstance(version, int) or isinstance(version, bool) or version < 1:
        raise ValueError("Asset version must be a positive integer")
    if not isinstance(name, str) or not name.strip() or len(name) > 256:
        raise ValueError("Name must be nonempty and <=256 characters")
    if properties is None:
        properties = {}
    if not isinstance(properties, dict) or len(properties) > 32:
        raise ValueError("properties must be an object with <=32 members")
    state = {"asset_id": asset_id, "asset_type": asset_type, "name": name.strip(),
             "version": version, "properties": properties,
             "relationships": _relationships(relationships or [], asset_id)}
    data = {"matrix": "I", "entity_id": "infra:" + asset_id, "timeline": timeline,
            "branch": branch, "valid_from": valid_from, "state": state,
            "source": source, "geometry": geometry}
    identity = str(uuid5(NAMESPACE_URL, canonical(data)))
    event = {"version": 1, "event_id": identity, **data, "operation": "upsert",
             "evidence": [], "asset": None}
    validate(event)
    return event


def _property(id_short: str, value: str, value_type="xs:string") -> dict:
    return {"modelType": "Property", "idShort": id_short, "valueType": value_type,
            "value": value}


def export_aas(event: dict) -> dict:
    """Export an AAS-shaped document for external schema and registry validation."""
    validate(event)
    if event["matrix"] != "I" or event["operation"] != "upsert":
        raise ValueError("Expected infrastructure upsert event")
    s = event["state"]
    if s.get("asset_type") not in KINDS:
        raise ValueError("Unsupported infrastructure asset type")
    asset_id = _uuid(s["asset_id"])
    shell_id = "urn:tsm:aas:" + asset_id
    submodel_id = "urn:tsm:submodel:infrastructure:" + asset_id
    relationships = _relationships(s.get("relationships", []), asset_id)
    slug = re.sub("[^A-Za-z0-9_]", "_", s["asset_type"])
    elements = [
        _property("AssetType", s["asset_type"]),
        _property("AssetName", str(s["name"])),
        _property("Version", str(s["version"]), "xs:integer"),
        _property("SourceAuthority", event["source"]["authority"]),
        _property("SourceSHA256", event["source"]["sha256"]),
        _property("ValidFrom", event["valid_from"]),
        {"modelType": "SubmodelElementCollection", "idShort": "Connections",
         "value": [
             {"modelType": "ReferenceElement", "idShort": f"Link{i:04d}",
              "value": {"type": "ExternalReference",
                        "keys": [{"type": "GlobalReference",
                                  "value": "urn:tsm:relation:" + r["type"] + ":"
                                           + r["target_asset_id"]}]}}
             for i, r in enumerate(relationships)
         ]},
    ]
    shell = {
        "modelType": "AssetAdministrationShell", "id": shell_id,
        "idShort": "TSM_" + slug + "_" + asset_id.replace("-", "")[:12],
        "assetInformation": {"assetKind": "Instance", "globalAssetId": "urn:uuid:" + asset_id},
        "submodels": [{"type": "ModelReference",
                       "keys": [{"type": "Submodel", "value": submodel_id}]}],
    }
    submodel = {"modelType": "Submodel", "id": submodel_id,
                "idShort": "TSMInfrastructure", "submodelElements": elements}
    return {"shell": shell, "submodels": [submodel], "source_event_id": event["event_id"],
            "verification": "AAS_SHAPE_ONLY_NOT_INDEPENDENTLY_CONFORMANCE_TESTED"}
