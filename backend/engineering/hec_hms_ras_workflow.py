"""Fail-closed contracts for a reproducible HEC-HMS to HEC-RAS workflow."""
from __future__ import annotations
import csv, hashlib, json, math, os, re, shutil, subprocess, uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence
from jsonschema import Draft202012Validator, FormatChecker

class ManifestError(ValueError): pass
class ReadinessError(RuntimeError): pass

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""): digest.update(chunk)
    return digest.hexdigest()

def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False, ensure_ascii=False)

def validate_geojson_polygon(document: Any) -> None:
    if isinstance(document, dict) and document.get("type") == "Feature": geometry = document.get("geometry")
    elif isinstance(document, dict) and document.get("type") == "FeatureCollection":
        features = document.get("features")
        if not isinstance(features, list) or len(features) != 1: raise ValueError("AOI FeatureCollection must contain exactly one feature")
        geometry = features[0].get("geometry") if isinstance(features[0], dict) else None
    else: geometry = document
    if not isinstance(geometry, dict) or geometry.get("type") not in {"Polygon", "MultiPolygon"}: raise ValueError("AOI must be a Polygon or MultiPolygon")
    coords = geometry.get("coordinates")
    polygons = [coords] if geometry["type"] == "Polygon" else coords
    if not isinstance(polygons, list) or not polygons: raise ValueError("AOI coordinates are empty")
    for polygon in polygons:
        if not isinstance(polygon, list) or not polygon: raise ValueError("polygon must contain rings")
        for ring in polygon:
            if not isinstance(ring, list) or len(ring) < 4: raise ValueError("linear ring requires at least four positions")
            points = []
            for pos in ring:
                if not isinstance(pos, list) or len(pos) < 2: raise ValueError("position requires two numeric ordinates")
                x, y = pos[:2]
                if any(not isinstance(v, (int, float)) or isinstance(v, bool) or not math.isfinite(v) for v in (x, y)): raise ValueError("coordinates must be finite numbers")
                points.append((float(x), float(y)))
            if points[0] != points[-1] or len(set(points[:-1])) < 3: raise ValueError("ring must be closed and have three distinct vertices")

def validate_manifest(manifest: Any, schema_path: Path) -> list[str]:
    try: schema = json.loads(schema_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc: raise ManifestError(f"cannot load schema: {exc}") from exc
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(manifest), key=lambda e: (list(map(str, e.absolute_path)), e.message))
    return [f"{'.'.join(map(str,e.absolute_path)) or '$'}: {e.message}" for e in errors]

def load_manifest(path: Path, schema_path: Path) -> dict[str, Any]:
    try: value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc: raise ManifestError(f"cannot load manifest: {exc}") from exc
    errors = validate_manifest(value, schema_path)
    if errors: raise ManifestError("manifest is invalid:\n- " + "\n- ".join(errors))
    return value

def _resolve_under(root: Path, relative: str) -> Path:
    rel = Path(relative)
    if not relative or rel.is_absolute() or ".." in rel.parts: raise ValueError(f"unsafe relative path: {relative!r}")
    root = root.resolve()
    current = root
    for part in rel.parts:
        current = current / part
        if current.is_symlink(): raise ValueError(f"symlink in model path: {relative}")
    result = (root / rel).resolve(strict=True)
    if not result.is_relative_to(root): raise ValueError(f"path escapes model root: {relative}")
    return result

def readiness_blockers(manifest: Mapping[str, Any], manifest_path: Path) -> list[str]:
    base = manifest_path.resolve().parent
    blockers: list[str] = []
    approval = manifest["pilot_area"]["approval"]
    if approval["status"] != "APPROVED": blockers.append("pilot_area.approval.status must be APPROVED")
    if not approval.get("approved_by") or not approval.get("evidence_ref") or not approval.get("approved_at"): blockers.append("AOI approval requires reviewer, timestamp, and evidence")
    if not re.fullmatch(r"[a-f0-9]{40}", manifest.get("source_commit", "")): blockers.append("source_commit must be a full Git SHA")
    geom = manifest["pilot_area"]["aoi_geometry"]
    geom_path = (base / geom["path"]).resolve()
    if not geom_path.is_file(): blockers.append(f"AOI geometry missing: {geom_path}")
    else:
        if sha256_file(geom_path) != geom["sha256"]: blockers.append("AOI geometry SHA-256 mismatch")
        try: validate_geojson_polygon(json.loads(geom_path.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError, ValueError) as exc: blockers.append(f"AOI geometry invalid: {exc}")
    model_roots = {}
    for key in ("hec_hms", "hec_ras"):
        model = manifest[key]
        root = (base / model["project_dir"]).resolve()
        model_roots[key] = root
        if not root.is_dir(): blockers.append(f"{key}.project_dir missing: {root}"); continue
        if not model.get("version") or not model.get("installation_verification_ref"): blockers.append(f"{key} version and installation evidence are required")
        inv = model["project_inventory"]
        if inv["reviewed"] is not True or not inv["evidence_ref"]: blockers.append(f"{key} inventory needs review evidence")
        for item in inv["files"]:
            try: path = _resolve_under(root, item["path"])
            except (ValueError, OSError) as exc: blockers.append(f"{key} inventory path invalid: {exc}"); continue
            if sha256_file(path) != item["sha256"]: blockers.append(f"{key} inventory hash mismatch: {item['path']}")
        if not model.get("horizontal_crs") or not model.get("vertical_datum"): blockers.append(f"{key} must specify horizontal CRS and vertical datum")
    if all(k in model_roots for k in ("hec_hms","hec_ras")):
        if manifest["hec_hms"]["horizontal_crs"] != manifest["hec_ras"]["horizontal_crs"]: blockers.append("HMS/RAS horizontal CRS mismatch; reviewed transform required")
        if manifest["hec_hms"]["vertical_datum"] != manifest["hec_ras"]["vertical_datum"]: blockers.append("HMS/RAS vertical datum mismatch; reviewed transformation required")
    hms = manifest["hec_hms"]
    ras = manifest["hec_ras"]
    for label, model in (("hec_hms", hms), ("hec_ras", ras)):
        try:
            root = model_roots[label]
            project_file = _resolve_under(root, model["project_file"])
            if not project_file.is_file(): blockers.append(f"{label} primary project file is missing")
        except (ValueError, OSError, KeyError) as exc:
            blockers.append(f"{label} primary project file is invalid: {exc}")
    if Path(hms["output_dss_relative_path"]).is_absolute() or ".." in Path(hms["output_dss_relative_path"]).parts:
        blockers.append("hec_hms.output_dss_relative_path must remain inside the run directory")
    if Path(ras["expected_hdf_relative_path"]).is_absolute() or ".." in Path(ras["expected_hdf_relative_path"]).parts:
        blockers.append("hec_ras.expected_hdf_relative_path must remain inside the copied RAS package")
    if ras["unsteady_flow_file_relative_path"] != manifest["hydrograph_transfer"]["ras_unsteady_flow_file_relative_path"]:
        blockers.append("hydrograph transfer target must match hec_ras.unsteady_flow_file_relative_path")
    if not hms.get("runner_command"): blockers.append("tested HEC-HMS compute-run adapter is required")
    if not manifest["hydrograph_transfer"].get("adapter_command"): blockers.append("tested DSS transfer adapter is required")
    if not ras.get("runner_command"): blockers.append("tested HEC-RAS compute-plan adapter is required")
    return sorted(set(blockers))

def validate_hydrograph_csv(path: Path, timestamp_column: str, flow_column: str) -> dict[str, Any]:
    if not path.is_file() or path.stat().st_size == 0: raise ValueError("hydrograph CSV missing or empty")
    points = []
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames or timestamp_column not in reader.fieldnames or flow_column not in reader.fieldnames: raise ValueError("missing timestamp/flow columns")
        for rownum, row in enumerate(reader, 2):
            try: stamp = datetime.fromisoformat((row[timestamp_column] or "").replace("Z","+00:00")); flow = float(row[flow_column])
            except (TypeError, ValueError) as exc: raise ValueError(f"invalid timestamp/flow on row {rownum}") from exc
            if stamp.tzinfo is None or stamp.utcoffset().total_seconds() != 0: raise ValueError(f"row {rownum} timestamp must be UTC")
            if not math.isfinite(flow) or flow < 0: raise ValueError(f"row {rownum} flow must be finite and non-negative")
            points.append((stamp.astimezone(timezone.utc), flow))
    if len(points) < 2 or any(a[0] >= b[0] for a,b in zip(points,points[1:])): raise ValueError("hydrograph requires at least two strictly increasing UTC times")
    volume = sum((b[0]-a[0]).total_seconds()*(a[1]+b[1])/2 for a,b in zip(points,points[1:]))
    return {"sha256":sha256_file(path),"point_count":len(points),"start_time_utc":points[0][0].isoformat().replace("+00:00","Z"),"end_time_utc":points[-1][0].isoformat().replace("+00:00","Z"),"minimum_flow_cfs":min(p[1] for p in points),"maximum_flow_cfs":max(p[1] for p in points),"trapezoidal_volume_ft3":volume,"status":"FORMAT_VALIDATED_HYDROLOGY_UNVALIDATED"}

class ContentAddressedArtifactStore:
    """Atomic local SHA-256 store; local file URIs are not shared object storage."""
    def __init__(self, root: Path):
        self.root = root.resolve(); self.objects = self.root / "objects" / "sha256"; self.objects.mkdir(parents=True, exist_ok=True)
    def put_file(self, source: Path, artifact_type: str) -> dict[str, Any]:
        source = source.resolve(strict=True)
        if not source.is_file() or source.is_symlink(): raise ValueError("artifact source must be a regular file")
        digest = sha256_file(source); name = re.sub(r"[^A-Za-z0-9._-]","_",source.name)[:100] or "artifact"
        target = self.objects / digest[:2] / digest / name; target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            if sha256_file(target) != digest: raise IOError("artifact integrity mismatch")
        else:
            tmp = target.with_name(f".{target.name}.{uuid.uuid4().hex}.tmp")
            try:
                shutil.copyfile(source,tmp)
                if sha256_file(tmp) != digest: raise IOError("artifact changed during copy")
                os.replace(tmp,target)
            finally: tmp.unlink(missing_ok=True)
        return {"artifact_type":artifact_type,"sha256":digest,"byte_length":target.stat().st_size,"storage_uri":target.as_uri(),"relative_storage_uri":target.relative_to(self.root).as_posix()}


def _expand_command(command: Sequence[str], replacements: Mapping[str, str]) -> list[str]:
    expanded = []
    for token in command:
        value = token
        for key, replacement in replacements.items():
            value = value.replace("{" + key + "}", replacement)
        if re.search(r"\\{[A-Za-z_][A-Za-z0-9_]*\\}", value):
            raise ValueError(f"unresolved adapter placeholder: {value!r}")
        expanded.append(value)
    return expanded

def _copy_package(source: Path, target: Path) -> None:
    if target.exists(): raise FileExistsError(f"refusing to overwrite run package: {target}")
    for path in source.rglob("*"):
        if path.is_symlink(): raise ValueError(f"symlink is not allowed in model package: {path}")
    shutil.copytree(source, target, symlinks=False)

def run_workflow(manifest_path: Path, schema_path: Path) -> dict[str, Any]:
    """Execute configured HMS, DSS transfer, and RAS adapters into a unique run directory.

    A successful process chain is still marked UNVALIDATED; this routine cannot
    establish model calibration, predictive skill, or regulatory acceptability.
    """
    manifest_path = manifest_path.resolve(strict=True)
    manifest = load_manifest(manifest_path, schema_path)
    blockers = readiness_blockers(manifest, manifest_path)
    if blockers: raise ReadinessError("workflow blocked:\\n- " + "\\n- ".join(blockers))
    base = manifest_path.parent
    artifact_cfg = manifest["artifact_store"]
    artifact_root = (base / artifact_cfg["root_dir"]).resolve()
    for key in ("hec_hms", "hec_ras"):
        model_root = (base / manifest[key]["project_dir"]).resolve()
        if artifact_root == model_root or artifact_root.is_relative_to(model_root) or model_root.is_relative_to(artifact_root):
            raise ReadinessError("artifact store and model packages must be separate directory trees")
    store = ContentAddressedArtifactStore(artifact_root)
    run_id = manifest["workflow_id"] + "-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    run_root = artifact_root / "runs" / run_id
    run_root.mkdir(parents=True, exist_ok=False)
    receipt: dict[str, Any] = {
        "schema_version": "1.0.0", "run_id": run_id, "workflow_id": manifest["workflow_id"],
        "source_commit": manifest["source_commit"], "manifest_sha256": sha256_file(manifest_path),
        "started_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "status": "RUNNING", "validation_status": "NOT_RUN", "human_review_required": True,
        "governance_status": "HUMAN_REVIEW_REQUIRED", "stages": [], "artifacts": [],
    }
    receipt_path = run_root / "receipt.json"
    try:
        receipt["artifacts"].append(store.put_file(manifest_path, "workflow_manifest"))
        hms_source = (base / manifest["hec_hms"]["project_dir"]).resolve()
        ras_source = (base / manifest["hec_ras"]["project_dir"]).resolve()
        hms_work = run_root / "work" / "hec-hms"
        ras_work = run_root / "work" / "hec-ras"
        _copy_package(hms_source, hms_work)
        _copy_package(ras_source, ras_work)
        for key, root in (("hec_hms", hms_source), ("hec_ras", ras_source)):
            for file in sorted(p for p in root.rglob("*") if p.is_file()):
                receipt["artifacts"].append(store.put_file(file, key + "_source_file"))
        timeout = manifest["execution"]["timeout_seconds"]
        outputs = run_root / "outputs"
        outputs.mkdir()
        hms = manifest["hec_hms"]
        dss_path = (run_root / hms["output_dss_relative_path"]).resolve()
        if not dss_path.is_relative_to(run_root.resolve()): raise ValueError("HMS DSS output path escapes run directory")
        dss_path.parent.mkdir(parents=True, exist_ok=True)
        hms_replacements = {
            "project_dir": str(hms_work), "project_file": str((hms_work / hms["project_file"]).resolve()),
            "simulation_run": hms["simulation_run"], "dss_file": str(dss_path),
            "manifest_path": str(manifest_path), "run_id": run_id,
        }
        hms_result = run_argv(_expand_command(hms["runner_command"], hms_replacements), cwd=hms_work, timeout_seconds=timeout)
        (run_root / "hms.stdout.log").write_text(hms_result["stdout"], encoding="utf-8")
        (run_root / "hms.stderr.log").write_text(hms_result["stderr"], encoding="utf-8")
        receipt["stages"].append({"stage": "HEC_HMS", **hms_result})
        if hms_result["return_code"] != 0: raise RuntimeError(f"HEC-HMS adapter exited {hms_result['return_code']}")
        if not dss_path.is_file() or dss_path.stat().st_size == 0: raise RuntimeError("HEC-HMS adapter did not produce a fresh DSS output")
        receipt["artifacts"].append(store.put_file(dss_path, "hec_hms_dss_output"))
        transfer = manifest["hydrograph_transfer"]
        flow_relative = transfer["ras_unsteady_flow_file_relative_path"]
        ras_flow_path = (ras_work / flow_relative).resolve()
        if not ras_flow_path.is_relative_to(ras_work.resolve()): raise ValueError("RAS flow path escapes the copied project")
        ras_flow_path.parent.mkdir(parents=True, exist_ok=True)
        ras_flow_path.unlink(missing_ok=True)
        hydrograph_csv = (outputs / transfer["output_csv_relative_path"]).resolve()
        if not hydrograph_csv.is_relative_to(outputs.resolve()): raise ValueError("hydrograph CSV path escapes output directory")
        hydrograph_csv.parent.mkdir(parents=True, exist_ok=True)
        transfer_replacements = {
            "dss_file": str(dss_path), "project_dir": str(ras_work),
            "project_file": str((ras_work / manifest["hec_ras"]["project_file"]).resolve()),
            "plan_name": manifest["hec_ras"]["plan_name"], "ras_unsteady_flow_file": str(ras_flow_path),
            "hydrograph_csv": str(hydrograph_csv), "manifest_path": str(manifest_path), "run_id": run_id,
        }
        transfer_result = run_argv(_expand_command(transfer["adapter_command"], transfer_replacements), cwd=base, timeout_seconds=timeout)
        (run_root / "transfer.stdout.log").write_text(transfer_result["stdout"], encoding="utf-8")
        (run_root / "transfer.stderr.log").write_text(transfer_result["stderr"], encoding="utf-8")
        receipt["stages"].append({"stage": "HYDROGRAPH_TRANSFER", **transfer_result})
        if transfer_result["return_code"] != 0: raise RuntimeError(f"hydrograph transfer adapter exited {transfer_result['return_code']}")
        if not ras_flow_path.is_file() or ras_flow_path.stat().st_size == 0: raise RuntimeError("transfer adapter did not produce declared RAS flow file")
        hydro_summary = validate_hydrograph_csv(hydrograph_csv, transfer["timestamp_column"], transfer["flow_column"])
        receipt["stages"].append({"stage": "HYDROGRAPH_CONTRACT", **hydro_summary})
        receipt["artifacts"].append(store.put_file(hydrograph_csv, "hec_hms_ras_exchange_hydrograph"))
        receipt["artifacts"].append(store.put_file(ras_flow_path, "hec_ras_unsteady_flow_input"))
        ras = manifest["hec_ras"]
        hdf_path = (ras_work / ras["expected_hdf_relative_path"]).resolve()
        if not hdf_path.is_relative_to(ras_work.resolve()): raise ValueError("expected HDF5 path escapes RAS package")
        hdf_path.unlink(missing_ok=True)
        ras_replacements = {**transfer_replacements, "project_dir": str(ras_work),
            "project_file": str((ras_work / ras["project_file"]).resolve()), "result_hdf": str(hdf_path)}
        ras_result = run_argv(_expand_command(ras["runner_command"], ras_replacements), cwd=base, timeout_seconds=timeout)
        (run_root / "ras.stdout.log").write_text(ras_result["stdout"], encoding="utf-8")
        (run_root / "ras.stderr.log").write_text(ras_result["stderr"], encoding="utf-8")
        receipt["stages"].append({"stage": "HEC_RAS", **ras_result})
        if ras_result["return_code"] != 0: raise RuntimeError(f"HEC-RAS adapter exited {ras_result['return_code']}")
        if not hdf_path.is_file() or hdf_path.stat().st_size == 0: raise RuntimeError("HEC-RAS adapter did not produce fresh result HDF5")
        from backend.engineering.hecras_hdf5 import discover_water_surface_datasets
        datasets = discover_water_surface_datasets(hdf_path)
        receipt["stages"].append({"stage": "HEC_RAS_OUTPUT", "hdf_sha256": sha256_file(hdf_path),
            "water_surface_dataset_count": len(datasets), "status": "OUTPUT_PRESENT_SCIENTIFIC_VALIDATION_PENDING"})
        receipt["artifacts"].append(store.put_file(hdf_path, "hec_ras_result_hdf5"))
        for log_name, kind in (("hms.stdout.log","hec_hms_stdout"),("hms.stderr.log","hec_hms_stderr"),
                               ("transfer.stdout.log","hydrograph_transfer_stdout"),("transfer.stderr.log","hydrograph_transfer_stderr"),
                               ("ras.stdout.log","hec_ras_stdout"),("ras.stderr.log","hec_ras_stderr")):
            receipt["artifacts"].append(store.put_file(run_root / log_name, kind))
        receipt["status"] = "COMPLETED_UNVALIDATED"
        receipt["validation_status"] = "PENDING_INDEPENDENT_ENGINEERING_REVIEW"
        receipt["blockers"] = [
            "Hydrologic calibration and independent validation were not performed by this runner.",
            "Hydrograph volume calculation is a format/summary check, not a DSS equivalence or mass-balance proof.",
            "Hydraulic stability, calibration, uncertainty and regulatory disposition require qualified review.",
        ]
    except Exception as exc:
        receipt["status"] = "FAILED"
        receipt["validation_status"] = "NOT_RUN"
        receipt["error"] = f"{type(exc).__name__}: {exc}"
    receipt["finished_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    receipt_path.write_text(json.dumps(receipt, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")
    receipt["receipt_artifact"] = store.put_file(receipt_path, "hec_workflow_run_receipt")
    if receipt["status"] == "FAILED": raise RuntimeError(f"workflow failed; receipt retained at {receipt_path}: {receipt.get('error')}")
    return receipt

def run_argv(command: Sequence[str], *, cwd: Path, timeout_seconds: int) -> dict[str, Any]:
    """Run an operator-tested adapter without shell interpolation."""
    if not command or any(not isinstance(v,str) or not v for v in command): raise ValueError("command must be a non-empty argv array")
    if not 1 <= timeout_seconds <= 86400: raise ValueError("timeout_seconds must be 1..86400")
    environment_keys = ("PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "JAVA_HOME", "HEC_HMS_HOME", "HEC_RAS_HOME", "USERPROFILE", "HOME", "APPDATA", "LOCALAPPDATA")
    child_env = {key: os.environ[key] for key in environment_keys if os.environ.get(key)}
    completed = subprocess.run(list(command),cwd=cwd,check=False,shell=False,capture_output=True,text=True,timeout=timeout_seconds,env=child_env)
    return {"return_code":completed.returncode,"stdout":completed.stdout[-20000:],"stderr":completed.stderr[-20000:]}

def main(argv: Sequence[str] | None = None) -> int:
    import argparse
    parser = argparse.ArgumentParser(description="Fail-closed HEC-HMS to HEC-RAS workflow")
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--schema", type=Path, default=Path(__file__).resolve().parents[2] / "data/schemas/hec-hms-ras-workflow-v1.schema.json")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--validate-only", action="store_true")
    group.add_argument("--run", action="store_true")
    args = parser.parse_args(argv)
    try:
        manifest = load_manifest(args.manifest, args.schema)
        blockers = readiness_blockers(manifest, args.manifest)
        if args.validate_only:
            print(json.dumps({"schema_valid": True, "ready_to_run": not blockers, "execution_performed": False, "blockers": blockers}, indent=2))
            return 0
        if blockers: raise ReadinessError("workflow blocked:\\n- " + "\\n- ".join(blockers))
        result = run_workflow(args.manifest, args.schema)
        print(json.dumps(result, indent=2, sort_keys=True, allow_nan=False))
        return 0
    except (ManifestError, ReadinessError) as exc:
        print(json.dumps({"status": "BLOCKED", "error": str(exc), "execution_performed": False}, indent=2), file=__import__("sys").stderr)
        return 2
    except (OSError, ValueError, RuntimeError) as exc:
        print(json.dumps({"status": "FAILED", "error": str(exc), "execution_performed": bool(args.run)}, indent=2), file=__import__("sys").stderr)
        return 2

if __name__ == "__main__":
    raise SystemExit(main())
