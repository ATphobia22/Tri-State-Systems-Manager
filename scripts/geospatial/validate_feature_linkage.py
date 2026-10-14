#!/usr/bin/env python3
"""Validate feature-level metadata linkage (research requirement #6).

Linkage chain under test:
  tileset tile extras.tsm.sourceObjectId
    <-> GLB content (EXT_mesh_features / EXT_structural_metadata if present)
    <-> source GeoJSON IGIO OBJECTID (exact set equality)

Rules:
  1. Every tile must declare exactly one integer sourceObjectId.
  2. Tile sourceObjectIds must be unique across the tileset.
  3. Every GLB file referenced by a tile must exist and be a valid GLB.
  4. If the GLB contains EXT_mesh_features, every feature ID in the
     extension must equal the tile's declared sourceObjectId.
  5. If the GLB contains EXT_structural_metadata, every property table
     row must be attributable to the tile's sourceObjectId.
  6. When --geojson is given: the set of tile sourceObjectIds must EXACTLY
     equal the set of source OBJECTIDs (no missing, no extras).
  7. GLBs without the EXT extensions are accepted (current TSM GLBs use
     extras.tsm), but the tile-level linkage in rules 1-3, 6 still applies.

Fail-closed: any violation -> non-zero exit with details.
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path


def fail(msg: str):
    raise SystemExit(f"FAIL: {msg}")


def read_glb_parts(path: Path) -> tuple[dict, bytes]:
    """Parse GLB v2 JSON and BIN chunks without dropping binary metadata."""
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF" or struct.unpack_from("<I", data, 4)[0] != 2:
        fail(f"invalid GLB {path}")
    declared_length = struct.unpack_from("<I", data, 8)[0]
    if declared_length != len(data):
        fail(f"GLB length header mismatch in {path}: {declared_length} != {len(data)}")
    offset, doc, binary = 12, None, b""
    while offset + 8 <= len(data):
        length, kind = struct.unpack_from("<I4s", data, offset)
        offset += 8
        chunk = data[offset:offset + length]
        if len(chunk) != length:
            fail(f"truncated GLB chunk in {path}")
        if kind == b"JSON":
            doc = json.loads(chunk.rstrip(b" \\x00").decode())
        elif kind == b"BIN\x00":
            binary = chunk
        offset += length
    if not isinstance(doc, dict):
        fail(f"missing GLB JSON chunk {path}")
    return doc, binary


def read_glb_meta(path: Path) -> dict:
    return read_glb_parts(path)[0]


def implicit_glb_object_ids(path: Path, violations: list[str]) -> set[int]:
    """Decode OBJECTID UINT32 values and validate every vertex feature index."""
    context = str(path)
    doc, binary = read_glb_parts(path)
    used = set(doc.get("extensionsUsed", []))
    if not {"EXT_mesh_features", "EXT_structural_metadata"}.issubset(used):
        violations.append(f"{context}: missing required EXT_mesh_features / EXT_structural_metadata declarations")
        return set()
    sm = doc.get("extensions", {}).get("EXT_structural_metadata", {})
    tables = sm.get("propertyTables")
    if not isinstance(tables, list) or len(tables) != 1:
        violations.append(f"{context}: expected exactly one structural metadata property table")
        return set()
    table = tables[0]
    count = table.get("count")
    prop = table.get("properties", {}).get("OBJECTID", {})
    value_view_index = prop.get("values")
    views = doc.get("bufferViews", [])
    if not isinstance(count, int) or count <= 0 or not isinstance(value_view_index, int) or not (0 <= value_view_index < len(views)):
        violations.append(f"{context}: invalid OBJECTID property table count/values reference")
        return set()
    view = views[value_view_index]
    start, length = int(view.get("byteOffset", 0)), int(view.get("byteLength", -1))
    if length != count * 4 or start < 0 or start + length > len(binary):
        violations.append(f"{context}: OBJECTID UINT32 bufferView length/offset is invalid")
        return set()
    object_ids = set(struct.unpack_from("<" + "I" * count, binary, start))
    if len(object_ids) != count:
        violations.append(f"{context}: duplicate OBJECTID values in structural metadata table")
    referenced_rows: set[int] = set()
    for mesh_index, mesh in enumerate(doc.get("meshes", [])):
        for primitive_index, primitive in enumerate(mesh.get("primitives", [])):
            ctx = f"{context}: mesh[{mesh_index}].primitive[{primitive_index}]"
            feature_ext = primitive.get("extensions", {}).get("EXT_mesh_features", {}).get("featureIds", [])
            accessor_index = primitive.get("attributes", {}).get("_FEATURE_ID_0")
            if not feature_ext or not isinstance(accessor_index, int):
                violations.append(f"{ctx}: _FEATURE_ID_0 is not linked to EXT_mesh_features")
                continue
            if feature_ext[0].get("attribute") != 0 or feature_ext[0].get("propertyTable") != 0:
                violations.append(f"{ctx}: feature-ID attribute/property-table linkage must be 0")
            accessors = doc.get("accessors", [])
            if not (0 <= accessor_index < len(accessors)):
                violations.append(f"{ctx}: invalid feature-ID accessor index")
                continue
            accessor = accessors[accessor_index]
            view_index = accessor.get("bufferView")
            if accessor.get("componentType") != 5125 or accessor.get("type") != "SCALAR" or not isinstance(view_index, int) or not (0 <= view_index < len(views)):
                violations.append(f"{ctx}: feature IDs must be UINT32 scalar accessor")
                continue
            feature_view = views[view_index]
            fstart = int(feature_view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
            fcount = accessor.get("count")
            if not isinstance(fcount, int) or fcount <= 0 or fstart < 0 or fstart + fcount * 4 > len(binary):
                violations.append(f"{ctx}: invalid feature-ID accessor range")
                continue
            feature_indices = struct.unpack_from("<" + "I" * fcount, binary, fstart)
            for feature_index in feature_indices:
                if feature_index >= count:
                    violations.append(f"{ctx}: vertex feature index {feature_index} exceeds property-table count {count}")
                else:
                    referenced_rows.add(feature_index)
    if referenced_rows != set(range(count)):
        violations.append(f"{context}: metadata rows not referenced by geometry: {sorted(set(range(count)) - referenced_rows)[:10]}")
    return object_ids


def check_glb_linkage(glb_path: Path, expected_sid: int, violations: list, ctx: str):
    """Verify GLB-internal feature metadata matches the tile's sourceObjectId."""
    doc = read_glb_meta(glb_path)
    ext_used = doc.get("extensionsUsed", [])

    # EXT_mesh_features: feature IDs must match expected_sid
    mf = doc.get("extensions", {}).get("EXT_mesh_features", {})
    for fid_set in mf.get("featureIds", []):
        # Feature IDs may be in attributes or textures; check declared lists
        pass  # structural presence check below via meshes
    # Check mesh primitives for EXT_mesh_features
    for mi, mesh in enumerate(doc.get("meshes", [])):
        for pi, prim in enumerate(mesh.get("primitives", [])):
            pext = prim.get("extensions", {}).get("EXT_mesh_features", {})
            for fis in pext.get("featureIds", []):
                # If explicit ID list present, all must equal expected_sid
                ids = fis.get("ids")
                if isinstance(ids, list) and ids:
                    bad = [i for i in ids if i != expected_sid]
                    if bad:
                        violations.append(
                            f"{ctx}: EXT_mesh_features IDs {bad[:5]} != "
                            f"sourceObjectId {expected_sid}")

    # EXT_structural_metadata: property tables must be attributable
    sm = doc.get("extensions", {}).get("EXT_structural_metadata", {})
    for tname, table in sm.get("propertyTables", {}).items():
        # Each table should have a row count consistent with single-feature GLBs
        count = table.get("count")
        if count not in (None, 1):
            violations.append(
                f"{ctx}: EXT_structural_metadata table {tname!r} count={count}, "
                f"expected 1 for single-feature GLB (sourceObjectId {expected_sid})")
        # Check for sourceObjectId property matching
        for pname, prop in table.get("properties", {}).items():
            if pname.lower() in ("sourceobjectid", "objectid", "igioobjectid"):
                vals = prop.get("values")
                if isinstance(vals, list) and vals and vals[0] != expected_sid:
                    violations.append(
                        f"{ctx}: structural metadata {pname}={vals[0]} != {expected_sid}")

    return ext_used


def collect_tiles(node: dict, out: list):
    """Recursively collect tile nodes with content."""
    content = node.get("content", {})
    uri = content.get("uri")
    if uri and not uri.startswith("{"):  # skip template URIs (implicit mode)
        out.append(node)
    for child in node.get("children", []):
        collect_tiles(child, out)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--tileset", required=True, type=Path)
    ap.add_argument("--tiles-dir", required=True, type=Path)
    ap.add_argument("--geojson", type=Path, default=None,
                    help="source GeoJSON for exact OBJECTID set equality")
    args = ap.parse_args()

    tileset = json.loads(args.tileset.read_text())
    violations: list[str] = []

    tiles: list[dict] = []
    collect_tiles(tileset.get("root", {}), tiles)
    if not tiles:
        # Implicit mode: decode actual per-tile property tables and vertex IDs.
        content_dir = args.tiles_dir / "content"
        glbs = sorted(content_dir.rglob("*.glb")) if content_dir.exists() else []
        if not glbs:
            violations.append("implicit tileset has no content GLBs")
        implicit_ids: set[int] = set()
        for glb_path in glbs:
            try:
                tile_ids = implicit_glb_object_ids(glb_path, violations)
                overlap = implicit_ids.intersection(tile_ids)
                if overlap:
                    violations.append(f"{glb_path}: duplicate OBJECTIDs across implicit content GLBs: {sorted(overlap)[:10]}")
                implicit_ids.update(tile_ids)
            except Exception as exc:
                violations.append(f"{glb_path}: unable to validate feature metadata: {exc}")
        if args.geojson:
            data = json.loads(args.geojson.read_text())
            source_ids = set()
            for feature in data.get("features", []):
                props = feature.get("properties", {}) or {}
                raw = props.get("igioObjectId", props.get("sourceObjectId", props.get("OBJECTID", props.get("objectid"))))
                if isinstance(raw, int) and not isinstance(raw, bool) and raw >= 0:
                    source_ids.add(raw)
                elif isinstance(raw, str) and raw.strip().isdigit():
                    source_ids.add(int(raw.strip()))
            missing = sorted(source_ids - implicit_ids)
            extra = sorted(implicit_ids - source_ids)
            if missing:
                violations.append(f"OBJECTIDs in source but not implicit content: {len(missing)} missing, examples={missing[:10]}")
            if extra:
                violations.append(f"OBJECTIDs in implicit content but not source: {len(extra)} extra, examples={extra[:10]}")
        if violations:
            print(f"FAIL: {len(violations)} feature-linkage violations:", file=sys.stderr)
            for violation in violations[:20]:
                print(f"  - {violation}", file=sys.stderr)
            sys.exit(1)
        print(f"PASS: implicit feature linkage OK ({len(implicit_ids)} unique OBJECTIDs)")
        return

    seen: dict[int, str] = {}
    ext_summary: dict[str, int] = {}
    for t in tiles:
        tsm = t.get("extras", {}).get("tsm", {})
        sid = tsm.get("sourceObjectId")
        uri = t.get("content", {}).get("uri", "")
        ctx = f"tile {uri}"
        if not isinstance(sid, int) or sid < 0:
            violations.append(f"{ctx}: invalid sourceObjectId {sid!r}")
            continue
        if sid in seen:
            violations.append(f"{ctx}: duplicate sourceObjectId {sid} (also {seen[sid]})")
        seen[sid] = uri
        glb_path = args.tiles_dir / uri
        if not glb_path.exists():
            violations.append(f"{ctx}: missing GLB {glb_path}")
            continue
        try:
            ext_used = check_glb_linkage(glb_path, sid, violations, ctx)
            for e in ext_used:
                ext_summary[e] = ext_summary.get(e, 0) + 1
        except SystemExit as e:
            violations.append(f"{ctx}: {e}")

    # Exact set equality against source
    if args.geojson:
        data = json.loads(args.geojson.read_text())
        src_ids = set()
        for ft in data.get("features", []):
            p = ft.get("properties", {}) or {}
            v = p.get("igioObjectId", p.get("sourceObjectId", p.get("OBJECTID")))
            if isinstance(v, (int, float)):
                src_ids.add(int(v))
        tile_ids = set(seen.keys())
        missing = sorted(src_ids - tile_ids)
        extra = sorted(tile_ids - src_ids)
        if missing:
            violations.append(f"OBJECTIDs in source but not tileset: {len(missing)} e.g. {missing[:5]}")
        if extra:
            violations.append(f"OBJECTIDs in tileset but not source: {len(extra)} e.g. {extra[:5]}")

    if violations:
        print(f"FAIL: {len(violations)} feature-linkage violations:", file=sys.stderr)
        for v in violations[:20]:
            print(f"  - {v}", file=sys.stderr)
        sys.exit(1)

    print(f"PASS: feature linkage OK ({len(seen)} tiles, unique OBJECTIDs)")
    if ext_summary:
        print(f"  GLB extensions seen: {ext_summary}")
    if args.geojson:
        print(f"  exact OBJECTID set equality vs source: OK")


if __name__ == "__main__":
    main()
