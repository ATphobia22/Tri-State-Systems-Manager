"""Run from Unreal Editor 5.8 using the built-in PythonScriptPlugin.

Creates an actual World Partition binary map on the operator's UE workstation.
Does NOT insert fabricated terrain, source buildings, AOIs or geodetic control.
Idempotent: never overwrite an existing TSM level.
"""
import unreal

TARGET = "/Game/Maps/TSMRegion"
subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)

if unreal.EditorAssetLibrary.does_asset_exist(TARGET):
    unreal.log("TSM World Partition map already exists; preserving asset: " + TARGET)
else:
    if not subsystem.new_level(TARGET, is_partitioned_world=True):
        raise RuntimeError("UE5.8 LevelEditorSubsystem.new_level(is_partitioned_world=True) failed")
    unreal.log("TSM World Partition map created and saved: " + TARGET)
    unreal.log_warning(
        "Map is an EMPTY partitioned level. Import authoritative/verified terrain and "
        "set World Settings > World Partition > Enable Streaming before Shipping."
    )

if not unreal.EditorAssetLibrary.does_asset_exist(TARGET):
    raise RuntimeError("World Partition map was not persisted to disk")
unreal.log("TSM map evidence: project-owned UE5.8 asset exists at " + TARGET)
