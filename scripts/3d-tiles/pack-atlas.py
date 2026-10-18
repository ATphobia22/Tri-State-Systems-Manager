#!/usr/bin/env python3
"""
pack-atlas.py — Texture atlas consolidation for TSM 3D assets.

Takes multiple GLB files, bakes their materials into a single unified
texture atlas (albedo), and rewrites UVs so all meshes share one material.
Minimizes draw calls for the MapLibre/three.js render path.

Usage:
    blender --background --python pack-atlas.py -- \
        --inputs building1.glb building2.glb \
        --output atlas-packed.glb \
        --atlas-size 2048

Research basis: mapping-planes-lod-integration-20261018-0426 §2
(T-dimension: texture atlas consolidation).

Requires: Blender 3.x+ (headless). No other dependencies.
"""

import argparse
import os
import sys

# Blender python runs with its own interpreter; bpy only exists inside Blender.
try:
    import bpy
except ImportError:
    print("ERROR: This script must run inside Blender:")
    print("  blender --background --python pack-atlas.py -- --inputs a.glb b.glb --output out.glb")
    sys.exit(1)


def parse_args():
    # Blender consumes argv before --; ours come after.
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    p = argparse.ArgumentParser()
    p.add_argument("--inputs", nargs="+", required=True, help="Input GLB files")
    p.add_argument("--output", required=True, help="Output packed GLB")
    p.add_argument("--atlas-size", type=int, default=2048, help="Atlas texture size (px)")
    return p.parse_args(argv)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    # Purge orphaned data blocks so the atlas is the only texture left.
    for block in list(bpy.data.meshes):
        bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials):
        bpy.data.materials.remove(block)
    for block in list(bpy.data.images):
        bpy.data.images.remove(block)


def import_glbs(paths):
    for path in paths:
        if not os.path.exists(path):
            print(f"WARNING: input not found, skipping: {path}")
            continue
        print(f"Importing {path}")
        bpy.ops.import_scene.gltf(filepath=path)


def smart_unwrap_all():
    """Smart UV project every mesh so the atlas bake has clean UVs."""
    bpy.ops.object.select_all(action="SELECT")
    for obj in bpy.context.selected_objects:
        if obj.type != "MESH":
            obj.select_set(False)
    bpy.context.view_layer.objects.active = next(
        (o for o in bpy.context.selected_objects if o.type == "MESH"), None
    )
    if bpy.context.view_layer.objects.active is None:
        print("WARNING: no meshes found after import")
        return
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    # Smart UV project with a small island margin to avoid bleeding.
    bpy.ops.uv.smart_project(angle_limit=66, island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")


def make_atlas_material(size):
    """Create one shared material with a blank atlas image."""
    atlas_img = bpy.data.images.new("TSM_Atlas", width=size, height=size, alpha=True)
    atlas_img.colorspace_settings.name = "sRGB"
    # Fill with mid-grey so unbaked areas are visible, not black.
    pixels = [0.5, 0.5, 0.5, 1.0] * (size * size)
    atlas_img.pixels = pixels

    mat = bpy.data.materials.new("TSM_Atlas_Material")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = atlas_img
    tex.label = "Atlas"

    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat, atlas_img


def assign_atlas_material(mat):
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            if not obj.data.materials:
                obj.data.materials.append(mat)
            else:
                obj.data.materials[0] = mat


def bake_atlas(atlas_img, size):
    """Bake combined diffuse from all source materials into the atlas."""
    bpy.context.scene.render.engine = "CYCLES"
    # CPU bake; GPU optional via preferences if available.
    bpy.context.scene.cycles.device = "CPU"
    bpy.context.scene.cycles.samples = 16
    bpy.context.scene.render.bake.use_pass_direct = False
    bpy.context.scene.render.bake.use_pass_indirect = False
    bpy.context.scene.render.bake.margin = 4

    # Select all meshes for the bake.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.select_set(True)
    active = next((o for o in bpy.data.objects if o.type == "MESH"), None)
    if active is None:
        print("WARNING: nothing to bake")
        return
    bpy.context.view_layer.objects.active = active

    # Make the atlas image the active bake target on every material.
    for m in bpy.data.materials:
        if m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE":
                    n.select = (n.image == atlas_img)
            m.node_tree.nodes.active = next(
                (n for n in m.node_tree.nodes
                 if n.type == "TEX_IMAGE" and n.image == atlas_img),
                None,
            )

    print(f"Baking {size}x{size} atlas (DIFFUSE, no lighting)...")
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"})
    atlas_img.save()


def export_packed(output):
    bpy.ops.object.select_all(action="SELECT")
    print(f"Exporting {output}")
    bpy.ops.export_scene.gltf(
        filepath=output,
        export_format="GLB",
        export_materials="EXPORT",
        export_image_format="AUTO",
    )


def main():
    args = parse_args()
    clear_scene()
    import_glbs(args.inputs)
    smart_unwrap_all()
    mat, atlas_img = make_atlas_material(args.atlas_size)
    assign_atlas_material(mat)
    bake_atlas(atlas_img, args.atlas_size)
    export_packed(args.output)
    print(f"Done. Atlas-packed GLB: {args.output}")


if __name__ == "__main__":
    main()
