#!/usr/bin/env python3
"""
TSM PDAL LiDAR Processing Pipelines.

Generates and executes PDAL (Point Data Abstraction Library) pipelines for the
Tri-State Systems Manager tri-state LiDAR fabric. PDAL is the point-cloud
equivalent of GDAL: it builds JSON data-processing pipelines to filter,
classify, thin, and rasterize raw LAS/LAZ/EPT point clouds.

Input sources: USGS 3DEP EPT resources — see
scripts/flood-forecasting/tsm_usgs_lidar_ept.py for the tri-state EPT registry
(IN_2020 covers Posey, Vanderburgh, Warrick, Gibson in EPSG:2968 / NAVD88).

PDAL docs: https://pdal.io/

Each builder returns a PDAL pipeline JSON dict (the "pipeline" key). The
executor `run_pipeline()` shells out to `pdal pipeline`. If PDAL is not
installed, builders still work (they only produce JSON); the executor and
--check report a clear error.

Requires: PDAL >= 2.5 on the machine that executes pipelines.
Install: conda install -c conda-forge pdal  (or apt install pdal on Ubuntu)
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# PDAL availability
# ---------------------------------------------------------------------------

PDAL_BIN = shutil.which("pdal")


def pdal_available() -> bool:
    """True when the `pdal` CLI is on PATH."""
    return PDAL_BIN is not None


def require_pdal() -> str:
    """Return the pdal binary path, or raise a clear error."""
    if not pdal_available():
        raise RuntimeError(
            "PDAL is not installed on this machine. "
            "Install it to execute pipelines: "
            "`conda install -c conda-forge pdal` or `apt install pdal`. "
            "Pipeline JSON generation still works without PDAL."
        )
    return PDAL_BIN  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Tri-state EPT inputs (mirrors scripts/flood-forecasting/tsm_usgs_lidar_ept.py)
# ---------------------------------------------------------------------------

TRISTATE_EPT = {
    "IN_2020": {
        "url": "https://s3-us-west-2.amazonaws.com/usgs-lidar-public/IN_2020/ept.json",
        "crs": "EPSG:2968",
        "vdatum": "NAVD88",
        "year": 2020,
        "quality": "QL2",
    },
}


def _reader_for(path_or_url: str) -> dict[str, Any]:
    """Pick the right PDAL reader stage for a path or URL."""
    lower = path_or_url.lower()
    if lower.endswith("ept.json"):
        return {"type": "readers.ept", "filename": path_or_url}
    if lower.endswith((".copc.laz", ".copc.copc.laz")):
        return {"type": "readers.copc", "filename": path_or_url}
    if lower.endswith((".laz", ".las")):
        return {"type": "readers.las", "filename": path_or_url}
    # Default: let PDAL guess from the filename.
    return {"type": "readers.las", "filename": path_or_url}


# ---------------------------------------------------------------------------
# Pipeline builders — each returns a {"pipeline": [...]} dict
# ---------------------------------------------------------------------------

def ground_filter_pipeline(
    input: str,
    output: str,
    *,
    bounds: str | None = None,
) -> dict[str, Any]:
    """
    Ground classification with the SMRF (Simple Morphological Filter).

    SMRF (filters.smrf) progressively opens the surface with increasing
    window sizes and classifies points within a slope-dependent threshold
    as ground (Classification = 2, ASPRS standard).

    Args:
        input: LAS/LAZ/COPC/EPT path or URL.
        output: output LAS/LAZ path with Classification populated.
        bounds: optional PDAL bounds string, e.g. "([411000,412000],[4188000,4189000])".
    """
    stages: list[dict[str, Any]] = [_reader_for(input)]
    if bounds:
        stages.append({"type": "filters.crop", "bounds": bounds})
    stages += [
        # Drop noise / withheld points before classification.
        {
            "type": "filters.range",
            "limits": "Classification![7:7], Withheld![1:1]",
        },
        {
            "type": "filters.smrf",
            "window": 18,
            "slope": 0.2,
            "threshold": 0.45,
            "scalar": 1.2,
        },
        {"type": "writers.las", "filename": output},
    ]
    return {"pipeline": stages}


def dem_pipeline(
    input: str,
    output_tif: str,
    *,
    resolution: float = 1.0,
    bounds: str | None = None,
    ground_only: bool = True,
) -> dict[str, Any]:
    """
    Rasterize a DEM GeoTIFF from point cloud data.

    When ground_only=True the pipeline first runs SMRF ground classification
    and keeps only ground points (Classification == 2), then interpolates a
    1 m (default) DEM with IDW via writers.gdal.

    Args:
        input: LAS/LAZ/COPC/EPT path or URL.
        output_tif: output GeoTIFF path.
        resolution: DEM cell size in the input CRS units (meters for UTM,
            feet for EPSG:2968 — Indiana State Plane West is in feet).
        bounds: optional PDAL bounds string to clip the area of interest.
        ground_only: classify ground first (recommended for DEMs).
    """
    stages: list[dict[str, Any]] = [_reader_for(input)]
    if bounds:
        stages.append({"type": "filters.crop", "bounds": bounds})
    if ground_only:
        stages += [
            {
                "type": "filters.smrf",
                "window": 18,
                "slope": 0.2,
                "threshold": 0.45,
                "scalar": 1.2,
            },
            {"type": "filters.range", "limits": "Classification[2:2]"},
        ]
    stages.append(
        {
            "type": "writers.gdal",
            "filename": output_tif,
            "resolution": resolution,
            "output_type": "idw",
            "gdaldriver": "GTiff",
            "data_type": "float32",
            "nodata": -9999,
        }
    )
    return {"pipeline": stages}


def building_vegetation_pipeline(
    input: str,
    output: str,
    *,
    hag_threshold_m: float = 2.0,
    bounds: str | None = None,
) -> dict[str, Any]:
    """
    Separate buildings/vegetation from ground using height-above-ground.

    Computes HeightAboveGround for every point (filters.hag_nn against the
    SMRF ground surface), then splits the stream: points above the threshold
    are tagged Classification=6 (building, ASPRS) when they form planar
    clusters — here approximated by height alone; a downstream step can
    refine with filters.planefit. Ground keeps Classification=2.

    Args:
        input: LAS/LAZ/COPC/EPT path or URL.
        output: output LAS/LAZ path.
        hag_threshold_m: height-above-ground threshold in meters. NOTE: if
            the input CRS is in feet (e.g. EPSG:2968), pass the threshold
            converted to feet (2 m ≈ 6.56 ft).
        bounds: optional PDAL bounds string.
    """
    stages: list[dict[str, Any]] = [_reader_for(input)]
    if bounds:
        stages.append({"type": "filters.crop", "bounds": bounds})
    stages += [
        {
            "type": "filters.smrf",
            "window": 18,
            "slope": 0.2,
            "threshold": 0.45,
            "scalar": 1.2,
        },
        # Height above the nearest ground neighbor.
        {"type": "filters.hag_nn"},
        # Tag tall non-ground points as buildings (ASPRS class 6).
        {
            "type": "filters.assign",
            "assignment": f"Classification[6:6] WHERE HeightAboveGround > {hag_threshold_m}",
        },
        {"type": "writers.las", "filename": output},
    ]
    return {"pipeline": stages}


def thin_pipeline(
    input: str,
    output: str,
    *,
    step: int = 2,
    bounds: str | None = None,
) -> dict[str, Any]:
    """
    Thin a point cloud for web visualization (Potree / EPT preview).

    Keeps every Nth point (filters.decimation). For Poisson-disk style
    even spacing use filters.sample instead — decimation is faster and
    deterministic, which is what a preview cache wants.

    Args:
        input: LAS/LAZ/COPC/EPT path or URL.
        output: thinned LAS/LAZ path.
        step: keep every Nth point (step=2 halves the cloud).
        bounds: optional PDAL bounds string.
    """
    stages: list[dict[str, Any]] = [_reader_for(input)]
    if bounds:
        stages.append({"type": "filters.crop", "bounds": bounds})
    stages += [
        {"type": "filters.decimation", "step": step},
        {"type": "writers.las", "filename": output, "compression": True},
    ]
    return {"pipeline": stages}


def ept_to_laz_pipeline(
    ept_url: str,
    output_laz: str,
    *,
    bounds: str | None = None,
    resolution: float | None = None,
) -> dict[str, Any]:
    """
    Convert an EPT resource (or sub-region) to a local LAZ file.

    Useful for pulling a manageable AOI tile out of the statewide IN_2020
    EPT before running local pipelines. Pass bounds in the EPT's native
    CRS (EPSG:2968 feet for IN_2020).

    Args:
        ept_url: https URL of the ept.json.
        output_laz: output .laz path.
        bounds: PDAL bounds string, e.g. "([400000,420000],[4178000,4200000])".
        resolution: optional EPT resolution limit (filters.ept resolution).
    """
    stages: list[dict[str, Any]] = [
        {"type": "readers.ept", "filename": ept_url}
    ]
    if resolution is not None:
        stages.append({"type": "filters.ept", "resolution": resolution})
    if bounds:
        stages.append({"type": "filters.crop", "bounds": bounds})
    stages.append(
        {"type": "writers.las", "filename": output_laz, "compression": True}
    )
    return {"pipeline": stages}


def info_pipeline(input: str) -> dict[str, Any]:
    """
    Metadata probe: bounds, point count, CRS, schema.

    Returns a pipeline dict whose final stage is writers.text so
    `pdal pipeline` prints a summary; for programmatic use prefer
    `pdal info --summary <file>` (see summarize()).
    """
    return {
        "pipeline": [
            _reader_for(input),
            {"type": "writers.text", "filename": "STDOUT", "order": "X,Y,Z"},
        ]
    }


# ---------------------------------------------------------------------------
# Executor
# ---------------------------------------------------------------------------

def run_pipeline(
    pipeline: dict[str, Any],
    *,
    stream_output: bool = True,
    timeout: int = 3600,
) -> subprocess.CompletedProcess[str]:
    """
    Execute a PDAL pipeline dict via `pdal pipeline`.

    The pipeline is serialized to a temp JSON file (never left behind) and
    passed to the CLI. Raises RuntimeError when PDAL is not installed.

    Returns the CompletedProcess. Raises subprocess.CalledProcessError on
    PDAL failure (check=True).
    """
    pdal = require_pdal()
    import tempfile

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", prefix="tsm-pdal-", delete=False
    ) as fh:
        json.dump(pipeline, fh, indent=2)
        tmp = fh.name
    try:
        result = subprocess.run(
            [pdal, "pipeline", tmp],
            capture_output=not stream_output,
            text=True,
            timeout=timeout,
            check=True,
        )
        return result
    finally:
        Path(tmp).unlink(missing_ok=True)


def summarize(input: str) -> dict[str, Any]:
    """
    Return `pdal info --summary` metadata for a file/URL as a dict.

    Raises RuntimeError when PDAL is not installed.
    """
    pdal = require_pdal()
    result = subprocess.run(
        [pdal, "info", "--summary", input],
        capture_output=True,
        text=True,
        timeout=300,
        check=True,
    )
    return json.loads(result.stdout)["summary"]


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

BUILDERS = {
    "ground": ground_filter_pipeline,
    "dem": dem_pipeline,
    "building-vegetation": building_vegetation_pipeline,
    "thin": thin_pipeline,
    "ept-to-laz": ept_to_laz_pipeline,
}


def _print_check() -> int:
    """--check: verify PDAL is installed and print version."""
    if not pdal_available():
        print("❌ pdal NOT found on PATH.")
        print("   Install: conda install -c conda-forge pdal  (or: apt install pdal)")
        print("   Pipeline JSON generation still works; execution requires PDAL.")
        return 1
    result = subprocess.run(
        [PDAL_BIN, "--version"], capture_output=True, text=True, timeout=30
    )
    print(f"✅ {result.stdout.strip()}")
    print("   Tri-state EPT inputs:")
    for key, val in TRISTATE_EPT.items():
        print(f"   - {key}: {val['url']}")
    return 0


def _print_pipeline(name: str, kwargs: dict[str, Any]) -> int:
    """--print <name>: emit the pipeline JSON to stdout."""
    builder = BUILDERS.get(name)
    if builder is None:
        print(f"Unknown pipeline '{name}'. Choices: {', '.join(sorted(BUILDERS))}")
        return 2
    print(json.dumps(builder(**kwargs), indent=2))
    return 0


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]

    if "--check" in args:
        return _print_check()

    if "--print" in args:
        idx = args.index("--print")
        name = args[idx + 1] if idx + 1 < len(args) else ""
        # Remaining args as key=value kwargs for the builder.
        kwargs: dict[str, Any] = {}
        for token in args[idx + 2 :]:
            if "=" in token:
                k, v = token.split("=", 1)
                # Light numeric coercion.
                try:
                    kwargs[k] = int(v)
                except ValueError:
                    try:
                        kwargs[k] = float(v)
                    except ValueError:
                        kwargs[k] = v
        return _print_pipeline(name, kwargs)

    if "--help" in args or "-h" in args or not args:
        print(__doc__)
        print("Usage:")
        print("  pdal_pipelines.py --check")
        print("  pdal_pipelines.py --print <name> input=<path> output=<path> [key=value ...]")
        print(f"  Pipelines: {', '.join(sorted(BUILDERS))}")
        print()
        print("Examples:")
        print("  pdal_pipelines.py --print dem input=tile.laz output_tif=dem.tif resolution=1.0 \\")
        print('      bounds=\"([411000,412000],[4188000,4189000])\" | pdal pipeline /dev/stdin')
        print("  pdal_pipelines.py --print ept-to-laz \\")
        print("      ept_url=https://s3-us-west-2.amazonaws.com/usgs-lidar-public/IN_2020/ept.json \\")
        print('      output_laz=posey-aoi.laz bounds=\"([400000,420000],[4178000,4200000])\"')
        return 0

    print(f"Unknown arguments: {args}. Try --help.")
    return 2


if __name__ == "__main__":
    sys.exit(main())
