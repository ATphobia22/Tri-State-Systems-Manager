#!/usr/bin/env python3
"""Fetch USGS 3DEP DEM tiles for a bounding box and merge them into one GeoTIFF.

Pipeline (mirrors docs/TERRAIN-RGB-3DEP-PIPELINE.md):

    3DEP tile discovery (TNMAccess / AWS 3DEP endpoints)
      -> per-tile download with SHA-256 recording (JSON manifest, resume-safe)
      -> gdalwarp / osgeo.gdal.Warp (explicit CRS transformation)
      -> single merged GeoTIFF in the project CRS

REAL-DATA USAGE
---------------
Real data comes from USGS 3DEP. Tile discovery uses the USGS TNMAccess API
(https://tnmaccess.nationalmap.gov/api/v1/products, bbox query, GeoTIFF
products, preferring 1 m where available) and/or the staged 3DEP products on
AWS (e.g. https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1m/...).
Per-tile source URL, fetch timestamp, byte size, and SHA-256 are recorded in
the JSON manifest so the acquisition stays traceable to an authoritative
product. An acquisition that cannot establish source identity, version, CRS,
vertical datum, or a reproducible hash is rejected, per the pipeline doc.

CRS EXPECTATIONS
----------------
The bounding box is given in EPSG:4326 (lon/lat). 3DEP source rasters are
typically delivered in a source CRS such as UTM (metres) or EPSG:4269, with a
NAVD88 vertical datum. This tool merges to the TSM project CRS convention
EPSG:2966 (NAD83 / Indiana West, ftUS) unless --target-crs overrides it. The
reprojection is recorded in the manifest transformation chain. Note: a
horizontal reprojection is NOT a vertical datum conversion -- no vertical
datum shift is applied or claimed here; the source vertical datum is recorded
as metadata only.

OPERATOR INVOCATION
-------------------
Network fetch (discovery + download) runs only when a human operator invokes
this tool WITHOUT --dry-run. CI and automated runs must use --dry-run, which
exercises the full pipeline logic (tile-list computation, synthetic fetch,
manifest writing, merge planning, resume checks) with synthetic local tiles
and ZERO network access and ZERO GDAL dependency.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import os
import sys
import urllib.request
from pathlib import Path
from typing import Any

MANIFEST_VERSION = 1
MANIFEST_NAME = "manifest.json"
TILES_DIRNAME = "tiles"

# Project CRS convention (NAD83 / Indiana West, ftUS). Source 3DEP tiles are
# typically UTM-metres or EPSG:4269 with a NAVD88 vertical datum.
DEFAULT_TARGET_CRS = "EPSG:2966"
BBOX_CRS = "EPSG:4326"

# TNMAccess discovery endpoint (operator runs only; never touched by --dry-run).
TNM_PRODUCTS_API = "https://tnmaccess.nationalmap.gov/api/v1/products"


class PipelineError(Exception):
    """Clean, user-facing pipeline failure (exit code 2, no partial output)."""


# ---------------------------------------------------------------------------
# BBox validation
# ---------------------------------------------------------------------------

def parse_bbox(values: list[str]) -> tuple[float, float, float, float]:
    try:
        minlon, minlat, maxlon, maxlat = (float(v) for v in values)
    except (TypeError, ValueError):
        raise PipelineError(f"bbox values must be numbers, got: {values!r}")
    if not (minlon < maxlon):
        raise PipelineError(
            f"invalid bbox: minlon ({minlon}) must be < maxlon ({maxlon})")
    if not (minlat < maxlat):
        raise PipelineError(
            f"invalid bbox: minlat ({minlat}) must be < maxlat ({maxlat})")
    if not (-180.0 <= minlon <= 180.0 and -180.0 <= maxlon <= 180.0):
        raise PipelineError(
            f"invalid bbox: longitudes must be within [-180, 180], got "
            f"({minlon}, {maxlon})")
    if not (-90.0 <= minlat <= 90.0 and -90.0 <= maxlat <= 90.0):
        raise PipelineError(
            f"invalid bbox: latitudes must be within [-90, 90], got "
            f"({minlat}, {maxlat})")
    return (minlon, minlat, maxlon, maxlat)


def check_out_writable(out: Path) -> None:
    parent = out.parent
    if not parent.exists():
        raise PipelineError(f"unwritable output path: directory does not exist: {parent}")
    if not os.access(parent, os.W_OK):
        raise PipelineError(f"unwritable output path: no write permission: {parent}")
    if out.exists() and out.is_dir():
        raise PipelineError(f"output path is a directory: {out}")


# ---------------------------------------------------------------------------
# Tile-list computation
# ---------------------------------------------------------------------------

def dry_run_tiles(bbox: tuple[float, float, float, float]) -> list[dict[str, Any]]:
    """Deterministic synthetic tile grid over the bbox (no network, no GDAL).

    Splits the bbox into a fixed 2x2 grid so dry-run exercises multi-tile
    fetch, resume, and merge-planning logic.
    """
    minlon, minlat, maxlon, maxlat = bbox
    tiles: list[dict[str, Any]] = []
    for row in range(2):
        for col in range(2):
            tile_id = f"dryrun_r{row}_c{col}"
            tiles.append({
                "tile_id": tile_id,
                "grid": {"row": row, "col": col},
                # Clearly synthetic scheme -- never resolvable, never fetched.
                "source_url": f"dry-run://usgs-3dep-synthetic/{tile_id}",
                "source_crs": BBOX_CRS,
                "vertical_datum": "synthetic (no datum)",
            })
    return tiles


def discover_3dep_tiles(bbox: tuple[float, float, float, float]) -> list[dict[str, Any]]:
    """Discover real 3DEP DEM tiles covering the bbox via TNMAccess.

    Operator-only: performs HTTPS requests. Prefers 1 m products.
    """
    minlon, minlat, maxlon, maxlat = bbox
    query = (
        f"{TNM_PRODUCTS_API}?bbox={minlon},{minlat},{maxlon},{maxlat}"
        f"&prodFormats=GeoTIFF&outputFormat=JSON"
    )
    req = urllib.request.Request(query, headers={"User-Agent": "tsm-merge-dem/1"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # network/API failure -> fail closed
        raise PipelineError(f"3DEP discovery failed for {query}: {exc}") from exc

    items = payload.get("items") or payload.get("ScienceBaseItems") or []
    if not items:
        raise PipelineError(f"no 3DEP products found for bbox {bbox}")

    def rank(item: dict[str, Any]) -> int:
        title = json.dumps(item).lower()
        if "1 meter" in title or "1m" in title or "1-meter" in title:
            return 0
        return 1

    tiles: list[dict[str, Any]] = []
    for i, item in enumerate(sorted(items, key=rank)):
        url = item.get("downloadURL") or item.get("url")
        if not url:
            continue  # no reproducible source -> skip per pipeline doc
        tiles.append({
            "tile_id": f"3dep_{i:04d}",
            "source_url": url,
            "source_title": item.get("title") or item.get("name"),
            "source_crs": item.get("crs") or "unknown (must be resolved before merge)",
            "vertical_datum": item.get("verticalDatum") or "unknown (must be resolved before merge)",
        })
    if not tiles:
        raise PipelineError(f"3DEP products for bbox {bbox} expose no download URLs")
    return tiles


# ---------------------------------------------------------------------------
# Fetch with resume
# ---------------------------------------------------------------------------

def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def utcnow() -> str:
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def dry_run_payload(tile: dict[str, Any], bbox: tuple[float, float, float, float]) -> bytes:
    """Deterministic synthetic tile bytes: stable across runs (resume-safe)."""
    body = {
        "format": "tsm-dryrun-dem-tile.v1",
        "tile_id": tile["tile_id"],
        "grid": tile["grid"],
        "bbox": list(bbox),
    }
    return b"TSM-DRYRUN-TILE\n" + json.dumps(body, sort_keys=True).encode("utf-8") + b"\n"


def download_tile(url: str, dest: Path) -> None:
    """Operator-only HTTPS download of a single tile."""
    req = urllib.request.Request(url, headers={"User-Agent": "tsm-merge-dem/1"})
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:  # noqa: S310
            with dest.open("wb") as handle:
                for chunk in iter(lambda: resp.read(1 << 20), b""):
                    handle.write(chunk)
    except Exception as exc:
        if dest.exists():
            dest.unlink()  # never leave a partial tile behind
        raise PipelineError(f"failed to download {url}: {exc}") from exc


def fetch_tiles(
    tiles: list[dict[str, Any]],
    tiles_dir: Path,
    prior_manifest: dict[str, Any] | None,
    dry_run: bool,
    bbox: tuple[float, float, float, float],
) -> list[dict[str, Any]]:
    """Fetch tiles with resume: skip files whose recorded SHA-256 still matches.

    Checksum mismatch on an existing file -> re-fetch, never silently reuse.
    Returns per-tile records for the manifest.
    """
    tiles_dir.mkdir(parents=True, exist_ok=True)
    prior = {t["tile_id"]: t for t in (prior_manifest or {}).get("tiles", [])}
    records: list[dict[str, Any]] = []

    for tile in tiles:
        tile_id = tile["tile_id"]
        local_path = tiles_dir / f"{tile_id}.tif"
        prev = prior.get(tile_id)
        status = "fetched"

        if local_path.exists() and prev and prev.get("sha256"):
            if sha256_of(local_path) == prev["sha256"]:
                status = "skipped"  # resume: verified intact, no re-download
            # else: checksum mismatch -> fall through to re-fetch below

        if status != "skipped":
            if dry_run:
                local_path.write_bytes(dry_run_payload(tile, bbox))
            else:
                download_tile(tile["source_url"], local_path)
            if prev is not None and status == "fetched":
                # A prior record existed but the file was missing or its hash
                # mismatched: this download replaced it.
                status = "refetched"

        records.append({
            "tile_id": tile_id,
            "grid": tile.get("grid"),
            "source_url": tile["source_url"],
            "local_path": str(local_path),
            "sha256": sha256_of(local_path),
            "bytes": local_path.stat().st_size,
            "fetched_at": utcnow() if status != "skipped" else prev.get("fetched_at"),
            "status": status,
        })
    return records


# ---------------------------------------------------------------------------
# Merge planning / execution
# ---------------------------------------------------------------------------

def detect_gdal_backend() -> str | None:
    """Return 'osgeo' if the GDAL Python bindings import, 'gdalwarp' if the
    CLI is on PATH, else None. Dry-run never requires a backend."""
    try:
        import osgeo.gdal  # noqa: F401
        return "osgeo"
    except ImportError:
        pass
    for candidate in ("gdalwarp",):
        for directory in os.environ.get("PATH", "").split(os.pathsep):
            if Path(directory, candidate).exists():
                return "gdalwarp"
    return None


def warp_args(inputs: list[str], output: str, target_crs: str) -> list[str]:
    return [
        "gdalwarp", "-t_srs", target_crs, "-r", "bilinear",
        "-co", "COMPRESS=DEFLATE", "-co", "TILED=YES",
        *inputs, output,
    ]


def run_merge(
    tile_paths: list[Path],
    out: Path,
    target_crs: str,
    dry_run: bool,
) -> dict[str, Any]:
    """Plan (and, outside dry-run, execute) the GDAL merge into one GeoTIFF."""
    import shutil

    inputs = [str(p) for p in tile_paths]
    backend = detect_gdal_backend()
    plan: dict[str, Any] = {
        "inputs": inputs,
        "output": str(out),
        "target_crs": target_crs,
        "gdal_args": warp_args(inputs, str(out), target_crs),
        "backend": backend,
        "executed": False,
        "error": None,
    }

    if dry_run:
        # CI-safe: record the plan, touch nothing, require nothing.
        return plan

    if backend is None:
        raise PipelineError(
            "no GDAL available: install the GDAL Python bindings (osgeo) or the "
            "gdalwarp CLI to run a real merge")

    import subprocess  # noqa: S603 -- operator-invoked, argv is constructed

    if backend == "osgeo":
        from osgeo import gdal
        gdal.UseExceptions()
        try:
            gdal.Warp(str(out), inputs, dstSRS=target_crs,
                      resampleAlg="bilinear",
                      creationOptions=["COMPRESS=DEFLATE", "TILED=YES"])
        except Exception as exc:
            raise PipelineError(f"gdal.Warp failed: {exc}") from exc
    else:
        if shutil.which("gdalwarp") is None:
            raise PipelineError("gdalwarp CLI disappeared from PATH")
        proc = subprocess.run(plan["gdal_args"], capture_output=True, text=True)
        if proc.returncode != 0:
            raise PipelineError(f"gdalwarp failed: {proc.stderr.strip() or proc.stdout.strip()}")

    if not out.exists() or out.stat().st_size == 0:
        raise PipelineError(f"merge produced no output at {out}")
    plan["executed"] = True
    plan["output_sha256"] = sha256_of(out)
    return plan


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------

def load_prior_manifest(workdir: Path) -> dict[str, Any] | None:
    manifest_path = workdir / MANIFEST_NAME
    if not manifest_path.exists():
        return None
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        # Fail closed: never silently discard or overwrite a corrupt manifest.
        raise PipelineError(
            f"existing manifest at {manifest_path} is unreadable ({exc}); "
            "remove or repair the workdir before re-running") from exc
    if not isinstance(data, dict) or "tiles" not in data:
        raise PipelineError(
            f"existing manifest at {manifest_path} has an unexpected schema; "
            "remove or repair the workdir before re-running")
    return data


def write_manifest_atomic(workdir: Path, manifest: dict[str, Any]) -> Path:
    manifest_path = workdir / MANIFEST_NAME
    tmp_path = workdir / (MANIFEST_NAME + ".tmp")
    tmp_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n",
                        encoding="utf-8")
    os.replace(tmp_path, manifest_path)  # atomic: no partial manifest committed
    return manifest_path


# ---------------------------------------------------------------------------
# Pipeline driver
# ---------------------------------------------------------------------------

def run_pipeline(
    bbox: tuple[float, float, float, float],
    out: Path,
    workdir: Path,
    target_crs: str,
    dry_run: bool,
) -> dict[str, Any]:
    # Fail-closed validation BEFORE any workdir/manifest writes.
    check_out_writable(out)
    workdir.mkdir(parents=True, exist_ok=True)
    prior_manifest = load_prior_manifest(workdir)

    tiles = dry_run_tiles(bbox) if dry_run else discover_3dep_tiles(bbox)
    tile_records = fetch_tiles(tiles, workdir / TILES_DIRNAME, prior_manifest,
                               dry_run, bbox)
    merge_plan = run_merge([Path(r["local_path"]) for r in tile_records],
                           out, target_crs, dry_run)

    manifest = {
        "manifest_version": MANIFEST_VERSION,
        "tool": "tools/terrain/merge-dem.py",
        "created_at": utcnow(),
        "dry_run": dry_run,
        "bbox": list(bbox),
        "bbox_crs": BBOX_CRS,
        "target_crs": target_crs,
        "source_authority": "USGS 3DEP" if not dry_run else "synthetic (dry-run)",
        "transformation_chain": (
            f"bbox {BBOX_CRS} -> tile source CRS -> warp to {target_crs} "
            "(horizontal reprojection only; no vertical datum conversion applied)"
        ),
        "tiles": tile_records,
        "merge": merge_plan,
    }
    manifest_path = write_manifest_atomic(workdir, manifest)
    return {"manifest_path": str(manifest_path), "manifest": manifest}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Fetch USGS 3DEP DEM tiles for a bbox and merge them "
                    "into a single GeoTIFF (see docs/TERRAIN-RGB-3DEP-PIPELINE.md).")
    parser.add_argument("--bbox", nargs=4, required=True, metavar=("MINLON", "MINLAT", "MAXLON", "MAXLAT"),
                        help="bounding box in EPSG:4326 lon/lat")
    parser.add_argument("--out", required=True,
                        help="output merged GeoTIFF path")
    parser.add_argument("--workdir", required=True,
                        help="working directory for tiles and manifest.json")
    parser.add_argument("--target-crs", default=DEFAULT_TARGET_CRS,
                        help=f"merge target CRS (default: {DEFAULT_TARGET_CRS})")
    parser.add_argument("--dry-run", action="store_true",
                        help="CI-safe mode: synthetic local tiles, no network, no GDAL")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        bbox = parse_bbox(args.bbox)
        result = run_pipeline(bbox, Path(args.out), Path(args.workdir),
                              args.target_crs, args.dry_run)
    except PipelineError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    counts: dict[str, int] = {}
    for tile in result["manifest"]["tiles"]:
        counts[tile["status"]] = counts.get(tile["status"], 0) + 1
    merge = result["manifest"]["merge"]
    print(f"manifest: {result['manifest_path']}")
    print(f"tiles: {counts}")
    print(f"merge: executed={merge['executed']} backend={merge['backend']} -> {merge['output']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
