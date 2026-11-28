#!/usr/bin/env python3
"""Python/Docker/gRPC simulation orchestrator. Retires OpenMI 2.0. Emits EvidenceArtifact JSON manifests."""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import tempfile
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[2]

def sha256_obj(obj: Any) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, default=str).encode()).hexdigest()

def classify_flood_stage(station_id: str, stage_ft: Any, thresholds: Any) -> str:
    """Classify a same-station gage-stage observation in feet, never a forecast.

    Caller must establish station identity, units and gage datum before use.
    No other station's thresholds may be substituted. This is a screening
    label, not an emergency warning or hydraulic-model result.
    """
    def finite_number(value):
        try:
            return type(value) in (int, float) and math.isfinite(value)
        except OverflowError:
            return False

    if not finite_number(stage_ft):
        return "OBSERVATION_UNAVAILABLE"
    if not isinstance(station_id, str) or not isinstance(thresholds, dict):
        return "THRESHOLD_UNAVAILABLE"
    station = thresholds.get(station_id)
    if not isinstance(station, dict):
        return "THRESHOLD_UNAVAILABLE"
    levels = [("action_ft", "ACTION"), ("flood_ft", "MINOR"),
              ("moderate_ft", "MODERATE"), ("major_ft", "MAJOR")]
    values = [station.get(key) for key, _ in levels]
    if not all(finite_number(value) for value in values):
        return "THRESHOLD_UNAVAILABLE"
    if not all(a < b for a, b in zip(values, values[1:])):
        return "THRESHOLD_UNAVAILABLE"
    for value, (_, label) in reversed(list(zip(values, levels))):
        if stage_ft >= value:
            return label
    return "BELOW_ACTION"


def run_chain(job_id: str) -> Dict[str, Any]:
    steps = ["TimesFM_3.0", "GEOGLOWS_v2", "OpenHydroNet", "HydroMT_SFINCS", "hfsubsetR", "wres_explorer"]
    results = {s: {"status": "QUEUED", "backend": "docker"} for s in steps}
    results["HydroMT_SFINCS"]["status"] = "READY"
    results["ras2fim"] = {"status": "BLOCKED", "reason": "Windows-only — use HydroMT/SFINCS"}
    manifest = {
        "job_id": job_id,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "orchestrator": "run_all.py",
        "stack": "Python/Docker/gRPC",
        "openmi": "RETIRED",
        "steps": results,
        "adr004": "Human-Authority-Final — no autonomous actuation",
    }
    manifest["inputs_sha256"] = sha256_obj({"job_id": job_id, "steps": steps})
    manifest["manifest_sha256"] = sha256_obj(manifest)
    return manifest

def main(argv: List[str]) -> int:
    job_id = argv[1] if len(argv) > 1 else "forecast-chain-001"
    # A portable identifier, not a filename or filesystem path.
    reserved = {"CON", "PRN", "AUX", "NUL"} | {f"{prefix}{i}" for prefix in ("COM", "LPT") for i in range(1, 10)}
    if (len(argv) > 2 or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", job_id)
            or job_id.upper() in reserved):
        print("BLOCKED: invalid forecast job identifier", file=sys.stderr)
        return 2
    data_dir = ROOT / "data"
    out_dir = data_dir / "forecast_runs"
    path = out_dir / f"{job_id}.json"
    pending = None
    try:
        if data_dir.is_symlink() or out_dir.is_symlink():
            raise ValueError("Symlinked output directory")
        out_dir.mkdir(parents=True, exist_ok=True)
        manifest = run_chain(job_id)
        # Stage fully written bytes in the same directory; the hard-link operation
        # atomically creates the destination and refuses existing files/symlinks.
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=out_dir,
                                         prefix=".forecast-", suffix=".tmp", delete=False) as stream:
            pending = Path(stream.name)
            json.dump(manifest, stream, indent=2, allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.link(pending, path)
    except (OSError, ValueError):
        print("BLOCKED: unable to create immutable forecast manifest", file=sys.stderr)
        return 2
    finally:
        if pending is not None:
            pending.unlink(missing_ok=True)
    print(json.dumps({"wrote": str(path), "sha256": manifest["manifest_sha256"][:16]}, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
