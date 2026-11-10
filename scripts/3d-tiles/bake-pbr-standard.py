#!/usr/bin/env python3
"""
TSM Standardized Headless PBR Material Baking.

Bakes PBR texture maps (albedo, normal, roughness, metallic, AO) from
high-poly 3D models using headless Blender. Based on best practices from:
- Blender background baking pattern (dev.to/kendeepp)
- TSM's 3D Tiles PBR pipeline requirements

Standardized output for TSM 3D Tiles:
  - albedo (base color): sRGB, PNG
  - normal: Linear, PNG (OpenGL format)
  - roughness: Linear, PNG (grayscale)
  - metallic: Linear, PNG (grayscale)
  - ao: Linear, PNG (grayscale)

Usage:
  # Bake all maps for a model
  blender -b --factory-startup model.blend --python bake_pbr_standard.py -- \
    --input /path/to/highpoly.glb \
    --output /path/to/output/ \
    --resolution 2048

  # Bake single map
  blender -b --factory-startup model.blend --python bake_pbr_standard.py -- \
    --input /path/to/highpoly.glb \
    --output /path/to/output/ \
    --map normal \
    --resolution 1024

Requirements:
  - Blender 3.0+ (headless)
  - Model with UVs (auto-generated if missing)
  - Cycles render engine (required for baking)
"""

import argparse
import sys
import os
import math
from pathlib import Path

# Parse args after "--"
argv = sys.argv
if "--" in argv:
    argv = argv[argv.index("--") + 1:]
else:
    argv = []

parser = argparse.ArgumentParser(description="TSM standardized PBR baking")
parser.add_argument("--input", required=True, help="Input model (GLB/OBJ/FBX)")
parser.add_argument("--output", required=True, help="Output directory")
parser.add_argument(
    "--map",
    choices=["all", "albedo", "normal", "roughness", "metallic", "ao"],
    default="all",
    help="Which map to bake",
)
parser.add_argument("--resolution", type=int, default=2048, help="Texture resolution")
parser.add_argument("--samples", type=int, default=32, help="Cycles samples")
args = parser.parse_args(argv)

# Blender Python API (only available when run via blender --python)
try:
    import bpy
    from mathutils import Vector
except ImportError:
    print("ERROR: Must run via 'blender -b --python bake_pbr_standard.py -- ...'")
    print("Baking requires Blender's Python environment (bpy module).")
    sys.exit(1)


# Standardized bake configurations
BAKE_CONFIGS = {
    "albedo": {
        "type": "DIFFUSE",
        "pass_filter": {"COLOR"},
        "colorspace": "sRGB",
        "description": "Base color / albedo",
    },
    "normal": {
        "type": "NORMAL",
        "pass_filter": set(),
        "colorspace": "Non-Color",
        "description": "Tangent-space normal map (OpenGL)",
    },
    "roughness": {
        "type": "ROUGHNESS",
        "pass_filter": set(),
        "colorspace": "Non-Color",
        "description": "Roughness (grayscale)",
    },
    "metallic": {
        "type": "EMIT",  # Trick: bake metallic via emission
        "pass_filter": set(),
        "colorspace": "Non-Color",
        "description": "Metallic (grayscale)",
    },
    "ao": {
        "type": "AO",
        "pass_filter": set(),
        "colorspace": "Non-Color",
        "description": "Ambient occlusion",
    },
}


def setup_cycles():
    """Configure Cycles for baking."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"  # Switch to Cycles (required for bake)
    scene.cycles.use_denoising = False  # CPU baking must work without OpenImageDenoiser
    scene.cycles.samples = args.samples
    scene.cycles.device = "CPU"  # CPU for headless reliability
    print(f"Cycles configured: {args.samples} samples, CPU")


def ensure_uvs(obj):
    """Ensure the object has UVs; generate with Smart UV Project if missing."""
    if not obj.data.uv_layers:
        print(f"  No UVs found, generating Smart UV Project...")
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
        bpy.ops.object.mode_set(mode="OBJECT")
        print(f"  UVs generated")
    else:
        print(f"  UVs present: {len(obj.data.uv_layers)} layer(s)")


def bake_map(obj, map_name: str, output_dir: Path):
    """Bake a single PBR map."""
    config = BAKE_CONFIGS[map_name]
    print(f"\nBaking {map_name} ({config['description']})...")

    # Create target image
    img_name = f"{obj.name}_{map_name}"
    img = bpy.data.images.new(
        img_name,
        width=args.resolution,
        height=args.resolution,
        alpha=False,
    )
    img.colorspace_settings.name = config["colorspace"]
    img.filepath_raw = str(output_dir / f"{img_name}.png")
    img.file_format = "PNG"

    # Work on temporary copies so source node graphs survive every failure.
    original_materials = list(obj.data.materials)
    copies = []
    try:
        if not original_materials or any(mat is None for mat in original_materials):
            raise ValueError("Every mesh material slot must have an explicit material")
        for index, original in enumerate(original_materials):
            mat = original.copy()
            copies.append(mat)
            mat.use_nodes = True
            obj.data.materials[index] = mat
            nodes = mat.node_tree.nodes
            links = mat.node_tree.links
            if map_name == "metallic":
                outputs = [n for n in nodes if n.type == "OUTPUT_MATERIAL" and n.is_active_output]
                if len(outputs) != 1 or not outputs[0].inputs["Surface"].is_linked:
                    raise ValueError("Metallic bake requires an active connected material output")
                output = outputs[0]
                shader = output.inputs["Surface"].links[0].from_node
                if shader.type != "BSDF_PRINCIPLED":
                    raise ValueError("Metallic bake requires a direct Principled surface shader")
                metallic = shader.inputs["Metallic"]
                emission = nodes.new("ShaderNodeEmission")
                if metallic.is_linked:
                    links.new(metallic.links[0].from_socket, emission.inputs["Color"])
                else:
                    value = metallic.default_value
                    emission.inputs["Color"].default_value = (value, value, value, 1)
                links.new(emission.outputs["Emission"], output.inputs["Surface"])
            target = nodes.new("ShaderNodeTexImage")
            target.image = img
            nodes.active = target
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.bake(type=config["type"], pass_filter=config["pass_filter"],
                            use_clear=True, margin=16)
        img.save()
    finally:
        for index, original in enumerate(original_materials):
            obj.data.materials[index] = original
        for mat in copies:
            bpy.data.materials.remove(mat)

    return img.filepath_raw


def main():
    input_path = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("TSM Standardized PBR Baking")
    print("=" * 60)
    print(f"Input:  {input_path}")
    print(f"Output: {output_dir}")
    print(f"Maps:   {args.map}")
    print(f"Res:    {args.resolution}x{args.resolution}")
    print()

    # Clear default scene
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

    # Import model
    print(f"Importing {input_path.suffix}...")
    if input_path.suffix.lower() == ".glb":
        bpy.ops.import_scene.gltf(filepath=str(input_path))
    elif input_path.suffix.lower() == ".obj":
        bpy.ops.wm.obj_import(filepath=str(input_path))
    elif input_path.suffix.lower() == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(input_path))
    else:
        print(f"ERROR: Unsupported format {input_path.suffix}")
        sys.exit(1)

    # Find meshes
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        print("ERROR: No meshes found in imported file")
        sys.exit(1)

    print(f"Found {len(meshes)} mesh(es)")

    setup_cycles()

    maps_to_bake = (
        list(BAKE_CONFIGS.keys()) if args.map == "all" else [args.map]
    )

    results = {}
    failures = []
    for obj in meshes:
        print(f"\nProcessing: {obj.name}")
        ensure_uvs(obj)
        for map_name in maps_to_bake:
            try:
                path = bake_map(obj, map_name, output_dir)
                results[f"{obj.name}_{map_name}"] = path
            except Exception as e:
                print(f"  FAILED {map_name}: {e}")
                failures.append((obj.name, map_name))

    print("\n" + "=" * 60)
    print(f"Baking complete: {len(results)} maps")
    for name, path in results.items():
        print(f"  {name}: {path}")

    return 1 if failures else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"BAKE FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
