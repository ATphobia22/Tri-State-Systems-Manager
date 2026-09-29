#!/usr/bin/env python3
"""Bounded CadQuery worker: allowlisted JSON geometry jobs in, hashed artifacts out."""
from __future__ import annotations
import hashlib, json, os, sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
ALLOWED_OUTPUTS = {"STEP", "DXF", "STL"}
ALLOWED_OPERATIONS = {"box", "cylinder", "rect_extrude"}
MAX_INPUT_BYTES = 64 * 1024
def fail(message: str) -> None: raise SystemExit(f"cadquery-worker: {message}")
def positive_number(value: Any, name: str) -> float:
    number = float(value)
    if not number > 0 or not number < 1_000_000: fail(f"{name} must be >0 and <1,000,000")
    return number
def build_model(cq: Any, job: dict[str, Any]) -> Any:
    operation = str(job.get("operation", "")).lower()
    parameters = job.get("parameters")
    if not isinstance(parameters, dict): fail("parameters must be an object")
    if operation == "box":
        return cq.Workplane("XY").box(positive_number(parameters.get("length"), "length"), positive_number(parameters.get("width"), "width"), positive_number(parameters.get("height"), "height"))
    if operation == "cylinder":
        return cq.Workplane("XY").cylinder(positive_number(parameters.get("height"), "height"), positive_number(parameters.get("radius"), "radius"))
    if operation == "rect_extrude":
        return cq.Workplane("XY").rect(positive_number(parameters.get("width"), "width"), positive_number(parameters.get("height"), "height")).extrude(positive_number(parameters.get("depth"), "depth"))
    fail(f"unsupported operation: {operation}; allowed={sorted(ALLOWED_OPERATIONS)}")
def main() -> int:
    raw = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
    if len(raw) > MAX_INPUT_BYTES: fail("input exceeds 64 KiB")
    job = json.loads(raw.decode("utf-8"))
    if not isinstance(job, dict): fail("job must be a JSON object")
    outputs = [str(value).upper() for value in job.get("outputs", ["STEP"])]
    if not outputs or any(value not in ALLOWED_OUTPUTS for value in outputs): fail("outputs must be a non-empty subset of STEP/DXF/STL")
    try:
        import cadquery as cq
    except ImportError as exc: fail(f"CadQuery is not installed: {exc}")
    model = build_model(cq, job)
    output_dir = Path(os.environ.get("TSM_CADQUERY_OUTPUT_DIR", "/tmp/tsm-cadquery-output")).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    input_sha = hashlib.sha256(raw).hexdigest()
    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    files = []
    for output in outputs:
        target = output_dir / f"artifact.{output.lower()}"
        if output == "STEP": cq.exporters.export(model, str(target), cq.exporters.ExportTypes.STEP)
        elif output == "STL": cq.exporters.export(model, str(target), cq.exporters.ExportTypes.STL)
        elif output == "DXF": cq.exporters.exportDXF(model, str(target))
        files.append({"path": str(target), "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "bytes": target.stat().st_size})
    print(json.dumps({"artifactType":"ENGINEERING_CAD_ARTIFACT","source":"cadquery","authorityClass":"DERIVED","outputs":outputs,"provenance":{"inputSha256":input_sha,"generatorVersion":getattr(cq,"__version__","unknown"),"generatedAt":generated_at},"files":files}, sort_keys=True))
    return 0
if __name__ == "__main__": raise SystemExit(main())
