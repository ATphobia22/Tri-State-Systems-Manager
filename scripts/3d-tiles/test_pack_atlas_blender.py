#!/usr/bin/env python3
"""Headless Blender integration test for the multi-channel PBR atlas packer.

Run:
    blender --background --factory-startup --python scripts/3d-tiles/test_pack_atlas_blender.py

The test creates two real GLBs, invokes pack-atlas.py in a separate Blender
process, and validates the resulting embedded glTF PBR texture bindings.
"""
from __future__ import annotations

import json
import struct
import subprocess
import tempfile
from pathlib import Path

import bpy

SCRIPT = Path(__file__).resolve().with_name("pack-atlas.py")


def require_gltf_operators() -> None:
    if not hasattr(bpy.ops.export_scene, "gltf") or not hasattr(bpy.ops.import_scene, "gltf"):
        try:
            bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
        except Exception as exc:
            raise RuntimeError("Blender glTF 2.0 import/export operators are unavailable") from exc
    if not hasattr(bpy.ops.export_scene, "gltf") or not hasattr(bpy.ops.import_scene, "gltf"):
        raise RuntimeError("Blender glTF 2.0 import/export operators are unavailable")


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def create_fixture_glb(
    path: Path,
    color: tuple[float, float, float],
    roughness: float,
    metallic: float,
    location_x: float,
) -> None:
    clear_scene()
    bpy.ops.mesh.primitive_cube_add(size=2.0, location=(location_x, 0.0, 0.0))
    mesh = bpy.context.active_object
    mesh.name = f"TSMFixture_{path.stem}"
    material = bpy.data.materials.new(f"TSMFixtureMaterial_{path.stem}")
    material.use_nodes = True
    principled = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    mesh.data.materials.clear()
    mesh.data.materials.append(material)

    bpy.ops.object.mode_set(mode="EDIT")
    try:
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=0.785398, island_margin=0.0)
    finally:
        bpy.ops.object.mode_set(mode="OBJECT")

    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_materials="EXPORT",
        use_selection=True,
    )
    if not path.is_file() or path.stat().st_size < 128:
        raise RuntimeError(f"Fixture GLB export failed: {path}")


def read_glb_json(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 20:
        raise RuntimeError(f"GLB is too small to be valid: {path}")
    magic, version, total_length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or total_length != len(data):
        raise RuntimeError(f"Invalid GLB header: {path}")
    offset = 12
    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<I4s", data, offset)
        offset += 8
        chunk = data[offset : offset + chunk_length]
        offset += chunk_length
        if chunk_type == b"JSON":
            return json.loads(chunk.rstrip(b" \t\r\n\x00").decode("utf-8"))
    raise RuntimeError(f"GLB has no JSON chunk: {path}")


def assert_pbr_bindings(path: Path) -> None:
    document = read_glb_json(path)
    materials = document.get("materials", [])
    if len(materials) != 1:
        raise AssertionError(f"Expected one consolidated material, got {len(materials)}")
    material = materials[0]
    pbr = material.get("pbrMetallicRoughness", {})
    required = {
        "baseColorTexture": pbr.get("baseColorTexture"),
        "metallicRoughnessTexture": pbr.get("metallicRoughnessTexture"),
        "normalTexture": material.get("normalTexture"),
        "occlusionTexture": material.get("occlusionTexture"),
    }
    missing = [name for name, binding in required.items() if not isinstance(binding, dict) or "index" not in binding]
    if missing:
        raise AssertionError(f"Exported material is missing PBR texture bindings: {missing}")

    textures = document.get("textures", [])
    images = document.get("images", [])
    for name, binding in required.items():
        index = binding["index"]
        if index < 0 or index >= len(textures):
            raise AssertionError(f"{name} points outside glTF texture table")
        source = textures[index].get("source")
        if not isinstance(source, int) or source < 0 or source >= len(images):
            raise AssertionError(f"{name} does not reference a valid embedded image")
        if "bufferView" not in images[source] or images[source].get("mimeType") != "image/png":
            raise AssertionError(f"{name} image is not embedded as a PNG in the GLB")

    mr_texture = pbr["metallicRoughnessTexture"]["index"]
    ao_texture = material["occlusionTexture"]["index"]
    if textures[mr_texture].get("source") != textures[ao_texture].get("source"):
        raise AssertionError("glTF AO and metallic-roughness bindings must share the packed ORM image")

    extensions = document.get("extensionsUsed", [])
    # No vendor-specific extension is required for the core metallic/roughness and normal bindings.
    print(json.dumps({
        "ok": True,
        "output": str(path),
        "materialCount": len(materials),
        "textureCount": len(textures),
        "imageCount": len(images),
        "pbrBindings": sorted(required),
        "extensionsUsed": extensions,
    }, indent=2))


def main() -> None:
    require_gltf_operators()
    with tempfile.TemporaryDirectory(prefix="tsm-pbr-atlas-") as temp:
        root = Path(temp)
        first = root / "red-metallic.glb"
        second = root / "blue-dielectric.glb"
        output = root / "atlas-packed.glb"

        create_fixture_glb(first, (0.8, 0.05, 0.02), roughness=0.25, metallic=0.9, location_x=-2.5)
        create_fixture_glb(second, (0.02, 0.08, 0.8), roughness=0.8, metallic=0.05, location_x=2.5)

        command = [
            bpy.app.binary_path,
            "--background",
            "--factory-startup",
            "--python",
            str(SCRIPT),
            "--",
            "--inputs",
            str(first),
            str(second),
            "--output",
            str(output),
            "--atlas-size",
            "256",
        ]
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=300,
        )
        print(result.stdout)
        if result.returncode != 0:
            print(result.stderr)
            raise RuntimeError(f"pack-atlas.py failed with exit code {result.returncode}")
        if not output.is_file() or output.stat().st_size == 0:
            raise RuntimeError("pack-atlas.py did not produce the requested GLB")

        assert_pbr_bindings(output)
        expected_sidecars = [
            output.with_name(f"{output.stem}.{suffix}-atlas.png")
            for suffix in ("albedo", "normal", "roughness", "metallic", "ao")
        ]
        expected_sidecars.append(output.with_name(f"{output.stem}.orm-atlas.png"))
        missing = [str(p) for p in expected_sidecars if not p.is_file() or p.stat().st_size == 0]
        if missing:
            raise AssertionError(f"One or more baked map sidecars are missing/empty: {missing}")
        print("PASS: headless Blender PBR atlas integration test")


if __name__ == "__main__":
    main()
