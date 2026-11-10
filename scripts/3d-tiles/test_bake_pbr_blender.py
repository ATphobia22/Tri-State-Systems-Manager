"""Run with blender -b --python-exit-code 1 --python THIS_FILE -- BAKER_PATH."""
import bpy, runpy, sys, tempfile
from pathlib import Path
baker = Path(sys.argv[sys.argv.index("--")+1])
sys.argv = ["blender", "--", "--input", "unused.glb", "--output", tempfile.gettempdir(), "--resolution", "32", "--samples", "1"]
module = runpy.run_path(str(baker), run_name="bake_test")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
bpy.ops.mesh.primitive_cube_add()
obj = bpy.context.object
for value in (0.0, 1.0):
    mat = bpy.data.materials.new(str(value))
    mat.use_nodes = True
    mat.node_tree.nodes.get("Principled BSDF").inputs["Metallic"].default_value = value
    obj.data.materials.append(mat)
for face in obj.data.polygons:
    face.material_index = face.index % 2
original = list(obj.data.materials)
module["setup_cycles"]()
module["ensure_uvs"](obj)
with tempfile.TemporaryDirectory() as folder:
    path = module["bake_map"](obj, "metallic", Path(folder))
    image = bpy.data.images.load(path, check_existing=False)
    pixels = list(image.pixels)[::4]
    assert min(pixels) < .1 and max(pixels) > .9, (min(pixels), max(pixels))
    assert list(obj.data.materials) == original
    # Unsupported mixed/non-Principled material must be rejected and restored.
    mat = original[1]
    nodes = mat.node_tree.nodes
    emit = nodes.new("ShaderNodeEmission")
    mat.node_tree.links.new(emit.outputs[0], nodes.get("Material Output").inputs["Surface"])
    try:
        module["bake_map"](obj, "metallic", Path(folder))
    except ValueError:
        pass
    else:
        raise AssertionError("unsupported surface silently baked")
    assert list(obj.data.materials) == original
print("PBR metallic pixel and restoration tests passed")
