#!/usr/bin/env python3
"""Python/Docker/gRPC simulation orchestrator. Retires OpenMI 2.0. Emits EvidenceArtifact JSON manifests."""
from __future__ import annotations

import hashlib
import json
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
