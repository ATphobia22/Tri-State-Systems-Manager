"""UE5.8 Editor-only, non-destructive RVT material authoring templates.

Creates assets and graph connections; intentionally DOES NOT assign a material
to an engineering landscape, change a native elevation mesh, or silently alter
World Partition/RVT bounds.
"""
import unreal

FOLDER = "/Game/TSM/MountVernon/Materials"
RVT_NAME = "RVT_TSM_MV_Surface"
LANDSCAPE_NAME = "M_TSM_MV_LandscapeRVTWriter"
ROAD_NAME = "M_TSM_MV_RoadEdgeBlend"
FOUNDATION_NAME = "M_TSM_MV_FoundationEdgeBlend"


def _asset(name, asset_cls, factory):
    path = FOLDER + "/" + name
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        found = unreal.EditorAssetLibrary.load_asset(path)
        if not isinstance(found, asset_cls):
            raise RuntimeError("Asset name collision with incompatible class: " + path)
        return found, False
    created = unreal.AssetToolsHelpers.get_asset_tools().create_asset(name, FOLDER, asset_cls, factory)
    if created is None:
        raise RuntimeError("Unreal asset creation failed: " + path)
    return created, True


def _node(material, cls, x, y):
    result = unreal.MaterialEditingLibrary.create_material_expression(material, cls, x, y)
    if result is None:
        raise RuntimeError("Failed creating material expression " + str(cls))
    return result


def _connect(source, source_pin, target, pin):
    if not unreal.MaterialEditingLibrary.connect_material_expressions(source, source_pin, target, pin):
        raise RuntimeError("Unreal material expression connection failed: " + source_pin + " -> " + pin)


def _param_color(material, name, rgba, x, y):
    node = _node(material, unreal.MaterialExpressionVectorParameter, x, y)
    node.set_editor_property("parameter_name", unreal.Name(name))
    node.set_editor_property("default_value", unreal.LinearColor(*rgba))
    return node


def _param_scalar(material, name, value, x, y):
    node = _node(material, unreal.MaterialExpressionScalarParameter, x, y)
    node.set_editor_property("parameter_name", unreal.Name(name))
    node.set_editor_property("default_value", float(value))
    return node


def _finish(mat):
    unreal.MaterialEditingLibrary.recompile_material(mat)
    if not unreal.EditorAssetLibrary.save_loaded_asset(mat):
        raise RuntimeError("Failed saving material: " + mat.get_path_name())


def _writer(material):
    # Template colors ONLY; replace with licensed surveyed imagery/PBR layer logic.
    base = _param_color(material, "Terrain_VisualPreview_Color", (0.28, 0.24, 0.17, 1.0), -700, -250)
    rough = _param_scalar(material, "Terrain_VisualPreview_Roughness", 0.82, -700, 80)
    out = _node(material, unreal.MaterialExpressionRuntimeVirtualTextureOutput, -240, 220)
    _connect(base, "", out, "BaseColor")
    _connect(rough, "", out, "Roughness")
    if not unreal.MaterialEditingLibrary.connect_material_property(
            base, "", unreal.MaterialProperty.MP_BASE_COLOR):
        raise RuntimeError("Failed connecting writer BaseColor")
    if not unreal.MaterialEditingLibrary.connect_material_property(
            rough, "", unreal.MaterialProperty.MP_ROUGHNESS):
        raise RuntimeError("Failed connecting writer Roughness")
    _finish(material)


def _blend(material, rvt, kind):
    # Vertex alpha is an EDGE WEIGHT that must be authored in the road/foundation
    # mesh. A=0 blends with terrain; A=1 preserves the engineered mesh surface.
    sample = _node(material, unreal.MaterialExpressionRuntimeVirtualTextureSample, -790, -170)
    sample.set_editor_property("virtual_texture", rvt)
    sample_type = sample.get_editor_property("material_type")
    rvt_type = rvt.get_editor_property("material_type")
    if sample_type != rvt_type:
        sample.set_editor_property("material_type", rvt_type)
    color = ((0.055, 0.052, 0.049, 1.0) if kind == "road"
             else (0.30, 0.29, 0.26, 1.0))
    surface = _param_color(material, kind.title() + "_VisualPreview_Color", color, -790, -430)
    vertex = _node(material, unreal.MaterialExpressionVertexColor, -790, -670)
    blend = _node(material, unreal.MaterialExpressionLinearInterpolate, -330, -170)
    _connect(sample, "BaseColor", blend, "A")
    _connect(surface, "", blend, "B")
    _connect(vertex, "A", blend, "Alpha")
    if not unreal.MaterialEditingLibrary.connect_material_property(
            blend, "", unreal.MaterialProperty.MP_BASE_COLOR):
        raise RuntimeError("Failed connecting " + kind + " BaseColor")
    rough = _param_scalar(material, kind.title() + "_Roughness", 0.72, -330, 150)
    rough_blend = _node(material, unreal.MaterialExpressionLinearInterpolate, 90, 160)
    # Match the road/foundation roughness transition to the same vertex alpha
    # as its base-color transition (normal tangent-space QA remains a manual gate).
    _connect(sample, "Roughness", rough_blend, "A")
    _connect(rough, "", rough_blend, "B")
    _connect(vertex, "A", rough_blend, "Alpha")
    if not unreal.MaterialEditingLibrary.connect_material_property(
            rough_blend, "", unreal.MaterialProperty.MP_ROUGHNESS):
        raise RuntimeError("Failed connecting " + kind + " Roughness")
    _finish(material)


def create_rvt_assets():
    rvt, was_new = _asset(RVT_NAME, unreal.RuntimeVirtualTexture, unreal.RuntimeVirtualTextureFactory())
    if was_new and not unreal.EditorAssetLibrary.save_loaded_asset(rvt):
        raise RuntimeError("Failed saving RVT asset")
    created = [FOLDER + "/" + RVT_NAME]
    for name, builder, args in (
        (LANDSCAPE_NAME, _writer, ()),
        (ROAD_NAME, _blend, (rvt, "road")),
        (FOUNDATION_NAME, _blend, (rvt, "foundation")),
    ):
        material, was_new = _asset(name, unreal.Material, unreal.MaterialFactoryNew())
        if was_new:
            builder(material, *args)
        created.append(FOLDER + "/" + name)
    unreal.log_warning(
        "MOUNT VERNON RVT: asset graph templates exist. No RVT volume or material "
        "assignment was made. Verify RVT asset material type, place/size a Runtime "
        "Virtual Texture Volume, register the Landscape as writer, route actual "
        "road/foundation meshes through vertex-alpha edge masks, then GPU-test."
    )
    return created
