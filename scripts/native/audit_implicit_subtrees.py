#!/usr/bin/env python3
"""Bounded OGC 3D Tiles 1.1 implicit-subtree reference traversal.

Static integrity only: never claims a headed render, spatial coherence, survey
accuracy, or regulatory acceptance. Uses OGC availability bit order and follows
only available tiles and child subtree references. Rejects unbounded traversal.
"""
from __future__ import annotations

import json
import struct
from pathlib import Path

MAX_SUBTREE_BYTES = 64 * 1024 * 1024
MAX_SUBTREES = 10000
MAX_ENUMERATED_TILES = 250000
MAX_SUBTREE_LEVELS = 7


def _positive_int(value: object, name: str, maximum: int) -> int:
    if type(value) is not int or not 1 <= value <= maximum:
        raise ValueError("invalid implicit tiling " + name)
    return value


def _morton(x: int, y: int, z: int, level: int, octree: bool) -> int:
    result = 0
    width = 3 if octree else 2
    for bit in range(level):
        result |= ((x >> bit) & 1) << (width * bit)
        result |= ((y >> bit) & 1) << (width * bit + 1)
        if octree:
            result |= ((z >> bit) & 1) << (width * bit + 2)
    return result


def _binary_subtree(path: Path) -> tuple[dict, bytes]:
    if path.stat().st_size > MAX_SUBTREE_BYTES:
        raise ValueError("implicit subtree exceeds byte limit")
    raw = path.read_bytes()
    if raw.startswith(b"subt"):
        if len(raw) < 24:
            raise ValueError("invalid binary subtree header")
        magic, version, json_bytes, binary_bytes = struct.unpack_from("<4sIQQ", raw)
        if magic != b"subt" or version != 1 or json_bytes % 8 or binary_bytes % 8:
            raise ValueError("invalid subtree magic, version or alignment")
        if 24 + json_bytes + binary_bytes != len(raw):
            raise ValueError("invalid subtree declared length")
        document = raw[24:24 + json_bytes]
        internal = raw[24 + json_bytes:]
    else:
        # OGC subtree JSON encoding is supported, with external buffers.
        document = raw
        internal = b""
    try:
        subtree = json.loads(document.decode("utf-8"))
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("invalid implicit subtree JSON") from exc
    if not isinstance(subtree, dict):
        raise ValueError("invalid implicit subtree document")
    return subtree, internal


def _template(value: object, coords: tuple[int, int, int, int], octree: bool) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError("missing implicit resource template")
    level, x, y, z = coords
    # Do not use Python str.format here: its width specifiers and attribute
    # access are not part of the OGC URI-template grammar and can allocate
    # unbounded strings from untrusted tileset metadata.
    required = ("{level}", "{x}", "{y}", "{z}") if octree else ("{level}", "{x}", "{y}")
    if any(token not in value for token in required):
        raise ValueError("missing implicit URI template coordinate")
    uri = value
    for token, number in zip(("{level}", "{x}", "{y}", "{z}"), (level, x, y, z)):
        if token == "{z}" and not octree and token in uri:
            raise ValueError("unexpected z in quadtree template")
        uri = uri.replace(token, str(number))
    if "{" in uri or "}" in uri:
        raise ValueError("unsupported implicit URI template syntax")
    return uri


def traverse_implicit(
    index_path: Path,
    node: dict,
    asset,
    content_files: set[Path],
    inspect_glb,
    visit_tileset,
) -> dict:
    implicit = node.get("implicitTiling")
    if implicit is None:
        # Legacy extension is not a 3D Tiles 1.1 implicitTiling object.
        raise ValueError("legacy implicit tiling extension unsupported")
    if not isinstance(implicit, dict):
        raise ValueError("invalid implicit tiling specification")
    scheme = implicit.get("subdivisionScheme")
    if scheme not in ("QUADTREE", "OCTREE"):
        raise ValueError("invalid implicit subdivision scheme")
    octree = scheme == "OCTREE"
    fanout = 8 if octree else 4
    subtree_levels = _positive_int(implicit.get("subtreeLevels"), "subtreeLevels", MAX_SUBTREE_LEVELS)
    available_levels = _positive_int(implicit.get("availableLevels"), "availableLevels", 24)
    if "children" in node:
        raise ValueError("implicit root must omit explicit children")
    if "content" in node and "contents" in node:
        raise ValueError("implicit root cannot mix content and contents")
    if "content" in node and not isinstance(node["content"], dict):
        raise ValueError("invalid implicit content template")
    subtree_def = implicit.get("subtrees")
    if not isinstance(subtree_def, dict):
        raise ValueError("implicit subtrees definition missing")
    subtree_template = subtree_def.get("uri")
    contents = node.get("contents")
    if contents is None:
        contents = [node["content"]] if isinstance(node.get("content"), dict) else []
    if not isinstance(contents, list) or any(not isinstance(x, dict) for x in contents):
        raise ValueError("invalid implicit content templates")
    if any("uri" not in x for x in contents):
        raise ValueError("invalid implicit content template")
    if len(contents) > 8:
        raise ValueError("too many implicit content templates")

    pending = [(0, 0, 0, 0)]
    processed: set[tuple[int, int, int, int]] = set()
    total_tiles = 0
    total_contents = 0

    while pending:
        coords = pending.pop()
        if coords in processed:
            raise ValueError("duplicate implicit subtree reference")
        processed.add(coords)
        if len(processed) > MAX_SUBTREES:
            raise ValueError("implicit subtree count limit exceeded")
        level, gx, gy, gz = coords
        subtree_file = asset(index_path.parent, _template(subtree_template, coords, octree))
        content_files.add(subtree_file)
        subtree, internal = _binary_subtree(subtree_file)
        buffers = subtree.get("buffers", [])
        views = subtree.get("bufferViews", [])
        if not isinstance(buffers, list) or not isinstance(views, list):
            raise ValueError("invalid implicit subtree buffer metadata")
        loaded: list[bytes] = []
        for buffer_index, buffer in enumerate(buffers):
            if not isinstance(buffer, dict):
                raise ValueError("invalid subtree buffer")
            count = buffer.get("byteLength")
            if type(count) is not int or count < 0 or count > MAX_SUBTREE_BYTES:
                raise ValueError("invalid subtree buffer length")
            if "uri" in buffer:
                path = asset(subtree_file.parent, buffer["uri"])
                if path.stat().st_size > MAX_SUBTREE_BYTES:
                    raise ValueError("external subtree buffer exceeds byte limit")
                content_files.add(path)
                raw = path.read_bytes()
            else:
                if buffer_index != 0 or not subtree_file.read_bytes().startswith(b"subt"):
                    raise ValueError("only binary subtree buffer zero may be internal")
                raw = internal
            if len(raw) < count:
                raise ValueError("truncated subtree buffer")
            loaded.append(raw[:count])

        extracted: list[bytes] = []
        for view in views:
            if not isinstance(view, dict):
                raise ValueError("invalid subtree buffer view")
            i, start, length = view.get("buffer"), view.get("byteOffset", 0), view.get("byteLength")
            if type(i) is not int or not 0 <= i < len(loaded) or type(start) is not int or start < 0 \
                    or type(length) is not int or length < 0 or start + length > len(loaded[i]):
                raise ValueError("subtree buffer view out of range")
            if start % 8:
                raise ValueError("subtree buffer view offset is not 8-byte aligned")
            extracted.append(loaded[i][start:start + length])

        tile_bits = (fanout ** subtree_levels - 1) // (fanout - 1)
        child_bits = fanout ** subtree_levels
        if tile_bits + child_bits > MAX_ENUMERATED_TILES:
            raise ValueError("implicit subtree availability exceeds audit budget")

        def availability(record: object, count: int) -> list[bool]:
            if not isinstance(record, dict):
                raise ValueError("implicit availability record missing")
            is_constant = "constant" in record
            is_bitstream = "bitstream" in record
            if is_constant == is_bitstream:
                raise ValueError("implicit availability must have exactly one encoding")
            if is_constant:
                c = record["constant"]
                if type(c) is not int or c not in (0, 1):
                    raise ValueError("invalid implicit availability constant")
                bits = [bool(c)] * count
            else:
                i = record["bitstream"]
                if type(i) is not int or not 0 <= i < len(extracted):
                    raise ValueError("implicit availability buffer view missing")
                payload = extracted[i]
                required = (count + 7) // 8
                if len(payload) < required or any(payload[required:]):
                    raise ValueError("implicit availability bitstream length invalid")
                bits = [bool(payload[k // 8] & (1 << (k % 8))) for k in range(count)]
                if count % 8 and payload[required - 1] >> (count % 8):
                    raise ValueError("nonzero implicit availability padding bits")
            stated = record.get("availableCount")
            if stated is not None and (type(stated) is not int or stated != sum(bits)):
                raise ValueError("implicit availableCount does not match bitstream")
            return bits

        tile_avail = availability(subtree.get("tileAvailability"), tile_bits)
        child_avail = availability(subtree.get("childSubtreeAvailability"), child_bits)
        content_def = subtree.get("contentAvailability", [])
        if not isinstance(content_def, list) or len(contents) != len(content_def):
            raise ValueError("implicit content availability does not match templates")
        content_avail = [availability(record, tile_bits) for record in content_def]
        if not tile_avail[0]:
            raise ValueError("implicit subtree root must be available")

        local_level_offsets = [sum(fanout ** depth for depth in range(k))
                               for k in range(subtree_levels)]
        for local_level in range(subtree_levels):
            global_level = level + local_level
            count = fanout ** local_level
            for idx in range(count):
                bit = local_level_offsets[local_level] + idx
                if not tile_avail[bit]:
                    if any(a[bit] for a in content_avail):
                        raise ValueError("implicit content exists on unavailable tile")
                    continue
                if local_level:
                    parent = local_level_offsets[local_level - 1] + (idx // fanout)
                    if not tile_avail[parent]:
                        raise ValueError("implicit available tile has unavailable parent")
                if global_level >= available_levels:
                    raise ValueError("implicit availability exceeds availableLevels")
                total_tiles += 1
                if total_tiles > MAX_ENUMERATED_TILES:
                    raise ValueError("implicit tile traversal budget exceeded")
                lx = ly = lz = 0
                for bit_level in range(local_level):
                    lx |= ((idx >> ((3 if octree else 2) * bit_level)) & 1) << bit_level
                    ly |= ((idx >> ((3 if octree else 2) * bit_level + 1)) & 1) << bit_level
                    if octree:
                        lz |= ((idx >> (3 * bit_level + 2)) & 1) << bit_level
                here = (global_level, (gx << local_level) | lx,
                        (gy << local_level) | ly, (gz << local_level) | lz)
                for template, enabled in zip(contents, content_avail):
                    if enabled[bit]:
                        target = asset(index_path.parent, _template(template["uri"], here, octree))
                        if target.suffix.lower() == ".json":
                            raise ValueError("implicit tile content cannot be an external tileset")
                        elif target.suffix.lower() == ".glb":
                            content_files.add(target)
                            inspect_glb(target)
                        else:
                            raise ValueError("implicit content format not independently audited")
                        total_contents += 1

        child_level = level + subtree_levels
        for idx, enabled in enumerate(child_avail):
            if not enabled:
                continue
            if child_level >= available_levels:
                raise ValueError("implicit child subtree exceeds availableLevels")
            # The child tree may only exist beneath an available parent tile.
            ancestor_idx = local_level_offsets[-1] + idx // fanout
            if not tile_avail[ancestor_idx]:
                raise ValueError("implicit child subtree has unavailable parent")
            lx = ly = lz = 0
            for bit_level in range(subtree_levels):
                lx |= ((idx >> ((3 if octree else 2) * bit_level)) & 1) << bit_level
                ly |= ((idx >> ((3 if octree else 2) * bit_level + 1)) & 1) << bit_level
                if octree:
                    lz |= ((idx >> (3 * bit_level + 2)) & 1) << bit_level
            pending.append((child_level, (gx << subtree_levels) | lx,
                            (gy << subtree_levels) | ly, (gz << subtree_levels) | lz))
    return {"subtrees": len(processed), "tiles": total_tiles, "contents": total_contents}
