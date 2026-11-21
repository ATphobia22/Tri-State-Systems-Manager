"""UE5.8 editor-only Mount Vernon source-vector importer.

Call run() from the Editor Utility Widget after staging a checked local scene.
This creates source-linked PCG spline carriers; it does NOT generate roofs,
reshape the landscape, import heightmaps or certify elevations.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path

from tsm_mv_scene_contract import ROLES, load_scene, sha256_file


def _uid(role, feature_id):
    return hashlib.sha256((role + ":" + feature_id).encode("utf-8")).hexdigest()[:24]


def _tag_strings(actor):
    return {str(t) for t in actor.get_editor_property("tags")}


def _tags(role, uid, manifest_sha):
    return [
        "TSM_MV_GENERATED",
        "MV_" + role.upper(),
        "MV_UID_" + uid,
        "MV_MANIFEST_" + manifest_sha[:20],
        "PENDING_EVIDENCE",
    ]


def _ensure_editor(unreal):
    if not unreal.EditorLevelLibrary.get_editor_world():
        raise RuntimeError("Open and save a World Partition level before generating")
    cls = getattr(unreal, "TSMGeoSplineActor", None)
    if cls is None:
        raise RuntimeError("TSMGeoSplineActor is not compiled; build TSMNative Editor target first")
    return unreal.get_editor_subsystem(unreal.EditorActorSubsystem), cls


def _existing_index(editor):
    found = {}
    for actor in editor.get_all_level_actors():
        tags = _tag_strings(actor)
        if "TSM_MV_GENERATED" not in tags:
            continue
        uid_tags = [tag for tag in tags if tag.startswith("MV_UID_")]
        if len(uid_tags) != 1 or uid_tags[0] in found:
            raise RuntimeError("Ambiguous generated actor identity in loaded level")
        found[uid_tags[0]] = tags
    return found


def _write_spline(unreal, spline, points, position, base_z, *, closed):
    spline.clear_spline_points(update_spline=False)
    for i, point in enumerate(points[:-1] if closed else points):
        z = point[2] if len(point) == 3 else 0.0
        delta = unreal.Vector(point[0] - position[0], point[1] - position[1], z - base_z)
        spline.add_spline_point(delta, unreal.SplineCoordinateSpace.LOCAL, False)
        spline.set_spline_point_type(i, unreal.SplinePointType.LINEAR, False)
    spline.set_closed_loop(closed, update_spline=True)


def _spawn_spline(unreal, editor, actor_class, role, feature, sha, manifest_sha):
    points = feature["points"]
    position = points[0]
    base_z = position[2] if len(position) == 3 else 0.0
    origin = unreal.Vector(position[0], position[1], base_z)
    actor = editor.spawn_actor_from_class(actor_class, origin, unreal.Rotator(0.0, 0.0, 0.0))
    if actor is None:
        raise RuntimeError("EditorActorSubsystem.spawn_actor_from_class returned null")
    try:
        props = feature["properties"]
        uid = _uid(role, feature["id"])
        actor.set_actor_label("MV_" + role[:-1].upper() + "_" + uid[:16])
        actor.set_folder_path("MountVernon/" + role.title())
        actor.set_editor_property("tags", [unreal.Name(x) for x in _tags(role, uid, manifest_sha)])
        actor.set_editor_property("feature_id", feature["id"])
        actor.set_editor_property("feature_kind", role)
        actor.set_editor_property("source_sha256", sha)
        actor.set_editor_property("evidence_status", "PENDING_EVIDENCE")
        actor.set_editor_property("height_cm", float(props.get("height_cm", 0)))
        actor.set_editor_property("eave_cm", float(props.get("eave_cm", 0)))
        actor.set_editor_property("width_cm", float(props.get("width_cm", 0)))
        actor.set_editor_property("roof_type", str(props.get("roof_type", "unknown")))
        _write_spline(unreal, actor.get_editor_property("geometry_spline"),
                      points, position, base_z, closed=feature["closed"])
        for ring in feature["interior_rings"]:
            interior = actor.add_interior_ring_spline()
            if interior is None:
                raise RuntimeError("Failed creating interior spline for " + feature["id"])
            _write_spline(unreal, interior, ring, position, base_z, closed=True)
    except Exception:
        editor.destroy_actor(actor)
        raise
    return actor


def run(scene_dir=None, *, dry_run=False, save_map=False):
    """Preflight entire scene and avoid duplicate or partial additive imports.

    Re-running identical manifests skips already loaded actors. Different
    manifests on the same stable IDs raise; editing/replacing requires review.
    World Partition *unloaded* actors must be inspected separately before import.
    """
    import unreal

    root = Path(scene_dir or os.environ.get("TSM_MV_SCENE_DIR", "")).expanduser()
    if not str(root) or not root.is_dir():
        raise RuntimeError("Set TSM_MV_SCENE_DIR to a local folder with a manifest")
    manifest, layers = load_scene(root)
    digest = sha256_file(root / "manifest.json")
    editor, actor_class = _ensure_editor(unreal)
    existing = _existing_index(editor)
    jobs = []
    skipped = 0
    for role in ROLES:
        for feature in layers[role]:
            uid_tag = "MV_UID_" + _uid(role, feature["id"])
            old = existing.get(uid_tag)
            if old is not None:
                if "MV_MANIFEST_" + digest[:20] not in old:
                    raise RuntimeError(
                        "Existing loaded generated feature has different manifest: " + feature["id"])
                skipped += 1
            else:
                jobs.append((role, feature))
    summary = {
        "total": sum(len(v) for v in layers.values()),
        "skipped": skipped,
        "to_spawn": len(jobs),
        "manifest_sha256": digest,
        "vertical_datum": manifest["vertical_datum"],
        "evidence_status": "PENDING_EVIDENCE",  # independent review gate always retained
    }
    if dry_run:
        unreal.log("TSM Mount Vernon dry run: " + str(summary))
        return summary
    # A high density tree layer should be instanced/PCG sourced rather than
    # spawning unbounded individual editor actors.
    if len(layers["trees"]) > 10000:
        raise RuntimeError("Over 10,000 trees: first tile/instance the canopy layer for PCG")
    created = []
    try:
        with unreal.ScopedSlowTask(len(jobs), "Importing checked Mount Vernon source vectors") as task:
            task.make_dialog(True)
            for role, feature in jobs:
                if task.should_cancel():
                    raise RuntimeError("Operator cancelled import; rolling back spawned actors")
                task.enter_progress_frame(1)
                if role == "trees":
                    point = feature["points"][0]
                    z = point[2] if len(point) == 3 else 0.0
                    actor = editor.spawn_actor_from_class(
                        unreal.TargetPoint, unreal.Vector(point[0], point[1], z),
                        unreal.Rotator(0.0, 0.0, 0.0))
                    if actor is None:
                        raise RuntimeError("Failed spawning tree anchor")
                    uid = _uid(role, feature["id"])
                    actor.set_actor_label("MV_TREE_" + uid[:16])
                    actor.set_folder_path("MountVernon/Trees")
                    actor.set_editor_property(
                        "tags", [unreal.Name(x) for x in _tags(role, uid, digest)])
                else:
                    sha = manifest["files"][role]["sha256"]
                    actor = _spawn_spline(unreal, editor, actor_class, role, feature, sha, digest)
                created.append(actor)
    except Exception:
        for actor in reversed(created):
            editor.destroy_actor(actor)
        raise
    if save_map and not unreal.EditorLevelLibrary.save_current_level():
        raise RuntimeError("Actors created but map save failed; review level before retry")
    unreal.log("TSM Mount Vernon generated (NOT height/datum-certified): " + str(summary))
    return summary


if __name__ == "__main__":
    run()
