"""Run ONCE in UE Editor: create BP_TSM_MountVernonTownGenerator from native EUW class.

Requires a successful C++ Editor build. Never overwrite an existing widget asset.
"""
import unreal

PACKAGE = "/Game/TSM/Editor"
NAME = "BP_TSM_MountVernonTownGenerator"
ASSET = PACKAGE + "/" + NAME
if unreal.EditorAssetLibrary.does_asset_exist(ASSET):
    widget = unreal.EditorAssetLibrary.load_asset(ASSET)
else:
    parent = getattr(unreal, "TSMMountVernonGeneratorWidget", None)
    if parent is None:
        raise RuntimeError("Editor widget native class missing; compile TSMMountVernonEditor plugin")
    factory = unreal.EditorUtilityWidgetBlueprintFactory()
    factory.set_editor_property("parent_class", parent.static_class())
    widget = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        NAME, PACKAGE, unreal.EditorUtilityWidgetBlueprint, factory
    )
    if widget is None:
        raise RuntimeError("EditorUtilityWidgetBlueprint creation failed")
    unreal.EditorAssetLibrary.save_loaded_asset(widget)
unreal.get_editor_subsystem(unreal.EditorUtilitySubsystem).spawn_and_register_tab(widget)
unreal.log("Mount Vernon Editor Utility Widget: " + ASSET)
