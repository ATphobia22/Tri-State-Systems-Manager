#!/usr/bin/env python3
"""Bake and consolidate multi-GLB assets into one glTF-compatible PBR material.

Bakes five source channels (albedo, tangent-space normal, roughness, metallic,
and ambient occlusion), packs AO/roughness/metallic into glTF's ORM channels
(R=AO, G=roughness, B=metallic), and exports one material using three textures:
base color (sRGB), normal (Non-Color), and packed ORM (Non-Color).

Run inside Blender with the glTF 2.0 importer/exporter enabled:
    blender --background --factory-startup --python pack-atlas.py -- \
        --inputs building1.glb building2.glb --output atlas-packed.glb --atlas-size 2048

The five baked channel images are also saved beside the output GLB for audit.
Complex metallic shader graphs fail closed instead of losing material semantics.
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

try:
    import bpy
except ImportError:
    print("ERROR: This script must run inside Blender.")
    print("  blender --background --python pack-atlas.py -- --inputs a.glb b.glb --output out.glb")
    sys.exit(1)

CHANNELS = {
    "albedo": {"bake_type": "DIFFUSE", "color_space": "sRGB", "suffix": "albedo"},
    "normal": {"bake_type": "NORMAL", "color_space": "Non-Color", "suffix": "normal"},
    "roughness": {"bake_type": "ROUGHNESS", "color_space": "Non-Color", "suffix": "roughness"},
    "metallic": {"bake_type": "EMIT", "color_space": "Non-Color", "suffix": "metallic"},
    "ao": {"bake_type": "AO", "color_space": "Non-Color", "suffix": "ao"},
}


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
    if args.atlas_size < 256 or args.atlas_size > 4096 or args.atlas_size & (args.atlas_size - 1):
        raise SystemExit("--atlas-size must be a power of two between 256 and 4096")
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
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def mesh_objects() -> list:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def import_glbs(paths: list[Path]) -> None:
    for path in paths:
        before = {obj.as_pointer() for obj in mesh_objects()}
        print(f"Importing {path}")
        bpy.ops.import_scene.gltf(filepath=str(path))
        added = [obj for obj in mesh_objects() if obj.as_pointer() not in before]
        if not added:
            raise RuntimeError(f"Input GLB contains no imported mesh geometry: {path}")
    if not mesh_objects():
        raise RuntimeError("No mesh geometry was imported; refusing to export an empty atlas")


def source_materials() -> list:
    materials = []
    for obj in mesh_objects():
        if obj.data.uv_layers.active is None:
            raise RuntimeError(f"Mesh {obj.name!r} has no active UV map after unwrap")
        if not obj.data.materials:
            raise RuntimeError(f"Mesh {obj.name!r} has no source material; refusing to invent appearance")
        for material in obj.data.materials:
            if material is None:
                raise RuntimeError(f"Mesh {obj.name!r} has an unassigned material slot")
            if material not in materials:
                material.use_nodes = True
                materials.append(material)
    if not materials:
        raise RuntimeError("No source materials were imported")
    return materials


def smart_unwrap_all() -> None:
    """Create UVs and pack all object islands together to avoid cross-GLB overlap."""
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
        bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.0)
        bpy.ops.uv.pack_islands(rotate=True, margin=0.02)
    finally:
        bpy.ops.object.mode_set(mode="OBJECT")
    for obj in meshes:
        if obj.data.uv_layers.active is None:
            raise RuntimeError(f"UV unwrap failed for mesh object {obj.name!r}")


def create_image(name: str, size: int, path: Path, color_space: str):
    image = bpy.data.images.new(name, width=size, height=size, alpha=False, float_buffer=False)
    image.colorspace_settings.name = color_space
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    return image


def install_bake_targets(materials: list, image):
    """Make the same atlas image the active bake target on every source material."""
    state = []
    for material in materials:
        nodes = material.node_tree.nodes
        previous_active = nodes.active
        previous_selection = [(node, node.select) for node in nodes]
        target = nodes.new("ShaderNodeTexImage")
        target.image = image
        target.label = f"Temporary TSM bake target: {image.name}"
        for node in nodes:
            node.select = False
        target.select = True
        nodes.active = target
        state.append((material, target, previous_active, previous_selection))
    return state


def remove_bake_targets(state) -> None:
    for material, target, previous_active, previous_selection in reversed(state):
        nodes = material.node_tree.nodes
        if target.name in nodes:
            nodes.remove(target)
        for node, was_selected in previous_selection:
            if node.name in nodes:
                node.select = was_selected
        if previous_active is not None and previous_active.name in nodes:
            nodes.active = previous_active


def temporarily_route_metallic_to_emission(materials: list):
    """Expose a direct Principled Metallic input for an exact scalar bake.

    Arbitrary shader graphs are rejected. The temporary changes are rolled back
    if any material is unsupported or the bake later fails.
    """
    changes = []
    try:
        for material in materials:
            nodes = material.node_tree.nodes
            links = material.node_tree.links
            outputs = [
                node for node in nodes
                if node.type == "OUTPUT_MATERIAL" and getattr(node, "is_active_output", False)
            ]
            if not outputs:
                raise RuntimeError(f"Material {material.name!r} has no active material output")
            surface = outputs[0].inputs.get("Surface")
            surface_links = list(surface.links) if surface is not None else []
            if len(surface_links) != 1 or surface_links[0].from_node.type != "BSDF_PRINCIPLED":
                raise RuntimeError(
                    f"Material {material.name!r} has a non-simple output graph; "
                    "metallic atlas baking only supports a direct Principled BSDF connection"
                )
            original_surface_socket = surface_links[0].from_socket
            principled = surface_links[0].from_node
            metallic = principled.inputs.get("Metallic")
            if metallic is None:
                raise RuntimeError(f"Material {material.name!r} has no Principled Metallic input")
            metallic_links = list(metallic.links)
            emission = nodes.new("ShaderNodeEmission")
            changes.append((material, surface, original_surface_socket, None, emission))
            if metallic_links:
                links.new(metallic_links[0].from_socket, emission.inputs["Color"])
            else:
                value = float(metallic.default_value)
                emission.inputs["Color"].default_value = (value, value, value, 1.0)
            links.remove(surface_links[0])
            replacement = links.new(emission.outputs["Emission"], surface)
            changes[-1] = (material, surface, original_surface_socket, replacement, emission)
        return changes
    except Exception:
        restore_metallic_routes(changes)
        raise


def restore_metallic_routes(changes) -> None:
    for material, surface, original_surface_socket, replacement, emission in reversed(changes):
        nodes = material.node_tree.nodes
        links = material.node_tree.links
        if replacement is not None:
            try:
                links.remove(replacement)
            except (ReferenceError, RuntimeError):
                pass
        if not any(link.from_socket == original_surface_socket for link in surface.links):
            links.new(original_surface_socket, surface)
        if emission.name in nodes:
            nodes.remove(emission)


def set_mesh_selection(meshes: list) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]


def bake_channel(channel: str, image, materials: list, meshes: list) -> None:
    """Bake one source channel to a shared atlas and persist the raw channel PNG."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 16
    scene.render.bake.margin = 8
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True
    if channel == "normal":
        scene.render.bake.normal_space = "TANGENT"

    target_state = install_bake_targets(materials, image)
    metallic_state = []
    try:
        set_mesh_selection(meshes)
        if channel == "metallic":
            metallic_state = temporarily_route_metallic_to_emission(materials)
            bpy.ops.object.bake(type="EMIT")
        elif channel == "albedo":
            bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"})
        else:
            bpy.ops.object.bake(type=CHANNELS[channel]["bake_type"])
        image.update()
        image.save()
        image.pack()
        print(f"Baked {channel}: {image.filepath_raw}")
    finally:
        if metallic_state:
            restore_metallic_routes(metallic_state)
        remove_bake_targets(target_state)


def pack_orm_channels(ao_image, roughness_image, metallic_image, orm_image) -> None:
    """Pack standard glTF channels: AO=R, roughness=G, metallic=B."""
    try:
        import numpy as np
    except ImportError as exc:
        raise RuntimeError("Blender's bundled NumPy module is required to pack ORM channels") from exc

    width, height = orm_image.size
    expected = width * height * 4

    def rgba(image):
        pixels = np.asarray(image.pixels[:], dtype=np.float32)
        if pixels.size != expected:
            raise RuntimeError(f"Unexpected pixel count in {image.name}: {pixels.size}")
        return pixels.reshape((height, width, 4))

    ao = rgba(ao_image)
    roughness = rgba(roughness_image)
    metallic = rgba(metallic_image)
    packed = np.ones((height, width, 4), dtype=np.float32)
    packed[..., 0] = np.clip(ao[..., 0], 0.0, 1.0)
    packed[..., 1] = np.clip(roughness[..., 0], 0.0, 1.0)
    packed[..., 2] = np.clip(metallic[..., 0], 0.0, 1.0)
    orm_image.pixels.foreach_set(packed.ravel())
    orm_image.update()
    orm_image.save()
    orm_image.pack()
    print("Packed glTF ORM texture: R=AO, G=roughness, B=metallic")


def create_gltf_material_output_group():
    """Create Blender's special glTF Material Output group with an Occlusion input."""
    group = bpy.data.node_groups.get("glTF Material Output")
    if group is None:
        group = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        existing_names = set()
        if hasattr(group, "interface"):
            for item in group.interface.items_tree:
                if getattr(item, "item_type", None) == "SOCKET" and getattr(item, "in_out", None) == "INPUT":
                    existing_names.add(item.name)
            if "Occlusion" not in existing_names:
                group.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketColor")
        else:
            if not any(socket.name == "Occlusion" for socket in group.inputs):
                group.inputs.new("NodeSocketColor", "Occlusion")
    return group


def create_pbr_material(albedo_image, normal_image, orm_image):
    """Connect three atlases using the core glTF metal/rough PBR channel convention."""
    material = bpy.data.materials.new("TSM_Consolidated_PBR")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    albedo = nodes.new("ShaderNodeTexImage")
    albedo.name = "TSM Base Color Atlas"
    albedo.label = "Base Color (sRGB)"
    albedo.image = albedo_image
    normal = nodes.new("ShaderNodeTexImage")
    normal.name = "TSM Tangent Normal Atlas"
    normal.label = "Tangent-space Normal (Non-Color)"
    normal.image = normal_image
    orm = nodes.new("ShaderNodeTexImage")
    orm.name = "TSM ORM Atlas"
    orm.label = "ORM: R=AO, G=Roughness, B=Metallic"
    orm.image = orm_image

    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.space = "TANGENT"
    normal_map.inputs["Strength"].default_value = 1.0
    if hasattr(bpy.types, "ShaderNodeSeparateColor"):
        separate = nodes.new("ShaderNodeSeparateColor")
        separate.mode = "RGB"
        red_name, green_name, blue_name = "Red", "Green", "Blue"
    else:
        separate = nodes.new("ShaderNodeSeparateRGB")
        red_name, green_name, blue_name = "R", "G", "B"

    group = create_gltf_material_output_group()
    gltf_output = nodes.new("ShaderNodeGroup")
    gltf_output.node_tree = group
    gltf_output.label = "glTF Material Output"
    if gltf_output.inputs.get("Occlusion") is None:
        raise RuntimeError("Failed to create glTF Material Output/Occlusion socket")

    links.new(albedo.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(normal.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    links.new(orm.outputs["Color"], separate.inputs[0])
    links.new(separate.outputs[green_name], bsdf.inputs["Roughness"])
    links.new(separate.outputs[blue_name], bsdf.inputs["Metallic"])
    # Blender's glTF exporter discovers the AO image from the special node
    # group; the full ORM image is intentional because glTF samples its R channel.
    links.new(orm.outputs["Color"], gltf_output.inputs["Occlusion"])
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    nodes.active = albedo
    return material


def assign_shared_material(material) -> None:
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
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_materials="EXPORT",
        export_image_format="AUTO",
        use_selection=False,
    )
    if not output.is_file() or output.stat().st_size == 0:
        raise RuntimeError(f"Blender did not produce a non-empty output GLB: {output}")


def main() -> None:
    args = parse_args()
    inputs, output = validate_args(args)
    atlas_paths = {
        channel: output.with_name(f"{output.stem}.{CHANNELS[channel]['suffix']}-atlas.png")
        for channel in CHANNELS
    }
    orm_path = output.with_name(f"{output.stem}.orm-atlas.png")

    clear_scene()
    import_glbs(inputs)
    smart_unwrap_all()
    meshes = mesh_objects()
    materials = source_materials()
    size = args.atlas_size
    images = {
        channel: create_image(
            f"TSM_{channel.title()}_Atlas", size, atlas_paths[channel], CHANNELS[channel]["color_space"]
        )
        for channel in CHANNELS
    }
    for channel in ("albedo", "normal", "roughness", "metallic", "ao"):
        bake_channel(channel, images[channel], materials, meshes)

    orm_image = create_image("TSM_ORM_Atlas", size, orm_path, "Non-Color")
    pack_orm_channels(images["ao"], images["roughness"], images["metallic"], orm_image)
    pbr_material = create_pbr_material(images["albedo"], images["normal"], orm_image)
    assign_shared_material(pbr_material)
    # Intermediate maps are written as audit artifacts but should not be
    # interpreted as used glTF channels; the GLB uses baseColor, normal and ORM.
    export_packed(output)
    for image in images.values():
        if not Path(image.filepath_raw).is_file() or Path(image.filepath_raw).stat().st_size == 0:
            raise RuntimeError(f"Baked channel output missing: {image.filepath_raw}")
    if not Path(orm_image.filepath_raw).is_file() or Path(orm_image.filepath_raw).stat().st_size == 0:
        raise RuntimeError(f"Packed ORM output missing: {orm_image.filepath_raw}")
    print(f"Done. PBR-atlas GLB: {output}")
    print(f"Embedded PBR atlases: base color, tangent normal, packed ORM ({orm_path})")
    print("Audit sidecars: albedo, normal, roughness, metallic, AO PNGs")


if __name__ == "__main__":
    main()
