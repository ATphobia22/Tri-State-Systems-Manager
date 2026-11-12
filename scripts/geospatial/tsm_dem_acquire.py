#!/usr/bin/env python3
"""
TSM bounded DEM acquisition via USGS The National Map (TNM) Access API.

- Queries product metadata for configured Tri-State county AOIs
- Optional download with per-file / per-county / total byte caps
- SHA-256 of every downloaded file
- JSON acquisition report
- NEVER sets coverage_verified or vertical_datum_approved without operator sign-off

Requires network. Prefer 1/3 arc-second or 1-meter 3DEP products when listed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("TSM-DEMAcquire")

ROOT = Path(__file__).resolve().parents[2]
TNM_API = "https://tnmaccess.nationalmap.gov/api/v1/products"

# Approximate county bboxes (WGS84 lon/lat). Coarse AOI only — not legal boundaries.
COUNTY_AOIS: Dict[str, Dict[str, Any]] = {
    "posey_in": {
        "name": "Posey County, IN",
        "bbox": [-88.15, 37.75, -87.75, 38.15],  # west,south,east,north
    },
    "vanderburgh_in": {
        "name": "Vanderburgh County, IN",
        "bbox": [-87.75, 37.85, -87.40, 38.15],
    },
    "gibson_in": {
        "name": "Gibson County, IN",
        "bbox": [-87.85, 38.15, -87.35, 38.50],
    },
    "warrick_in": {
        "name": "Warrick County, IN",
        "bbox": [-87.50, 37.90, -87.05, 38.25],
    },
    "henderson_ky": {
        "name": "Henderson County, KY",
        "bbox": [-87.85, 37.70, -87.35, 37.95],
    },
    "gallatin_il": {
        "name": "Gallatin County, IL",
        "bbox": [-88.35, 37.60, -88.00, 37.90],
    },
}

DEFAULT_MAX_FILE = 1 * 1024**3  # 1 GiB
DEFAULT_MAX_COUNTY = 2 * 1024**3  # 2 GiB
DEFAULT_MAX_TOTAL = 8 * 1024**3  # 8 GiB


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def tnm_query(bbox: List[float], max_rows: int = 20) -> List[Dict[str, Any]]:
    """Query TNM products API for elevation datasets intersecting bbox."""
    params = {
        "bbox": ",".join(str(x) for x in bbox),
        "datasets": "National Elevation Dataset (NED) 1/3 arc-second",
        "prodFormats": "GeoTIFF",
        "max": str(max_rows),
    }
    url = TNM_API + "?" + urllib.parse.urlencode(params)
    logger.info("TNM query: %s", url)
    req = urllib.request.Request(url, headers={"User-Agent": "TSM-DEMAcquire/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    items = payload.get("items") or payload.get("features") or []
    if not items and isinstance(payload, list):
        items = payload
    return items if isinstance(items, list) else []


def pick_download_url(item: Dict[str, Any]) -> Optional[str]:
    for key in ("downloadURL", "url", "downloadUrl", "productURL"):
        if item.get(key):
            return str(item[key])
    urls = item.get("downloadURLs") or item.get("urls") or {}
    if isinstance(urls, dict):
        for v in urls.values():
            if isinstance(v, str) and v.startswith("http"):
                return v
    return None


def download(
    url: str,
    dest: Path,
    max_bytes: int,
) -> Dict[str, Any]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "TSM-DEMAcquire/1.0"})
    written = 0
    with urllib.request.urlopen(req, timeout=300) as resp, dest.open("wb") as out:
        while True:
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            written += len(chunk)
            if written > max_bytes:
                dest.unlink(missing_ok=True)
                raise RuntimeError(
                    f"File exceeds max_file_bytes ({max_bytes}): {url}"
                )
            out.write(chunk)
    digest = sha256_file(dest)
    return {"path": str(dest), "bytes": written, "sha256": digest, "url": url}


def try_rasterio_inspect(path: Path) -> Dict[str, Any]:
    try:
        import rasterio  # type: ignore
    except ImportError:
        return {"rasterio": False, "note": "rasterio not installed; inspection skipped"}
    try:
        with rasterio.open(path) as ds:
            return {
                "rasterio": True,
                "crs": str(ds.crs) if ds.crs else None,
                "width": ds.width,
                "height": ds.height,
                "count": ds.count,
                "dtypes": [str(t) for t in ds.dtypes],
                "nodata": ds.nodatavals,
                "bounds": list(ds.bounds),
                "transform": list(ds.transform)[:6],
            }
    except Exception as e:  # noqa: BLE001
        return {"rasterio": True, "error": str(e)}


def acquire_county(
    county_id: str,
    out_root: Path,
    *,
    download_files: bool,
    max_file: int,
    max_county: int,
    max_rows: int,
) -> Dict[str, Any]:
    meta = COUNTY_AOIS[county_id]
    bbox = meta["bbox"]
    items = tnm_query(bbox, max_rows=max_rows)
    county_dir = out_root / county_id
    county_dir.mkdir(parents=True, exist_ok=True)

    record: Dict[str, Any] = {
        "county_id": county_id,
        "name": meta["name"],
        "bbox_wsen": bbox,
        "query_item_count": len(items),
        "products": [],
        "downloaded": [],
        "bytes_downloaded": 0,
        "coverage_verified": False,
        "vertical_datum_approved": False,
        "notes": [
            "coverage_verified remains false until human inspects rasters",
            "vertical_datum_approved remains false until product metadata confirms NAVD88/GEOID path",
        ],
    }

    county_bytes = 0
    for item in items:
        title = item.get("title") or item.get("name") or "unknown"
        url = pick_download_url(item)
        prod = {
            "title": title,
            "sourceId": item.get("sourceId") or item.get("id"),
            "downloadURL": url,
            "metaUrl": item.get("metaUrl") or item.get("url"),
            "format": item.get("format") or item.get("prodFormats"),
            "sizeInBytes": item.get("sizeInBytes"),
        }
        record["products"].append(prod)

        if not download_files or not url:
            continue

        size_hint = int(item.get("sizeInBytes") or 0)
        if size_hint and size_hint > max_file:
            logger.warning("Skip %s — listed size %s > max_file", title, size_hint)
            continue
        if county_bytes >= max_county:
            logger.warning("County byte cap reached for %s", county_id)
            break

        fname = Path(urllib.parse.urlparse(url).path).name or "dem.tif"
        dest = county_dir / fname
        try:
            info = download(url, dest, max_bytes=min(max_file, max_county - county_bytes))
            info["inspect"] = try_rasterio_inspect(dest)
            record["downloaded"].append(info)
            county_bytes += info["bytes"]
            record["bytes_downloaded"] = county_bytes
            logger.info("Downloaded %s (%s bytes) sha256=%s...", fname, info["bytes"], info["sha256"][:12])
        except Exception as e:  # noqa: BLE001
            logger.error("Download failed %s: %s", url, e)
            record.setdefault("errors", []).append({"url": url, "error": str(e)})

    return record


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--counties",
        nargs="+",
        default=list(COUNTY_AOIS.keys()),
        choices=list(COUNTY_AOIS.keys()),
    )
    p.add_argument(
        "--out",
        type=Path,
        default=ROOT / "data" / "raw_usgs" / "tnm_dem",
    )
    p.add_argument("--download", action="store_true", help="Actually download files")
    p.add_argument("--max-file-gb", type=float, default=1.0)
    p.add_argument("--max-county-gb", type=float, default=2.0)
    p.add_argument("--max-total-gb", type=float, default=8.0)
    p.add_argument("--max-rows", type=int, default=10)
    p.add_argument(
        "--report",
        type=Path,
        default=ROOT / "integrations" / "registry" / "tsm_dem_acquisition_report.json",
    )
    args = p.parse_args(argv)

    max_file = int(args.max_file_gb * 1024**3)
    max_county = int(args.max_county_gb * 1024**3)
    max_total = int(args.max_total_gb * 1024**3)

    report: Dict[str, Any] = {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api": TNM_API,
        "download_mode": bool(args.download),
        "limits": {
            "max_file_bytes": max_file,
            "max_county_bytes": max_county,
            "max_total_bytes": max_total,
        },
        "counties": [],
        "total_bytes_downloaded": 0,
        "policy": {
            "coverage_verified": False,
            "vertical_datum_approved": False,
            "human_authority_final": True,
            "no_false_download_claims": True,
        },
    }

    total = 0
    try:
        for cid in args.counties:
            if total >= max_total and args.download:
                logger.warning("Total byte cap reached; stopping.")
                break
            rec = acquire_county(
                cid,
                args.out,
                download_files=args.download,
                max_file=max_file,
                max_county=min(max_county, max_total - total),
                max_rows=args.max_rows,
            )
            total += int(rec.get("bytes_downloaded") or 0)
            report["counties"].append(rec)
            report["total_bytes_downloaded"] = total

        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        logger.info("Wrote report %s", args.report)
        logger.info(
            "download_mode=%s total_bytes=%s coverage_verified=false",
            args.download,
            total,
        )
        return 0
    except Exception as e:  # noqa: BLE001
        logger.error("ACQUIRE FAILED: %s", e)
        return 1


if __name__ == "__main__":
    sys.exit(main())
