#!/usr/bin/env python3
"""Headless Blender PBR map baker; one isolated worker per map.

Supported maps: diffuse (albedo), normal, roughness, metallic, AO, and emission.
The source mesh/materials are not exported or modified permanently by this tool.
Metallic baking temporarily routes a simple Principled BSDF Metallic input through
an emission shader. Complex shader graphs are rejected rather than approximated.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import bpy
except ImportError:
    raise SystemExit("This script must run inside Blender (bpy is unavailable).")


BAKE_TYPE = {
    "diffuse": "DIFFUSE",
    "normal": "NORMAL",
    "roughness": "ROUGHNESS",
    "ao": "AO",
    "emit": "EMIT",
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--map",
        required=True,
        choices=["diffuse", "normal", "roughness", "metallic", "ao", "emit"],
    )
    parser.add_argument("--out", required=True, help="Output directory for baked PNG")
    parser.add_argument("--size", type=int, default=2048)
    parser.add_argument("--object", default=None, help="Object name (default: active)")
    return parser.parse_args(argv)


def validate_args(args: argparse.Namespace) -> Path:
    if args.size < 256 or args.size > 8192 or args.size & (args.size - 1):
        raise SystemExit("--size must be a power of two between 256 and 8192")
    output_dir = Path(args.out).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def resolve_mesh(object_name: str | None):
    obj = bpy.data.objects.get(object_name) if object_name else bpy.context.active_object
    if obj is None or obj.type != "MESH":
        raise SystemExit("No mesh object selected/found")
    if obj.data.uv_layers.active is None:
        raise SystemExit(f"Object {obj.name!r} has no active UV map; unwrap before baking")
    materials = []
    for slot in obj.material_slots:
        if slot.material is None:
            raise SystemExit(f"Object {obj.name!r} has an unassigned material slot")
        if slot.material not in materials:
            materials.append(slot.material)
    if not materials:
        raise SystemExit(f"Object {obj.name!r} has no material slots")
    return obj, materials


def make_bake_targets(materials, image):
    targets = []
    for material in materials:
        material.use_nodes = True
        nodes = material.node_tree.nodes
        previous_active = nodes.active
        target = nodes.new("ShaderNodeTexImage")
        target.image = image
        target.label = "Temporary TSM bake target"
        for node in nodes:
            node.select = False
        target.select = True
        nodes.active = target
        targets.append((material, target, previous_active))
    return targets


def prepare_metallic_emission(materials):
    """Temporarily expose Principled metallic values as emissive color."""
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
                    f"Material {material.name!r} uses a non-simple surface graph; "
                    "metallic baking supports a direct Principled BSDF connection only"
                )

            original_from_socket = surface_links[0].from_socket
            principled = surface_links[0].from_node
            metallic = principled.inputs.get("Metallic")
            if metallic is None:
                raise RuntimeError(f"Material {material.name!r} has no Principled Metallic input")
            metallic_links = list(metallic.links)
            emission = nodes.new("ShaderNodeEmission")
            change_index = len(changes)
            changes.append((material, surface, original_from_socket, None, emission))

            if metallic_links:
                links.new(metallic_links[0].from_socket, emission.inputs["Color"])
            else:
                value = float(metallic.default_value)
                emission.inputs["Color"].default_value = (value, value, value, 1.0)

            links.remove(surface_links[0])
            replacement_link = links.new(emission.outputs["Emission"], surface)
            changes[change_index] = (
                material, surface, original_from_socket, replacement_link, emission
            )
        return changes
    except Exception:
        restore_metallic_materials(changes)
        raise


def restore_metallic_materials(changes) -> None:
    for material, surface, original_from_socket, replacement_link, emission in reversed(changes):
        nodes = material.node_tree.nodes
        links = material.node_tree.links
        if replacement_link is not None:
            try:
                links.remove(replacement_link)
            except (ReferenceError, RuntimeError):
                pass
        if not any(link.from_socket == original_from_socket for link in surface.links):
            links.new(original_from_socket, surface)
        if emission.name in nodes:
            nodes.remove(emission)


def cleanup_bake_targets(targets) -> None:
    for material, target, previous_active in reversed(targets):
        nodes = material.node_tree.nodes
        if target.name in nodes:
            nodes.remove(target)
        if previous_active is not None and previous_active.name in nodes:
            nodes.active = previous_active


def main() -> None:
    args = parse_args()
    output_dir = validate_args(args)
    obj, materials = resolve_mesh(args.object)
    image_name = f"{obj.name}_{args.map}".replace("/", "_").replace("\\", "_")
    image_path = output_dir / f"{image_name}.png"
    image = bpy.data.images.new(image_name, args.size, args.size, alpha=False)
    image.filepath_raw = str(image_path)
    image.file_format = "PNG"

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    targets = make_bake_targets(materials, image)
    metallic_changes = []
    try:
        scene = bpy.context.scene
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.bake_type = "EMIT" if args.map == "metallic" else BAKE_TYPE[args.map]
        if args.map == "diffuse":
            scene.render.bake.use_pass_direct = False
            scene.render.bake.use_pass_indirect = False
            scene.render.bake.use_pass_color = True
        if args.map == "metallic":
            metallic_changes = prepare_metallic_emission(materials)

        bpy.ops.object.bake(type="EMIT" if args.map == "metallic" else BAKE_TYPE[args.map])
        image.save()
        print(f"Baked {args.map} -> {image_path}")
    finally:
        if metallic_changes:
            restore_metallic_materials(metallic_changes)
        cleanup_bake_targets(targets)


if __name__ == "__main__":
    main()
