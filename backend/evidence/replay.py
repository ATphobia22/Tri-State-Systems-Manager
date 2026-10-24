"""Deterministic replay verification for sealed solver evidence.

A replay is equivalent only when the original and replay records agree on
input manifest hash, config hash, solver name, solver version, and status,
and the replay record's own bundle hash verifies. Output artifact hashes
are reported as differences when they diverge (tolerances are NOT applied
silently: stage/flow tolerance comparison is a caller-side engineering
judgment, not something this function hides).

This mirrors the pasted ReplayVerification contract but adds the checks the
paste omits: config-hash equality, solver-version equality, and bundle
integrity of both records.
"""

from __future__ import annotations

from typing import Any

from backend.evidence.canonical_hash import verify_integrity


def verify_replay(original: dict[str, Any], replay: dict[str, Any]) -> dict[str, Any]:
    """Compare two sealed evidence records and report equivalence."""
    differences: list[str] = []
    if not verify_integrity(original):
        differences.append("Original evidence bundle hash does not verify (tampered or corrupt).")
    if not verify_integrity(replay):
        differences.append("Replay evidence bundle hash does not verify (tampered or corrupt).")
    for field in ("input_manifest_hash", "config_hash", "solver_name", "solver_version", "status"):
        if original.get(field) != replay.get(field):
            differences.append(
                f"{field} mismatch: original ({original.get(field)}) vs replay ({replay.get(field)}).")
    if original.get("output_artifact_hashes") != replay.get("output_artifact_hashes"):
        differences.append("Output artifact hashes differ between runs.")
    return {
        "original_run_id": original.get("run_id"),
        "replay_run_id": replay.get("run_id"),
        "equivalent": not differences,
        "differences": differences,
    }
