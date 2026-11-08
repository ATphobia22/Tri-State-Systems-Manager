"""Run with blender --background --python blender_validate.py -- input.glb receipt.json."""
import bpy
import json
import sys
from pathlib import Path

source, receipt = map(Path, sys.argv[sys.argv.index('--') + 1:])
if receipt.exists():
    raise ValueError('receipt already exists')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes:
    raise ValueError('no mesh objects imported')
with receipt.open('x') as f:
    json.dump({'blenderVersion': bpy.app.version_string, 'meshObjects': len(meshes),
               'vertices': sum(len(o.data.vertices) for o in meshes),
               'polygons': sum(len(o.data.polygons) for o in meshes),
               'result': 'IMPORT_COMPLETED', 'visualReview': 'NOT_PERFORMED'}, f, indent=2)
