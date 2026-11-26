#!/usr/bin/env python3
"""Python/Docker/gRPC simulation orchestrator. Retires OpenMI 2.0. Emits EvidenceArtifact JSON manifests."""
from __future__ import annotations

import hashlib
import json
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
    out_dir = ROOT / "data" / "forecast_runs"
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = run_chain(job_id)
    path = out_dir / f"{job_id}.json"
    path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"wrote": str(path), "sha256": manifest["manifest_sha256"][:16]}, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
