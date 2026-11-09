#!/usr/bin/env python3
"""Bounded, source-verified Posey 2025 leaf-on imagery + DSM downloader.

Defaults to downloading just the official county CSV indexes. 2025 DSM is NOT
bare-earth terrain. Matching tile names do not establish incorporated-city
coverage, roof accuracy, or NAVD88 vertical datum.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import io
import json
import os
import re
import tempfile
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

SOURCES = {
    "imagery2025": (
        "https://gisimageryleafoningov.s3.amazonaws.com/scripts/2025/tif/Posey2025tif.csv",
        "gisimageryleafoningov.s3.amazonaws.com", "imageryoptimized/2025/SPW/06in/"
    ),
    "dsm2025": (
        "https://gisimageryleafoningov.s3.amazonaws.com/scripts/2025/dsm/Posey2025dsm.csv",
        "giselevationingov.s3.amazonaws.com", "dsmoptimized/statewide/2025/SPW/1ft/"
    ),
}
STEM = re.compile(r"^in2025_[0-9]{8}_06$")
MAX_CSV_BYTES = 2_000_000

def read_inventory(name: str, data: bytes) -> tuple[dict[str, str], int]:
    if name not in SOURCES or len(data) > MAX_CSV_BYTES:
        raise ValueError("INVENTORY_UNEXPECTED_OR_OVERSIZED")
    try:
        rows = list(csv.reader(io.StringIO(data.decode("utf-8-sig"), newline="")))
    except UnicodeDecodeError as exc:
        raise ValueError("INVENTORY_ENCODING") from exc
    if not rows or rows[0] != ["url_tif" if name == "imagery2025" else "url_dsm"]:
        raise ValueError("INVENTORY_HEADER_MISMATCH")
    host, prefix = SOURCES[name][1:]
    tiles: dict[str, str] = {}
    for row in rows[1:]:
        if len(row) != 1:
            raise ValueError("INVENTORY_MALFORMED_ROW")
        url = row[0].strip()
        if not url:
            continue
        u = urlparse(url)
        if (u.scheme != "https" or u.hostname != host or u.port is not None
                or u.username or u.password or u.query or u.fragment
                or ".." in u.path.split("/") or "%" in u.path
                or not u.path.lstrip("/").startswith(prefix)):
            raise ValueError("INVENTORY_UNTRUSTED_URL")
        filename = Path(u.path).name
        if filename.endswith(".tfw") and name == "imagery2025":
            continue
        if not filename.endswith(".tif"):
            raise ValueError("INVENTORY_UNEXPECTED_EXTENSION")
        stem = filename.removesuffix(".tif")
        if not STEM.fullmatch(stem) or stem in tiles:
            raise ValueError("INVENTORY_DUPLICATE_OR_INVALID_STEM")
        tiles[stem] = url
    if not tiles:
        raise ValueError("INVENTORY_EMPTY")
    return tiles, len(rows) - 1

def download(url: str, dest: Path, *, max_bytes: int, allowed_hostname: str) -> dict:
    u = urlparse(url)
    if (u.scheme != "https" or u.hostname != allowed_hostname or u.port
            or u.username or u.password or u.query or u.fragment
            or ".." in u.path.split("/") or "%" in u.path):
        raise ValueError("DOWNLOAD_HOST_NOT_ALLOWLISTED")
    dest.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tsm-source-", dir=str(dest.parent))
    os.close(fd)
    temporary = Path(tmp)
    digest = hashlib.sha256()
    size = 0
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "TSM-Official-Source-Receipt/1.0"})
        with urllib.request.urlopen(request, timeout=90) as response:
            if urlparse(response.geturl()).hostname != allowed_hostname:
                raise ValueError("DOWNLOAD_REDIRECTED_OFFICIAL_HOST")
            declared = response.headers.get("Content-Length")
            if declared and int(declared) > max_bytes:
                raise ValueError("SOURCE_EXCEEDS_SIZE_BUDGET")
            with temporary.open("wb") as output:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > max_bytes:
                        raise ValueError("SOURCE_EXCEEDS_SIZE_BUDGET")
                    digest.update(chunk)
                    output.write(chunk)
        if declared and size != int(declared):
            raise ValueError("SOURCE_CONTENT_LENGTH_MISMATCH")
        if size <= 0:
            raise ValueError("EMPTY_SOURCE")
        if dest.suffix == ".tif":
            with temporary.open("rb") as file:
                if file.read(4) not in (b"II*\x00", b"MM\x00*"):
                    raise ValueError("NOT_CLASSIC_TIFF")
        os.replace(temporary, dest)
    finally:
        temporary.unlink(missing_ok=True)
    return {"source_url": url, "file": str(dest), "bytes": size,
            "sha256": digest.hexdigest()}

def raster_metadata(path: Path) -> dict:
    import rasterio
    with rasterio.open(path) as ds:
        if not ds.crs or ds.width <= 0 or ds.height <= 0 or ds.count <= 0:
            raise ValueError("RASTER_CRS_OR_DIMENSIONS_MISSING")
        b = ds.bounds
        return {
            "horizontal_crs_embedded": ds.crs.to_wkt(),
            "source_crs_epsg": ds.crs.to_epsg(),
            "bands": ds.count, "width": ds.width, "height": ds.height,
            "dtype": ds.dtypes[0],
            "bounds_native_units": [b.left, b.bottom, b.right, b.top],
            "pixel_resolution_native_units": list(ds.res),
            "raster_tags": dict(ds.tags()),
            "vertical_datum_verified": False,
        }

def horizontal_raster_footprint_evidence(imagery: dict, dsm: dict) -> dict:
    """Compare imagery and DSM bounds in the DSM horizontal CRS only.

    This transforms 2D envelope coordinates, NEVER raster pixel heights or a
    vertical datum. The operation is evidence of spatial coverage only, not an
    engineering-accuracy or survey-certification determination.
    """
    from rasterio.crs import CRS
    from rasterio.warp import transform_bounds
    from math import isfinite

    try:
        src_crs = CRS.from_user_input(imagery["horizontal_crs_embedded"])
        dst_crs = CRS.from_user_input(dsm["horizontal_crs_embedded"])
        src_bounds = tuple(float(v) for v in imagery["bounds_native_units"])
        dst_bounds = tuple(float(v) for v in dsm["bounds_native_units"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("RASTER_HORIZONTAL_CRS_OR_BOUNDS_INVALID") from exc
    for bounds in (src_bounds, dst_bounds):
        if (len(bounds) != 4 or not all(isfinite(x) for x in bounds)
                or bounds[0] >= bounds[2] or bounds[1] >= bounds[3]):
            raise ValueError("RASTER_BOUNDS_NOT_FINITE_OR_DEGENERATE")
    try:
        if src_crs == dst_crs:
            image_in_dsm_crs = src_bounds
            operation = "EQUIVALENT_HORIZONTAL_CRS"
        else:
            image_in_dsm_crs = transform_bounds(
                src_crs, dst_crs, *src_bounds, densify_pts=21
            )
            operation = "HORIZONTAL_BOUNDS_TRANSFORMED_TO_DSM_CRS"
    except Exception as exc:
        raise ValueError("RASTER_HORIZONTAL_CRS_TRANSFORMATION_FAILED") from exc
    if not all(isfinite(x) for x in image_in_dsm_crs):
        raise ValueError("TRANSFORMED_RASTER_BOUNDS_NONFINITE")
    overlap = (max(image_in_dsm_crs[0], dst_bounds[0]) <
               min(image_in_dsm_crs[2], dst_bounds[2]) and
               max(image_in_dsm_crs[1], dst_bounds[1]) <
               min(image_in_dsm_crs[3], dst_bounds[3]))
    return {
        "operation": operation,
        "imagery_horizontal_epsg": src_crs.to_epsg(),
        "dsm_horizontal_epsg": dst_crs.to_epsg(),
        "imagery_bounds_in_dsm_horizontal_crs": list(image_in_dsm_crs),
        "dsm_bounds_native_units": list(dst_bounds),
        "overlap": overlap,
        "vertical_datum_conversion_performed": False,
        "positional_accuracy_certified": False,
    }


def require_raster_footprint_overlap(a: dict, b: dict) -> bool:
    return horizontal_raster_footprint_evidence(a, b)["overlap"]

def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--output", type=Path, default=Path("posey-2025-official"))
    p.add_argument("--tile-stem", action="append", default=[])
    p.add_argument("--max-tiles", type=int, default=2)
    p.add_argument("--max-total-mib", type=int, default=260)
    p.add_argument("--max-file-mib", type=int, default=150)
    p.add_argument("--raster-inspect", action="store_true")
    args = p.parse_args()
    if (not 1 <= args.max_tiles <= 10 or not 1 <= args.max_total_mib <= 1500
            or not 1 <= args.max_file_mib <= 500):
        p.error("Invalid bounded download limits")
    stems = args.tile_stem
    if (len(stems) != len(set(stems)) or len(stems) > args.max_tiles
            or any(not STEM.fullmatch(s) for s in stems)):
        p.error("Select 0..max-tiles distinct exact tile stems")
    root = args.output
    root.mkdir(parents=True, exist_ok=True)
    inventories = {}
    objects = []
    remaining = args.max_total_mib * 1024 * 1024
    for name, (url, host, _) in SOURCES.items():
        path = root / (name + "-posey-manifest.csv")
        record = download(url, path, max_bytes=MAX_CSV_BYTES, allowed_hostname=urlparse(url).hostname or "")
        objects.append(dict(record, role="county_inventory"))
        inventories[name], raw_count = read_inventory(name, path.read_bytes())
        record["raw_url_rows"] = raw_count
        record["tif_count"] = len(inventories[name])
        remaining -= record["bytes"]
    if set(inventories["imagery2025"]) != set(inventories["dsm2025"]):
        raise ValueError("POSEY_IMAGERY_DSM_TILE_STEMS_DIVERGE")
    available = sorted(inventories["imagery2025"])
    if not set(stems) <= set(available):
        raise ValueError("REQUESTED_TILE_NOT_IN_BOTH_OFFICIAL_POSEY_MANIFESTS")
    (root / "paired-tile-stems.txt").write_text("\n".join(available)+"\n", encoding="utf-8")
    raster_info = {}
    horizontal_alignment = {}
    for stem in stems:
        for name in SOURCES:
            target = root / name / (stem + ".tif")
            if remaining <= 0:
                raise ValueError("TOTAL_DOWNLOAD_BUDGET_EXHAUSTED")
            record = download(inventories[name][stem], target,
                              max_bytes=min(remaining, args.max_file_mib * 1024 * 1024),
                              allowed_hostname=SOURCES[name][1])
            objects.append(dict(record, role=name, tile_stem=stem))
            remaining -= record["bytes"]
            if args.raster_inspect:
                raster_info.setdefault(stem, {})[name] = raster_metadata(target)
        if args.raster_inspect:
            horizontal_alignment[stem] = horizontal_raster_footprint_evidence(
                raster_info[stem]["imagery2025"], raster_info[stem]["dsm2025"]
            )
            if not horizontal_alignment[stem]["overlap"]:
                raise ValueError("MATCHING_TILE_STEMS_WITHOUT_RASTER_SPATIAL_OVERLAP")
    receipt = {
        "schema": "tsm.posey-2025-imagery-dsm-acquisition.v1",
        "publisher": "Indiana Geographic Information Office",
        "license": "CC0 per official AWS registry",
        "data_year": 2025,
        "tile_stems_verified_countywide": len(available),
        "selected_tile_stems": stems,
        "downloaded_objects": objects,
        "raster_metadata": raster_info,
        "horizontal_alignment": horizontal_alignment,
        "role_imagery": "6-inch RGB+NIR leaf-on reference texture",
        "role_dsm": "1-foot DSM; NOT bare-earth DEM or certified roof elevation",
        "terrain_2020_navd88_metadata_not_inferred_from_2025": True,
        "survey_certified": False, "engineering_approved": False,
        "complete_city_coverage_verified": False,
        "source_authenticity_independently_attested": False,
    }
    (root/"acquisition-receipt.json").write_text(
        json.dumps(receipt, sort_keys=True, indent=2, allow_nan=False)+"\n")
    (root/"SHA256SUMS.txt").write_text(
        "".join(f"{r['sha256']}  {r['file']}\n" for r in objects))
    print(json.dumps({"status": "SOURCE_BYTES_CHECKSUM_VERIFIED",
        "tiles_downloaded": len(stems), "paired_tile_count": len(available),
        "engineering_approved": False}, sort_keys=True))

if __name__ == "__main__":
    main()
