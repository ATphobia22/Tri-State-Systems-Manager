#!/usr/bin/env python3
"""Bounded independent audit of a Posey source ZIP versus a historic 3D Tiles tar[.zst].

This audits byte integrity, feature identity and basic glTF/3D Tiles references.
It does NOT establish roof-height accuracy, vertical datum or regulatory approval.
Requires the open-source zstd executable for .zst files.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import posixpath
import re
import struct
import subprocess
import tarfile
import zipfile
from pathlib import Path, PurePosixPath

MAX_MEMBER = 64 * 1024 * 1024
MAX_RAW_TOTAL = 1024 * 1024 * 1024
MAX_MEMBERS = 100_000


class AuditError(ValueError):
    pass


def sha256_file(path: Path) -> str:
    with path.open('rb') as src:
        return hashlib.file_digest(src, 'sha256').hexdigest()


def safe_name(name: str) -> bool:
    p = PurePosixPath(name)
    return (bool(name) and not name.startswith('/') and '\\' not in name
            and all(part not in ('', '..') for part in p.parts))


def check_glb(blob: bytes) -> None:
    """Validate GLB container + JSON scene identity, not actual GPU rendering."""
    if len(blob) < 20:
        raise AuditError('GLB truncated')
    magic, version, total = struct.unpack_from('<III', blob)
    if magic != 0x46546c67 or version != 2 or total != len(blob):
        raise AuditError('Invalid GLB header/version/declared length')
    size, typ = struct.unpack_from('<I4s', blob, 12)
    if typ != b'JSON' or size % 4 or size > len(blob) - 20:
        raise AuditError('Invalid GLB first chunk')
    try:
        doc = json.loads(blob[20:20+size].decode('utf-8').rstrip(' \t\r\n\0'))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise AuditError('Invalid glTF JSON') from exc
    if not isinstance(doc, dict) or doc.get('asset', {}).get('version') != '2.0':
        raise AuditError('Missing glTF 2.0 asset declaration')
    remaining = len(blob) - 20 - size
    if remaining:
        if remaining < 8:
            raise AuditError('Truncated GLB second chunk')
        bin_size, bin_type = struct.unpack_from('<I4s', blob, 20 + size)
        if bin_type != b'BIN\0' or bin_size + 8 != remaining or bin_size % 4:
            raise AuditError('Invalid GLB second chunk')


def snapshot(zip_path: Path) -> tuple[dict, set[int]]:
    seen = set()
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        if len(names) != len(set(names)) or any(not safe_name(n) for n in names):
            raise AuditError('Unsafe or duplicate ZIP path')
        if z.testzip() is not None:
            raise AuditError('Corrupt source ZIP CRC')
        inventory = z.read('posey-source-inventory.json')
        expected = hashlib.sha256(inventory).hexdigest()
        sidecar = z.read('posey-source-inventory.json.sha256').decode().split()[0]
        if expected != sidecar:
            raise AuditError('Inventory SHA256 sidecar mismatch')
        doc = json.loads(inventory)
        if doc.get('source_identity_complete') is not True:
            raise AuditError('Official source identity not established in inventory')
        pages = [n for n in names if n.startswith('raw-pages/') and n.endswith('.json')]
        if not pages:
            raise AuditError('No downloaded source pages')
        for p in pages:
            payload = json.loads(z.read(p))
            for feature in payload['features']:
                attrs = feature['attributes']
                oid = attrs.get('objectid')
                if type(oid) is not int or oid < 0 or oid in seen:
                    raise AuditError('Invalid or duplicate source OBJECTID')
                if not feature.get('geometry', {}).get('rings'):
                    raise AuditError('Missing footprint geometry')
                seen.add(oid)
        if len(seen) != doc.get('official_feature_count'):
            raise AuditError('Downloaded source count mismatch')
        canonical = (json.dumps(sorted(seen), sort_keys=True, separators=(',', ':')) + '\n').encode()
        if 'official_sorted_objectids_sha256' in doc and hashlib.sha256(canonical).hexdigest() != doc['official_sorted_objectids_sha256']:
            raise AuditError('Official OBJECTID digest mismatch')
    return {'zip_sha256': sha256_file(zip_path), 'inventory_sha256': expected,
            'source_count': len(seen), 'source_pages': len(pages),
            'source_vertical_datum_verified': False}, seen


def tile_references(node: object) -> set[str]:
    refs = set()
    todo = [node]
    while todo:
        curr = todo.pop()
        if not isinstance(curr, dict):
            raise AuditError('Invalid tile hierarchy')
        content = curr.get('content', {})
        if 'uri' in content:
            name = content['uri']
            if not isinstance(name, str) or not safe_name(name):
                raise AuditError('Unsafe tileset URI')
            refs.add('flat/' + name)
        todo.extend(curr.get('children', []))
    return refs


def archive(path: Path) -> tuple[dict, set[int]]:
    process = None
    if path.name.endswith('.zst') or path.name.endswith('.zst.bin'):
        process = subprocess.Popen(['zstd','-dc','--',str(path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        input_stream = process.stdout
    else:
        input_stream = path.open('rb')
    seen_paths: set[str] = set()
    physical_paths: set[str] = set()
    internal_symlinks = 0
    flat_ids: set[int] = set()
    glb_count = 0
    count = total_bytes = 0
    manifests = {}
    try:
        with tarfile.open(fileobj=input_stream, mode='r|') as tar:
            for member in tar:
                count += 1
                if count > MAX_MEMBERS or not safe_name(member.name) or member.name in seen_paths:
                    raise AuditError('Unsafe, duplicate or excessive tar entry')
                seen_paths.add(member.name)
                if member.issym():
                    # Preserve but do not extract: only symlinks pointing back to
                    # already validated ordinary files inside the archive are safe.
                    target = posixpath.normpath(posixpath.join(posixpath.dirname(member.name), member.linkname))
                    if (not target or target.startswith("../") or target.startswith("/")
                            or target not in physical_paths or "\\" in member.linkname):
                        raise AuditError("Unsafe or unresolved archive symlink")
                    internal_symlinks += 1
                    continue
                if not member.isfile():
                    raise AuditError("Unexpected non-regular archive entry")
                physical_paths.add(member.name)
                total_bytes += member.size
                if member.size < 0 or member.size > MAX_MEMBER or total_bytes > MAX_RAW_TOTAL:
                    raise AuditError('Archive exceeds decompression size limits')
                stream = tar.extractfile(member)
                if stream is None:
                    raise AuditError('Missing tar member bytes')
                blob = stream.read(MAX_MEMBER + 1)
                if len(blob) != member.size:
                    raise AuditError('Incomplete tar member')
                if member.name.endswith('.glb'):
                    check_glb(blob)
                    glb_count += 1
                    m = re.fullmatch(r'flat/(\d+)\.glb', member.name)
                    if m:
                        oid = int(m.group(1))
                        if oid in flat_ids:
                            raise AuditError('Duplicate flat OBJECTID')
                        flat_ids.add(oid)
                if member.name in ('flat/manifest.json','flat/tileset.json'):
                    manifests[member.name] = json.loads(blob)
        if process is not None and process.wait() != 0:
            raise AuditError('zstd decompression failed')
    finally:
        if input_stream is not None:
            input_stream.close()
        if process is not None and process.poll() is None:
            process.kill(); process.wait()
    if 'flat/manifest.json' not in manifests or 'flat/tileset.json' not in manifests:
        raise AuditError('Missing flat manifest or tileset')
    man = manifests['flat/manifest.json']
    if man.get('source', {}).get('sourceFeatureCount') != len(flat_ids):
        raise AuditError('Historical manifest source count mismatch')
    tile_refs = tile_references(manifests['flat/tileset.json']['root'])
    missing_refs = tile_refs - seen_paths
    missing_tileset_refs = {'flat/'+str(i)+'.glb' for i in flat_ids} - tile_refs
    return ({'archive_sha256': sha256_file(path), 'archive_entries': count, 'internal_symlinks': internal_symlinks,
             'ordinary_files': count - internal_symlinks, 'raw_bytes': total_bytes, 'glb_valid': glb_count,
             'flat_glb_count': len(flat_ids), 'flat_manifest_source_count': man['source']['sourceFeatureCount'],
             'broken_explicit_tile_refs': len(missing_refs),
             'unreferenced_flat_glbs': len(missing_tileset_refs)}, flat_ids)


def audit(source_zip: Path, tiles: Path) -> dict:
    s, source_ids = snapshot(source_zip)
    a, flat_ids = archive(tiles)
    missing = sorted(source_ids - flat_ids)
    extra = sorted(flat_ids - source_ids)
    identity_complete = not missing and not extra and not a['broken_explicit_tile_refs'] and not a['unreferenced_flat_glbs']
    return {'classification': 'INDEPENDENT_STRUCTURAL_ARCHIVE_AUDIT_NOT_HEIGHT_OR_DATUM_CERTIFICATION',
            'source': s, 'asset_integrity': a,
            'identity': {'complete': identity_complete, 'source_ids': len(source_ids),
                         'archive_flat_ids': len(flat_ids), 'matching_source_ids': len(source_ids & flat_ids),
                         'missing_source_ids': len(missing), 'missing_source_id_sample': missing[:20],
                         'unexpected_archive_ids': len(extra), 'unexpected_archive_id_sample': extra[:20]},
            'measured_roof_and_ground_heights_verified': False,
            'observed_versus_derived_measurements_independently_verified': False,
            'official_source_license_independently_rechecked': False,
            'windows_11_offline_verified': False,
            'production_accepted': False,
            'reason': 'Integrity and ID reconciliation are not scientific measurement or human engineering acceptance'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-zip', type=Path, required=True)
    parser.add_argument('--tiles-tar', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = audit(args.source_zip, args.tiles_tar)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + '\n')
    print(json.dumps({'archive_entries': result['asset_integrity']['archive_entries'],
                      'missing_source_ids': result['identity']['missing_source_ids'],
                      'classification': result['classification']}))
    if not result['identity']['complete']:
        raise SystemExit(2)

if __name__ == '__main__':
    main()
