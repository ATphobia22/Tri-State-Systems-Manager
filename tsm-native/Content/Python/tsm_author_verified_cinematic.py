"""Author a 5+ minute multi-camera LevelSequence from a validated TSM manifest.

Editor-only, to run from the real native UE5.8 project with Python Script Plugin and
Sequencer Scripting enabled. Does NOT synthesize real terrain/buildings or flood results.

Launch via UnrealEditor-Cmd -ExecutePythonScript=... with env:
  TSM_CINEMATIC_MANIFEST=.../production-manifest.json
  TSM_CINEMATIC_PREFLIGHT=.../preflight.json
An editor session loading /Game/TSM/Maps/TSMNative is required.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import unreal


def main():
    manifest = Path(os.environ["TSM_CINEMATIC_MANIFEST"])
    receipt = Path(os.environ["TSM_CINEMATIC_PREFLIGHT"])
    data = json.loads(manifest.read_text(encoding="utf-8"))
    proof = json.loads(receipt.read_text(encoding="utf-8"))
    if proof.get("result") != "SOURCE_CHECKSUMS_VALIDATED_ONLY":
        raise RuntimeError("A successful source-checksum receipt is required")
    if data.get("schema") != "tsm.cinematic.production.v1" or proof.get("shot_count") != len(data["shots"]):
        raise RuntimeError("Invalid cinematic manifest or preflight mismatch")
    if data.get("sequence") != "/Game/TSM/Cinematics/LS_TSMCommunity.LS_TSMCommunity":
        raise RuntimeError("Unexpected sequence destination: no silent overwrite")
    if unreal.EditorAssetLibrary.does_asset_exist(data["sequence"]):
        raise RuntimeError("LevelSequence already exists. Review, version or remove it explicitly.")
    unreal.EditorAssetLibrary.make_directory("/Game/TSM/Cinematics")
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    sequence = tools.create_asset(
        "LS_TSMCommunity", "/Game/TSM/Cinematics",
        unreal.LevelSequence, unreal.LevelSequenceFactoryNew()
    )
    if not sequence:
        raise RuntimeError("Failed to create a real LevelSequence .uasset")
    fps = int(data["fps"])
    sequence.set_display_rate(unreal.FrameRate(fps, 1))
    sequence.set_playback_start(0)
    sequence.set_playback_end(int(proof["expected_frames"]))
    actor_api = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    cuts = sequence.add_master_track(unreal.MovieSceneCameraCutTrack)
    channel_order = (
        ("Location.X", 0), ("Location.Y", 1), ("Location.Z", 2),
        ("Rotation.X", 0), ("Rotation.Y", 1), ("Rotation.Z", 2),
    )
    for shot in data["shots"]:
        camera = actor_api.spawn_actor_from_class(unreal.CineCameraActor, unreal.Vector(0, 0, 0))
        if camera is None:
            raise RuntimeError("CineCameraActor could not be spawned")
        camera.set_actor_label("TSM_Cine_" + shot["id"])
        camera_binding = sequence.add_possessable(camera)
        track = camera_binding.add_track(unreal.MovieScene3DTransformTrack)
        section = track.add_section()
        start = int(shot["start_frame"])
        end = start + int(shot["frames"])
        section.set_range(start, end)
        channels = section.get_channels()
        if len(channels) < 6:
            raise RuntimeError("UE5.8 did not expose expected transform channels")
        for key in shot["camera_keys"]:
            frame = start + int(key["frame"])
            values = key["world_cm"] + key["rotation_deg"]
            for index in range(6):
                channels[index].add_key(unreal.FrameNumber(frame), float(values[index]))
        cut = cuts.add_section()
        cut.set_range(start, end)
        binding_id = unreal.MovieSceneSequenceExtensions.get_binding_id(sequence, camera_binding)
        cut.set_camera_binding_id(binding_id)
    if not unreal.EditorAssetLibrary.save_loaded_asset(sequence):
        raise RuntimeError("Saving authored LevelSequence failed")
    if not unreal.EditorLevelLibrary.save_current_level():
        raise RuntimeError("Saving map with cinematic cameras failed")
    unreal.log("TSM_CINEMATIC_SEQUENCE_AUTHORED=" + data["sequence"])
    unreal.log_warning(
        "Camera authoring verified only. Source asset placements, terrain, water effects, "
        "visual alignment, full headed rendering and complete UE Shipping evidence remain separate."
    )


if __name__ == "__main__":
    main()
