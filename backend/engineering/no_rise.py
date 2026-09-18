"""Compare paired HEC-RAS Water Surface outputs under identical model conditions."""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import math
from pathlib import Path

from .hecras_hdf5 import discover_water_surface_datasets, read_water_surface


@dataclass(frozen=True)
class NoRiseResult:
    max_rise_ft: float
    max_drop_ft: float
    mean_delta_ft: float
    compared_values: int
    compliant: bool
    criterion_ft: float
    base_model_hash: str
    proposed_model_hash: str


def _file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def compare_water_surface(base_hdf: str | Path, proposed_hdf: str | Path, *, criterion_ft: float, time_index: int = -1, dataset_path: str | None = None) -> NoRiseResult:
    if not math.isfinite(criterion_ft) or criterion_ft < 0:
        raise ValueError("criterion_ft must be a finite non-negative value supplied by the governing design/regulatory basis")
    base = Path(base_hdf)
    proposed = Path(proposed_hdf)
    if dataset_path is None:
        base_refs = discover_water_surface_datasets(base)
        proposed_refs = discover_water_surface_datasets(proposed)
        base_names = {ref.dataset_name for ref in base_refs}
        common = next((ref.dataset_name for ref in proposed_refs if ref.dataset_name in base_names), None)
        if common is None:
            raise ValueError("no common 2D Flow Area Water Surface dataset exists between base and proposed models")
        dataset_path = f"Results/Unsteady/Output/Output Blocks/Base Output/Unsteady Time Series/2D Flow Areas/{common}"
        if not dataset_path.endswith("/Water Surface"):
            dataset_path += "/Water Surface"
    base_values = read_water_surface(base, dataset_path, time_index)
    proposed_values = read_water_surface(proposed, dataset_path, time_index)
    if len(base_values) != len(proposed_values):
        raise ValueError("base and proposed Water Surface arrays have different cell/node counts")
    deltas = [p - b for b, p in zip(base_values, proposed_values) if math.isfinite(b) and math.isfinite(p)]
    if not deltas:
        raise ValueError("no finite paired Water Surface values were available")
    return NoRiseResult(max(deltas), min(deltas), sum(deltas) / len(deltas), len(deltas), max(deltas) <= criterion_ft, criterion_ft, _file_hash(base), _file_hash(proposed))


def load_verified_regulatory_rule(rule_id: str, jurisdiction: str) -> dict:
    """Load a verified jurisdictional rule; never infer a regulatory threshold."""
    registry_path = Path(__file__).resolve().parents[2] / "data" / "regulatory" / "tsm-floodway-rules-v1.json"
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    for rule in registry.get("rules", []):
        if rule.get("id") == rule_id:
            if rule.get("jurisdiction") != jurisdiction:
                raise ValueError("regulatory rule jurisdiction does not match requested jurisdiction")
            if rule.get("status") != "VERIFIED_OFFICIAL_SOURCE":
                raise ValueError("regulatory rule is not verified against an official source")
            return rule
    raise ValueError(f"verified regulatory rule not found: {rule_id}")


def compare_water_surface_under_rule(
    base_hdf: str | Path,
    proposed_hdf: str | Path,
    *,
    rule_id: str,
    jurisdiction: str,
    time_index: int = -1,
    dataset_path: str | None = None,
) -> NoRiseResult:
    """Run a WSE comparison only when a verified rule supplies a numeric criterion."""
    rule = load_verified_regulatory_rule(rule_id, jurisdiction)
    threshold = rule.get("threshold")
    if not isinstance(threshold, (int, float)) or not math.isfinite(threshold):
        raise ValueError("selected regulatory rule has no numeric comparison threshold")
    if rule.get("comparison") not in {"less_than", "less_than_or_equal", "no_increase"}:
        raise ValueError("selected regulatory rule does not define a supported comparison")

    result = compare_water_surface(
        base_hdf,
        proposed_hdf,
        criterion_ft=float(threshold),
        time_index=time_index,
        dataset_path=dataset_path,
    )
    if rule["comparison"] == "less_than":
        return NoRiseResult(
            result.max_rise_ft,
            result.max_drop_ft,
            result.mean_delta_ft,
            result.compared_values,
            result.max_rise_ft < float(threshold),
            result.criterion_ft,
            result.base_model_hash,
            result.proposed_model_hash,
        )
    return result


def result_manifest(result: NoRiseResult) -> str:
    return json.dumps(result.__dict__, sort_keys=True, separators=(",", ":"))
