#!/usr/bin/env python3
"""Review-gated IFC -> GLB and explicit IFC-GlobalId / GIS asset crosswalk.

Uses an independently installed, reviewed IfcConvert binary. A parsed,
hash-checked preflight must already exist (ifc_preflight.py); geodetic
placement and land-survey/regulatory approval are NOT inferred by conversion.
No network access, automatic downloads, or fabricated asset IDs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import sys

SCHEMA = "tsm.geobim.mesh-bridge.v1"
MAX_MANIFEST_BYTES = 16 * 1024 * 1024
MAX_GLB_BYTES = 2 * 1024 * 1024 * 1024
GUID = re.compile(r"[0-9A-Za-z_$]{22}\Z")
ASSET = re.compile(r"[A-Za-z0-9][A-Za-z0-9:_.-]{0,127}\Z")
SHA = re.compile(r"[0-9a-f]{64}\Z")


class BridgeError(ValueError):
    """Source validity, geometry or evidence contract error."""


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_json(path: Path) -> dict:
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_MANIFEST_BYTES:
        raise BridgeError("MANIFEST_MISSING_OR_UNBOUNDED")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, UnicodeError) as exc:
        raise BridgeError("INVALID_MANIFEST_JSON") from exc
    if not isinstance(value, dict):
        raise BridgeError("MANIFEST_MUST_BE_OBJECT")
    return value


def validate_links(preflight: dict, crosswalk: dict, assets: dict, registry_digest: str) -> list[dict]:
    if preflight.get("schema") != "tsm.geobim.ifc-preflight.v1":
        raise BridgeError("VALID_IFC_PREFLIGHT_REQUIRED")
    products = preflight.get("products")
    if not isinstance(products, list) or len(products) > 250000:
        raise BridgeError("INVALID_PREFLIGHT_PRODUCT_SET")
    allowed: set[str] = set()
    for product in products:
        if not isinstance(product, dict) or not GUID.fullmatch(str(product.get("globalId", ""))):
            raise BridgeError("INVALID_IFC_GUID")
        if product["globalId"] in allowed:
            raise BridgeError("DUPLICATE_IFC_GUID")
        allowed.add(product["globalId"])
    rows = crosswalk.get("mappings")
    inventory = assets.get("assets")
    if not isinstance(rows, list) or len(rows) > 250000 or not isinstance(inventory, list) or len(inventory) > 250000:
        raise BridgeError("BOUNDED_LINK_AND_ASSET_LIST_REQUIRED")
    if crosswalk.get("assetRegistrySha256") != registry_digest:
        raise BridgeError("ASSET_REGISTRY_HASH_MISMATCH")
    asset_ids: set[str] = set()
    for asset in inventory:
        if not isinstance(asset, dict) or not isinstance(asset.get("assetId"), str) or not ASSET.fullmatch(asset["assetId"]):
            raise BridgeError("INVALID_ASSET_IDENTIFIER")
        if asset["assetId"] in asset_ids:
            raise BridgeError("DUPLICATE_GIS_ASSET")
        asset_ids.add(asset["assetId"])
    if len(asset_ids) == 0:
        raise BridgeError("EMPTY_GIS_ASSET_REGISTRY")
    out: list[dict] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            raise BridgeError("INVALID_CROSSWALK_ROW")
        gid, aid = row.get("ifcGlobalId"), row.get("assetId")
        evidence = row.get("reviewEvidenceSha256")
        if not isinstance(gid, str) or gid not in allowed or gid in seen:
            raise BridgeError("UNMATCHED_OR_DUPLICATE_IFC_GUID")
        if not isinstance(aid, str) or aid not in asset_ids:
            raise BridgeError("GIS_ASSET_NOT_FOUND_IN_PINNED_REGISTRY")
        if not isinstance(evidence, str) or not SHA.fullmatch(evidence):
            raise BridgeError("INDEPENDENT_REVIEW_EVIDENCE_DIGEST_REQUIRED")
        if row.get("reviewState") != "HUMAN_REVIEWED_CANDIDATE":
            raise BridgeError("CROSSWALK_MUST_BE_HUMAN_REVIEWED_CANDIDATE")
        seen.add(gid)
        out.append({
            "ifcGlobalId": gid,
            "assetId": aid,
            "reviewEvidenceSha256": evidence,
            "linkState": "HUMAN_REVIEWED_CANDIDATE",
            "surveyCertified": False,
        })
    return sorted(out, key=lambda x: x["ifcGlobalId"])


def validate_glb(path: Path) -> dict:
    if path.is_symlink() or not path.is_file() or not (32 <= path.stat().st_size <= MAX_GLB_BYTES):
        raise BridgeError("GLB_MISSING_OR_UNBOUNDED")
    size = path.stat().st_size
    with path.open("rb") as fp:
        header = fp.read(20)
        magic, version, declared, json_len, chunk_type = struct.unpack("<4sIIII", header)
        if magic != b"glTF" or version != 2 or declared != size or chunk_type != 0x4E4F534A:
            raise BridgeError("INVALID_GLB_V2_HEADER")
        if not 0 < json_len <= min(size - 20, MAX_MANIFEST_BYTES):
            raise BridgeError("INVALID_GLB_JSON_CHUNK")
        try:
            model = json.loads(fp.read(json_len).decode("utf-8").strip("\x00 "))
        except (UnicodeError, ValueError) as exc:
            raise BridgeError("INVALID_GLB_JSON") from exc
    if not isinstance(model, dict) or not isinstance(model.get("meshes"), list) or len(model["meshes"]) == 0:
        raise BridgeError("GLB_HAS_NO_MESHES")
    return {"sha256": digest(path), "bytes": size, "meshCount": len(model["meshes"])}


def convert(
    ifc: Path, preflight_path: Path, crosswalk_path: Path, asset_registry_path: Path,
    converter: Path, output_dir: Path,
) -> dict:
    # All inputs and the optional converter are checked before external execution.
    if not ifc.is_file() or ifc.is_symlink() or ifc.suffix.lower() != ".ifc":
        raise BridgeError("IFC_REGULAR_SOURCE_REQUIRED")
    if not converter.is_file() or converter.is_symlink() or not os.access(converter, os.X_OK):
        raise BridgeError("REVIEWED_IFCCONVERT_EXECUTABLE_REQUIRED")
    if not output_dir.is_dir() or output_dir.is_symlink():
        raise BridgeError("EXISTING_OUTPUT_DIRECTORY_REQUIRED")
    preflight, crosswalk, assets = (
        load_json(preflight_path), load_json(crosswalk_path), load_json(asset_registry_path)
    )
    receipt = preflight.get("source", {})
    if not isinstance(receipt, dict) or not isinstance(receipt.get("sha256"), str) or not SHA.fullmatch(receipt["sha256"]):
        raise BridgeError("IFC_PREFLIGHT_SOURCE_RECEIPT_REQUIRED")
    expected = receipt["sha256"]
    if digest(ifc) != expected:
        raise BridgeError("IFC_BYTES_CHANGED_SINCE_PREFLIGHT")
    registry_digest = digest(asset_registry_path)
    links = validate_links(preflight, crosswalk, assets, registry_digest)
    if not links:
        raise BridgeError("NO_REVIEWED_ASSET_LINKS")
    if preflight.get("geometry", {}).get("meshesExported") != 0:
        raise BridgeError("EXPECTED_UNEXPORTED_PREFLIGHT")
    out_glb = output_dir / "ifc-model.glb"
    out_json = output_dir / "ifc-model-asset-bridge.json"
    if any(p.exists() or p.is_symlink() for p in (out_glb, out_json)):
        raise BridgeError("OUTPUT_EXISTS_REFUSING_OVERWRITE")
    # No --ecef: original IFC CRS/control point has not been independently
    # surveyed. Preserve local GLB coordinates; do not place in the river map.
    try:
        run = subprocess.run(
            [str(converter), str(ifc), str(out_glb)],
            check=False, timeout=1800, capture_output=True, text=True,
        )
        if run.returncode != 0:
            raise BridgeError("IFCCONVERT_EXECUTION_FAILED")
        geometry = validate_glb(out_glb)
        if digest(ifc) != expected:
            raise BridgeError("IFC_CHANGED_DURING_CONVERSION")
        output = {
            "schemaVersion": SCHEMA,
            "sourceIfcSha256": expected,
            "preflightSha256": digest(preflight_path),
            "crosswalkSha256": digest(crosswalk_path),
            "assetRegistrySha256": registry_digest,
            "geometry": {"file": out_glb.name, **geometry, "coordinateFrame": "IFC_MODEL_LOCAL"},
            "links": links,
            "placementState": "UNVERIFIED_CONTROL_POINTS",
            "horizontalCrsDeclared": preflight.get("georeferencing", {}).get("projectedCrs"),
            "verticalDatumDeclared": preflight.get("georeferencing", {}).get("verticalDatumDeclared"),
            "sourceDatumVerified": False,
            "surveyCertified": False,
            "hydraulicModelInputApproved": False,
            "regulatoryApproved": False,
            "nativeViewerValidated": False,
            "note": "GLB conversion succeeded; mesh-level GUID retention and geodetic alignment are NOT independently verified.",
        }
        with out_json.open("x", encoding="utf-8") as fp:
            json.dump(output, fp, indent=2, sort_keys=True, allow_nan=False)
            fp.write("\n")
        return output
    except (BridgeError, subprocess.TimeoutExpired, OSError):
        # Fail without accidentally retaining a partial GLB mistaken for proof.
        if out_glb.exists() and not out_glb.is_symlink():
            out_glb.unlink()
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("ifc", "preflight", "crosswalk", "asset-registry", "ifcconvert", "output-dir"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    try:
        result = convert(args.ifc, args.preflight, args.crosswalk, args.asset_registry, args.ifcconvert, args.output_dir)
    except (BridgeError, OSError, subprocess.TimeoutExpired) as exc:
        parser.error(str(exc))
    print(json.dumps({"state": result["placementState"], "meshCount": result["geometry"]["meshCount"], "candidateLinks": len(result["links"])}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
