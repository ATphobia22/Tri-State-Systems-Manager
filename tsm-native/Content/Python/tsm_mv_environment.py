"""Unreal Engine 5.8 Editor-only environment Material Parameter Collection creator.

No player pawn, weather physics, real stage or SunSky actor is fabricated here.
Materials must explicitly reference the collection's parameters and a native
runtime controller must update the same MPC to support an interactive HUD.
"""
from __future__ import annotations

from tsm_mv_environment_contract import (
    ENVIRONMENT_SCALARS, WIND_DEFAULT_STRENGTH, WIND_XY,
    material_parameters, preset,
)

PATH = "/Game/TSM/MountVernon/Materials/MPC_MountVernon_Environment"


def setup():
    import unreal

    collection = unreal.EditorAssetLibrary.load_asset(PATH)
    if collection is not None:
        if not isinstance(collection, unreal.MaterialParameterCollection):
            raise RuntimeError("MPC asset path occupied by a different type: " + PATH)
        needed = set(ENVIRONMENT_SCALARS)
        observed = {str(x) for x in collection.get_scalar_parameter_names()}
        if not needed.issubset(observed):
            raise RuntimeError("Existing MPC has incompatible scalar parameters")
        vectors = {str(x) for x in collection.get_vector_parameter_names()}
        if "WindDirectionAndSpeed" not in vectors:
            raise RuntimeError("Existing MPC is missing WindDirectionAndSpeed")
        return collection, False

    asset = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        "MPC_MountVernon_Environment", "/Game/TSM/MountVernon/Materials",
        unreal.MaterialParameterCollection,
        unreal.MaterialParameterCollectionFactoryNew())
    if asset is None:
        raise RuntimeError("Unable to create Mount Vernon MPC")
    scalars = [
        unreal.CollectionScalarParameter(
            parameter_name=unreal.Name(name), default_value=float(value))
        for name, value in ENVIRONMENT_SCALARS.items()
    ]
    direction_length = (WIND_XY[0]**2 + WIND_XY[1]**2)**0.5
    wind = unreal.LinearColor(
        WIND_XY[0] / direction_length, WIND_XY[1] / direction_length,
        0.0, WIND_DEFAULT_STRENGTH)
    vectors = [
        unreal.CollectionVectorParameter(
            parameter_name=unreal.Name("WindDirectionAndSpeed"), default_value=wind)
    ]
    asset.set_editor_property("scalar_parameters", scalars)
    asset.set_editor_property("vector_parameters", vectors)
    if not unreal.EditorAssetLibrary.save_loaded_asset(asset):
        raise RuntimeError("Cannot save " + PATH)
    unreal.log("Created MPC_MountVernon_Environment (cinematic-only defaults)")
    return asset, True


def apply_preset(preset_name):
    """Apply MPC values to opened Editor world, not to fabricated physical weather."""
    import unreal

    scene = preset(preset_name)
    asset, _ = setup()
    world = unreal.EditorLevelLibrary.get_editor_world()
    if not world:
        raise RuntimeError("Open the Mount Vernon map before applying a preset")
    values = material_parameters(preset_name)
    for name, value in values["scalar"].items():
        unreal.KismetMaterialLibrary.set_scalar_parameter_value(
            world, asset, unreal.Name(name), float(value))
    for name, rgba in values["vector"].items():
        unreal.KismetMaterialLibrary.set_vector_parameter_value(
            world, asset, unreal.Name(name), unreal.LinearColor(*rgba))
    unreal.log_warning(
        "Applied CINEMATIC/NOT OBSERVED environmental palette " + preset_name +
        "; no SunSky, Niagara, real weather, wildlife or hydrology actors controlled. "
        "Set SunSky's geographic local time and DST explicitly before screenshots.")
    return scene


if __name__ == "__main__":
    setup()
