#!/usr/bin/env python3
"""Exact, resilient HEC-HMS DSS FLOW to HEC-RAS DSS boundary handoff.

Pinned library interface: hms-commander 0.4.0 and ras-commander 0.105.0.
The adapter never chooses a first-match hydrograph, fills gaps, creates fake
flows, or modifies the source RAS package. Call only against a fresh run copy.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import math
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

HMS_COMMANDER_VERSION = "0.4.0"
HMS_COMMANDER_SOURCE_COMMIT = "1404fee5c81820764197f38923764f8c1d1b2fb7"
RAS_COMMANDER_VERSION = "0.105.0"
RAS_COMMANDER_SOURCE_COMMIT = "574adbc725f9436a196698970febe39d98ef30c5"
ADAPTER_VERSION = "tsm-hms-ras-handoff@1.0.0"
INTERVAL_SECONDS = {
    "1MIN": 60, "5MIN": 300, "10MIN": 600, "15MIN": 900,
    "30MIN": 1800, "1HOUR": 3600, "2HOUR": 7200,
    "3HOUR": 10800, "4HOUR": 14400, "6HOUR": 21600,
    "8HOUR": 28800, "12HOUR": 43200, "1DAY": 86400,
}
CFS_TO_CMS = 0.028316846592
CMS_TO_CFS = 35.314666721489


class HandoffError(RuntimeError):
    """A transfer failed a provenance, data-quality, or adapter precondition."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_dss_pathname(pathname: str) -> tuple[str, str, str, str, str, str]:
    """Parse exactly six A-F parts. A and D may be empty; B/C/E/F may not."""
    if not isinstance(pathname, str) or not pathname.startswith("/") or not pathname.endswith("/"):
        raise ValueError("DSS pathname must start and end with slash")
    if pathname.startswith("//"):
        parts = [""] + pathname[2:-1].split("/")
    else:
        parts = pathname[1:-1].split("/")
    if len(parts) != 6:
        raise ValueError("DSS pathname must have exactly six A-F parts")
    if any(not part for index, part in enumerate(parts) if index not in (0, 3)):
        raise ValueError("only A and D DSS pathname parts may be blank")
    return tuple(parts)  # type: ignore[return-value]


def convert_flow_values(
    values: Sequence[float], *, source_units: str, target_units: str, conversion_method: str
) -> list[float]:
    """Apply only the explicit unit conversion written in the manifest."""
    source, target = source_units.upper(), target_units.upper()
    method = conversion_method.upper()
    allowed = {
        ("CFS", "CFS"): ("NONE_EXACT_VALUES", 1.0),
        ("CMS", "CMS"): ("NONE_EXACT_VALUES", 1.0),
        ("CFS", "CMS"): ("CFS_TO_CMS_0.028316846592", CFS_TO_CMS),
        ("CMS", "CFS"): ("CMS_TO_CFS_35.314666721489", CMS_TO_CFS),
    }
    expected = allowed.get((source, target))
    if expected is None or expected[0] != method:
        raise ValueError(f"conversion_method {method!r} mismatches declared units {source!r}->{target!r}")
    converted = []
    for index, raw in enumerate(values):
        value = float(raw)
        if not math.isfinite(value) or value < 0:
            raise ValueError(f"flow at row {index} must be finite and non-negative")
        new_value = value * expected[1]
        if not math.isfinite(new_value):
            raise ValueError(f"converted flow at row {index} is non-finite")
        converted.append(new_value)
    return converted


def validate_local_times(raw_times: Iterable[Any], *, time_zone: str, interval: str) -> tuple[list[datetime], list[datetime]]:
    """Require regular, increasing minute-aligned times; reject DST ambiguity."""
    try:
        zone = ZoneInfo(time_zone)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"unknown IANA time zone: {time_zone!r}") from exc
    try:
        step = INTERVAL_SECONDS[interval.upper()]
    except KeyError as exc:
        raise ValueError(f"unsupported interval: {interval!r}") from exc
    local_times: list[datetime] = []
    utc_times: list[datetime] = []
    for index, raw in enumerate(raw_times):
        value = raw.to_pydatetime() if hasattr(raw, "to_pydatetime") else raw
        if not isinstance(value, datetime):
            raise ValueError(f"timestamp {index} is not a datetime")
        local = value.astimezone(zone).replace(tzinfo=None) if value.tzinfo else value
        if local.second != 0 or local.microsecond != 0:
            raise ValueError(f"timestamp {index} is not aligned to a whole minute")
        aware0 = local.replace(tzinfo=zone, fold=0)
        aware1 = local.replace(tzinfo=zone, fold=1)
        if aware0.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) != local:
            raise ValueError(f"nonexistent local time at {local.isoformat()} in {time_zone}")
        if aware0.utcoffset() != aware1.utcoffset():
            raise ValueError(f"ambiguous local time at daylight-saving transition: {local.isoformat()}")
        utc = aware0.astimezone(timezone.utc)
        if local_times:
            previous = local_times[-1]
            previous_offset = previous.replace(tzinfo=zone, fold=0).utcoffset()
            if aware0.utcoffset() != previous_offset:
                raise ValueError(
                    f"UTC offset changed inside a single DSS hydrograph near {local.isoformat()}; "
                    "split the run at the timezone transition or supply source-correct fixed-standard-time semantics"
                )
            if local <= previous or (local - previous).total_seconds() != step:
                raise ValueError(f"gap, duplicate, or irregular timestamp near {local.isoformat()}; gap filling is disabled")
        local_times.append(local)
        utc_times.append(utc)
    if len(local_times) < 2:
        raise ValueError("at least two hydrograph time steps are required")
    return local_times, utc_times


def validate_hydrograph_frame(
    frame: Any, *, pathname: str, element_name: str, run_name: str,
    interval: str, source_units: str, target_units: str,
    conversion_method: str, time_zone: str,
) -> tuple[list[datetime], list[datetime], list[float], dict[str, Any]]:
    parts = parse_dss_pathname(pathname)
    if parts[1].casefold() != element_name.casefold() or parts[2].upper() != "FLOW":
        raise ValueError("source pathname must identify the declared element's FLOW record")
    if run_name.casefold() not in parts[5].casefold():
        raise ValueError("source pathname F-part does not identify source_run_name")
    if parts[4].upper() != interval.upper():
        raise ValueError("source pathname E-part does not match the declared interval")
    attrs = getattr(frame, "attrs", {}) or {}
    actual_units = attrs.get("units")
    if not isinstance(actual_units, str) or actual_units.strip().upper() != source_units.upper():
        raise ValueError(f"DSS units {actual_units!r} mismatch manifest units {source_units!r}")
    if getattr(frame, "empty", True) or "value" not in getattr(frame, "columns", []):
        raise ValueError("DSS record must return a non-empty frame with a value column")
    local_times, utc_times = validate_local_times(frame.index, time_zone=time_zone, interval=interval)
    values = convert_flow_values(
        list(frame["value"]), source_units=source_units, target_units=target_units,
        conversion_method=conversion_method,
    )
    if len(values) != len(local_times):
        raise ValueError("flow values and timestamps have different lengths")
    volume_ft3 = None
    if target_units.upper() == "CFS":
        volume_ft3 = sum(
            (utc_times[i + 1] - utc_times[i]).total_seconds() * (values[i] + values[i + 1]) / 2
            for i in range(len(values) - 1)
        )
    summary = {
        "source_pathname": pathname,
        "source_element_name": element_name,
        "source_run_name": run_name,
        "source_units": source_units.upper(),
        "target_units": target_units.upper(),
        "conversion_method": conversion_method,
        "time_zone": time_zone,
        "interval": interval.upper(),
        "point_count": len(values),
        "start_time_local": local_times[0].isoformat(),
        "end_time_local": local_times[-1].isoformat(),
        "start_time_utc": utc_times[0].isoformat().replace("+00:00", "Z"),
        "end_time_utc": utc_times[-1].isoformat().replace("+00:00", "Z"),
        "minimum_flow": min(values),
        "maximum_flow": max(values),
        "trapezoidal_volume_ft3": volume_ft3,
        "status": "FORMAT_AND_UNIT_CONTRACT_VALIDATED_HYDROLOGY_UNVALIDATED",
    }
    return local_times, utc_times, values, summary


def catalog_paths(catalog: Any) -> list[str]:
    if hasattr(catalog, "columns") and "pathname" in catalog.columns:
        return [str(item) for item in catalog["pathname"].tolist()]
    return [str(item) for item in catalog]


def validation_passed(result: Any) -> bool:
    if isinstance(result, Mapping):
        return result.get("passed") is True
    return getattr(result, "passed", False) is True


def _verify_vcs_distribution(distribution_name: str, expected_version: str, expected_commit: str) -> tuple[str, str]:
    """Verify installed version and the exact VCS commit in PEP 610 metadata."""
    try:
        distribution = importlib.metadata.distribution(distribution_name)
    except importlib.metadata.PackageNotFoundError as exc:
        raise HandoffError(f"required pinned package is not installed: {distribution_name}") from exc
    if distribution.version != expected_version:
        raise HandoffError(
            f"{distribution_name} version {distribution.version!r} does not match pinned {expected_version!r}"
        )
    raw_direct_url = distribution.read_text("direct_url.json")
    if not raw_direct_url:
        raise HandoffError(
            f"{distribution_name} was not installed from a VCS URL; install scripts/hydrology/requirements-hec-handoff.txt"
        )
    try:
        direct_url = json.loads(raw_direct_url)
    except json.JSONDecodeError as exc:
        raise HandoffError(f"{distribution_name} direct_url.json is invalid") from exc
    vcs_info = direct_url.get("vcs_info") if isinstance(direct_url, dict) else None
    actual_commit = vcs_info.get("commit_id") if isinstance(vcs_info, dict) else None
    actual_vcs = vcs_info.get("vcs") if isinstance(vcs_info, dict) else None
    if actual_vcs != "git" or actual_commit != expected_commit:
        raise HandoffError(
            f"{distribution_name} source commit {actual_commit!r} does not match pinned {expected_commit!r}"
        )
    return distribution.version, actual_commit


def execute_handoff(
    *, manifest: Mapping[str, Any], hms_dss_path: Path, ras_project_directory: Path,
    ras_unsteady_file: Path, ras_dss_file: Path, report_path: Path,
) -> dict[str, Any]:
    h = manifest["hydrograph_handoff"]
    hms_version, hms_commit = _verify_vcs_distribution(
        "hms-commander", HMS_COMMANDER_VERSION, HMS_COMMANDER_SOURCE_COMMIT
    )
    ras_version, ras_commit = _verify_vcs_distribution(
        "ras-commander", RAS_COMMANDER_VERSION, RAS_COMMANDER_SOURCE_COMMIT
    )
    if h["gap_policy"] != "REJECT":
        raise HandoffError("gap_policy must be REJECT; no interpolation is implemented")
    for path, label in ((hms_dss_path, "HMS DSS"), (ras_unsteady_file, "RAS unsteady file")):
        if not path.is_file() or path.stat().st_size == 0:
            raise FileNotFoundError(f"{label} is missing or empty: {path}")
    if ras_unsteady_file.suffix.lower() not in {f".u{i:02d}" for i in range(1, 100)}:
        raise ValueError("RAS boundary input must be a .uNN file")
    project = ras_project_directory.resolve(strict=True)
    if not ras_unsteady_file.resolve(strict=True).is_relative_to(project):
        raise ValueError("RAS .uNN file must be inside the staged RAS project")
    if not ras_dss_file.resolve(strict=False).is_relative_to(project):
        raise ValueError("target DSS file must be inside the staged RAS project")
    if ras_dss_file.resolve(strict=False) == hms_dss_path.resolve(strict=True):
        raise ValueError("source and target DSS files must be distinct")

    try:
        from hms_commander.dss import HmsDss
        from ras_commander.dss import RasDss
        from ras_commander import RasUnsteady
    except ImportError as exc:
        raise HandoffError("DSS integration needs the pinned packages, Java, pyjnius, and compatible HEC Monolith libraries") from exc

    source_path = h["source_dss_pathname"]
    if source_path not in catalog_paths(HmsDss.get_catalog(hms_dss_path)):
        raise HandoffError("exact source pathname not found in HEC-HMS DSS catalog; implicit first-match selection is prohibited")
    frame = HmsDss.read_timeseries(hms_dss_path, source_path)
    local_times, utc_times, values, series_summary = validate_hydrograph_frame(
        frame, pathname=source_path, element_name=h["source_element_name"],
        run_name=h["source_run_name"], interval=h["interval"],
        source_units=h["source_flow_units"], target_units=h["flow_units"],
        conversion_method=h["conversion_method"], time_zone=h["time_zone"],
    )
    target_path = h["ras_dss_pathname"]
    target_parts = parse_dss_pathname(target_path)
    if target_parts[2].upper() != "FLOW" or target_parts[4].upper() != h["interval"].upper():
        raise ValueError("target pathname must identify FLOW at the same explicit time interval")

    boundary = h["boundary_selector"]
    mode = boundary["mode"]
    river = boundary["river"] if mode == "1D" else None
    reach = boundary["reach"] if mode == "1D" else None
    station = boundary["station"] if mode == "1D" else None
    selector: dict[str, Any] = {"expected_bc_type": boundary["expected_bc_type"]}
    if mode == "2D":
        selector.update(sa_2d_name=boundary["area_2d"], bc_line=boundary["bc_line"])
    elif mode == "INDEX":
        selector["boundary_index"] = boundary["boundary_index"]
    elif mode != "1D":
        raise ValueError("boundary selector mode must be 1D, 2D, or INDEX")

    before_unsteady_hash = sha256_file(ras_unsteady_file)
    previous_dss_hash = sha256_file(ras_dss_file) if ras_dss_file.is_file() else None
    ras_dss_file.parent.mkdir(parents=True, exist_ok=True)
    RasDss.write_timeseries(
        dss_file=ras_dss_file, pathname=target_path, times=local_times, values=values,
        units=h["flow_units"].upper(), data_type="INST-VAL", create_if_missing=True,
        dss_version=int(h.get("dss_version", 7)),
    )
    if not ras_dss_file.is_file() or ras_dss_file.stat().st_size == 0:
        raise HandoffError("ras-commander returned without a target DSS file")
    validation = RasDss.check_pathname_exists(ras_dss_file, target_path)
    if not validation_passed(validation):
        raise HandoffError(f"target DSS pathname did not validate: {validation}")

    reference = os.path.relpath(ras_dss_file, ras_unsteady_file.parent)
    if os.name == "nt":
        reference = reference.replace("/", "\\")
    changed = RasUnsteady.set_boundary_dss_link(
        unsteady_file=ras_unsteady_file, river=river, reach=reach, station=station,
        dss_file=reference, dss_path=target_path, interval=h["interval"], **selector,
    )
    if changed is not True:
        raise HandoffError("ras-commander did not confirm the exact boundary update")
    unsteady_text = ras_unsteady_file.read_text(encoding="utf-8", errors="replace")
    if target_path not in unsteady_text:
        raise HandoffError("staged .uNN file does not reference the exact target DSS pathname")
    if not any(
        line.strip().startswith("DSS File=")
        and Path(line.split("=", 1)[1].strip().replace("\\", "/")).name == ras_dss_file.name
        for line in unsteady_text.splitlines()
    ):
        raise HandoffError("staged .uNN file does not reference the target DSS filename")

    report = {
        "schema_version": "1.0.0",
        "adapter": ADAPTER_VERSION,
        "hms_commander_version": hms_version,
        "hms_commander_source_commit": hms_commit,
        "ras_commander_version": ras_version,
        "ras_commander_source_commit": ras_commit,
        "source_dss": {"path": str(hms_dss_path), "sha256": sha256_file(hms_dss_path), "byte_length": hms_dss_path.stat().st_size},
        "target_dss": {
            "path": str(ras_dss_file), "sha256": sha256_file(ras_dss_file),
            "byte_length": ras_dss_file.stat().st_size, "pathname": target_path,
            "previous_sha256": previous_dss_hash, "pathname_validation_passed": True,
        },
        "target_unsteady_flow": {
            "path": str(ras_unsteady_file), "before_sha256": before_unsteady_hash,
            "after_sha256": sha256_file(ras_unsteady_file), "relative_dss_reference": reference,
            "boundary_selector": dict(boundary),
        },
        "series": series_summary,
        "status": "HANDOFF_WRITTEN_AND_STRUCTURALLY_CHECKED_HYDROLOGY_UNVALIDATED",
        "scientific_validation_status": "NOT_PERFORMED",
        "human_review_required": True,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = report_path.with_name(report_path.name + ".tmp")
    temporary.write_text(json.dumps(report, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")
    os.replace(temporary, report_path)
    return report


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--hms-dss", required=True, type=Path)
    parser.add_argument("--ras-project", required=True, type=Path)
    parser.add_argument("--ras-input", required=True, type=Path)
    parser.add_argument("--ras-dss", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        workspace = args.workspace.resolve(strict=True)
        ras_project = args.ras_project.resolve(strict=True)
        ras_input = args.ras_input.resolve(strict=True)
        ras_dss = args.ras_dss.resolve(strict=False)
        try:
            source_project = (workspace / manifest["hec_ras"]["project_directory"]).resolve(strict=True)
            source_input = (workspace / manifest["hydrograph_handoff"]["ras_input"]).resolve(strict=True)
            expected_relative_input = source_input.relative_to(source_project)
            actual_relative_input = ras_input.relative_to(ras_project)
        except (OSError, ValueError) as exc:
            raise ValueError("cannot map RAS boundary file into the staged project: " + str(exc)) from exc
        if expected_relative_input != actual_relative_input:
            raise ValueError("passed --ras-input does not correspond to hydrograph_handoff.ras_input in the staged project")
        if ras_dss != (ras_project / manifest["hydrograph_handoff"]["ras_dss_relative_path"]).resolve():
            raise ValueError("passed --ras-dss does not match hydrograph_handoff.ras_dss_relative_path")
        report = execute_handoff(
            manifest=manifest, hms_dss_path=args.hms_dss.resolve(strict=True),
            ras_project_directory=ras_project,
            ras_unsteady_file=ras_input,
            ras_dss_file=ras_dss,
            report_path=args.report.resolve(strict=False),
        )
        print(json.dumps({"ok": True, "status": report["status"], "report": str(args.report),
                          "target_dss_sha256": report["target_dss"]["sha256"]}, indent=2))
        return 0
    except Exception as exc:
        print(json.dumps({"ok": False, "status": "FAILED_OR_BLOCKED",
                          "error": f"{type(exc).__name__}: {exc}"}, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
