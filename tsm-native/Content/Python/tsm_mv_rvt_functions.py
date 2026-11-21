"""Reusable UE5.8 MaterialFunction authoring for two-RVT contact blending.

The functions have explicit inputs so they can be reused by a *final* masonry,
sidewalk or asphalt master material without hard-binding to project RVT assets.
They emit color/roughness/alpha; no unsafe mixed-space normal interpolation.
Build in Editor. Does not replace/overwrite existing user material functions.
"""
from __future__ import annotations

import tsm_mv_rvt

ROOT = "/Game/TSM/MountVernon/Materials/RVT"
FOUNDATION_NAME = "MF_RVT_FoundationBlend"
ROAD_NAME = "MF_RVT_RoadEdgeBlend"


def _add(unreal, function, cls, x, y):
    node = unreal.MaterialEditingLibrary.create_material_expression_in_function(
        function, cls, x, y)
    if node is None:
        raise RuntimeError("Unable to add material function expression: " + str(cls))
    return node


def _input(unreal, function, name, vector, index):
    node = _add(unreal, function, unreal.MaterialExpressionFunctionInput,
                -900, index * 220)
    node.set_editor_property("input_name", unreal.Name(name))
    node.set_editor_property(
        "input_type", unreal.FunctionInputType.FUNCTION_INPUT_VECTOR3
        if vector else unreal.FunctionInputType.FUNCTION_INPUT_SCALAR)
    node.set_editor_property("sort_priority", index)
    return node


def _math(unreal, function, cls, a, b=None):
    n = _add(unreal, function, cls, 0, 0)
    tsm_mv_rvt._wire(unreal, a, n, ("A", "Input"))
    if b is not None:
        tsm_mv_rvt._wire(unreal, b, n, ("B",))
    return n


def _pow(unreal, function, source, exponent):
    n = _add(unreal, function, unreal.MaterialExpressionPower, 0, 0)
    tsm_mv_rvt._wire(unreal, source, n, ("Base",))
    tsm_mv_rvt._wire(unreal, exponent, n, ("Exp", "Exponent"))
    return n


def _saturate(unreal, function, source):
    n = _add(unreal, function, unreal.MaterialExpressionSaturate, 0, 0)
    tsm_mv_rvt._wire(unreal, source, n, ("Input",))
    return n


def _blend(unreal, function, a, b, alpha):
    n = _add(unreal, function, unreal.MaterialExpressionLinearInterpolate, 0, 0)
    for source, pin in ((a, "A"), (b, "B"), (alpha, "Alpha")):
        tsm_mv_rvt._wire(unreal, source, n, (pin,))
    return n


def _output(unreal, function, name, source, index):
    node = _add(unreal, function, unreal.MaterialExpressionFunctionOutput,
                800, index * 220)
    node.set_editor_property("output_name", unreal.Name(name))
    node.set_editor_property("sort_priority", index)
    tsm_mv_rvt._wire(unreal, source, node, ("A", "Input"))


def _contact(unreal, function, pixel, ground, span, exponent):
    dz = _math(unreal, function, unreal.MaterialExpressionSubtract, pixel, ground)
    ratio = _math(unreal, function, unreal.MaterialExpressionDivide, dz, span)
    clamped = _saturate(unreal, function, ratio)
    return _pow(unreal, function, clamped, exponent)


def _build_foundation(unreal, function):
    inputs = [
        ("TerrainColor", True), ("ObjectColor", True),
        ("TerrainRoughness", False), ("ObjectRoughness", False),
        ("PixelWorldZCm", False), ("LandscapeWorldZCm", False),
        ("BlendHeightCm", False), ("BlendExponent", False),
        ("ContactDarken", False)
    ]
    p = {name: _input(unreal, function, name, vector, i)
         for i, (name, vector) in enumerate(inputs)}
    alpha = _contact(unreal, function, p["PixelWorldZCm"],
                     p["LandscapeWorldZCm"], p["BlendHeightCm"], p["BlendExponent"])
    darkened = _math(unreal, function, unreal.MaterialExpressionMultiply,
                     p["TerrainColor"], p["ContactDarken"])
    color = _blend(unreal, function, darkened, p["ObjectColor"], alpha)
    roughness = _blend(unreal, function, p["TerrainRoughness"], p["ObjectRoughness"], alpha)
    for i, (name, value) in enumerate(
            (("BlendedBaseColor", color), ("BlendedRoughness", roughness),
             ("BlendAlpha", alpha))):
        _output(unreal, function, name, value, i)


def _build_road(unreal, function):
    inputs = [
        ("TerrainColor", True), ("RoadColor", True),
        ("TerrainRoughness", False), ("RoadRoughness", False),
        ("EdgeCoverage", False), ("PixelWorldZCm", False),
        ("LandscapeWorldZCm", False), ("MaxContactDeltaCm", False)
    ]
    p = {name: _input(unreal, function, name, vector, i)
         for i, (name, vector) in enumerate(inputs)}
    dz = _math(unreal, function, unreal.MaterialExpressionSubtract,
               p["PixelWorldZCm"], p["LandscapeWorldZCm"])
    distance = _add(unreal, function, unreal.MaterialExpressionAbs, 0, 0)
    tsm_mv_rvt._wire(unreal, dz, distance, ("Input",))
    ratio = _math(unreal, function, unreal.MaterialExpressionDivide,
                  distance, p["MaxContactDeltaCm"])
    contact = _saturate(unreal, function, ratio)
    alpha = _math(unreal, function, unreal.MaterialExpressionMax,
                  p["EdgeCoverage"], contact)
    color = _blend(unreal, function, p["TerrainColor"], p["RoadColor"], alpha)
    roughness = _blend(unreal, function, p["TerrainRoughness"], p["RoadRoughness"], alpha)
    for i, (name, value) in enumerate(
            (("BlendedBaseColor", color), ("BlendedRoughness", roughness),
             ("BlendAlpha", alpha))):
        _output(unreal, function, name, value, i)


def setup():
    """Idempotently create two new reusable functions in an actual UE5.8 Editor."""
    import unreal

    made = []
    for name, builder in ((FOUNDATION_NAME, _build_foundation),
                          (ROAD_NAME, _build_road)):
        path = ROOT + "/" + name
        existing = unreal.EditorAssetLibrary.load_asset(path)
        if existing is not None:
            if not isinstance(existing, unreal.MaterialFunction):
                raise RuntimeError("Conflicting type at " + path)
            continue
        asset = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
            name, ROOT, unreal.MaterialFunction, unreal.MaterialFunctionFactoryNew())
        if asset is None:
            raise RuntimeError("Failed to create material function " + name)
        builder(unreal, asset)
        unreal.MaterialEditingLibrary.layout_material_function_expressions(asset)
        unreal.MaterialEditingLibrary.update_material_function(asset)
        if not unreal.EditorAssetLibrary.save_loaded_asset(asset):
            raise RuntimeError("Failed to save material function " + name)
        made.append(path)
    unreal.log("TSM reusable RVT MaterialFunctions staged: " + str(made))
    return made


if __name__ == "__main__":
    setup()
