"""Read-only HEC-RAS HDF5 WSE extraction with explicit schema checks.

Dataset paths vary by HEC-RAS version and project geometry. Callers must provide
verified paths from the actual result file; this module does not mutate HDF5.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any


def extract_wse_records(
    hdf_path: str | Path,
    output_json_path: str | Path,
    *,
    water_surface_dataset: str,
    cell_center_dataset: str,
    expected_crs_epsg: int = 2967,
    expected_vertical_datum: str = "NAVD88",
    nodata_threshold: float = -9000.0,
) -> dict[str, Any]:
    """Export the final time row and cell centers only when HDF5 structure is consistent.

    The function requires h5py and checks shape/metadata. It cannot independently
    establish that WSE values are in feet or the expected vertical datum unless
    the source file contains matching metadata attributes.
    """
    source = Path(hdf_path)
    target = Path(output_json_path)
    if not source.is_file():
        return {"status": "EXTRACTION_BLOCKED", "reason": f"source file not found: {source}"}
    water_surface_dataset = water_surface_dataset.strip("/")
    cell_center_dataset = cell_center_dataset.strip("/")
    if not water_surface_dataset or not cell_center_dataset:
        return {"status": "EXTRACTION_BLOCKED", "reason": "explicit dataset paths are required"}
    try:
        import h5py  # type: ignore[import-not-found]
        import numpy as np
    except ImportError:
        return {"status": "EXTRACTION_BLOCKED", "reason": "h5py and numpy are required for HDF5 extraction"}

    try:
        with h5py.File(source, "r") as h5:
            if water_surface_dataset not in h5 or cell_center_dataset not in h5:
                return {"status": "EXTRACTION_BLOCKED", "reason": "configured WSE or cell-center dataset is absent"}
            wse_ds = h5[water_surface_dataset]
            coords_ds = h5[cell_center_dataset]
            if wse_ds.ndim != 2 or wse_ds.shape[0] < 1:
                return {"status": "EXTRACTION_BLOCKED", "reason": "WSE dataset must have shape (time, cells)"}
            if coords_ds.ndim != 2 or coords_ds.shape[1] < 2:
                return {"status": "EXTRACTION_BLOCKED", "reason": "cell centers must have shape (cells, >=2)"}
            if wse_ds.shape[1] != coords_ds.shape[0]:
                return {"status": "EXTRACTION_BLOCKED", "reason": "WSE cell count does not match cell-center count"}
            final_time_index = int(wse_ds.shape[0] - 1)

            attrs = {}
            for key in ("Projection EPSG", "EPSG", "Coordinate System EPSG", "Vertical Datum", "Units"):
                if key in h5.attrs:
                    val = h5.attrs[key]
                    attrs[key] = val.decode("utf-8", "replace") if isinstance(val, bytes) else str(val)
            epsg_values = [v for k, v in attrs.items() if "EPSG" in k]
            if epsg_values and not any(str(expected_crs_epsg) in v for v in epsg_values):
                return {"status": "EXTRACTION_BLOCKED", "reason": "file-level CRS metadata conflicts with requested EPSG"}
            datum_values = [v for k, v in attrs.items() if "Datum" in k]
            if datum_values and not any(expected_vertical_datum.lower() in v.lower() for v in datum_values):
                return {"status": "EXTRACTION_BLOCKED", "reason": "file-level vertical-datum metadata conflicts with requested datum"}

            final_wse = np.asarray(wse_ds[final_time_index, :], dtype=float)
            coords = np.asarray(coords_ds[:, :2], dtype=float)
            records = []
            for index, (wse, xy) in enumerate(zip(final_wse, coords)):
                if not math.isfinite(float(wse)) or float(wse) < nodata_threshold:
                    continue
                if not all(math.isfinite(float(v)) for v in xy):
                    continue
                records.append({
                    "cell_index": index,
                    "coordinates_projected": [float(xy[0]), float(xy[1])],
                    "final_wse": round(float(wse), 3),
                })

        units_values = [v for k, v in attrs.items() if "Units" in k]
        metadata_verified = bool(
            epsg_values
            and datum_values
            and units_values
            and any("ft" in value.lower() or "feet" in value.lower() for value in units_values)
        )
        payload = {
            "extraction_meta": {
                "source_file": source.name,
                "wse_dataset": water_surface_dataset,
                "cell_center_dataset": cell_center_dataset,
                "requested_horizontal_crs_epsg": expected_crs_epsg,
                "requested_vertical_datum": expected_vertical_datum,
                "wse_units": "feet" if metadata_verified else "UNVERIFIED",
                "crs_and_vertical_metadata_verified": metadata_verified,
                "records_extracted": len(records),
                "final_time_index": final_time_index,
            },
            "spatial_wse_records": records,
        }
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        return {"status": "EXTRACTED_FOR_REVIEW", "records_parsed": len(records), "output_file": str(target)}
    except (OSError, ValueError, TypeError, KeyError) as exc:
        return {"status": "EXTRACTION_BLOCKED", "reason": f"unable to read/validate HDF5: {exc}"}
