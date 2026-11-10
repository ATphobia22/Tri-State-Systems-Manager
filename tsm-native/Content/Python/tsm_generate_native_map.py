"""Generate the real TSM native World Partition level before Win64 Shipping cook.

Runs ONLY inside Unreal Editor 5.8, never in the packaged application.
The scene is an explicitly local-data-only startup, not validated hydrology.
"""
import json
import os
from pathlib import Path
import unreal

MAP_ASSET = "/Game/TSM/Maps/TSMNative"


def main():
    root = Path(unreal.Paths.convert_relative_path_to_full(
        unreal.Paths.project_dir())).resolve()
    staged = (root / "Content" / "TSMData").resolve(strict=True)
    manifest = staged / "data-manifest.json"
    if not manifest.is_file():
        raise RuntimeError("Refusing empty native scene: staged data-manifest.json absent")

    tileset_value = os.environ.get("TSM_LOCAL_TILESET", "").strip()
    if not tileset_value:
        raise RuntimeError("TSM_LOCAL_TILESET is required and must be staged under Content/TSMData")
    tileset = Path(tileset_value).resolve(strict=True)
    if not tileset.is_file() or tileset.name != "tileset.json":
        raise RuntimeError("Must supply real local tileset.json")
    try:
        tileset.relative_to(staged)
    except ValueError as exc:
        raise RuntimeError("Tileset must be inside verified TSMData staging") from exc

    data = json.loads(tileset.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or "root" not in data:
        raise RuntimeError("Tileset JSON lacks root; refusing to construct fake scene")

    levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if not unreal.EditorAssetLibrary.does_asset_exist(MAP_ASSET):
        if not levels.new_level(MAP_ASSET, is_partitioned_world=True):
            raise RuntimeError("UE5.8 could not generate partitioned TSMNative map")
    elif not levels.load_level(MAP_ASSET):
        raise RuntimeError("Existing native map failed to load")

    world = unreal.EditorLevelLibrary.get_editor_world()
    if not world or not world.get_world_partition():
        raise RuntimeError("Native map must be a genuine World Partition map")

    cls = unreal.load_class(None, "/Script/TSMNative.TSMOfflineTileset")
    if cls is None:
        raise RuntimeError("TSMNative editor target has not compiled")
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    found = [a for a in actors.get_all_level_actors() if a.get_class() == cls]
    if len(found) > 1:
        raise RuntimeError("Duplicate offline tileset actors; cannot choose silently")
    actor = found[0] if found else actors.spawn_actor_from_class(
        cls, unreal.Vector(0, 0, 0))
    if actor is None:
        raise RuntimeError("Failed to spawn native local 3D Tiles actor")
    actor.set_actor_label("TSM_OfflineBuildings")
    actor.set_editor_property("local_tileset_json_relative_path",
                              tileset.relative_to(root).as_posix())
    actor.set_editor_property("maximum_screen_space_error", 8.0)

    if not levels.save_current_level():
        raise RuntimeError("TSMNative World Partition level could not be saved")
    if not unreal.EditorAssetLibrary.does_asset_exist(MAP_ASSET):
        raise RuntimeError("Generated map does not exist as a UE asset")
    unreal.log("TSM_NATIVE_MAP_GENERATED: " + MAP_ASSET)
    unreal.log("TSM_NATIVE_TILESET_FILE: " + str(tileset))


if __name__ == "__main__":
    main()
