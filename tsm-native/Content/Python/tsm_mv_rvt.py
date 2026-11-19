"""Create safe, reproducible UE5.8 RVT starter assets for Mount Vernon.

Creates *starter* materials and an RVT volume; does not overwrite user art.
The volume must be bounds-fitted to an imported Landscape and landscape/road/
building components must explicitly register the RVT in Details.
"""
from __future__ import annotations

ROOT = "/Game/TSM/MountVernon/Materials"
RVT_NAME = "RVT_MV_Surface"
MAT_NAMES = ("M_MV_Landscape_RVT_Starter", "M_MV_Road_RVT_Starter",
             "M_MV_Foundation_RVT_Starter")


def _create(unreal, name, asset_class, factory):
    asset_path = ROOT + "/" + name
    if unreal.EditorAssetLibrary.does_asset_exist(asset_path):
        asset = unreal.EditorAssetLibrary.load_asset(asset_path)
        if not isinstance(asset, asset_class):
            raise RuntimeError("Unexpected existing asset type at " + asset_path)
        return asset, False
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    asset = tools.create_asset(name, ROOT, asset_class, factory)
    if asset is None:
        raise RuntimeError("Failed creating " + asset_path)
    return asset, True


def _node(unreal, material, expression_class, x, y):
    result = unreal.MaterialEditingLibrary.create_material_expression(
        material, expression_class, x, y)
    if result is None:
        raise RuntimeError("Missing expression class " + str(expression_class))
    return result


def _wire(unreal, source, output_name, destination, input_name):
    if not unreal.MaterialEditingLibrary.connect_material_expressions(
            source, output_name, destination, input_name):
        raise RuntimeError("Material expression connection failed: " + input_name)


def _color(unreal, material, rgb, x, y):
    value = _node(unreal, material, unreal.MaterialExpressionConstant3Vector, x, y)
    value.set_editor_property("constant", unreal.LinearColor(*rgb, 1.0))
    return value


def _roughness(unreal, material, value, x, y):
    node = _node(unreal, material, unreal.MaterialExpressionConstant, x, y)
    node.set_editor_property("r", float(value))
    return node


def _compile(unreal, material):
    unreal.MaterialEditingLibrary.layout_material_expressions(material)
    unreal.MaterialEditingLibrary.recompile_material(material)
    if not unreal.EditorAssetLibrary.save_loaded_asset(material):
        raise RuntimeError("Unable to save material " + material.get_path_name())


def _make_landscape(unreal, material):
    color = _color(unreal, material, (0.27, 0.26, 0.22), -650, 0)
    roughness = _roughness(unreal, material, 0.78, -650, 200)
    unreal.MaterialEditingLibrary.connect_material_property(
        color, "", unreal.MaterialProperty.MP_BASE_COLOR)
    unreal.MaterialEditingLibrary.connect_material_property(
        roughness, "", unreal.MaterialProperty.MP_ROUGHNESS)
    out = _node(unreal, material, unreal.MaterialExpressionRuntimeVirtualTextureOutput, 150, 0)
    _wire(unreal, color, "", out, "BaseColor")
    _wire(unreal, roughness, "", out, "Roughness")
    _compile(unreal, material)


def _sample(unreal, material, rvt, x, y):
    sample = _node(unreal, material,
                   unreal.MaterialExpressionRuntimeVirtualTextureSample, x, y)
    sample.set_editor_property("virtual_texture", rvt)
    sample.set_editor_property(
        "material_type", unreal.RuntimeVirtualTextureMaterialType.BASE_COLOR_NORMAL_ROUGHNESS)
    return sample


def _make_road(unreal, material, rvt):
    sample = _sample(unreal, material, rvt, -1050, -200)
    asphalt = _color(unreal, material, (0.08, 0.075, 0.07), -1050, 100)
    vertex = _node(unreal, material, unreal.MaterialExpressionVertexColor, -1050, 400)
    lerp = _node(unreal, material, unreal.MaterialExpressionLinearInterpolate, -470, 0)
    _wire(unreal, sample, "Base Color", lerp, "A")
    _wire(unreal, asphalt, "", lerp, "B")
    _wire(unreal, vertex, "R", lerp, "Alpha")
    unreal.MaterialEditingLibrary.connect_material_property(
        lerp, "", unreal.MaterialProperty.MP_BASE_COLOR)
    rough = _roughness(unreal, material, 0.73, -470, 220)
    unreal.MaterialEditingLibrary.connect_material_property(
        rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
    # IMPORTANT: road samples LANDSCAPE RVT but does not write into the same RVT.
    _compile(unreal, material)


def _make_foundation(unreal, material, rvt):
    sample = _sample(unreal, material, rvt, -1200, -200)
    masonry = _color(unreal, material, (0.24, 0.12, 0.09), -1200, 100)
    world = _node(unreal, material, unreal.MaterialExpressionWorldPosition, -1200, 400)
    actor = _node(unreal, material, unreal.MaterialExpressionActorPositionWS, -1200, 600)
    subtract = _node(unreal, material, unreal.MaterialExpressionSubtract, -950, 470)
    _wire(unreal, world, "", subtract, "A")
    _wire(unreal, actor, "", subtract, "B")
    mask = _node(unreal, material, unreal.MaterialExpressionComponentMask, -730, 470)
    mask.set_editor_properties({"r": False, "g": False, "b": True, "a": False})
    _wire(unreal, subtract, "", mask, "Input")
    # Ground contact only: alpha increases from 0 at actor origin to 1 at +30 cm.
    divisor = _roughness(unreal, material, 30.0, -740, 690)
    divide = _node(unreal, material, unreal.MaterialExpressionDivide, -530, 470)
    _wire(unreal, mask, "", divide, "A")
    _wire(unreal, divisor, "", divide, "B")
    saturate = _node(unreal, material, unreal.MaterialExpressionSaturate, -330, 470)
    _wire(unreal, divide, "", saturate, "Input")
    lerp = _node(unreal, material, unreal.MaterialExpressionLinearInterpolate, -100, 50)
    _wire(unreal, sample, "Base Color", lerp, "A")
    _wire(unreal, masonry, "", lerp, "B")
    _wire(unreal, saturate, "", lerp, "Alpha")
    unreal.MaterialEditingLibrary.connect_material_property(
        lerp, "", unreal.MaterialProperty.MP_BASE_COLOR)
    rough = _roughness(unreal, material, 0.82, -100, 260)
    unreal.MaterialEditingLibrary.connect_material_property(
        rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
    _compile(unreal, material)


def setup(*, create_volume=True):
    import unreal
    rvt, new_rvt = _create(
        unreal, RVT_NAME, unreal.RuntimeVirtualTexture, unreal.RuntimeVirtualTextureFactory())
    if new_rvt:
        rvt.set_editor_property(
            "material_type",
            unreal.RuntimeVirtualTextureMaterialType.BASE_COLOR_NORMAL_ROUGHNESS)
        if not unreal.EditorAssetLibrary.save_loaded_asset(rvt):
            raise RuntimeError("Unable to save RVT asset")
    material_builders = (_make_landscape, _make_road, _make_foundation)
    new_names = []
    for name, builder in zip(MAT_NAMES, material_builders):
        mat, created = _create(unreal, name, unreal.Material, unreal.MaterialFactoryNew())
        if created:
            if builder is _make_landscape:
                builder(unreal, mat)
            else:
                builder(unreal, mat, rvt)
            new_names.append(name)
    if create_volume:
        actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
        existing = [
            actor for actor in actor_subsystem.get_all_level_actors()
            if "TSM_MV_RVT" in {str(t) for t in actor.get_editor_property("tags")}
        ]
        if len(existing) > 1:
            raise RuntimeError("Multiple loaded TSM_MV_RVT volumes; choose one manually")
        if not existing:
            volume = actor_subsystem.spawn_actor_from_class(
                unreal.RuntimeVirtualTextureVolume,
                unreal.Vector(0.0, 0.0, 0.0), unreal.Rotator(0.0, 0.0, 0.0))
            if volume is None:
                raise RuntimeError("Unable to create RVT volume")
            volume.set_actor_label("RVT_MV_Surface_ReviewBounds")
            volume.set_folder_path("MountVernon/RVT")
            volume.set_editor_property("tags", [unreal.Name("TSM_MV_RVT")])
            component = volume.get_editor_property("virtual_texture_component")
            component.set_editor_property("virtual_texture", rvt)
    unreal.log_warning(
        "RVT starter assets built (new materials: " + ", ".join(new_names) + "). "
        "Before rendering: fit volume bounds to validated Landscape, assign Landscape "
        "RVT output/material, register RVT on Landscape primitive, apply road/foundation "
        "materials. VertexColor.R must be authored with 0 at road edges, 1 at center. "
        "Do not treat starter flat colors as photoreal source imagery.")
    return {"rvt": ROOT + "/" + RVT_NAME, "new_materials": new_names,
            "volume_needs_bounds": bool(create_volume)}


if __name__ == "__main__":
    setup()
