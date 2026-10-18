#!/usr/bin/env python3
"""
bake-pbr.py — headless Blender PBR map baker (one worker per map).

Usage:
    blender -b --factory-startup scene.blend --python bake-pbr.py -- \
        --map normal --out ./baked/

Bakes one PBR channel per invocation so the parent can run one background
worker per map (avoids Blender's UI-blocking bake calls). Parent enforces
timeouts; mesh must have a UV map.

Maps: diffuse (albedo), normal, roughness, ao, emit
Blender's glTF exporter converts Principled BSDF -> glTF 2.0 PBR automatically.

Blender is GPL-3.0 as a tool; baked output assets are unrestricted.
"""

import argparse
import sys

import bpy


def parse_args() -> argparse.Namespace:
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    p = argparse.ArgumentParser()
    p.add_argument("--map", required=True,
                   choices=["diffuse", "normal", "roughness", "ao", "emit"])
    p.add_argument("--out", required=True, help="Output directory for baked PNG")
    p.add_argument("--size", type=int, default=2048)
    p.add_argument("--object", default=None, help="Object name (default: active)")
    return p.parse_args(argv)


BAKE_TYPE = {
    "diffuse": "DIFFUSE",
    "normal": "NORMAL",
    "roughness": "ROUGHNESS",
    "ao": "AO",
    "emit": "EMIT",
}


def main() -> None:
    args = parse_args()

    obj = bpy.data.objects.get(args.object) if args.object else bpy.context.active_object
    if obj is None or obj.type != "MESH":
        raise SystemExit("No mesh object selected/found")

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    # Ensure a UV map exists
    if not obj.data.uv_layers:
        raise SystemExit(f"Object {obj.name} has no UV map; unwrap first")

    # Create bake target image
    img_name = f"{obj.name}_{args.map}"
    img = bpy.data.images.new(img_name, args.size, args.size, alpha=False)
    img.filepath_raw = f"{args.out.rstrip('/')}/{img_name}.png"
    img.file_format = "PNG"

    # Attach image texture node as active bake target on every material
    for slot in obj.material_slots:
        mat = slot.material
        if mat is None or not mat.use_nodes:
            continue
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = img
        mat.node_tree.nodes.active = node

    # Cycles bake
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.device = "CPU"
    bpy.context.scene.cycles.bake_type = BAKE_TYPE[args.map]
    if args.map == "diffuse":
        bpy.context.scene.render.bake.use_pass_direct = False
        bpy.context.scene.render.bake.use_pass_indirect = False
        bpy.context.scene.render.bake.use_pass_color = True

    bpy.ops.object.bake(type=BAKE_TYPE[args.map])

    img.save()
    print(f"Baked {args.map} -> {img.filepath_raw}")


if __name__ == "__main__":
    main()
