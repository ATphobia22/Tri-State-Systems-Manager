#!/usr/bin/env python3
"""Create an import manifest from reviewed, already transformed FBX meshes."""
import argparse
import hashlib
import json
import re
from pathlib import Path


def checksum(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def create_manifest(folder, **metadata):
    folder = Path(folder).resolve(strict=True)
    required = ('source_uri', 'license', 'horizontal_crs', 'vertical_datum', 'transform_record')
    for key in required:
        if not isinstance(metadata.get(key), str) or not metadata[key].strip():
            raise ValueError('Missing ' + key)
    assets, names = [], set()
    for source in sorted(folder.glob('*.fbx')):
        name = re.sub(r'[^A-Za-z0-9_]', '_', source.stem)
        if not name.startswith('SM_'):
            name = 'SM_' + name
        if name.casefold() in names:
            raise ValueError('Colliding Unreal asset name: ' + name)
        names.add(name.casefold())
        assets.append(dict(file=source.name, asset_name=name,
                           destination='/Game/TSM/Infrastructure', sha256=checksum(source),
                           **{key: metadata[key] for key in required}))
    if not assets:
        raise ValueError('No FBX files found')
    output = folder / 'asset-manifest.json'
    with output.open('x', encoding='utf-8') as stream:
        json.dump({'assets': assets}, stream, indent=2)
        stream.write('\n')
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', type=Path)
    for key in ('source-uri', 'license', 'horizontal-crs', 'vertical-datum', 'transform-record'):
        parser.add_argument('--' + key, required=True)
    args = vars(parser.parse_args())
    folder = args.pop('folder')
    print(create_manifest(folder, **args))


if __name__ == '__main__':
    main()
