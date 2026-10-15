"""Fail-closed CSV validation for proposed HEC-RAS boundary hydrographs.

This validates data shape and supplied hydraulic evidence only. It does not query
USGS, prove a gauge is live/representative, or certify boundary conditions.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import math
from pathlib import Path
from typing import Any, Mapping

GAUGE_BY_BOUNDARY = {
    "WABASH_INFLOW": "03378500",
    "OHIO_TAILWATER": "03322000",
}
MIN_SLOPE_FT_FT = 0.0001
MAX_SLOPE_FT_FT = 0.0008
MAX_FROUDE = 0.85
DEFAULT_INTERVAL = timedelta(minutes=15)


@dataclass(frozen=True)
class BoundaryValidation:
    status: str
    boundary: str
    gauge_id: str
    records_seen: int
    missing_records: int
    missing_fraction: float
    max_consecutive_missing: int
    max_froude: float | None
    errors: tuple[str, ...]

    @property
    def valid(self) -> bool:
        return self.status == "VALIDATED_FOR_REVIEW" and not self.errors

    def as_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "boundary": self.boundary,
            "gauge_id": self.gauge_id,
            "records_seen": self.records_seen,
            "missing_records": self.missing_records,
            "missing_fraction": self.missing_fraction,
            "max_consecutive_missing": self.max_consecutive_missing,
            "max_froude": self.max_froude,
            "errors": list(self.errors),
            "execution_allowed": False,
        }


def _parse_timestamp(value: str) -> datetime:
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("timestamps must include a UTC offset or Z suffix")
    return parsed.astimezone(timezone.utc)


def _consecutive_true(values: list[bool]) -> int:
    current = longest = 0
    for value in values:
        current = current + 1 if value else 0
        longest = max(longest, current)
    return longest


def validate_boundary_csv(
    csv_path: str | Path,
    *,
    boundary: str,
    gauge_id: str,
    normal_depth_slope_ft_ft: float | None,
    telemetry_evidence: Mapping[str, Any] | None = None,
    interval: timedelta = DEFAULT_INTERVAL,
    max_consecutive_missing: int = 2,
    max_missing_fraction: float = 0.01,
    max_telemetry_age: timedelta = timedelta(minutes=30),
    now: datetime | None = None,
) -> BoundaryValidation:
    """Validate a CSV with timestamp, flow_cfs, and froude_number columns.

    Missing timestamps are reconstructed on the expected interval grid and count
    as missing records. Froude is accepted only as an explicitly supplied value;
    discharge alone is not sufficient to calculate it.
    """
    errors: list[str] = []
    expected_gauge = GAUGE_BY_BOUNDARY.get(boundary)
    if expected_gauge is None:
        errors.append(f"unknown boundary: {boundary}")
    elif gauge_id != expected_gauge:
        errors.append(f"{boundary} requires configured gauge {expected_gauge}, not {gauge_id}")

    if interval.total_seconds() <= 0:
        errors.append("interval must be positive")
    if max_consecutive_missing < 0 or not 0 <= max_missing_fraction <= 1:
        errors.append("missing-data thresholds are invalid")
    if normal_depth_slope_ft_ft is None or not math.isfinite(normal_depth_slope_ft_ft):
        errors.append("normal-depth slope is required and must be finite")
    elif not MIN_SLOPE_FT_FT <= normal_depth_slope_ft_ft <= MAX_SLOPE_FT_FT:
        errors.append(
            f"normal-depth slope must be within [{MIN_SLOPE_FT_FT}, {MAX_SLOPE_FT_FT}] ft/ft"
        )

    current_time = now or datetime.now(timezone.utc)
    if current_time.tzinfo is None or current_time.utcoffset() is None:
        errors.append("now must be timezone-aware")
    evidence = telemetry_evidence or {}
    if evidence.get("verified") is not True or evidence.get("gauge_id") != gauge_id:
        errors.append("verified, gauge-matched telemetry evidence is required; CSV contents do not prove live status")
    else:
        try:
            observed_at = _parse_timestamp(str(evidence.get("observed_at", "")))
            if current_time.tzinfo is not None and observed_at < current_time.astimezone(timezone.utc) - max_telemetry_age:
                errors.append("telemetry evidence is stale")
            if observed_at > current_time.astimezone(timezone.utc) + timedelta(minutes=2):
                errors.append("telemetry evidence timestamp is in the future")
        except (ValueError, TypeError):
            errors.append("telemetry evidence requires a valid timezone-aware observed_at timestamp")

    rows: list[tuple[datetime, float | None, float | None]] = []
    try:
        with Path(csv_path).open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            required = {"timestamp", "flow_cfs", "froude_number"}
            if reader.fieldnames is None or not required.issubset(set(reader.fieldnames)):
                errors.append("CSV requires columns: timestamp, flow_cfs, froude_number")
            else:
                for line_number, row in enumerate(reader, start=2):
                    try:
                        stamp = _parse_timestamp(row["timestamp"])
                        flow_text = (row.get("flow_cfs") or "").strip()
                        froude_text = (row.get("froude_number") or "").strip()
                        flow = float(flow_text) if flow_text else None
                        froude = float(froude_text) if froude_text else None
                        if flow is not None and (not math.isfinite(flow) or flow < 0):
                            raise ValueError("flow_cfs must be finite and non-negative")
                        if froude is not None and (not math.isfinite(froude) or froude < 0):
                            raise ValueError("froude_number must be finite and non-negative")
                        rows.append((stamp, flow, froude))
                    except (ValueError, TypeError, KeyError) as exc:
                        errors.append(f"CSV line {line_number}: {exc}")
    except OSError as exc:
        errors.append(f"unable to read CSV: {exc}")

    rows.sort(key=lambda row: row[0])
    if len(rows) < 2:
        errors.append("at least two CSV records are required")
    if any(rows[i][0] == rows[i + 1][0] for i in range(len(rows) - 1)):
        errors.append("duplicate timestamps are prohibited")
    if any(rows[i][0] > rows[i + 1][0] for i in range(len(rows) - 1)):
        errors.append("timestamps must be increasing")

    expected_rows: list[tuple[datetime, float | None, float | None]] = []
    if rows and interval.total_seconds() > 0:
        by_time = {row[0]: row for row in rows}
        start, end = rows[0][0], rows[-1][0]
        cursor = start
        while cursor <= end:
            expected_rows.append(by_time.get(cursor, (cursor, None, None)))
            cursor += interval
        if expected_rows[-1][0] != end:
            errors.append("timestamps do not align to the expected interval grid")

    missing_mask = [flow is None for _, flow, _ in expected_rows]
    missing_count = sum(missing_mask)
    missing_fraction = missing_count / len(expected_rows) if expected_rows else 1.0
    longest_missing = _consecutive_true(missing_mask)
    if missing_fraction > max_missing_fraction:
        errors.append(f"missing-data fraction {missing_fraction:.3%} exceeds {max_missing_fraction:.3%}")
    if longest_missing > max_consecutive_missing:
        errors.append(f"{longest_missing} consecutive missing records exceeds limit {max_consecutive_missing}")

    froudes = [froude for _, flow, froude in expected_rows if flow is not None and froude is not None]
    if any(flow is not None and froude is None for _, flow, froude in expected_rows):
        errors.append("Froude evidence is missing for one or more non-missing flow records")
    max_froude = max(froudes) if froudes else None
    if max_froude is None:
        errors.append("at least one supplied, geometry-derived Froude value is required")
    elif max_froude >= MAX_FROUDE:
        errors.append(f"maximum supplied Froude {max_froude:.3f} is not below {MAX_FROUDE:.2f}")

    return BoundaryValidation(
        status="VALIDATED_FOR_REVIEW" if not errors else "PIPELINE_LOCKED",
        boundary=boundary,
        gauge_id=gauge_id,
        records_seen=len(rows),
        missing_records=missing_count,
        missing_fraction=missing_fraction,
        max_consecutive_missing=longest_missing,
        max_froude=max_froude,
        errors=tuple(errors),
    )
