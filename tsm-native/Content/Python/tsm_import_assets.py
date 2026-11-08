"""Editor-only FBX import. TSM_ASSET_MANIFEST names the reviewed manifest."""
import hashlib
import json
import os
import re
from pathlib import Path
import unreal


def main():
    manifest = Path(os.environ['TSM_ASSET_MANIFEST']).resolve(strict=True)
    rows = json.loads(manifest.read_text(encoding='utf-8'))['assets']
    if not rows:
        raise ValueError('Empty asset manifest')
    prepared, destinations = [], set()
    for row in rows:
        source = (manifest.parent / row['file']).resolve(strict=True)
        source.relative_to(manifest.parent)
        if source.suffix.lower() != '.fbx':
            raise ValueError('Expected FBX: ' + str(source))
        if not re.fullmatch(r'SM_[A-Za-z0-9_]+', row['asset_name']):
            raise ValueError('Invalid mesh name')
        if not re.fullmatch(r'/Game/TSM(?:/[A-Za-z0-9_]+)*', row['destination']):
            raise ValueError('Invalid destination')
        key = row['destination'] + '/' + row['asset_name']
        if key.casefold() in destinations or unreal.EditorAssetLibrary.does_asset_exist(key):
            raise ValueError('Duplicate or existing destination: ' + key)
        destinations.add(key.casefold())
        expected = row['sha256'].lower()
        if not re.fullmatch(r'[0-9a-f]{64}', expected):
            raise ValueError('Invalid SHA-256')
        digest = hashlib.sha256()
        with source.open('rb') as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(block)
        if digest.hexdigest() != expected:
            raise ValueError('Checksum mismatch: ' + str(source))
        for field in ('source_uri', 'license', 'horizontal_crs', 'vertical_datum', 'transform_record'):
            if not isinstance(row.get(field), str) or not row[field].strip():
                raise ValueError('Missing ' + field)
        prepared.append((row, source))
    for row, source in prepared:
        options = unreal.FbxImportUI()
        for key, value in dict(import_mesh=True, import_as_skeletal=False,
                               import_animations=False, import_materials=False,
                               import_textures=False,
                               automated_import_should_detect_type=False).items():
            options.set_editor_property(key, value)
        options.set_editor_property('mesh_type_to_import', unreal.FBXImportType.FBXIT_STATIC_MESH)
        options.static_mesh_import_data.set_editor_property('combine_meshes', True)
        task = unreal.AssetImportTask()
        for key, value in dict(filename=str(source), destination_path=row['destination'],
                               destination_name=row['asset_name'], automated=True,
                               replace_existing=False, async_=False, save=False,
                               options=options).items():
            task.set_editor_property(key, value)
        unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
        meshes = [asset for asset in task.get_objects() if isinstance(asset, unreal.StaticMesh)]
        if not meshes:
            raise RuntimeError('No mesh imported: ' + str(source))
        for mesh in meshes:
            for field in ('sha256', 'source_uri', 'license', 'horizontal_crs', 'vertical_datum', 'transform_record'):
                unreal.EditorAssetLibrary.set_metadata_tag(mesh, 'TSM_' + field, row[field])
            if not unreal.EditorAssetLibrary.save_loaded_asset(mesh):
                raise RuntimeError('Save failed: ' + mesh.get_path_name())
        unreal.log('TSM imported ' + source.name)


if __name__ == '__main__':
    main()
