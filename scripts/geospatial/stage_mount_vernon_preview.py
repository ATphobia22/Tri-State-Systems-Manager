#!/usr/bin/env python3
"""Evidence-gated staging of two Mount Vernon terrain patches for offline UE5.8.
Does not certify elevations, generate a .umap, or prove mixed-LOD Transvoxel seams.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

def hash_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def _inside(folder: Path, filename: str) -> Path:
    if not isinstance(filename, str) or not filename or '/' in filename or '\\' in filename or filename.startswith('.'):
        raise ValueError(f'unsafe filename: {filename!r}')
    p = folder / filename
    if not p.is_file() or p.is_symlink():
        raise FileNotFoundError(p)
    return p

def verify(folder: Path) -> dict:
    folder = folder.resolve(strict=True)
    manifest = json.loads((folder / 'manifest.json').read_text())
    tileset = json.loads((folder / 'tileset.json').read_text())
    placements = json.loads((folder / 'unreal-placements.json').read_text())
    seam = json.loads((folder / 'mesh-seam-check.json').read_text())
    if manifest.get('verticalEvidence') != 'PENDING_EVIDENCE' or manifest.get('notForRegulatoryUse') is not True:
        raise ValueError('preview must preserve unverified datum and non-regulatory status')
    if manifest.get('transvoxelSeamStatus') != 'NOT_EVIDENCED':
        raise ValueError('preview cannot claim mixed-LOD seam certification')
    if tileset.get('asset', {}).get('version') != '1.1':
        raise ValueError('expected 3D Tiles 1.1')
    if manifest['tilesetSha256'] != hash_file(folder / 'tileset.json'):
        raise ValueError('tileset SHA-256 mismatch')
    if manifest['mapLayerSha256'] != hash_file(folder / 'dem-footprints.geojson'):
        raise ValueError('map coverage SHA-256 mismatch')
    if seam.get('pass') is not True or seam.get('productionTransvoxelSeamsValidated') is not False:
        raise ValueError('expected same-LOD-only seam test')
    indexed = {}
    for record in manifest['sourceRecords']:
        if record.get('verticalApproval') != 'PENDING_EVIDENCE':
            raise ValueError('source elevation evidence incorrectly promoted')
        for tile in record['tiles']:
            if tile['state'] == 'DERIVED_VISUAL_PREVIEW_ONLY':
                p = _inside(folder, tile['mesh'])
                if hash_file(p) != tile['sha256']:
                    raise ValueError(f'GLB SHA-256 mismatch: {p.name}')
                if p.name in indexed:
                    raise ValueError(f'duplicate tile: {p.name}')
                indexed[p.name] = tile['sha256']
    content = [item['content']['uri'] for item in tileset['root']['children']]
    if len(content) != len(set(content)) or set(content) != set(indexed):
        raise ValueError('tileset content does not match manifest')
    actors = placements.get('actors', [])
    if placements.get('actorCount') != len(actors) or set(item['asset'] for item in actors) != set(indexed):
        raise ValueError('Unreal actor placement inventory mismatch')
    if placements.get('verticalDatum') != 'PENDING_EVIDENCE':
        raise ValueError('Unreal datum label inconsistent')
    if seam.get('previewTerrainTileCount') != len(indexed):
        raise ValueError('same-LOD report tile count mismatch')
    return {'schema': 'tsm.mount-vernon-offline-stage-gate.v1',
            'tileCount': len(indexed), 'sourceCount': len(manifest['sourceRecords']),
            'sameLODSharedEdgeCount': seam['checkedSameLODEdges'],
            'sameLODMaxGapMeters': seam['maxGapMeters'],
            'sourceDatum': 'PENDING_EVIDENCE', 'mixedLODSeamValidation': 'NOT_EVIDENCED',
            'unrealMap': 'NOT_GENERATED', 'regulatoryStatus': 'NOT_A_REGULATORY_DETERMINATION'}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--asset-dir', required=True, type=Path)
    ap.add_argument('--stage-dir', type=Path)
    ap.add_argument('--report', type=Path)
    args = ap.parse_args()
    report = verify(args.asset_dir)
    if args.stage_dir:
        out = args.stage_dir.resolve()
        inp = args.asset_dir.resolve()
        if out == inp or inp in out.parents:
            raise ValueError('stage directory must not be inside source directory')
        out.mkdir(parents=True, exist_ok=True)
        for name in ['tileset.json','manifest.json','dem-footprints.geojson','mesh-seam-check.json','unreal-placements.json']:
            shutil.copy2(inp / name, out / name)
        for f in inp.glob('*.glb'):
            shutil.copy2(f, out / f.name)
        report['stagedFileCount'] = len(list(out.iterdir()))
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
