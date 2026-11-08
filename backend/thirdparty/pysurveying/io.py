from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
import pandas as pd

from .models import AdjustmentResult, LevelObservation, Observation, Point


def read_csv(path, **kwargs) -> pd.DataFrame:
    return pd.read_csv(path, **kwargs)


def read_excel(path, **kwargs) -> pd.DataFrame:
    return pd.read_excel(path, **kwargs)


def normalize_point_columns(data: pd.DataFrame) -> pd.DataFrame:
    """Normalize common point-table column names to ``name, x, y, z`` where possible."""
    aliases = {
        "name": {"name", "point", "point_id", "pointid", "pt", "id", "点名", "点号"},
        "x": {"x", "e", "east", "easting", "横坐标"},
        "y": {"y", "n", "north", "northing", "纵坐标"},
        "z": {"z", "h", "height", "elevation", "高程"},
        "fixed": {"fixed", "control", "known", "固定", "已知"},
    }
    rename: dict[str, str] = {}
    lower = {str(column).strip().lower(): column for column in data.columns}
    for target, candidates in aliases.items():
        for candidate in candidates:
            key = candidate.lower()
            if key in lower:
                rename[lower[key]] = target
                break
    return data.rename(columns=rename).copy()


def _as_bool(value) -> bool:
    if pd.isna(value):
        return False
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "fixed", "known", "是", "已知"}
    return bool(value)


def points_from_dataframe(data: pd.DataFrame) -> list[Point]:
    """Convert a normalized or common point table into :class:`Point` objects."""
    table = normalize_point_columns(data)
    required = {"name", "x", "y"}
    missing = required - set(table.columns)
    if missing:
        raise ValueError(f"point table is missing columns: {sorted(missing)}")

    points: list[Point] = []
    for _, row in table.iterrows():
        z = None
        if "z" in table.columns and pd.notna(row["z"]):
            z = float(row["z"])
        fixed = _as_bool(row["fixed"]) if "fixed" in table.columns else False
        points.append(
            Point(
                name=str(row["name"]),
                x=float(row["x"]),
                y=float(row["y"]),
                z=z,
                fixed=fixed,
            )
        )
    return points


def observations_from_dataframe(data: pd.DataFrame) -> list[Observation]:
    """Convert a control-network observation table into ``Observation`` objects.

    Required columns are ``kind, from_point, to_point, value``. Optional columns are
    ``sigma`` and ``target2``. This deliberately uses an explicit compact schema so
    instrument-specific parsing remains separate from adjustment code.
    """
    table = data.copy()
    aliases = {
        "kind": {"kind", "type", "observation", "观测类型"},
        "from_point": {"from_point", "from", "station", "测站", "起点"},
        "to_point": {"to_point", "to", "target", "照准点", "终点"},
        "target2": {"target2", "foresight", "前视", "前视点"},
        "value": {"value", "observed", "measurement", "观测值"},
        "sigma": {"sigma", "std", "stdev", "标准差", "中误差"},
    }
    lower = {str(column).strip().lower(): column for column in table.columns}
    rename: dict[str, str] = {}
    for target, candidates in aliases.items():
        for candidate in candidates:
            key = candidate.lower()
            if key in lower:
                rename[lower[key]] = target
                break
    table = table.rename(columns=rename)

    required = {"kind", "from_point", "to_point", "value"}
    missing = required - set(table.columns)
    if missing:
        raise ValueError(f"observation table is missing columns: {sorted(missing)}")

    observations: list[Observation] = []
    for _, row in table.iterrows():
        target2 = None
        if "target2" in table.columns and pd.notna(row["target2"]):
            text = str(row["target2"]).strip()
            target2 = text or None
        sigma = float(row["sigma"]) if "sigma" in table.columns and pd.notna(row["sigma"]) else 1.0
        observations.append(
            Observation(
                kind=str(row["kind"]).strip(),
                from_point=str(row["from_point"]).strip(),
                to_point=str(row["to_point"]).strip(),
                value=float(row["value"]),
                sigma=sigma,
                target2=target2,
            )
        )
    return observations


def level_observations_from_dataframe(data: pd.DataFrame) -> list[LevelObservation]:
    """Convert a leveling table into ``LevelObservation`` objects."""
    table = data.copy()
    aliases = {
        "from_point": {"from_point", "from", "start", "后视点", "起点"},
        "to_point": {"to_point", "to", "end", "前视点", "终点"},
        "height_difference": {"height_difference", "dh", "delta_h", "高差"},
        "sigma": {"sigma", "std", "stdev", "标准差", "中误差"},
    }
    lower = {str(column).strip().lower(): column for column in table.columns}
    rename: dict[str, str] = {}
    for target, candidates in aliases.items():
        for candidate in candidates:
            key = candidate.lower()
            if key in lower:
                rename[lower[key]] = target
                break
    table = table.rename(columns=rename)

    required = {"from_point", "to_point", "height_difference"}
    missing = required - set(table.columns)
    if missing:
        raise ValueError(f"leveling table is missing columns: {sorted(missing)}")

    observations: list[LevelObservation] = []
    for _, row in table.iterrows():
        sigma = float(row["sigma"]) if "sigma" in table.columns and pd.notna(row["sigma"]) else 1.0
        observations.append(
            LevelObservation(
                from_point=str(row["from_point"]).strip(),
                to_point=str(row["to_point"]).strip(),
                height_difference=float(row["height_difference"]),
                sigma=sigma,
            )
        )
    return observations


def read_landxml_points(path: str | Path) -> pd.DataFrame:
    """Read ``CgPoint`` coordinates from common LandXML files.

    LandXML commonly stores CgPoint text as northing, easting and optional elevation.
    The returned DataFrame normalizes these to columns ``name, x, y, z`` using
    ``x=easting`` and ``y=northing`` to match the local planar package convention.
    """
    root = ET.parse(path).getroot()
    rows = []
    for element in root.iter():
        if element.tag.split("}")[-1] != "CgPoint":
            continue
        parts = (element.text or "").split()
        if len(parts) < 2:
            continue
        rows.append(
            {
                "name": element.attrib.get("name") or element.attrib.get("oID"),
                "x": float(parts[1]),
                "y": float(parts[0]),
                "z": float(parts[2]) if len(parts) > 2 else np.nan,
            }
        )
    return pd.DataFrame(rows, columns=["name", "x", "y", "z"])


def read_gsi(path: str | Path) -> pd.DataFrame:
    """Best-effort reader for Leica GSI word records.

    This deliberately returns low-level word/value records instead of pretending to
    support every Leica GSI generation and project template.
    """
    rows = []
    pattern = re.compile(r"^(?P<word>\d{2,3})[^+\-]*(?P<value>[+\-]\d+)")
    with open(path, "r", encoding="latin-1") as file:
        for line_number, line in enumerate(file, start=1):
            for token in line.strip().split():
                match = pattern.match(token)
                if match:
                    rows.append(
                        {
                            "line": line_number,
                            "word": match.group("word"),
                            "value": int(match.group("value")),
                            "raw": token,
                        }
                    )
    return pd.DataFrame(rows)


def read_points(path: str | Path, **kwargs) -> pd.DataFrame:
    """Auto-detect a common point-table format from the file extension."""
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return normalize_point_columns(read_csv(path, **kwargs))
    if suffix in {".xlsx", ".xlsm"}:
        return normalize_point_columns(read_excel(path, **kwargs))
    if suffix in {".xml", ".landxml"}:
        return read_landxml_points(path)
    if suffix in {".gsi", ".gsi8", ".gsi16"}:
        return read_gsi(path)
    raise ValueError(f"unsupported point/instrument file extension: {suffix}")


def write_points(data: pd.DataFrame, path: str | Path, **kwargs) -> Path:
    """Write a point table to CSV or XLSX."""
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == ".csv":
        data.to_csv(path, index=False, **kwargs)
    elif suffix == ".xlsx":
        data.to_excel(path, index=False, **kwargs)
    else:
        raise ValueError("write_points supports .csv and .xlsx")
    return path


def adjustment_tables(result: AdjustmentResult) -> dict[str, pd.DataFrame]:
    """Convert an adjustment result into export-friendly tables.

    When the result contains control-network quality metadata, the residual sheet
    automatically includes raw residuals, standardized residuals, redundancy
    numbers, observation kinds and final robust weights.
    """
    metadata = result.metadata or {}
    parameters = pd.DataFrame(
        {"index": np.arange(len(result.parameters)), "value": np.asarray(result.parameters)}
    )

    residual_values = np.asarray(result.residuals, dtype=float)
    residual_data: dict[str, object] = {
        "index": np.arange(len(residual_values)),
        "residual": residual_values,
    }
    raw_residuals = metadata.get("raw_residuals")
    if raw_residuals is not None and len(raw_residuals) == len(residual_values):
        residual_data["residual_observation_unit"] = np.asarray(raw_residuals, dtype=float)
    observation_kinds = metadata.get("observation_kinds")
    if observation_kinds is not None and len(observation_kinds) == len(residual_values):
        residual_data["kind"] = list(observation_kinds)
    redundancy = metadata.get("redundancy_numbers")
    if redundancy is not None and len(redundancy) == len(residual_values):
        residual_data["redundancy"] = np.asarray(redundancy, dtype=float)
    robust_weights = metadata.get("robust_weights")
    if robust_weights is not None and len(robust_weights) == len(residual_values):
        residual_data["robust_weight"] = np.asarray(robust_weights, dtype=float)

    qvv = metadata.get("qvv")
    if qvv is not None and result.sigma0 is not None and result.sigma0 > 0:
        qvv_array = np.asarray(qvv, dtype=float)
        if qvv_array.shape == (len(residual_values), len(residual_values)):
            scale = result.sigma0 * np.sqrt(np.maximum(np.diag(qvv_array), 0.0))
            standardized = np.zeros_like(residual_values)
            valid = scale > np.finfo(float).eps
            standardized[valid] = residual_values[valid] / scale[valid]
            residual_data["standardized_residual"] = standardized

    residuals = pd.DataFrame(residual_data)
    summary_row = {
        "sigma0": result.sigma0,
        "dof": result.dof,
        "converged": result.converged,
        "iterations": result.iterations,
        "rank": metadata.get("rank"),
    }
    if redundancy is not None:
        summary_row["redundancy_sum"] = float(np.sum(np.asarray(redundancy, dtype=float)))
    summary = pd.DataFrame([summary_row])
    tables = {"summary": summary, "parameters": parameters, "residuals": residuals}

    adjusted_points = metadata.get("adjusted_points")
    if adjusted_points:
        tables["adjusted_points"] = pd.DataFrame(
            [
                {"name": name, "x": coordinates[0], "y": coordinates[1]}
                for name, coordinates in adjusted_points.items()
            ]
        )
    adjusted_heights = metadata.get("adjusted_heights")
    if adjusted_heights:
        tables["adjusted_heights"] = pd.DataFrame(
            [{"name": name, "height": value} for name, value in adjusted_heights.items()]
        )
    return tables


def export_adjustment_excel(result: AdjustmentResult, path: str | Path) -> Path:
    """Export adjustment summary, parameters, residual diagnostics and adjusted values."""
    path = Path(path)
    if path.suffix.lower() != ".xlsx":
        raise ValueError("export path must end with .xlsx")
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        for sheet_name, table in adjustment_tables(result).items():
            table.to_excel(writer, sheet_name=sheet_name[:31], index=False)
    return path
