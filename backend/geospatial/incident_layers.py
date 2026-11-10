"""Offline incident-overlay adapter, independently written for TSM.

Adapts the *data-driven layer inventory* concept demonstrated by
iamtekson/rasuwa-flood, not its Nepal data, code, imagery or claims.
No network calls, auto-approval, regulatory authority promotion or model runs.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
from pathlib import Path, PurePosixPath
from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/geospatial/incident-layers", tags=["incident-layers"])

MAX_MANIFEST_BYTES = 256 * 1024
MAX_GEOJSON_BYTES = 16 * 1024 * 1024
MAX_FEATURES = 25_000
MAX_LAYERS = 32
# Broad region guard, not a substitute for an exact county polygon join.
TRI_STATE_BOUNDS = (-92.0, 35.0, -84.0, 41.0)
ID = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")
FIELD = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,63}$")
SHA = re.compile(r"^[a-fA-F0-9]{64}$")
KIND_GEOMETRY: dict[str, set[str]] = {
    "fill": {"Polygon", "MultiPolygon"},
    "line": {"LineString", "MultiLineString"},
    "circle": {"Point", "MultiPoint"},
}
AUTHORITIES = {"OBSERVATION", "CONTEXT", "PLANNING", "DERIVED"}


class IncidentLayerError(ValueError):
    """Manifest, provenance, geometry, or evidence validation failed."""


def incident_root() -> Path:
    explicit = os.environ.get("TSM_INCIDENT_LAYERS_ROOT")
    if explicit:
        return Path(explicit)
    offline = os.environ.get("OFFLINE_DATA_ROOT")
    return Path(offline) / "regional" / "incidents" if offline else Path.home() / "workspace" / "offline-data" / "regional" / "incidents"


def _regular_file(path: Path, root: Path, budget: int) -> bytes:
    home = root.resolve()
    actual = path.resolve()
    if home not in actual.parents or path.is_symlink() or not actual.is_file():
        raise IncidentLayerError("missing, symlinked, or out-of-root local evidence")
    if actual.stat().st_size > budget:
        raise IncidentLayerError("local evidence exceeds bounded byte limit")
    return actual.read_bytes()


def _filename(name: Any) -> str:
    if not isinstance(name, str) or "\\" in name or ":" in name or name.startswith("/"):
        raise IncidentLayerError("invalid local GeoJSON relative path")
    components = PurePosixPath(name).parts
    if not components or any(c in {"", ".", ".."} for c in components):
        raise IncidentLayerError("local GeoJSON path traversal rejected")
    if not name.lower().endswith(".geojson") or len(name) > 240:
        raise IncidentLayerError("local evidence must be a .geojson file")
    return name


def _manifest(root: Path) -> list[dict[str, Any]]:
    manifest_path = root / "layers.json"
    raw = _regular_file(manifest_path, root, MAX_MANIFEST_BYTES)
    try:
        object_ = json.loads(raw)
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise IncidentLayerError("invalid manifest JSON") from exc
    if not isinstance(object_, dict) or object_.get("schema") != "tsm.offline-incident-layers.v1":
        raise IncidentLayerError("invalid incident manifest schema")
    layers = object_.get("layers")
    if not isinstance(layers, list) or len(layers) > MAX_LAYERS:
        raise IncidentLayerError("invalid incident layer list")
    seen: set[str] = set()
    for row in layers:
        if not isinstance(row, dict):
            raise IncidentLayerError("incident entry must be an object")
        lid = row.get("id")
        if not isinstance(lid, str) or not ID.fullmatch(lid) or lid in seen:
            raise IncidentLayerError("unsafe or duplicate incident layer id")
        seen.add(lid)
        if row.get("style") not in KIND_GEOMETRY:
            raise IncidentLayerError("unsupported incident map style")
        if row.get("authority_class") not in AUTHORITIES:
            raise IncidentLayerError("unreviewed incident layer cannot claim regulatory authority")
        if row.get("crs") != "EPSG:4326":
            raise IncidentLayerError("incident GeoJSON must explicitly declare lon/lat EPSG:4326")
        if row.get("vertical_datum") is not None:
            raise IncidentLayerError("3D elevation/datum inference is not allowed in incident overlays")
        if not row.get("approved_for_display") is True or row.get("license_reviewed") is not True:
            raise IncidentLayerError("human display and license review are required")
        for key in ("title", "source_agency", "source_license", "acquired_at", "attribution"):
            if not isinstance(row.get(key), str) or not row[key].strip() or len(row[key]) > 300:
                raise IncidentLayerError(f"missing or invalid incident provenance: {key}")
        if not isinstance(row.get("source_url"), str) or not row["source_url"].startswith("https://"):
            raise IncidentLayerError("HTTPS source URL is required")
        if not SHA.fullmatch(str(row.get("sha256", ""))):
            raise IncidentLayerError("SHA-256 of staged GeoJSON is required")
        _filename(row.get("file"))
        fields = row.get("display_fields")
        if not isinstance(fields, list) or len(fields) > 12 or any(
            not isinstance(field, str) or not FIELD.fullmatch(field) for field in fields
        ) or len(fields) != len(set(fields)):
            raise IncidentLayerError("unsafe or duplicated display field allowlist")
    return layers


def _coords(coordinates: Any, depth: int = 0) -> None:
    if depth > 5 or not isinstance(coordinates, list) or not coordinates:
        raise IncidentLayerError("invalid or deeply nested coordinates")
    if all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in coordinates):
        if len(coordinates) != 2 or not all(math.isfinite(x) for x in coordinates):
            raise IncidentLayerError("coordinates must be finite 2D lon/lat; no unverified Z")
        west, south, east, north = TRI_STATE_BOUNDS
        if not (west <= coordinates[0] <= east and south <= coordinates[1] <= north):
            raise IncidentLayerError("geometry outside broad Tri-State geographic guard")
        return
    for item in coordinates:
        _coords(item, depth + 1)


def _sanitized_features(data: dict[str, Any], row: dict[str, Any]) -> dict[str, Any]:
    if data.get("type") != "FeatureCollection" or not isinstance(data.get("features"), list):
        raise IncidentLayerError("source must be GeoJSON FeatureCollection")
    feats = data["features"]
    if len(feats) > MAX_FEATURES:
        raise IncidentLayerError("GeoJSON feature budget exceeded")
    cleaned = []
    fields = row["display_fields"]
    for feature in feats:
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise IncidentLayerError("invalid GeoJSON feature")
        geometry = feature.get("geometry")
        if not isinstance(geometry, dict) or geometry.get("type") not in KIND_GEOMETRY[row["style"]]:
            raise IncidentLayerError("geometry class does not match reviewed map style")
        _coords(geometry.get("coordinates"))
        props = feature.get("properties")
        if not isinstance(props, dict):
            raise IncidentLayerError("GeoJSON properties must be an object")
        public = {}
        for key in fields:
            value = props.get(key)
            if isinstance(value, (str, int, float, bool)) and (
                not isinstance(value, float) or math.isfinite(value)
            ):
                public[key] = value if not isinstance(value, str) else value[:256]
        cleaned.append({"type": "Feature", "geometry": geometry, "properties": public})
    return {"type": "FeatureCollection", "features": cleaned}


def list_incident_layers(root: Path | None = None) -> dict[str, Any]:
    base = root or incident_root()
    if not (base / "layers.json").is_file():
        return {"schema": "tsm.offline-incident-layers.v1", "state": "SOURCE_UNAVAILABLE", "layers": [],
                "human_review_required": True, "reason": "No approved local incident manifest is staged"}
    layers = _manifest(base)
    return {"schema": "tsm.offline-incident-layers.v1", "state": "MANIFEST_REVIEWED_DATA_UNVERIFIED",
            "human_review_required": True,
            "layers": [
                {k: row[k] for k in ("id", "title", "style", "authority_class", "source_agency",
                                     "source_url", "source_license", "acquired_at", "attribution")}
                | {"data_state": "VERIFY_ON_REQUEST", "regulatory_determination": False}
                for row in layers
            ]}


def load_incident_geojson(layer_id: str, root: Path | None = None) -> dict[str, Any]:
    if not ID.fullmatch(layer_id):
        raise IncidentLayerError("unsafe incident layer id")
    base = root or incident_root()
    row = next((entry for entry in _manifest(base) if entry["id"] == layer_id), None)
    if row is None:
        raise KeyError(layer_id)
    raw = _regular_file(base / _filename(row["file"]), base, MAX_GEOJSON_BYTES)
    if hashlib.sha256(raw).hexdigest() != row["sha256"].lower():
        raise IncidentLayerError("staged incident data SHA-256 differs from approved manifest")
    try:
        data = json.loads(raw)
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise IncidentLayerError("staged GeoJSON is not valid UTF-8 JSON") from exc
    if not isinstance(data, dict):
        raise IncidentLayerError("GeoJSON document must be an object")
    output = _sanitized_features(data, row)
    output["_tsm"] = {
        "state": "VERIFIED_LOCAL_ADVISORY",
        "authority_class": row["authority_class"],
        "source_agency": row["source_agency"],
        "source_url": row["source_url"],
        "source_sha256": row["sha256"].lower(),
        "acquired_at": row["acquired_at"],
        "vertical_datum": None,
        "crs": "EPSG:4326",
        "regulatory_determination": False,
        "human_review_required": True,
        "notice": "Broad coordinate bounds only; exact county intersection, hydrologic modeling and regulatory status not established",
    }
    return output


@router.get("")
def incident_index() -> dict[str, Any]:
    try:
        return list_incident_layers()
    except IncidentLayerError as exc:
        raise HTTPException(503, detail={"code": "INCIDENT_MANIFEST_INVALID", "reason": str(exc)}) from exc


@router.get("/{layer_id}/geojson")
def incident_geojson(layer_id: str) -> dict[str, Any]:
    try:
        return load_incident_geojson(layer_id)
    except KeyError as exc:
        raise HTTPException(404, detail={"code": "INCIDENT_LAYER_UNKNOWN"}) from exc
    except IncidentLayerError as exc:
        raise HTTPException(503, detail={"code": "INCIDENT_EVIDENCE_NOT_VERIFIED", "reason": str(exc)}) from exc
