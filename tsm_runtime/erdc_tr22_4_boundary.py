"""Reconstruct ERDC/CHL TR-22-4 boundary-flow arithmetic for review only.

The report describes Wabash inflow as the sum of three USGS gauges and derives
the J. T. Myers inflow as combined flow minus the Wabash contribution. This
module checks aligned CSV arithmetic; it does not fetch USGS data, apply travel
time, validate gauge representativeness, or authorize any model execution.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime, timezone
import math
from pathlib import Path
from typing import Mapping


COMBINED_GAUGE = "03381700"
WABASH_COMPONENT_GAUGES = ("03378500", "03378550", "03381500")
REQUIRED_GAUGES = (COMBINED_GAUGE, *WABASH_COMPONENT_GAUGES)


@dataclass(frozen=True)
class BoundaryDerivation:
    status: str
    records: tuple[dict[str, float | str], ...]
    gauge_ids: tuple[str, ...]
    errors: tuple[str, ...]

    @property
    def valid_for_review(self) -> bool:
        return self.status == "DERIVED_FOR_REVIEW" and not self.errors

    def as_dict(self) -> dict[str, object]:
        return {
            "status": self.status,
            "records": list(self.records),
            "gauge_ids": list(self.gauge_ids),
            "errors": list(self.errors),
            "execution_allowed": False,
            "source_method": "ERDC/CHL TR-22-4 reported gauge arithmetic; no lag correction",
        }


def _parse_timestamp(value: str) -> datetime:
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("timestamp must include UTC offset or Z")
    return parsed.astimezone(timezone.utc)


def _read_gauge_csv(path: str | Path, gauge_id: str) -> tuple[dict[datetime, float], list[str]]:
    errors: list[str] = []
    values: dict[datetime, float] = {}
    try:
        with Path(path).open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            if reader.fieldnames is None or not {"timestamp", "flow_cfs"}.issubset(reader.fieldnames):
                return {}, [f"{gauge_id}: CSV requires timestamp,flow_cfs columns"]
            for line, row in enumerate(reader, start=2):
                try:
                    timestamp = _parse_timestamp(row["timestamp"])
                    flow = float(row["flow_cfs"])
                    if not math.isfinite(flow) or flow < 0:
                        raise ValueError("flow_cfs must be finite and non-negative")
                    if timestamp in values:
                        raise ValueError("duplicate timestamp")
                    values[timestamp] = flow
                except (ValueError, TypeError, KeyError) as exc:
                    errors.append(f"{gauge_id} line {line}: {exc}")
    except OSError as exc:
        errors.append(f"{gauge_id}: unable to read CSV: {exc}")
    if not values:
        errors.append(f"{gauge_id}: no valid discharge records")
    return values, errors


def derive_erdc_tr22_4_boundaries(
    gauge_csvs: Mapping[str, str | Path],
) -> BoundaryDerivation:
    """Derive Wabash inflow and J. T. Myers inflow from four aligned CSVs.

    Each CSV must use cfs and have timezone-aware timestamps. Timestamp sets
    must match exactly: no interpolation, silent row dropping, or travel-time
    adjustment is performed. Negative residual flow blocks the entire derivation.
    """
    errors: list[str] = []
    missing = [gauge for gauge in REQUIRED_GAUGES if gauge not in gauge_csvs]
    if missing:
        return BoundaryDerivation(
            "PIPELINE_LOCKED", (), tuple(sorted(gauge_csvs)),
            (f"missing required gauge CSVs: {', '.join(missing)}",),
        )

    series: dict[str, dict[datetime, float]] = {}
    for gauge_id in REQUIRED_GAUGES:
        values, gauge_errors = _read_gauge_csv(gauge_csvs[gauge_id], gauge_id)
        series[gauge_id] = values
        errors.extend(gauge_errors)
    if errors:
        return BoundaryDerivation("PIPELINE_LOCKED", (), REQUIRED_GAUGES, tuple(errors))

    reference = set(series[COMBINED_GAUGE])
    for gauge_id in WABASH_COMPONENT_GAUGES:
        if set(series[gauge_id]) != reference:
            errors.append(f"{gauge_id}: timestamp grid differs from combined gauge {COMBINED_GAUGE}")
    if errors:
        return BoundaryDerivation("PIPELINE_LOCKED", (), REQUIRED_GAUGES, tuple(errors))
    if not reference:
        return BoundaryDerivation("PIPELINE_LOCKED", (), REQUIRED_GAUGES, ("no common timestamps",))

    records: list[dict[str, float | str]] = []
    for stamp in sorted(reference):
        wabash = sum(series[gauge][stamp] for gauge in WABASH_COMPONENT_GAUGES)
        combined = series[COMBINED_GAUGE][stamp]
        ohio = combined - wabash
        if ohio < 0:
            errors.append(
                f"{stamp.isoformat()}: combined flow {combined:g} cfs is below "
                f"the summed Wabash flow {wabash:g} cfs"
            )
            continue
        records.append({
            "timestamp": stamp.isoformat().replace("+00:00", "Z"),
            "wabash_inflow_cfs": wabash,
            "combined_flow_cfs": combined,
            "j_t_myers_inflow_cfs": ohio,
        })

    if errors:
        return BoundaryDerivation("PIPELINE_LOCKED", (), REQUIRED_GAUGES, tuple(errors))
    if not records:
        return BoundaryDerivation("PIPELINE_LOCKED", (), REQUIRED_GAUGES, ("no derived records",))
    return BoundaryDerivation("DERIVED_FOR_REVIEW", tuple(records), REQUIRED_GAUGES, ())
