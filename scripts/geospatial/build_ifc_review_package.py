#!/usr/bin/env python3
"""Join verified IFC intake, parsed IFC preflight, GLB node GUIDs, and control comparisons.

This is an offline evidence-building tool, NOT an IFC authoring engine, surveyed
alignment certificate, a 3D Tiles metadata encoder, or a geometry placement permit.
It never promotes input declarations into independent approval.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import sys

from scripts.geospatial.verify_geobim_ifc_intake import verify as verify_source
from scripts.geospatial.export_reviewed_ifc_glb import validate_glb

REVIEW_SCHEMA = "tsm.design-review.v1"
FEATURE_SCHEMA = "tsm.geobim.glb-node-crosswalk.v1"
CONTROL_SCHEMA = "tsm.ifc-independent-control.v1"
PLACEMENT_SCHEMA = "tsm.geobim.placement-screen.v1"
GUID = re.compile(r"[A-Za-z0-9_$]{22}\Z")
ID = re.compile(r"[A-Za-z0-9_.:-]{1,128}\Z")
SHA = re.compile(r"[0-9a-f]{64}\Z")
# Units are independently known for these regionally relevant projected frames.
# Other EPSG codes require an explicit reviewed unit adapter, not a guess.
CRS_UNIT = {"EPSG:2966": ("ftUS", 1200 / 3937),
            "EPSG:26916": ("m", 1.0),
            "EPSG:3089": ("ftUS", 1200 / 3937)}
MAX_JSON_BYTES = 16 * 1024 * 1024
MAX_REVIEW_BYTES = 4 * 1024 * 1024
MAX_PRODUCTS = 20000
MAX_CONTROLS = 10000

def file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def input_file(path: Path, max_bytes: int = MAX_JSON_BYTES) -> Path:
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= max_bytes:
        raise ValueError("INVALID_OR_UNBOUNDED_INPUT: " + str(path))
    return path

def read_json(path: Path) -> dict:
    document = json.loads(input_file(path).read_text(encoding="utf-8"))
    if not isinstance(document, dict):
        raise ValueError("EXPECTED_JSON_OBJECT")
    return document

def finite(value, label: str) -> float:
    if type(value) not in (int, float) or not math.isfinite(value):
        raise ValueError("NONFINITE_NUMERIC_VALUE: " + label)
    return float(value)

def positive(value, label: str) -> float:
    result = finite(value, label)
    if result <= 0:
        raise ValueError("NONPOSITIVE_VALUE: " + label)
    return result

def compact_json(value: dict) -> bytes:
    return (json.dumps(value, separators=(",", ":"), sort_keys=True, ensure_ascii=True,
                       allow_nan=False) + "\n").encode("utf-8")

def parse_glb_nodes(path: Path, valid_guids: set[str]) -> tuple[list[dict], int]:
    """Only explicit GUID-attributed mesh nodes count; no ordering or heuristic linking."""
    validate_glb(path)
    with path.open("rb") as stream:
        header = stream.read(20)
        magic, version, total, length, type_id = struct.unpack("<4sIIII", header)
        if magic != b"glTF" or version != 2 or total != path.stat().st_size or type_id != 0x4E4F534A:
            raise ValueError("INVALID_GLB_HEADER")
        data = stream.read(length)
    obj = json.loads(data.decode("utf-8").rstrip(" \x00"))
    meshes = obj.get("meshes", [])
    nodes = obj.get("nodes", [])
    if not isinstance(nodes, list) or len(nodes) > 200000:
        raise ValueError("INVALID_GLB_NODE_LIST")
    if not isinstance(meshes, list) or len(meshes) > 200000:
        raise ValueError("INVALID_GLB_MESH_LIST")
    bindings = []
    unknown_mesh_nodes = 0
    for index, node in enumerate(nodes):
        if not isinstance(node, dict):
            raise ValueError("INVALID_GLB_NODE")
        mesh = node.get("mesh")
        if mesh is None:
            continue
        if type(mesh) is not int or not 0 <= mesh < len(meshes):
            raise ValueError("GLB_NODE_MESH_INVALID")
        extras = node.get("extras", {})
        if not isinstance(extras, dict):
            raise ValueError("GLB_NODE_EXTRAS_INVALID")
        name = node.get("name")
        guid_from_name = name if isinstance(name, str) and GUID.fullmatch(name) else None
        guid_from_extras = extras.get("ifcGlobalId")
        if guid_from_extras is not None and (not isinstance(guid_from_extras, str) or not GUID.fullmatch(guid_from_extras)):
            raise ValueError("GLB_EXTRAS_IFC_GUID_MALFORMED")
        if guid_from_name and guid_from_extras and guid_from_name != guid_from_extras:
            raise ValueError("CONFLICTING_GLB_GUID")
        guid = guid_from_extras or guid_from_name
        if not guid:
            unknown_mesh_nodes += 1
            continue
        if guid not in valid_guids:
            raise ValueError("UNKNOWN_IFC_GUID_IN_GLB: " + guid)
        bindings.append({"ifcGlobalId": guid, "nodeIndex": index, "meshIndex": mesh})
    bindings.sort(key=lambda b: (b["ifcGlobalId"], b["nodeIndex"]))
    return bindings, unknown_mesh_nodes

def review_controls(path: Path, ifc_sha: str, preflight_sha: str, preflight: dict,
                    horizontal_crs: str, horizontal_units: str, meter_per_unit: float,
                    vertical_datum: str) -> dict:
    c = read_json(path)
    if c.get("schema") != CONTROL_SCHEMA:
        raise ValueError("INVALID_CONTROL_SCHEMA")
    if c.get("sourceIfcSha256") != ifc_sha or c.get("sourcePreflightSha256") != preflight_sha:
        raise ValueError("CONTROL_SOURCE_HASH_MISMATCH")
    if (c.get("horizontalCrs") != horizontal_crs or c.get("horizontalUnits") != horizontal_units or
            c.get("verticalDatum") != vertical_datum):
        raise ValueError("CONTROL_FRAME_MISMATCH")
    if not isinstance(c.get("sourceAuthority"), str) or not c["sourceAuthority"].strip():
        raise ValueError("MISSING_CONTROL_AUTHORITY_DECLARATION")
    if not isinstance(c.get("coordinateEpoch"), str) or not c["coordinateEpoch"].strip():
        raise ValueError("MISSING_COORDINATE_EPOCH")
    name = c.get("surveyReport")
    digest = c.get("surveyReportSha256")
    if not isinstance(name, str) or not name or not isinstance(digest, str) or not SHA.fullmatch(digest):
        raise ValueError("MISSING_SURVEY_SOURCE_AND_HASH")
    base = path.resolve().parent
    report_path = (path.parent / name)
    if report_path.is_symlink() or report_path.resolve().parent != base:
        raise ValueError("SURVEY_REPORT_OUTSIDE_CONTROL_DIRECTORY")
    input_file(report_path, max_bytes=256 * 1024 * 1024)
    if file_hash(report_path) != digest:
        raise ValueError("SURVEY_REPORT_HASH_MISMATCH")
    geo = preflight["georeferencing"]
    op = geo.get("mapConversion")
    if not isinstance(op, dict):
        raise ValueError("IFC_MAP_CONVERSION_REQUIRED")
    lengths = geo.get("lengthUnits")
    if not isinstance(lengths, dict) or lengths.get("verified") is not True:
        raise ValueError("IFC_LENGTH_UNITS_NOT_VERIFIED")
    model_meter = positive(lengths.get("metersPerModelUnit"), "metersPerModelUnit")
    scale = positive(op.get("scale"), "mapConversion.scale")
    a = finite(op.get("axisAbscissa"), "mapConversion.axisAbscissa")
    b = finite(op.get("axisOrdinate"), "mapConversion.axisOrdinate")
    if abs(math.hypot(a, b) - 1) > 1e-6:
        raise ValueError("IFC_MAP_AXIS_NOT_NORMALIZED")
    # Reject grossly inconsistent project-unit-to-map-unit scale conventions.
    # A valid site combined scale factor must still be reviewed independently.
    if abs((scale * meter_per_unit / model_meter) - 1.0) > 0.02:
        raise ValueError("IFC_MAP_SCALE_UNIT_CONFLICT")
    e = finite(op.get("eastings"), "eastings")
    n = finite(op.get("northings"), "northings")
    h = finite(op.get("orthogonalHeight"), "orthogonalHeight")
    rows = c.get("controlPoints")
    if not isinstance(rows, list) or not 3 <= len(rows) <= MAX_CONTROLS:
        raise ValueError("AT_LEAST_THREE_INDEPENDENT_CONTROLS_REQUIRED")
    ids, pts, residuals = set(), [], []
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str) or not ID.fullmatch(row["id"]):
            raise ValueError("INVALID_CONTROL_POINT_ID")
        if row["id"] in ids:
            raise ValueError("DUPLICATE_CONTROL_POINT_ID")
        ids.add(row["id"])
        local, measured = row.get("localIfc"), row.get("surveyMap")
        if not isinstance(local, list) or not isinstance(measured, list) or len(local) != 3 or len(measured) != 3:
            raise ValueError("INVALID_CONTROL_COORDINATES")
        x, y, z = (finite(item, "localIfc") for item in local)
        east, north, height = (finite(item, "surveyMap") for item in measured)
        pts.append((x, y))
        # IFC MapConversion project-axis → grid-axis. Never derive these
        # parameters by fitting the same test points being scored.
        pred_e = e + scale * (a * x - b * y)
        pred_n = n + scale * (b * x + a * y)
        pred_h = h + scale * z
        dx = (pred_e - east) * meter_per_unit
        dy = (pred_n - north) * meter_per_unit
        dz = (pred_h - height) * meter_per_unit
        if not all(math.isfinite(item) for item in (dx, dy, dz)):
            raise ValueError("NUMERIC_CONTROL_RESIDUAL_OVERFLOW")
        residuals.append((row["id"], dx, dy, dz))
    # Require three spatially distributed controls, not repeated/collinear points.
    extent = max(math.hypot(px-qx,py-qy) for px,py in pts for qx,qy in pts)
    if extent <= 1e-6:
        raise ValueError("CONTROL_POINTS_NOT_DISTRIBUTED")
    if max(abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))
           for ax,ay in pts for bx,by in pts for cx,cy in pts) < 1e-6 * extent * extent:
        raise ValueError("CONTROL_POINTS_COLLINEAR")
    count = len(residuals)
    rmse_h = math.sqrt(math.fsum(dx*dx + dy*dy for _,dx,dy,dz in residuals)/count)
    rmse_v = math.sqrt(math.fsum(dz*dz for _,dx,dy,dz in residuals)/count)
    h_tol = positive(c.get("maxHorizontalRmseM"), "maxHorizontalRmseM")
    v_tol = positive(c.get("maxVerticalRmseM"), "maxVerticalRmseM")
    if not all(math.isfinite(v) for v in (rmse_h, rmse_v)):
        raise ValueError("NUMERIC_CONTROL_RMSE_OVERFLOW")
    return {
        "controlInputHashVerified": True,
        "controlFileSha256": file_hash(path),
        "surveyReportHashVerified": True,
        "surveyReportSha256": digest,
        "sourceAuthorityDeclared": c["sourceAuthority"],
        "coordinateEpochDeclared": c["coordinateEpoch"],
        "controlCount": count,
        "numericControlCheckPassed": rmse_h <= h_tol and rmse_v <= v_tol,
        "metrics": {
            "horizontalRmseM": rmse_h, "verticalRmseM": rmse_v,
            "maxHorizontalResidualM": max(math.hypot(dx,dy) for _,dx,dy,dz in residuals),
            "maxVerticalResidualM": max(abs(dz) for _,dx,dy,dz in residuals),
            "declaredHorizontalToleranceM": h_tol,
            "declaredVerticalToleranceM": v_tol
        },
        "residuals": [{"controlId": pid, "dxM": dx, "dyM": dy, "dzM": dz}
                      for pid, dx, dy, dz in residuals],
    }

def build(ifc_path: Path, intake_metadata_path: Path, preflight_path: Path,
          mesh_bridge_path: Path, glb_path: Path, output_dir: Path,
          model_id: str, revision_id: str, *, control_path: Path | None = None) -> tuple[dict, dict, dict]:
    if not isinstance(model_id, str) or not ID.fullmatch(model_id) or not isinstance(revision_id, str) or not ID.fullmatch(revision_id):
        raise ValueError("INVALID_MODEL_OR_REVISION_ID")
    if output_dir.is_symlink() or not output_dir.is_dir():
        raise ValueError("OUTPUT_DIRECTORY_NOT_READY")
    outputs = [output_dir / name for name in ("design-review.json", "ifc-feature-map.json", "ifc-placement-screen.json")]
    if any(x.exists() or x.is_symlink() for x in outputs):
        raise ValueError("OUTPUT_EXISTS_REFUSING_OVERWRITE")
    metadata = read_json(intake_metadata_path)
    receipt = verify_source(ifc_path, metadata)
    if not receipt["sourceBytesVerified"]:
        raise ValueError("IFC_SOURCE_NOT_VERIFIED")
    preflight = read_json(preflight_path)
    bridge = read_json(mesh_bridge_path)
    if preflight.get("schema") != "tsm.geobim.ifc-preflight.v1":
        raise ValueError("IFC_PREFLIGHT_REQUIRED")
    if preflight.get("source", {}).get("sha256") != receipt["sha256"]:
        raise ValueError("IFC_PREFLIGHT_SOURCE_HASH_MISMATCH")
    preflight_sha = file_hash(preflight_path)
    if bridge.get("schemaVersion") != "tsm.geobim.mesh-bridge.v1":
        raise ValueError("MESH_BRIDGE_REQUIRED")
    if bridge.get("sourceIfcSha256") != receipt["sha256"] or bridge.get("preflightSha256") != preflight_sha:
        raise ValueError("PREFLIGHT_HASH_MISMATCH")
    if bridge.get("geometry", {}).get("coordinateFrame") != "IFC_MODEL_LOCAL":
        raise ValueError("UNREVIEWED_COORDINATE_FRAME")
    if bridge["geometry"].get("file") != glb_path.name:
        raise ValueError("GLB_FILENAME_MISMATCH")
    if validate_glb(glb_path)["sha256"] != bridge["geometry"].get("sha256"):
        raise ValueError("GLB_HASH_MISMATCH")
    geo = preflight.get("georeferencing", {})
    if not isinstance(geo, dict) or geo.get("projectedCrs") != metadata["horizontalCrs"] or geo.get("verticalDatumDeclared") != metadata["verticalDatum"]:
        raise ValueError("PRECHECK_CRS_OR_VERTICAL_DATUM_CONFLICT")
    source_crs = metadata["horizontalCrs"]
    if source_crs not in CRS_UNIT:
        raise ValueError("CRS_UNIT_REQUIRES_INDEPENDENT_ADAPTER")
    map_unit, meter_per_unit = CRS_UNIT[source_crs]
    if not isinstance(preflight.get("products"), list) or len(preflight["products"]) > MAX_PRODUCTS:
        raise ValueError("REVIEW_PRODUCT_LIMIT_EXCEEDED")
    valid = set()
    elements = []
    for product in preflight["products"]:
        if not isinstance(product, dict) or not isinstance(product.get("globalId"), str) or not GUID.fullmatch(product["globalId"]):
            raise ValueError("INVALID_PREFLIGHT_IFC_GUID")
        gid = product["globalId"]
        if gid in valid:
            raise ValueError("DUPLICATE_PREFLIGHT_GUID")
        valid.add(gid)
        category = str(product.get("ifcClass", "IfcProduct"))
        if not ID.fullmatch(category):
            raise ValueError("INVALID_IFC_CLASS")
        parent = product.get("parentGlobalId")
        if parent is not None and (not isinstance(parent, str) or not GUID.fullmatch(parent)):
            raise ValueError("INVALID_IFC_PARENT")
        title = product.get("name")
        if not isinstance(title, str) or not title.strip() or len(title) > 512:
            title = category + " " + gid
        elements.append({"id": gid, "parentId": parent, "title": title,
                         "category": category, "quantities": {}})
    for element in elements:
        if element["parentId"] and element["parentId"] not in valid:
            element["parentId"] = None  # Unresolved relationship, never an invented root mesh.
    nodes, unmapped = parse_glb_nodes(glb_path, valid)
    links = {}
    for row in bridge.get("links", []):
        if not isinstance(row, dict) or row.get("linkState") != "HUMAN_REVIEWED_CANDIDATE":
            raise ValueError("UNREVIEWED_GIS_CROSSWALK")
        gid, asset = row.get("ifcGlobalId"), row.get("assetId")
        if gid not in valid or gid in links or not isinstance(asset,str) or not ID.fullmatch(asset):
            raise ValueError("INVALID_OR_DUPLICATE_GIS_CROSSWALK")
        links[gid] = asset
    bindings = [{**node, "assetId": links.get(node["ifcGlobalId"])}
                for node in nodes]
    mapped = {b["ifcGlobalId"] for b in bindings}
    expected = {x["globalId"] for x in preflight["products"] if x.get("hasRepresentation") is True}
    feature_map = {
        "schema": FEATURE_SCHEMA, "modelId": model_id, "revisionId": revision_id,
        "sourceIfcSha256": receipt["sha256"], "glbSha256": bridge["geometry"]["sha256"],
        "coordinateFrame": "IFC_MODEL_LOCAL",
        "bindings": bindings, "mappedGlobalIdCount": len(mapped),
        "expectedRepresentedProductCount": len(expected),
        "unmappedRepresentedProductCount": len(expected - mapped),
        "unmappedMeshNodeCount": unmapped,
        "glbNodeGuidAttributed": bool(bindings),
        "meshIdentityIndependentlyVerified": False,
        "threeDTilesFeatureMetadataEmitted": False,
        "note": "Node name / extras GUIDs are reported as source assertions; GLB geometry semantics and 3D Tiles EXT_mesh_features are not independently validated.",
    }
    control = {"controlInputHashVerified": False, "numericControlCheckPassed": False,
               "controlCount": 0, "metrics": None}
    if control_path is not None:
        control = review_controls(control_path, receipt["sha256"], preflight_sha, preflight,
                                  source_crs, map_unit, meter_per_unit, metadata["verticalDatum"])
    placement = {
        "schema": PLACEMENT_SCHEMA, "modelId": model_id, "revisionId": revision_id,
        "sourceIfcSha256": receipt["sha256"], "horizontalCrs": source_crs,
        "horizontalUnits": map_unit, "verticalDatum": metadata["verticalDatum"],
        "ifcMapConversionDeclared": geo.get("mapConversion") is not None,
        **control,
        "surveyControlIndependentlyAuthenticated": False,
        "surveyorApproved": False,
        "modelOverlayPermitted": False,
        "terrainClipPermitted": False,
        "regulatoryUse": False,
        "geometryPlacementState": "PENDING_INDEPENDENT_SURVEY_AUTHENTICATION",
        "notice": "Numeric comparison is neither surveyed source authentication nor a release permit. Keep mesh local and clipping disabled.",
    }
    review = {
        "schema": REVIEW_SCHEMA, "modelId": model_id, "revisionId": revision_id,
        "source": {
            "sourceId": metadata["sourceId"], "sha256": receipt["sha256"],
            "horizontalCrs": source_crs, "horizontalUnits": map_unit,
            "verticalDatum": metadata["verticalDatum"], "license": metadata["license"],
        },
        "placement": {"state": "PENDING_EVIDENCE", "controlCount": control["controlCount"],
                      "maxResidualM": None, "toleranceM": None},
        "elements": sorted(elements, key=lambda item: item["id"]),
    }
    files = [(outputs[0], compact_json(review)), (outputs[1], compact_json(feature_map)),
             (outputs[2], compact_json(placement))]
    if len(files[0][1]) > MAX_REVIEW_BYTES:
        raise ValueError("REVIEW_JSON_EXCEEDS_BROWSER_4MIB_LIMIT")
    # Validate every output before writing; rollback if output IO fails.
    created = []
    try:
        for path, data in files:
            with path.open("xb") as fh:
                fh.write(data)
            created.append(path)
    except OSError:
        for path in created:
            path.unlink(missing_ok=True)
        raise
    return review, feature_map, placement

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("ifc", "metadata", "preflight", "mesh-bridge", "glb", "output-dir", "model-id", "revision-id"):
        parser.add_argument("--" + name, required=True, type=Path if name not in ("model-id", "revision-id") else str)
    parser.add_argument("--controls", type=Path)
    args = parser.parse_args()
    try:
        review, features, placement = build(
            args.ifc, args.metadata, args.preflight, args.mesh_bridge, args.glb,
            args.output_dir, args.model_id, args.revision_id, control_path=args.controls)
    except (OSError, ValueError, KeyError, TypeError, struct.error) as exc:
        print(json.dumps({"status": "REJECTED", "reason": str(exc)}), file=sys.stderr)
        return 2
    print(json.dumps({"status": "METADATA_PACKAGE_CREATED_WITH_UNPLACED_GLB",
                      "elements": len(review["elements"]), "nodeGuidLinks": len(features["bindings"]),
                      "controlCheckPassed": placement["numericControlCheckPassed"],
                      "modelOverlayPermitted": False, "terrainClipPermitted": False}))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
