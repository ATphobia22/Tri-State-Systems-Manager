"""UE5.8 Editor-only importer; called by UTSMMountVernonGeneratorWidget.

Never imports an unreviewed map, assigns a vertical datum, creates synthetic
source heights, modifies existing actors, or claims a Shipping-ready scene.
"""
import json
import os
import sys
from pathlib import Path

import unreal

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from tsm_mv_contract import inspect_package

MANIFEST = os.environ["TSM_MV_MANIFEST"]
ACTION = os.environ.get("TSM_MV_ACTION", "validate").lower()
pkg = inspect_package(MANIFEST)


def _receipt_path():
    out_dir = Path(unreal.Paths.project_saved_dir()) / "TSM" / "MountVernon"
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir / (pkg["manifest_sha256"][:20] + ".json")


def _receipt(status, counts, message):
    out = _receipt_path()
    payload = {
        "status": status, "message": message,
        "manifest_sha256": pkg["manifest_sha256"],
        "world_partition_map": pkg["scene"]["world_partition_map"],
        "coordinate_frame": pkg["frame"],
        "evidence_status": pkg["scene"]["evidence_status"],
        "source_receipts": pkg["sources"],
        "feature_counts": counts,
        "regulatory_determination": False,
        "shipping_validated": False,
    }
    temp = out.with_suffix(".json.partial")
    temp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    temp.replace(out)
    unreal.log("TSM Mount Vernon evidence receipt: " + str(out))


def _check_open_level():
    world = unreal.EditorLevelLibrary.get_editor_world()
    if world is None:
        raise RuntimeError("Open an actual saved World Partition level before generating")
    open_map = world.get_path_name().split(".")[0]
    required_map = pkg["scene"]["world_partition_map"]
    if open_map != required_map:
        raise RuntimeError("Wrong map opened: " + open_map + "; expected " + required_map)
    if open_map.startswith("/Temp/"):
        raise RuntimeError("Refusing unsaved/transient level")
    return world


def _create_vector_actors():
    _check_open_level()
    if _receipt_path().exists():
        raise RuntimeError(
            "This manifest already has a generation receipt (possibly partial). "
            "Inspect and reconcile it before another run; no silent duplicates."
        )
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if subsystem is None:
        raise RuntimeError("EditorActorSubsystem unavailable")
    existing_labels = {str(a.get_actor_label()) for a in subsystem.get_all_level_actors()}
    required_labels = {f.stable_label for f in pkg["features"]}
    if existing_labels.intersection(required_labels):
        raise RuntimeError("Existing TSM managed labels present: reconcile/delete intentionally before rerun")
    native_actor = getattr(unreal, "TSMMountVernonVectorActor", None)
    if native_actor is None:
        raise RuntimeError("TSMMountVernonVectorActor class missing: rebuild C++ TSMNative Editor target")
    counts = {"building": 0, "road": 0, "tree": 0}
    # A partial receipt is written BEFORE any editor mutation, to fail safe after crashes.
    _receipt("PARTIAL", counts, "Generation in progress; remove only after inspected reconciliation")
    try:
        total = len(pkg["features"])
        with unreal.ScopedSlowTask(total, "Mount Vernon evidence-gated spline generation") as task:
            task.make_dialog(True)
            for feature in pkg["features"]:
                if task.should_cancel():
                    raise RuntimeError("Cancelled by editor operator; partial actors require reconciliation")
                task.enter_progress_frame(1)
                points = feature.points
                first = points[0]
                actor = subsystem.spawn_actor_from_class(
                    native_actor, unreal.Vector(*first), unreal.Rotator(0, 0, 0)
                )
                if actor is None:
                    raise RuntimeError("Failed to spawn " + feature.stable_label)
                actor.set_actor_label(feature.stable_label)
                actor.set_folder_path("TSM/MountVernon/" + feature.kind.title())
                actor.set_editor_property("feature_id", feature.feature_id)
                actor.set_editor_property("kind", feature.kind)
                actor.set_editor_property("source_sha256", feature.source_sha256)
                actor.set_editor_property("evidence_status", pkg["scene"]["evidence_status"])
                p = feature.properties
                for key, value in (
                    ("height_cm", p.get("height_cm")),
                    ("eave_cm", p.get("eave_cm")),
                    ("road_width_cm", p.get("width_cm")),
                ):
                    if value is not None:
                        actor.set_editor_property(key, float(value))
                actor.set_editor_property("roof_type", str(p.get("roof_type", "")))
                actor.set_editor_property("tags", [
                    unreal.Name("TSM_MV_MANAGED"),
                    unreal.Name({"building": "MV_Building", "road": "MV_Road", "tree": "MV_Tree"}[feature.kind]),
                    unreal.Name("EVIDENCE_" + pkg["scene"]["evidence_status"]),
                ])
                spline = actor.get_editor_property("footprint")
                spline.clear_spline_points(update_spline=False)
                if feature.kind != "tree":
                    for x, y, z in points:
                        spline.add_spline_point(unreal.Vector(x - first[0], y - first[1], z - first[2]),
                                                unreal.SplineCoordinateSpace.LOCAL, update_spline=False)
                spline.set_closed_loop(feature.closed, update_spline=True)
                counts[feature.kind] += 1
        _receipt("EDITOR_VECTORS_GENERATED", counts,
                 "Native splines only. PCG, RVT volume, baked meshes and Shipping require validation.")
        unreal.log_warning(
            "Mount Vernon: " + repr(counts) +
            " native vector actors generated; they are NOT completed building/road meshes."
        )
    except Exception as error:
        _receipt("PARTIAL", counts, "Editor generation interrupted: " + str(error))
        raise


if ACTION == "validate":
    _check_open_level()
    unreal.log("Mount Vernon manifest preflight PASSED; datasets: " +
               repr([(s["kind"], s["count"]) for s in pkg["sources"]]))
elif ACTION == "generate":
    _create_vector_actors()
elif ACTION == "rvt":
    from tsm_mv_rvt import create_rvt_assets
    created = create_rvt_assets()
    unreal.log_warning("RVT authoring assets created/reused: " + ", ".join(created) +
                       ". Assign volume/landscape/road writers and test headed rendering.")
else:
    raise ValueError("Unsupported TSM_MV_ACTION: " + ACTION)
