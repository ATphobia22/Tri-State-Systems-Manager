#!/usr/bin/env python3
"""Bounded project-sidecar check for converting DEM Z samples to display feet.

This is a LOCAL project-declared provenance check, not independent USGS/IGIO
vertical certification, survey QA, or a geoid transformation. Missing, unpinned
or contradictory evidence yields None, keeping building footprints usable while
elevations remain unavailable.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

FT_PER_M = 3.280839895013123
MAX_SIDECAR_BYTES = 256 * 1024
MAX_DEM_BYTES = 2 * 1024 * 1024 * 1024

def pinned_navd88_scale_to_ft(dem: Path) -> float | None:
    """Return feet per input Z unit only after matching a pinned local raster."""
    sidecar = dem.with_suffix(".provenance.json")
    try:
        if (not dem.is_file() or dem.is_symlink() or not sidecar.is_file()
                or sidecar.is_symlink() or sidecar.stat().st_size > MAX_SIDECAR_BYTES
                or dem.stat().st_size > MAX_DEM_BYTES):
            return None
        record = json.loads(sidecar.read_text(encoding="utf-8"))
        if not isinstance(record, dict) or Path(str(record.get("asset_path", ""))).name != dem.name:
            return None
        wanted = record.get("asset_sha256")
        if not isinstance(wanted, str) or len(wanted) != 64 or any(c not in "0123456789abcdef" for c in wanted):
            return None
        raster = record.get("raster")
        if not isinstance(raster, dict) or raster.get("vertical_datum") != "NAVD88":
            return None
        units = raster.get("elevation_units")
        conversions = {
            "metres": FT_PER_M, "meters": FT_PER_M, "m": FT_PER_M,
            "feet": 1.0, "ft": 1.0, "us_survey_feet": 1.0,
        }
        scale = conversions.get(units) if isinstance(units, str) else None
        if scale is None or not math.isfinite(scale):
            return None
        digest = hashlib.sha256()
        with dem.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
        return scale if digest.hexdigest() == wanted else None
    except (ValueError, OSError, UnicodeError, TypeError):
        return None
