#!/usr/bin/env python3
"""Evidence-gated Mount Vernon roof OBJ export and interior topology inspection.

An OBJ from a LiDAR roof-plane candidate is LOD2-derived reference geometry,
NOT a surveyed LOD3 enclosure. Interior graph connectivity is NOT an egress plan.
No default heights, invented rooms, fabricated exits, or inferred NAVD88 heights.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import deque
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

SHA_LENGTH = 64
SCHEMA = "tsm.indoor.topology.v1"
MAX_NODES = 20_000
MAX_LINKS = 80_000
MAX_FILE_BYTES = 350_000_000


class EvidenceError(ValueError):
    """Reject unverifiable source or topology without hiding the reason."""


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_bytes(path: Path) -> bytes:
    if not path.is_file() or path.stat().st_size > MAX_FILE_BYTES:
        raise EvidenceError("INPUT_MISSING_OR_OVERSIZED")
    return path.read_bytes()


def require_digest(value: object, name: str) -> str:
    if not isinstance(value, str) or len(value) != SHA_LENGTH or any(ch not in "0123456789abcdef" for ch in value):
        raise EvidenceError(f"{name}_INVALID_SHA256")
    return value


def require_https(value: object, name: str) -> str:
    if not isinstance(value, str):
        raise EvidenceError(f"{name}_MISSING_URL")
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise EvidenceError(f"{name}_REQUIRES_HTTPS")
    return value


def finite(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def load_json(path: Path, expected_hash: str | None = None) -> tuple[dict, str]:
    raw = read_bytes(path)
    actual = sha256(raw)
    if expected_hash is not None and actual != require_digest(expected_hash, "EXPECTED_INPUT"):
        raise EvidenceError("INPUT_SHA256_MISMATCH")
    try:
        result = json.loads(raw)
    except (ValueError, UnicodeError) as exc:
        raise EvidenceError("INPUT_NOT_JSON") from exc
    if not isinstance(result, dict):
        raise EvidenceError("INPUT_NOT_OBJECT")
    return result, actual


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = (json.dumps(payload, sort_keys=True, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(raw)
    tmp.replace(path)


def find_building(dataset: dict, objectid: int) -> dict:
    features = dataset.get("features")
    if dataset.get("type") != "FeatureCollection" or not isinstance(features, list):
        raise EvidenceError("SOURCE_GEOJSON_FEATURE_COLLECTION_REQUIRED")
    found = [item for item in features
             if isinstance(item, dict) and isinstance(item.get("properties"), dict)
             and item["properties"].get("objectid") == objectid]
    if len(found) != 1:
        raise EvidenceError("SOURCE_BUILDING_MISSING_OR_DUPLICATED")
    feature = found[0]
    if feature.get("geometry", {}).get("type") not in ("Polygon", "MultiPolygon"):
        raise EvidenceError("SOURCE_BUILDING_POLYGON_REQUIRED")
    planes = feature["properties"].get("roofPlanes")
    if not isinstance(planes, list) or not any(
        isinstance(plane, dict) and finite(plane.get("rmse_m")) and plane["rmse_m"] <= 0.15
        and isinstance(plane.get("inlier_count"), int) and plane["inlier_count"] >= 30
        and isinstance(plane.get("normal"), list) and len(plane["normal"]) == 3
        and all(finite(x) for x in plane["normal"]) and abs(plane["normal"][2]) > 1e-6
        for plane in planes
    ):
        raise EvidenceError("SOURCE_LIDAR_ROOF_PLANE_GATE_FAILED")
    return feature


def export_roof_obj(
    *, source_geojson: Path, source_sha256: str, batch_summary: Path,
    batch_sha256: str, glb_root: Path, objectid: int, outdir: Path,
) -> dict:
    """Export ONLY upward-facing facets from an already reviewed LOD2 batch output."""
    if not isinstance(objectid, int) or isinstance(objectid, bool) or objectid < 1:
        raise EvidenceError("BUILDING_OBJECTID_INVALID")
    source, source_hash = load_json(source_geojson, source_sha256)
    feature = find_building(source, objectid)
    summary, summary_hash = load_json(batch_summary, batch_sha256)
    if summary.get("generated_by") != "lod2-batch-reconstruct.py" or summary.get("roof_planes_crs") != "EPSG:3857":
        raise EvidenceError("UNRECOGNIZED_LOD2_BATCH")
    rows = summary.get("results")
    if not isinstance(rows, list):
        raise EvidenceError("BATCH_RESULTS_MISSING")
    matching = [row for row in rows if isinstance(row, dict) and row.get("objectid") == objectid]
    if len(matching) != 1:
        raise EvidenceError("BATCH_OBJECTID_MISSING_OR_DUPLICATED")
    row = matching[0]
    if row.get("status") != "ok" or row.get("watertight") is not True:
        raise EvidenceError("BATCH_GEOMETRY_NOT_WATERTIGHT_OR_UNAVAILABLE")
    if Path(str(row.get("glb", ""))).name != f"lod2-{objectid}.glb":
        raise EvidenceError("BATCH_GLB_IDENTITY_MISMATCH")
    origin = row.get("origin_3857")
    if not isinstance(origin, list) or len(origin) != 2 or not all(finite(n) for n in origin):
        raise EvidenceError("BATCH_LOCAL_ORIGIN_MISSING")
    glb_path = glb_root / f"lod2-{objectid}.glb"
    glb_hash = sha256(read_bytes(glb_path))
    try:
        import numpy as np
        import trimesh
    except ImportError as exc:
        raise EvidenceError("NUMPY_AND_TRIMESH_REQUIRED") from exc
    # force='scene' applies node transforms when meshes are concatenated.
    scene = trimesh.load(str(glb_path), force="scene", process=True)
    mesh = scene.dump(concatenate=True)
    if mesh.is_empty or not mesh.is_watertight:
        raise EvidenceError("GLB_MESH_NOT_WATERTIGHT")
    if not np.isfinite(mesh.vertices).all() or not np.isfinite(mesh.face_normals).all():
        raise EvidenceError("GLB_NONFINITE_GEOMETRY")
    # Excludes virtual floor slabs and vertical walls from the legacy PoC.
    up_faces = np.flatnonzero(mesh.face_normals[:, 2] > 0.10)
    if len(up_faces) < 1:
        raise EvidenceError("NO_UPWARD_FACING_ROOF_FACES")
    roof = mesh.submesh([up_faces], append=True, repair=False)
    if roof.is_empty or not np.isfinite(roof.vertices).all():
        raise EvidenceError("ROOF_MESH_INVALID")
    outdir.mkdir(parents=True, exist_ok=True)
    obj_name = f"roof-{objectid}.obj"
    obj_raw = roof.export(file_type="obj")
    if not isinstance(obj_raw, str):
        raise EvidenceError("OBJ_EXPORT_FAILED")
    obj_bytes = obj_raw.encode("utf-8")
    obj_path = outdir / obj_name
    obj_path.write_bytes(obj_bytes)
    result = {
        "schema": "tsm.derived-roof-obj.v1",
        "building_key": f"IGIO:building:{objectid}",
        "source_objectid": objectid,
        "geometric_lod": "LOD2_ROOF_ONLY_DERIVED_CANDIDATE",
        "citygml_3_lod3_certified": False,
        "architectural_openings": "NOT_EVIDENCED",
        "interior_geometry": "NOT_EVIDENCED",
        "building_identity_reconciled_with_current_city_scene": False,
        "source_feature_sha256": sha256(json.dumps(feature, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()),
        "input_geojson_sha256_verified": source_hash,
        "input_lod2_batch_sha256_verified": summary_hash,
        "input_glb_sha256_verified": glb_hash,
        "obj_sha256": sha256(obj_bytes),
        "obj_file": obj_name,
        "triangles_roof": int(len(roof.faces)),
        "object_crs": "EPSG:3857_LOCAL_ORIGIN",
        "origin_3857_m": origin,
        "vertical_datum": "UNVERIFIED_SOURCE_HEIGHT_DATUM",
        "vertical_units": "METRES_AS_ENCODED_IN_SOURCE_MESH",
        "classification": "DERIVED_REFERENCE_NOT_SURVEYED",
        "engineering_approved": False,
        "evacuation_use_approved": False,
        "notes": "OBJ preserves source mesh Z and local XY; no datum transform, opening, or interior elevation is inferred.",
    }
    atomic_json(outdir / f"roof-{objectid}.manifest.json", result)
    return result


def _source_record(value: object) -> dict:
    if not isinstance(value, dict):
        raise EvidenceError("INDOOR_SOURCE_RECORD_MISSING")
    require_https(value.get("url"), "INDOOR_SOURCE")
    require_digest(value.get("sha256"), "INDOOR_SOURCE")
    if not isinstance(value.get("issuer"), str) or not value["issuer"].strip():
        raise EvidenceError("INDOOR_SOURCE_ISSUER_REQUIRED")
    try:
        stamp = datetime.fromisoformat(value["retrieved_at"].replace("Z", "+00:00"))
        if stamp.tzinfo is None:
            raise ValueError("timezone missing")
    except (ValueError, TypeError, AttributeError, KeyError) as exc:
        raise EvidenceError("INDOOR_SOURCE_RETRIEVAL_TIME_INVALID") from exc
    return value


def assess_indoor_topology(document: dict) -> dict:
    """Validate a supplied measured-source connectivity graph, NOT building safety."""
    if document.get("schema") != SCHEMA:
        raise EvidenceError("INDOOR_SCHEMA_INVALID")
    key = document.get("building_key")
    if not isinstance(key, str) or not key.startswith("IGIO:building:") or not key[14:].isdigit():
        raise EvidenceError("INDOOR_BUILDING_IDENTITY_INVALID")
    _source_record(document.get("source"))
    if document.get("crs") != "EPSG:26916" or document.get("horizontal_units") != "metres":
        raise EvidenceError("INDOOR_CRS_UNITS_MISMATCH")
    datum = document.get("vertical_datum")
    if datum not in ("NAVD88", "UNVERIFIED"):
        raise EvidenceError("INDOOR_VERTICAL_DATUM_UNSUPPORTED")
    floors = document.get("floors")
    nodes = document.get("nodes")
    links = document.get("links")
    if not isinstance(floors, list) or not floors or not isinstance(nodes, list) or not (1 <= len(nodes) <= MAX_NODES) or not isinstance(links, list) or len(links) > MAX_LINKS:
        raise EvidenceError("INDOOR_GRAPH_SIZE_OR_STRUCTURE_INVALID")
    floor_ids: set[str] = set()
    for floor in floors:
        if not isinstance(floor, dict) or not isinstance(floor.get("id"), str) or not floor["id"] or floor["id"] in floor_ids:
            raise EvidenceError("INDOOR_FLOOR_DUPLICATE_OR_INVALID")
        floor_ids.add(floor["id"])
        elev = floor.get("elevation_m_navd88")
        if elev is not None:
            if datum != "NAVD88" or not finite(elev):
                raise EvidenceError("INDOOR_FLOOR_ELEVATION_DATUM_INVALID")
            require_digest(floor.get("elevation_evidence_sha256"), "INDOOR_FLOOR_ELEVATION")
        elif floor.get("elevation_evidence_sha256") is not None:
            raise EvidenceError("INDOOR_FLOOR_ELEVATION_EVIDENCE_WITHOUT_VALUE")
    node_ids: set[str] = set()
    neighbours: dict[str, set[str]] = {}
    exit_count = 0
    for node in nodes:
        if not isinstance(node, dict):
            raise EvidenceError("INDOOR_NODE_INVALID")
        nid = node.get("id")
        p = node.get("xy_m")
        if not isinstance(nid, str) or not nid or nid in node_ids or node.get("floor_id") not in floor_ids:
            raise EvidenceError("INDOOR_NODE_ID_OR_FLOOR_INVALID")
        if not isinstance(p, list) or len(p) != 2 or not all(finite(v) for v in p):
            raise EvidenceError("INDOOR_NODE_COORDINATES_INVALID")
        if node.get("kind") not in {"ROOM", "DOOR", "CORRIDOR", "STAIR", "EXTERIOR_EXIT"}:
            raise EvidenceError("INDOOR_NODE_KIND_INVALID")
        require_digest(node.get("source_sha256"), "INDOOR_NODE")
        node_ids.add(nid)
        neighbours[nid] = set()
        exit_count += int(node["kind"] == "EXTERIOR_EXIT")
    pairs: set[tuple[str, str]] = set()
    for link in links:
        if not isinstance(link, dict):
            raise EvidenceError("INDOOR_LINK_INVALID")
        a, b = link.get("from"), link.get("to")
        if a not in node_ids or b not in node_ids or a == b:
            raise EvidenceError("INDOOR_LINK_NODE_INVALID")
        if link.get("kind") not in {"DOORWAY", "CORRIDOR", "STAIRS", "CONNECTOR"}:
            raise EvidenceError("INDOOR_LINK_TYPE_INVALID")
        require_digest(link.get("source_sha256"), "INDOOR_LINK")
        edge = tuple(sorted([a, b]))
        if edge in pairs:
            raise EvidenceError("INDOOR_DUPLICATE_LINK")
        pairs.add(edge)
        neighbours[a].add(b)
        neighbours[b].add(a)
    visited: set[str] = set()
    components: list[list[str]] = []
    for nodeid in sorted(node_ids):
        if nodeid in visited:
            continue
        queue = deque([nodeid])
        visited.add(nodeid)
        component: list[str] = []
        while queue:
            curr = queue.popleft()
            component.append(curr)
            for adjacent in sorted(neighbours[curr]):
                if adjacent not in visited:
                    visited.add(adjacent)
                    queue.append(adjacent)
        components.append(sorted(component))
    measured_floors = sum(floor["elevation_m_navd88"] is not None for floor in floors)
    return {
        "schema": "tsm.indoor.topology-assessment.v1",
        "building_key": key,
        "source_document_sha256_declared": document["source"]["sha256"],
        "source_document_bytes_independently_verified": False,
        "source_identity_and_geometry_review": "NOT_EVIDENCED",
        "citygml_3_interior_supported_by_model": True,
        "tsm_application_lod4_not_established": True,
        "node_count": len(node_ids),
        "link_count": len(pairs),
        "floor_count": len(floors),
        "floors_with_stated_elevations": measured_floors,
        "connected_components": components,
        "exterior_exit_node_count": exit_count,
        "status": "TOPOLOGY_CONTRACT_PASS_REFERENCE_ONLY",
        "evacuation_route_certification": "NOT_EVIDENCED",
        "routing_instructions_authorized": False,
        "engineering_approved": False,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest="action", required=True)
    roof = subs.add_parser("export-roof", help="Convert existing LiDAR-derived LOD2 GLB to provenance-bound roof-only OBJ")
    roof.add_argument("--source-geojson", type=Path, required=True)
    roof.add_argument("--source-sha256", required=True)
    roof.add_argument("--batch-summary", type=Path, required=True)
    roof.add_argument("--batch-sha256", required=True)
    roof.add_argument("--glb-root", type=Path, required=True)
    roof.add_argument("--objectid", type=int, required=True)
    roof.add_argument("--outdir", type=Path, required=True)
    interior = subs.add_parser("assess-indoor", help="Graph connectivity from a supplied floor-plan model; NEVER evacuation directions")
    interior.add_argument("--input", type=Path, required=True)
    interior.add_argument("--expected-sha256", required=True)
    interior.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.action == "export-roof":
        result = export_roof_obj(source_geojson=args.source_geojson, source_sha256=args.source_sha256,
                                 batch_summary=args.batch_summary, batch_sha256=args.batch_sha256,
                                 glb_root=args.glb_root, objectid=args.objectid, outdir=args.outdir)
    else:
        document, filehash = load_json(args.input, args.expected_sha256)
        result = assess_indoor_topology(document)
        result["input_file_sha256_verified"] = filehash
        atomic_json(args.output, result)
    print(json.dumps(result, sort_keys=True, allow_nan=False))


if __name__ == "__main__":
    main()
