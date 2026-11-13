"""Generate the real TSM native World Partition level before Win64 Shipping cook.

Runs ONLY inside Unreal Editor 5.8, never in the packaged application.
The scene is an explicitly local-data-only startup, not validated hydrology.
"""
import hashlib
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

    source_manifest = json.loads(manifest.read_text(encoding="utf-8"))
    tracked = {
        str(item["path"]): str(item["sha256"]).lower()
        for item in source_manifest.get("files", [])
    }

    def audited_local_tileset(file_path):
        if file_path.name != "tileset.json" or not file_path.is_file():
            raise RuntimeError("A real local 3D Tiles tileset.json is mandatory")
        try:
            relative = file_path.relative_to(staged).as_posix()
        except ValueError as exc:
            raise RuntimeError("Tileset escapes the source-verified TSMData root") from exc
        size = file_path.stat().st_size
        if not 0 < size <= 32 * 1024 * 1024:
            raise RuntimeError("3D Tiles catalog missing or exceeds 32 MiB")
        sha = hashlib.sha256(file_path.read_bytes()).hexdigest()
        if tracked.get(relative) != sha:
            raise RuntimeError("3D Tiles catalog SHA256 is not in native data-manifest")
        tile_json = json.loads(file_path.read_text(encoding="utf-8"))
        if not isinstance(tile_json, dict) or "root" not in tile_json:
            raise RuntimeError("Invalid 3D Tiles root; no placeholder mesh permitted")
        return relative, sha

    buildings_relative, buildings_sha = audited_local_tileset(tileset)
    terrain_value = os.environ.get("TSM_LOCAL_TERRAIN_TILESET", "").strip()
    if not terrain_value:
        raise RuntimeError("TSM_LOCAL_TERRAIN_TILESET is required for genuine native terrain")
    terrain_tileset = Path(terrain_value).resolve(strict=True)
    terrain_relative, terrain_sha = audited_local_tileset(terrain_tileset)
    if terrain_relative == buildings_relative:
        raise RuntimeError("Terrain and buildings must be independent source 3D Tilesets")

    levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if not unreal.EditorAssetLibrary.does_asset_exist(MAP_ASSET):
        if not levels.new_level(MAP_ASSET, is_partitioned_world=True):
            raise RuntimeError("UE5.8 could not generate partitioned TSMNative map")
    elif not levels.load_level(MAP_ASSET):
        raise RuntimeError("Existing native map failed to load")

    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    if not world:
        raise RuntimeError("Native editor world unavailable after level creation")
    # NewLevel(..., is_partitioned_world=True) creates the partitioned world.
    # C++ game-mode runtime gate separately reports absent World Partition.

    cls = unreal.load_class(None, "/Script/TSMNative.TSMOfflineTileset")
    if cls is None:
        raise RuntimeError("TSMNative editor target has not compiled")
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    def configure_layer(label, kind, absolute_path, relative_path, sha256):
        found = [
            a for a in actors.get_all_level_actors()
            if a.get_class() == cls and a.get_actor_label() == label
        ]
        if len(found) > 1:
            raise RuntimeError("Duplicate offline Cesium layer actor: " + label)
        actor = found[0] if found else actors.spawn_actor_from_class(
            cls, unreal.Vector(0, 0, 0))
        if actor is None:
            raise RuntimeError("Unable to create local Cesium actor: " + label)
        actor.set_actor_label(label)
        actor.set_editor_property("local_tileset_json_relative_path",
                                  absolute_path.relative_to(root).as_posix())
        actor.set_editor_property("maximum_screen_space_error", 8.0)
        actor.set_editor_property("layer_kind", kind)
        actor.set_editor_property("source_id", "TSMData/" + relative_path)
        actor.set_editor_property("source_sha256", sha256)
        unreal.log("TSM_LAYER_STAGED: " + kind + " sha256=" + sha256)

    configure_layer("TSM_OfflineBuildings", "buildings", tileset,
                    buildings_relative, buildings_sha)
    configure_layer("TSM_OfflineTerrain", "terrain", terrain_tileset,
                    terrain_relative, terrain_sha)

    roads_value = os.environ.get("TSM_LOCAL_ROADS_TILESET", "").strip()
    if roads_value:
        roads_tileset = Path(roads_value).resolve(strict=True)
        roads_relative, roads_sha = audited_local_tileset(roads_tileset)
        if roads_relative in (buildings_relative, terrain_relative):
            raise RuntimeError("Roads cannot alias another 3D Tiles layer")
        configure_layer("TSM_OfflineRoads", "roads", roads_tileset,
                        roads_relative, roads_sha)

    if not levels.save_current_level():
        raise RuntimeError("TSMNative World Partition level could not be saved")
    if not unreal.EditorAssetLibrary.does_asset_exist(MAP_ASSET):
        raise RuntimeError("Generated map does not exist as a UE asset")
    unreal.log("TSM_NATIVE_MAP_GENERATED: " + MAP_ASSET)
    unreal.log("TSM_NATIVE_TILESET_FILE: " + str(tileset))


if __name__ == "__main__":
    main()
