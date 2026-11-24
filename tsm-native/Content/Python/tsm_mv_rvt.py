"""UE5.8 Editor-only two-channel Mount Vernon RVT starter asset generator.

RVT_MountVernon_Material contains surface color/normal/roughness/specular.
RVT_MountVernon_Height contains landscape world height (world cm).
The Landscape writes both. Roads/foundations only sample them, never self-write.
This creates actual .uasset starter materials in the UE Editor, without
guessing Landscape bounds, virtual-texture memory budgets or source elevations.
"""
from __future__ import annotations

ROOT = "/Game/TSM/MountVernon/Materials/RVT"
SURFACE = "RVT_MountVernon_Material"
HEIGHT = "RVT_MountVernon_Height"
LANDSCAPE = "M_MV_Landscape_RVT_Starter"
ROAD = "M_MV_Road_RVT_Starter"
FOUNDATION = "M_MV_Foundation_RVT_Starter"


def _create(unreal, name, klass, factory):
    path = ROOT + "/" + name
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        asset = unreal.EditorAssetLibrary.load_asset(path)
        if not isinstance(asset, klass):
            raise RuntimeError("Conflicting Unreal asset: " + path)
        return asset, False
    asset = unreal.AssetToolsHelpers.get_asset_tools().create_asset(name, ROOT, klass, factory)
    if asset is None:
        raise RuntimeError("Unreal asset factory failed: " + path)
    return asset, True


def _node(unreal, material, cls, x, y):
    node = unreal.MaterialEditingLibrary.create_material_expression(material, cls, x, y)
    if node is None:
        raise RuntimeError("Cannot create expression: " + str(cls))
    return node


def _find_pin(unreal, node, wanted, output=False):
    names = (unreal.MaterialEditingLibrary.get_material_expression_output_names(node)
             if output else unreal.MaterialEditingLibrary.get_material_expression_input_names(node))
    aliases = {str(name).replace(" ", "").replace("_", "").lower(): str(name) for name in names}
    for candidate in wanted:
        key = candidate.replace(" ", "").replace("_", "").lower()
        if key in aliases:
            return aliases[key]
    raise RuntimeError("RVT material graph pin not found " + str(wanted) +
                       " on " + str(type(node)) + ": " + str(list(names)))


def _wire(unreal, source, target, target_names, source_names=None):
    out_name = ("" if source_names is None
                else _find_pin(unreal, source, source_names, output=True))
    in_name = _find_pin(unreal, target, target_names)
    if not unreal.MaterialEditingLibrary.connect_material_expressions(
            source, out_name, target, in_name):
        raise RuntimeError("Unreal failed to connect material pin " + in_name)


def _material_out(unreal, source, property_name, output_names=None):
    material_property = getattr(unreal.MaterialProperty, property_name)
    output_name = "" if output_names is None else _find_pin(
        unreal, source, output_names, output=True)
    if not unreal.MaterialEditingLibrary.connect_material_property(
            source, output_name, material_property):
        raise RuntimeError("Material property connection failed: " + property_name)


def _rgb(unreal, mat, value, x, y):
    n = _node(unreal, mat, unreal.MaterialExpressionConstant3Vector, x, y)
    n.set_editor_property("constant", unreal.LinearColor(value[0], value[1], value[2], 1.0))
    return n


def _scalar(unreal, mat, value, x, y):
    n = _node(unreal, mat, unreal.MaterialExpressionConstant, x, y)
    n.set_editor_property("r", float(value))
    return n


def _sparam(unreal, mat, name, value, x, y):
    n = _node(unreal, mat, unreal.MaterialExpressionScalarParameter, x, y)
    n.set_editor_property("parameter_name", unreal.Name(name))
    n.set_editor_property("default_value", float(value))
    return n


def _operation(unreal, mat, cls, a, b=None, x=0, y=0):
    n = _node(unreal, mat, cls, x, y)
    _wire(unreal, a, n, ("A", "Input"))
    if b is not None:
        _wire(unreal, b, n, ("B",))
    return n


def _saturate(unreal, mat, source, x, y):
    n = _node(unreal, mat, unreal.MaterialExpressionSaturate, x, y)
    _wire(unreal, source, n, ("Input",))
    return n


def _sample(unreal, mat, rvt, rvt_type, x, y):
    n = _node(unreal, mat, unreal.MaterialExpressionRuntimeVirtualTextureSample, x, y)
    n.set_editor_property("virtual_texture", rvt)
    n.set_editor_property("material_type", rvt_type)
    return n


def _lerp(unreal, mat, a, b, alpha, x, y, a_pin=None, b_pin=None):
    n = _node(unreal, mat, unreal.MaterialExpressionLinearInterpolate, x, y)
    _wire(unreal, a, n, ("A",), a_pin)
    _wire(unreal, b, n, ("B",), b_pin)
    _wire(unreal, alpha, n, ("Alpha",))
    return n


def _pixel_z(unreal, mat, x, y):
    world = _node(unreal, mat, unreal.MaterialExpressionWorldPosition, x, y)
    mask = _node(unreal, mat, unreal.MaterialExpressionComponentMask, x + 220, y)
    mask.set_editor_properties({"r": False, "g": False, "b": True, "a": False})
    _wire(unreal, world, mask, ("Input",))
    return mask


def _compile(unreal, mat):
    unreal.MaterialEditingLibrary.layout_material_expressions(mat)
    unreal.MaterialEditingLibrary.recompile_material(mat)
    if not unreal.EditorAssetLibrary.save_loaded_asset(mat):
        raise RuntimeError("Unable to persist " + mat.get_path_name())


def _build_landscape(unreal, mat):
    color = _rgb(unreal, mat, (0.27, 0.26, 0.22), -750, 0)
    normal = _rgb(unreal, mat, (0.0, 0.0, 1.0), -750, 180)
    rough = _scalar(unreal, mat, 0.78, -750, 360)
    spec = _scalar(unreal, mat, 0.3, -750, 520)
    height = _pixel_z(unreal, mat, -750, 760)
    _material_out(unreal, color, "MP_BASE_COLOR")
    _material_out(unreal, normal, "MP_NORMAL")
    _material_out(unreal, rough, "MP_ROUGHNESS")
    _material_out(unreal, spec, "MP_SPECULAR")
    output = _node(unreal, mat, unreal.MaterialExpressionRuntimeVirtualTextureOutput, 400, 0)
    _wire(unreal, color, output, ("BaseColor", "Base Color"))
    # The world-height channel is rendered to a distinct RVT_WorldHeight asset.
    _wire(unreal, normal, output, ("Normal",))
    _wire(unreal, rough, output, ("Roughness",))
    _wire(unreal, spec, output, ("Specular",))
    _wire(unreal, height, output, ("WorldHeight", "World Height"))
    _compile(unreal, mat)


def _make_height_above_landscape(unreal, mat, height_rvt, x, y):
    sampled = _sample(unreal, mat, height_rvt,
                      unreal.RuntimeVirtualTextureMaterialType.WORLD_HEIGHT, x, y)
    pixel = _pixel_z(unreal, mat, x, y + 320)
    delta = _node(unreal, mat, unreal.MaterialExpressionSubtract, x + 520, y + 130)
    _wire(unreal, pixel, delta, ("A",))
    _wire(unreal, sampled, delta, ("B",), ("WorldHeight", "World Height"))
    return delta


def _foundation_contact(unreal, mat, height_rvt):
    delta = _make_height_above_landscape(unreal, mat, height_rvt, -1100, 400)
    blend_cm = _sparam(unreal, mat, "BlendHeightCM", 35.0, -600, 750)
    divide = _operation(unreal, mat, unreal.MaterialExpressionDivide, delta, blend_cm,
                        -310, 480)
    saturate = _saturate(unreal, mat, divide, -50, 480)
    exponent = _sparam(unreal, mat, "BlendExponent", 1.5, -50, 660)
    alpha = _node(unreal, mat, unreal.MaterialExpressionPower, 220, 480)
    _wire(unreal, saturate, alpha, ("Base",))
    _wire(unreal, exponent, alpha, ("Exp", "Exponent"))
    return alpha


def _build_foundation(unreal, mat, surface_rvt, height_rvt):
    surface = _sample(unreal, mat, surface_rvt,
                      unreal.RuntimeVirtualTextureMaterialType.BASE_COLOR_NORMAL_SPECULAR,
                      -1100, 0)
    masonry = _rgb(unreal, mat, (0.24, 0.12, 0.09), -1100, 220)
    damp = _sparam(unreal, mat, "ContactDarken", 0.75, -850, -240)
    terrain_color = _node(unreal, mat, unreal.MaterialExpressionMultiply, -610, -100)
    _wire(unreal, surface, terrain_color, ("A",), ("BaseColor", "Base Color"))
    _wire(unreal, damp, terrain_color, ("B",))
    alpha = _foundation_contact(unreal, mat, height_rvt)
    color = _lerp(unreal, mat, terrain_color, masonry, alpha, 500, 100)
    _material_out(unreal, color, "MP_BASE_COLOR")
    contact_rough = _sparam(unreal, mat, "ContactRoughness", 0.92, -400, -250)
    brick_rough = _sparam(unreal, mat, "BrickRoughness", 0.78, -400, -420)
    rough = _lerp(unreal, mat, contact_rough, brick_rough, alpha, 480, 330)
    _material_out(unreal, rough, "MP_ROUGHNESS")
    # Tangent-space object normals cannot be directly lerped with RVT world normals.
    # Supply a source-authored normal map later; do not make an invalid normal blend.
    _compile(unreal, mat)


def _build_road(unreal, mat, surface_rvt, height_rvt):
    surface = _sample(unreal, mat, surface_rvt,
                      unreal.RuntimeVirtualTextureMaterialType.BASE_COLOR_NORMAL_SPECULAR,
                      -1200, -100)
    asphalt = _rgb(unreal, mat, (0.075, 0.07, 0.065), -1200, 170)
    vertex = _node(unreal, mat, unreal.MaterialExpressionVertexColor, -1200, 450)
    # VertexColor.R: 0 at outer edge, 1 in road interior. Do not assume U maps across.
    delta = _make_height_above_landscape(unreal, mat, height_rvt, -1200, 740)
    absolute = _node(unreal, mat, unreal.MaterialExpressionAbs, -440, 960)
    _wire(unreal, delta, absolute, ("Input",))
    max_contact = _sparam(unreal, mat, "MaxContactDeltaCM", 20.0, -500, 1170)
    max_delta = _operation(unreal, mat, unreal.MaterialExpressionDivide, absolute,
                           max_contact, -170, 960)
    max_delta = _saturate(unreal, mat, max_delta, 100, 960)
    # If the road is no longer near the terrain, do not paint the ground over
    # a floating geometry gap. The geometry discrepancy must be fixed upstream.
    feather = _node(unreal, mat, unreal.MaterialExpressionMax, 360, 500)
    _wire(unreal, vertex, feather, ("A",), ("R", "Red"))
    _wire(unreal, max_delta, feather, ("B",))
    edge = _saturate(unreal, mat, feather, 600, 500)
    color = _lerp(
        unreal, mat, surface, asphalt, edge, 910, 100,
        a_pin=("BaseColor", "Base Color"))
    _material_out(unreal, color, "MP_BASE_COLOR")
    natural_rough = _sparam(unreal, mat, "TerrainEdgeRoughness", 0.88, 400, -300)
    asphalt_rough = _sparam(unreal, mat, "AsphaltRoughness", 0.70, 600, -250)
    rough = _lerp(unreal, mat, natural_rough, asphalt_rough, edge, 900, 360)
    _material_out(unreal, rough, "MP_ROUGHNESS")
    _compile(unreal, mat)


def _material_types(unreal):
    return (unreal.RuntimeVirtualTextureMaterialType.BASE_COLOR_NORMAL_SPECULAR,
            unreal.RuntimeVirtualTextureMaterialType.WORLD_HEIGHT)


def _create_rvt(unreal, name, material_type):
    rvt, created = _create(unreal, name, unreal.RuntimeVirtualTexture,
                           unreal.RuntimeVirtualTextureFactory())
    if created:
        rvt.set_editor_property("material_type", material_type)
        if not unreal.EditorAssetLibrary.save_loaded_asset(rvt):
            raise RuntimeError("RVT save failed: " + name)
    elif rvt.get_editor_property("material_type") != material_type:
        raise RuntimeError("Existing RVT type mismatch: " + name)
    return rvt, created


def _place_volumes(unreal, surface_rvt, height_rvt):
    editor = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    present = {}
    for actor in editor.get_all_level_actors():
        for tag in actor.get_editor_property("tags"):
            tag = str(tag)
            if tag in ("TSM_MV_RVT_MATERIAL", "TSM_MV_RVT_HEIGHT"):
                if tag in present:
                    raise RuntimeError("Duplicate RVT volume tag: " + tag)
                present[tag] = actor
    count = 0
    for tag, name, asset in (
        ("TSM_MV_RVT_MATERIAL", "Material", surface_rvt),
        ("TSM_MV_RVT_HEIGHT", "Height", height_rvt),
    ):
        if tag in present:
            continue
        actor = editor.spawn_actor_from_class(
            unreal.RuntimeVirtualTextureVolume,
            unreal.Vector(0.0, 0.0, 0.0), unreal.Rotator(0.0, 0.0, 0.0))
        if actor is None:
            raise RuntimeError("Unreal failed to spawn " + tag)
        actor.set_actor_label("RVT_MountVernon_" + name + "_SetBounds")
        actor.set_folder_path("MountVernon/RVT")
        actor.set_editor_property("tags", [unreal.Name(tag), unreal.Name("BOUNDS_UNVERIFIED")])
        component = actor.get_editor_property("virtual_texture_component")
        component.set_editor_property("virtual_texture", asset)
        count += 1
    return count


def setup(*, create_volumes=True):
    """Create idempotent starter materials + both RVT assets in an open editor level.

    No auto-merge or replacement of existing user-created assets.
    Per-asset virtual resolution is intentionally NOT set until measurement.
    """
    import unreal
    surface_type, height_type = _material_types(unreal)
    surface_rvt, new_surface = _create_rvt(unreal, SURFACE, surface_type)
    height_rvt, new_height = _create_rvt(unreal, HEIGHT, height_type)
    created = []
    for name, builder in (
        (LANDSCAPE, _build_landscape),
        (ROAD, _build_road),
        (FOUNDATION, _build_foundation),
    ):
        mat, is_new = _create(unreal, name, unreal.Material, unreal.MaterialFactoryNew())
        if is_new:
            if name == LANDSCAPE:
                builder(unreal, mat)
            else:
                builder(unreal, mat, surface_rvt, height_rvt)
            created.append(name)
    volumes = _place_volumes(unreal, surface_rvt, height_rvt) if create_volumes else 0
    unreal.log_warning(
        "Created two Mount Vernon RVTs and starter materials; landscape components "
        "still need BOTH RVTs in Render to Virtual Textures; volumes need manually "
        "Set Bounds against the verified Landscape. Roads and foundations sample "
        "both RVTs, do not write them. Check material graph compile and headed RVT "
        "debug modes before release; neither elevations nor 60 FPS are verified.")
    return {
        "surface_rvt": ROOT + "/" + SURFACE, "height_rvt": ROOT + "/" + HEIGHT,
        "new_surface_rvt": new_surface, "new_height_rvt": new_height,
        "new_materials": created, "new_volumes": volumes, "bounds_verified": False,
    }


if __name__ == "__main__":
    setup()
