"""UE5.8 editor-only importer for evidence-labeled Mount Vernon DEM preview GLBs.

Run in Python Editor Script Plugin after unpacking the Drive preview archive,
opening and SAVING a World Partition map, and setting TSM_MV_TILES_DIR to
the extracted folder holding manifest.json and unreal-placements.json.

Editor-only, never packaged runtime. Sources are NOT NAVD88-certified.
"""
import json
import os
from pathlib import Path
import unreal

root = Path(os.environ["TSM_MV_TILES_DIR"]).expanduser().resolve()
manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
placements = json.loads((root / "unreal-placements.json").read_text(encoding="utf-8"))
if manifest.get("verticalEvidence") != "PENDING_EVIDENCE":
    raise RuntimeError("Preview importer expects unverified vertical evidence label")
if manifest.get("meshTileCount") != len(placements.get("actors", [])):
    raise RuntimeError("Preview manifest actor count mismatch")
if manifest.get("meshTileCount") != 32:
    raise RuntimeError("Unexpected preview tile inventory: inspect data before import")
if not unreal.EditorLevelLibrary.get_editor_world():
    raise RuntimeError("Save and open a real World Partition level before importing")

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
editor_actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
if editor_actors is None:
    raise RuntimeError("Missing EditorActorSubsystem; requires UE5.8 Editor")
for item in placements["actors"]:
    source = (root / item["asset"]).resolve()
    if not source.is_relative_to(root) or not source.is_file() or source.suffix.lower() != ".glb":
        raise RuntimeError("Missing/unsafe preview GLB: " + str(source))
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", str(source))
    task.set_editor_property("destination_path", "/Game/TSM/MountVernon/PreviewTerrain")
    task.set_editor_property("automated", True)
    task.set_editor_property("save", True)
    task.set_editor_property("replace_existing", False)
    asset_tools.import_asset_tasks([task])
    mesh = None
    for asset_path in task.get_editor_property("imported_object_paths"):
        imported = unreal.EditorAssetLibrary.load_asset(asset_path)
        if isinstance(imported, unreal.StaticMesh):
            mesh = imported
            break
    if mesh is None:
        raise RuntimeError("glTF Interchange import failed for " + str(source))
    actor = editor_actors.spawn_actor_from_class(
        unreal.StaticMeshActor,
        unreal.Vector(*item["worldLocationCm"]),
        unreal.Rotator(0, item["worldYawDegrees"], 0)
    )
    actor.set_actor_label("DEMO_UNVERIFIED_" + item["name"])
    actor.static_mesh_component.set_static_mesh(mesh)
    actor.set_editor_property(
        "tags",
        [unreal.Name("PENDING_EVIDENCE"), unreal.Name("SIMULATION_DEMO"),
         unreal.Name("NOT_A_REGULATORY_DETERMINATION")]
    )

unreal.log_warning(
    "Mount Vernon: imported 32 visual-preview mesh actors. "
    "Vertical source units/datum not independently verified; DO NOT use as NAVD88 engineering terrain. "
    "Save the World Partition map and run a headed native render before release."
)
