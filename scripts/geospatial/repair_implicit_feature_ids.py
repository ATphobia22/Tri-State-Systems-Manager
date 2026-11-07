#!/usr/bin/env python3
"""Copy an implicit tileset and repair legacy UINT32 feature vertex attributes.

Local row indices change storage and the legacy schema ID becomes a valid
identifier. OBJECTIDs, geometry, transforms, heights and authority claims are preserved. This is format repair, not acceptance.
"""
import argparse
import hashlib
import json
import shutil
import struct
from pathlib import Path

from validate_feature_linkage import feature_id_values


def repair_glb(data: bytes) -> bytes:
    if data[:4] != b'glTF' or len(data) < 20:
        raise ValueError('not a GLB')
    magic, version, length = struct.unpack_from('<4sII', data)
    if version != 2 or length != len(data):
        raise ValueError('invalid GLB header')
    chunks = []
    offset = 12
    while offset < len(data):
        size, kind = struct.unpack_from('<I4s', data, offset)
        offset += 8
        if offset + size > len(data):
            raise ValueError('truncated GLB chunk')
        chunks.append([kind, data[offset:offset + size]])
        offset += size
    if [k for k, _ in chunks] != [b'JSON', b'BIN\0']:
        raise ValueError('expected JSON and BIN chunks')
    doc = json.loads(chunks[0][1])
    binary = bytearray(chunks[1][1])
    attributes = {p['attributes']['_FEATURE_ID_0'] for m in doc.get('meshes', [])
                  for p in m.get('primitives', []) if '_FEATURE_ID_0' in p.get('attributes', {})}
    schema = doc.get('extensions', {}).get('EXT_structural_metadata', {}).get('schema', {})
    changed = schema.get('id') == 'tsm-building-feature-schema'
    if changed:
        schema['id'] = 'tsm_building_feature_schema'
    for index in attributes:
        accessor = doc['accessors'][index]
        component_type = accessor.get('componentType')
        if component_type not in (5125, 5126):
            raise ValueError('unsupported feature-ID component type')
        values, start, count = feature_id_values(doc, binary, index, component_type)
        if component_type == 5126:
            continue
        # Other views may alias the same bytes even with a different view index.
        for other_index, other in enumerate(doc['bufferViews']):
            if other_index == accessor['bufferView']:
                continue
            other_start = other.get('byteOffset', 0)
            other_end = other_start + other['byteLength']
            if other.get('buffer', 0) == 0 and start < other_end and other_start < start + count * 4:
                raise ValueError('overlapping feature-ID bufferView')
        if any(a is not accessor and a.get('bufferView') == accessor['bufferView'] for a in doc['accessors']):
            raise ValueError('shared feature-ID bufferView')
        struct.pack_into('<' + 'f' * count, binary, start, *values)
        accessor['componentType'] = 5126
        changed = True
    if not changed:
        return data
    encoded = json.dumps(doc, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    body = struct.pack('<I4s', len(encoded), b'JSON') + encoded
    body += struct.pack('<I4s', len(binary), b'BIN\0') + binary
    return struct.pack('<4sII', magic, version, 12 + len(body)) + body


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    source, output = args.input_dir.resolve(), args.output_dir.resolve()
    if output == source or source in output.parents or output in source.parents or output.exists():
        parser.error('output must be a new directory outside the source tree')
    shutil.copytree(source, output)
    entries = []
    for path in sorted(output.rglob('*.glb')):
        original = path.read_bytes()
        repaired = repair_glb(original)
        path.write_bytes(repaired)
        entries.append({'path': path.relative_to(output).as_posix(),
                        'changed': repaired != original,
                        'sourceSha256': hashlib.sha256(original).hexdigest(),
                        'sha256': hashlib.sha256(repaired).hexdigest()})
    receipt = {'purpose': 'FORMAT_REPAIR_ONLY', 'engineeringUse': False,
               'regulatoryUse': False, 'files': entries}
    (output / 'feature-id-repair-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(f"Inspected {len(entries)} GLBs; repaired {sum(e['changed'] for e in entries)}")


if __name__ == '__main__':
    main()
