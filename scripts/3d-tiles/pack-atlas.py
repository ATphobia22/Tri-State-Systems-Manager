#!/usr/bin/env python3
"""
pack-atlas.py — deterministic UV packing and albedo atlas consolidation.

Imports multiple GLBs, globally packs their UV islands, bakes source diffuse
color into one atlas, then assigns one shared glTF-compatible PBR material.
Source materials remain attached until the bake completes.

Usage:
    blender --background --python pack-atlas.py -- \
        --inputs building1.glb building2.glb \
        --output atlas-packed.glb \
        --atlas-size 2048

Requires Blender 3.x+ with the glTF 2.0 importer/exporter enabled.
"""
from __future__ import annotations

import argparse
import math
import os
import sys
from pathlib import Path

try:
    import bpy
except ImportError:
    print("ERROR: This script must run inside Blender.")
    print("  blender --background --python pack-atlas.py -- --inputs a.glb b.glb --output out.glb")
    sys.exit(1)


def parse_args() -> argparse.Namespace:
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    parser = argparse.ArgumentParser()
    parser.add_argument("--inputs", nargs="+", required=True, help="Input GLB files")
    parser.add_argument("--output", required=True, help="Output packed GLB")
    parser.add_argument("--atlas-size", type=int, default=2048, help="Square atlas size in pixels")
    return parser.parse_args(argv)


def validate_args(args: argparse.Namespace) -> tuple[list[Path], Path]:
    inputs = [Path(value).expanduser().resolve() for value in args.inputs]
    output = Path(args.output).expanduser().resolve()

    if args.atlas_size < 256 or args.atlas_size > 8192 or args.atlas_size & (args.atlas_size - 1):
        raise SystemExit("--atlas-size must be a power of two between 256 and 8192")
    if len({str(path) for path in inputs}) != len(inputs):
        raise SystemExit("Input list contains duplicate paths")
    missing = [str(path) for path in inputs if not path.is_file()]
    if missing:
        raise SystemExit(f"Missing input GLB file(s): {', '.join(missing)}")
    invalid = [str(path) for path in inputs if path.suffix.lower() != ".glb"]
    if invalid:
        raise SystemExit(f"Only .glb inputs are supported: {', '.join(invalid)}")
    if output.suffix.lower() != ".glb":
        raise SystemExit("--output must end with .glb")
    if output in inputs:
        raise SystemExit("Output path must not overwrite an input GLB")

    output.parent.mkdir(parents=True, exist_ok=True)
    return inputs, output


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    for block in list(bpy.data.meshes):
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials):
        if block.users == 0:
            bpy.data.materials.remove(block)
    for block in list(bpy.data.images):
        if block.users == 0:
            bpy.data.images.remove(block)


def import_glbs(paths: list[Path]) -> None:
    for path in paths:
        print(f"Importing {path}")
        bpy.ops.import_scene.gltf(filepath=str(path))

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("No mesh geometry was imported; refusing to export an empty atlas")


def mesh_objects() -> list:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def smart_unwrap_all() -> None:
    """Create UVs and pack islands across all selected mesh objects together."""
    meshes = mesh_objects()
    if not meshes:
        raise RuntimeError("No meshes available for UV unwrapping")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]

    bpy.ops.object.mode_set(mode="EDIT")
    try:
        bpy.ops.mesh.select_all(action="SELECT")
        # Smart Project's angle is in radians. Pack islands globally afterwards
        # so separate GLBs do not all overlap in the same 0..1 UV square.
        bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.0)
        bpy.ops.uv.pack_islands(rotate=True, margin=0.02)
    finally:
        bpy.ops.object.mode_set(mode="OBJECT")

    for obj in meshes:
        if obj.data.uv_layers.active is None:
            raise RuntimeError(f"UV unwrap failed for mesh object {obj.name!r}")


def make_atlas_material(size: int, atlas_path: Path):
    """Create the target image and one glTF metallic-roughness material."""
    atlas_img = bpy.data.images.new(
        "TSM_Albedo_Atlas", width=size, height=size, alpha=False, float_buffer=False
    )
    atlas_img.colorspace_settings.name = "sRGB"
    atlas_img.filepath_raw = str(atlas_path)
    atlas_img.file_format = "PNG"

    mat = bpy.data.materials.new("TSM_Atlas_PBR")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = atlas_img
    texture.label = "TSM Albedo Atlas"
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 1.0
    links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    nodes.active = texture
    texture.select = True
    return mat, atlas_img


def bake_atlas(atlas_img) -> None:
    """Bake source materials' diffuse color without baked lighting."""
    meshes = mesh_objects()
    if not meshes:
        raise RuntimeError("No meshes available to bake")

    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.device = "CPU"
    bpy.context.scene.cycles.samples = 16
    bpy.context.scene.render.bake.use_pass_direct = False
    bpy.context.scene.render.bake.use_pass_indirect = False
    bpy.context.scene.render.bake.margin = 4

    # Every source material used by the bake needs the same active target image.
    # Do not replace source materials before this operation: doing so destroys
    # the appearance being baked.
    for obj in meshes:
        if not obj.data.uv_layers.active:
            raise RuntimeError(f"Mesh {obj.name!r} has no active UV map")
        if not obj.data.materials:
            fallback = bpy.data.materials.new(f"{obj.name}_UntexturedSource")
            fallback.diffuse_color = (0.5, 0.5, 0.5, 1.0)
            fallback.use_nodes = True
            obj.data.materials.append(fallback)

        for material in obj.data.materials:
            if material is None:
                raise RuntimeError(f"Mesh {obj.name!r} has an unassigned material slot")
            material.use_nodes = True
            nodes = material.node_tree.nodes
            target = nodes.new("ShaderNodeTexImage")
            target.image = atlas_img
            target.label = "Temporary TSM bake target"
            for node in nodes:
                node.select = False
            target.select = True
            nodes.active = target

    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]

    print(f"Baking {atlas_img.size[0]}x{atlas_img.size[1]} albedo atlas...")
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"})
    atlas_img.save()
    atlas_img.pack()


def assign_atlas_material(material) -> None:
    """Replace every mesh's material slots and face assignments with the atlas."""
    meshes = mesh_objects()
    if not meshes:
        raise RuntimeError("No meshes available for atlas material assignment")

    for obj in meshes:
        obj.data.materials.clear()
        obj.data.materials.append(material)
        for polygon in obj.data.polygons:
            polygon.material_index = 0


def export_packed(output: Path) -> None:
    bpy.ops.object.select_all(action="SELECT")
    print(f"Exporting {output}")
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_materials="EXPORT",
        export_image_format="AUTO",
    )
    if not output.is_file() or output.stat().st_size == 0:
        raise RuntimeError(f"Blender did not produce a non-empty output GLB: {output}")


def main() -> None:
    args = parse_args()
    inputs, output = validate_args(args)
    atlas_path = output.with_name(f"{output.stem}.albedo-atlas.png")

    clear_scene()
    import_glbs(inputs)
    smart_unwrap_all()
    atlas_material, atlas_img = make_atlas_material(args.atlas_size, atlas_path)
    bake_atlas(atlas_img)
    assign_atlas_material(atlas_material)
    export_packed(output)
    print(f"Done. Atlas-packed GLB: {output}")
    print(f"Atlas image: {atlas_path}")


if __name__ == "__main__":
    main()
