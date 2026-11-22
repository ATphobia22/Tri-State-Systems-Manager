#!/usr/bin/env python3
"""Conservative independent-release evidence contract (no invented success).

Building inventory checks compare actual per-OBJECTID lists, not summary
counts. Replay checks compare complete serialized state before/after rebuild.
Native offline Shipping and headed browser validation remain separate human-
reviewed gates: neither is inferred from a successful source-build job.
"""
from __future__ import annotations

import argparse
from hashlib import sha256
import json
from pathlib import Path
import re
import sys

SHA = re.compile(r"^[a-f0-9]{64}$")
ID = re.compile(r"^[1-9][0-9]{0,12}$")


def load_json(path: Path):
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 48_000_000:
        raise ValueError(f"Unsafe or oversized evidence source: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def ids(document, *, label: str) -> set[str]:
    if not isinstance(document, list):
        raise ValueError(f"{label} requires a JSON array of official OBJECTIDs")
    values = []
    for value in document:
        if isinstance(value, bool) or not isinstance(value, (str, int)):
            raise ValueError(f"{label} includes invalid OBJECTID")
        normalized = str(value)
        if not ID.fullmatch(normalized):
            raise ValueError(f"{label} includes noncanonical OBJECTID")
        values.append(normalized)
    if len(set(values)) != len(values):
        raise ValueError(f"{label} includes duplicate OBJECTIDs")
    return set(values)


def building_inventory(source, mesh, footprints, reviewed_heights, *, expected=23082):
    """Height IDs must be independently substantiated by per-building evidence."""
    if type(expected) is not int or expected < 1:
        raise ValueError("Expected inventory count must be positive")
    source_ids = ids(source, label="official source")
    mesh_ids = ids(mesh, label="3D mesh")
    footprint_ids = ids(footprints, label="footprint fallback")
    height_ids = ids(reviewed_heights, label="reviewed height evidence")
    unknown_mesh = mesh_ids - source_ids
    unknown_footprint = footprint_ids - source_ids
    unknown_height = height_ids - source_ids
    mesh_without_height = mesh_ids - height_ids
    missing_mesh = source_ids - mesh_ids
    missing_display = source_ids - (mesh_ids | footprint_ids)
    overlap = mesh_ids & footprint_ids
    correct_source_size = len(source_ids) == expected
    identities_consistent = not (unknown_mesh or unknown_footprint or unknown_height)
    visual_coverage = correct_source_size and identities_consistent and not missing_display
    all_meshes_height_linked = not mesh_without_height and not missing_mesh
    ready = (correct_source_size and identities_consistent and all_meshes_height_linked
             and not footprint_ids and mesh_ids == source_ids and height_ids == source_ids)
    return {
        "schema": "tsm.phase5.building-id-reconciliation.v1",
        "status": "IDENTITIES_RECONCILED_REVIEW_REQUIRED" if ready else "BLOCKED",
        "expected_source_ids": expected, "source_ids": len(source_ids),
        "mesh_ids": len(mesh_ids), "footprint_fallback_ids": len(footprint_ids),
        "reviewed_height_ids": len(height_ids), "visual_footprint_coverage": visual_coverage,
        "full_3d_id_coverage": ready,
        "source_count_matches_baseline": correct_source_size,
        "unknown_mesh_ids": len(unknown_mesh),
        "unknown_footprint_ids": len(unknown_footprint),
        "unknown_height_ids": len(unknown_height),
        "mesh_without_reviewed_height": len(mesh_without_height),
        "source_without_mesh": len(missing_mesh),
        "source_without_any_display": len(missing_display),
        "double_counted_mesh_and_fallback": len(overlap),
        "examples_missing_mesh": sorted(missing_mesh)[:25],
        "limitations": "Exact ID-set and asserted reviewed-height membership only. Actual LAS/COPC roof and ground geometry must be independently checked.",
    }


def _stable_entries(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("entries"), list):
        raise ValueError("Replay proof requires a complete Twin State API response")
    if payload.get("next") is not None or payload.get("next_after") is not None:
        raise ValueError("Replay proof is paginated; collect all pages before comparison")
    if type(payload.get("watermark")) is not int:
        raise ValueError("Replay proof lacks integer committed watermark")
    items = {}
    for row in payload["entries"]:
        event = row.get("event")
        if not isinstance(event, dict):
            raise ValueError("Replay proof entry lacks canonical event")
        matrix, entity = event.get("matrix"), event.get("entity_id")
        key = (matrix, entity)
        if not matrix or not entity or key in items:
            raise ValueError("Replay snapshot has missing or repeated canonical identity")
        items[key] = {"event": event, "geometry": row.get("geometry"), "seq": row.get("seq")}
    return items


def replay(before, after):
    first, second = _stable_entries(before), _stable_entries(after)
    if before["watermark"] != after["watermark"]:
        raise ValueError("Rebuild changed the event watermark; cannot compare equal input state")
    if not first:
        raise ValueError("Empty state is not evidence of successful twin replay")
    def digest(mapping):
        rows = [{"key": list(k), **mapping[k]} for k in sorted(mapping)]
        raw = json.dumps(rows, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
                         allow_nan=False).encode("utf-8")
        return sha256(raw).hexdigest()
    baseline, rebuilt = digest(first), digest(second)
    return {"schema": "tsm.phase5.projection-replay.v1",
            "status": "DETERMINISTIC_REPLAY_MATCH" if baseline == rebuilt else "BLOCKED",
            "watermark": before["watermark"], "entity_count": len(first),
            "before_sha256": baseline, "after_sha256": rebuilt,
            "matched": baseline == rebuilt,
            "limitations": "Compares full supplied snapshot; requires independently captured and complete pre-/post-rebuild exports."}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--official-ids", type=Path)
    parser.add_argument("--mesh-ids", type=Path)
    parser.add_argument("--fallback-ids", type=Path)
    parser.add_argument("--reviewed-height-ids", type=Path)
    parser.add_argument("--expected-count", type=int, default=23082)
    parser.add_argument("--replay-before", type=Path)
    parser.add_argument("--replay-after", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    has_building = all((args.official_ids, args.mesh_ids, args.fallback_ids,
                        args.reviewed_height_ids))
    has_replay = bool(args.replay_before and args.replay_after)
    if not has_building and not has_replay:
        parser.error("Provide all four building ID manifests and/or both replay exports")
    report = {"schema": "tsm.phase5.evidence-summary.v1", "verified": False,
              "gates": {}, "shipping": "NOT_EVIDENCED",
              "headed_public_rendering": "NOT_EVIDENCED"}
    try:
        if has_building:
            report["gates"]["building_ids"] = building_inventory(
                load_json(args.official_ids), load_json(args.mesh_ids),
                load_json(args.fallback_ids), load_json(args.reviewed_height_ids),
                expected=args.expected_count)
        if has_replay:
            report["gates"]["replay"] = replay(load_json(args.replay_before),
                                                load_json(args.replay_after))
        passed = all((v.get("full_3d_id_coverage", v.get("matched", False))
                      for v in report["gates"].values()))
        report["status"] = "INPUT_GATES_MATCH_RELEASE_STILL_BLOCKED" if passed else "BLOCKED"
        report["limitations"] = ("Not a full release certificate. A checked Windows UE5.8 Shipping "
                                 "acceptance receipt and independently reviewed headed public rendering "
                                 "are mandatory; source data and height geometry require audit.")
        if args.output:
            if args.output.exists():
                raise ValueError("Refusing to overwrite an existing release report")
            args.output.write_text(json.dumps(report, sort_keys=True, indent=2)+"\n",
                                   encoding="utf-8")
        print(json.dumps(report, sort_keys=True))
        return 2 if not passed else 0
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "ERROR", "reason": str(error)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
