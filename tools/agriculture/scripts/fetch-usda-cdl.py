#!/usr/bin/env python3
"""Acquire USDA NASS CDL from STAC, then clip to the official county boundary.

This is a categorical, derived crop-cover raster, NOT a measured field record.
No network access is possible unless --live is explicitly supplied.
Requires rasterio and remote COG access for the live crop step.

Usage:
 python tools/agriculture/scripts/fetch-usda-cdl.py --year 2025 --live \
   --out /private/cdl-posey-2025.tif
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PC_STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTION = "usda-cdl"
DEFAULT_BOUNDARY = Path("data/posey-county/boundaries/posey-county.geojson")


def validate_year(year: int) -> int:
    # NASS nationwide CDL starts in 2008. Current-year data might not yet be
    # published, so remote absence must remain SOURCE_UNAVAILABLE.
    if type(year) is not int or not 2008 <= year <= datetime.now(timezone.utc).year:
        raise ValueError("CDL year must be 2008 through current year, subject to actual published availability")
    return year


def county_geometry(path: Path) -> tuple[dict[str, Any], list[float], str]:
    raw = path.read_bytes()
    doc = json.loads(raw.decode("utf-8"))
    items = doc.get("features") if isinstance(doc, dict) and doc.get("type") == "FeatureCollection" else []
    matches = [f for f in items if isinstance(f, dict) and f.get("properties", {}).get("GEOID") == "18129"]
    if len(matches) != 1:
        raise ValueError("exactly one official Posey County GEOID 18129 boundary is required")
    geometry = matches[0]["geometry"]
    if geometry.get("type") not in ("Polygon", "MultiPolygon"):
        raise ValueError("county geometry must be a Polygon/MultiPolygon")
    bounds = [float("inf"), float("inf"), float("-inf"), float("-inf")]
    def walk(item: Any) -> None:
        if not isinstance(item, list):
            raise ValueError("invalid county geometry coordinates")
        if item and len(item) >= 2 and all(type(v) in (int, float) for v in item[:2]):
            x, y = float(item[0]), float(item[1])
            if not (-180 <= x <= 180 and -90 <= y <= 90):
                raise ValueError("county coordinate outside WGS84 bounds")
            bounds[0], bounds[1] = min(bounds[0], x), min(bounds[1], y)
            bounds[2], bounds[3] = max(bounds[2], x), max(bounds[3], y)
        else:
            for child in item:
                walk(child)
    walk(geometry["coordinates"])
    if not (bounds[0] < bounds[2] and bounds[1] < bounds[3]):
        raise ValueError("empty county polygon bounds")
    return geometry, bounds, hashlib.sha256(raw).hexdigest()


def search_cdl(year: int, bounds: list[float]) -> dict[str, Any]:
    validate_year(year)
    params = {
        "datetime": f"{year}-01-01T00:00:00Z/{year}-12-31T23:59:59Z",
        "bbox": ",".join(map(str, bounds)),
        "limit": 25,
    }
    url = f"{PC_STAC_URL}/collections/{COLLECTION}/items?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "TSM/1.0 crop evidence client"})
    with urllib.request.urlopen(req, timeout=35) as resp:
        data = resp.read(4 * 1024 * 1024 + 1)
        if len(data) > 4 * 1024 * 1024:
            raise ValueError("STAC discovery exceeded size ceiling")
        return json.loads(data)


def select_item(response: dict[str, Any], year: int) -> dict[str, Any]:
    validate_year(year)
    rows = response.get("features") if isinstance(response, dict) else None
    if not isinstance(rows, list) or not rows:
        raise ValueError(f"no USDA CDL STAC item available for {year}")
    matching = []
    for item in rows:
        if not isinstance(item, dict) or item.get("collection") != COLLECTION:
            continue
        if not isinstance(item.get("id"), str) or not item["id"]:
            continue
        dt = (item.get("properties") or {}).get("datetime")
        stac_year = (item.get("properties") or {}).get("year")
        if (isinstance(dt, str) and dt[:4] == str(year)) or stac_year == year:
            matching.append(item)
    if len(matching) != 1:
        raise ValueError(f"expected exactly one annual USDA CDL STAC item for {year}; found {len(matching)}")
    return matching[0]


def asset_href(item: dict[str, Any]) -> str:
    assets = item.get("assets")
    if not isinstance(assets, dict):
        raise ValueError("STAC item missing assets")
    matches = []
    for name, asset in assets.items():
        if not isinstance(asset, dict):
            continue
        href = asset.get("href")
        if not isinstance(href, str):
            continue
        parts = urllib.parse.urlsplit(href)
        host = parts.hostname or ""
        if parts.scheme != "https" or parts.username or parts.password or not (
            host == "planetarycomputer.microsoft.com" or host.endswith(".blob.core.windows.net")
        ):
            continue
        if not re.search(r"\.tiff?$", parts.path.lower()):
            continue
        if "data" in (asset.get("roles") or []) or "data" in name.lower() or "cog" in name.lower():
            matches.append(href)
    if len(matches) != 1:
        raise ValueError("expected a single trusted HTTPS raster data asset, not ambiguous STAC assets")
    return matches[0]


def clip_remote_cdl(href: str, geometry: dict[str, Any], out: Path) -> dict[str, Any]:
    try:
        import rasterio
        from rasterio.mask import mask
        from rasterio.warp import transform_geom
    except ImportError as exc:
        raise RuntimeError("rasterio required for county polygon masking, not a whole-state download") from exc
    out.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(href) as source:
        if source.count < 1 or not source.crs:
            raise ValueError("CDL COG lacks band or CRS metadata")
        if source.crs.to_epsg() is None:
            raise ValueError("source raster CRS has no verifiable EPSG code")
        if source.dtypes[0][0] not in ("u", "i"):
            raise ValueError("categorical CDL raster must have integer classification values")
        projected = transform_geom("EPSG:4326", source.crs, geometry)
        nodata = source.nodata if source.nodata is not None else 0
        pixels, transform = mask(source, [projected], crop=True, filled=True, nodata=nodata, all_touched=False)
        if pixels.size == 0:
            raise ValueError("no county coverage in selected raster")
        profile = source.profile.copy()
        profile.update(driver="GTiff", height=pixels.shape[1], width=pixels.shape[2], transform=transform,
                       compress="deflate", tiled=False, nodata=nodata)
        with rasterio.open(out, "w", **profile) as dest:
            dest.write(pixels)
        return {"sourceEpsg": source.crs.to_epsg(), "outputEpsg": source.crs.to_epsg(),
                "outputWidth": pixels.shape[2], "outputHeight": pixels.shape[1],
                "sourceNodata": source.nodata, "outputNodata": nodata,
                "countyMask": "EXACT_GEOID_18129_POLYGON", "resampling": "NONE_CATEGORICAL_VALUES_PRESERVED"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--live", action="store_true", help="opt in to STAC discovery and reading the remote crop COG")
    parser.add_argument("--boundary", type=Path, default=DEFAULT_BOUNDARY)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if not args.live:
        parser.error("--live required: this importer never requests remote data by default")
    try:
        validate_year(args.year)
        geometry, bounds, boundary_hash = county_geometry(args.boundary)
        selected = select_item(search_cdl(args.year, bounds), args.year)
        href = asset_href(selected)
        details = clip_remote_cdl(href, geometry, args.out)
        source_hash = hashlib.sha256(args.out.read_bytes()).hexdigest()
        receipt = {
            "schemaVersion": "tsm.usda.cdl.county-raster.v1",
            "year": args.year, "acquiredAtUtc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "sourceAgency": "USDA NASS", "sourceCollection": COLLECTION, "stacItemId": selected["id"],
            "sourceAssetUrl": href, "sourceAssetSha256": None,
            "boundaryGeoId": "18129", "boundarySha256": boundary_hash,
            "derivedRasterSha256": source_hash, "dataClassification": "DERIVED_CLASSIFIED_CROP_COVER",
            "engineeringUse": False, "regulatoryUse": False, "notAnIndividualFarmRecord": True,
            "dataVintagesMustMatch": True, **details,
        }
        args.out.with_suffix(args.out.suffix + ".receipt.json").write_text(json.dumps(receipt, sort_keys=True, indent=2) + "\n", encoding="utf-8")
        args.out.with_suffix(args.out.suffix + ".sha256").write_text(f"{source_hash}  {args.out.name}\n", encoding="utf-8")
        print(json.dumps({"status": "DERIVED_NOT_FIELD_VERIFIED", "cropYear": args.year, "sha256": source_hash}, sort_keys=True))
        return 0
    except (OSError, ValueError, RuntimeError, KeyError) as exc:
        print(f"SOURCE_UNAVAILABLE_OR_INVALID CDL: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
