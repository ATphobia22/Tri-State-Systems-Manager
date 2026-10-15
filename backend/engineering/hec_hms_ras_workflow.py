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
    if not manifest["hydrograph_transfer"].get("adapter_command"): blockers.append("tested DSS transfer adapter is required")
    if not manifest["hec_ras"].get("runner_command"): blockers.append("tested HEC-RAS compute-plan adapter is required")
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

def run_argv(command: Sequence[str], *, cwd: Path, timeout_seconds: int) -> dict[str, Any]:
    """Run an operator-tested adapter without shell interpolation."""
    if not command or any(not isinstance(v,str) or not v for v in command): raise ValueError("command must be a non-empty argv array")
    if not 1 <= timeout_seconds <= 86400: raise ValueError("timeout_seconds must be 1..86400")
    completed = subprocess.run(list(command),cwd=cwd,check=False,shell=False,capture_output=True,text=True,timeout=timeout_seconds,env={"PATH":os.environ.get("PATH","")})
    return {"return_code":completed.returncode,"stdout":completed.stdout[-20000:],"stderr":completed.stderr[-20000:]}
