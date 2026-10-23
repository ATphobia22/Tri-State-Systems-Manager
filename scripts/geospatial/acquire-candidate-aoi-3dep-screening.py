#!/usr/bin/env python3
"""Acquire reproducible USGS 3DEP screening data for a local AOI or Census ZCTA.

The ZCTA mode fetches the official Census TIGERweb polygon for the requested
five-digit ZCTA, then downloads a resampled USGS 3DEP ImageServer GeoTIFF over
its bounding box and measures valid/NoData pixels inside the polygon. A ZCTA
approximates postal ZIP geography and is not an exact USPS delivery boundary.
This is screening evidence, not native QL2 terrain, datum certification,
engineering validation, or permission to run a flood model.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.warp import transform_geom

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_AOI = ROOT / "data/posey-county/aoi/lower-wabash-ohio-core-candidate.geojson"
SERVICE = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer"
CENSUS_ZCTA_LAYER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/84"


def fetch(url: str, timeout: int = 120, attempts: int = 4) -> tuple[bytes, str]:
    """Fetch authoritative service data with bounded retry for transient HTTP/network faults."""
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "TSM-AOI-Terrain-Evidence/1.1", "Accept": "*/*"},
    )
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read(), response.headers.get("Content-Type", "")
        except urllib.error.HTTPError as exc:
            if exc.code not in (408, 425, 429, 500, 502, 503, 504) or attempt + 1 >= attempts:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt + 1 >= attempts:
                raise
        delay = min(2 ** attempt, 8)
        print(f"Transient source failure; retrying in {delay}s ({attempt + 2}/{attempts})", file=sys.stderr)
        time.sleep(delay)
    raise RuntimeError("request retry loop exited unexpectedly")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _positions(value: Any) -> Iterator[tuple[float, float]]:
    """Walk nested GeoJSON coordinates and yield coordinate pairs."""
    if isinstance(value, list) and len(value) >= 2 and all(
        isinstance(v, (int, float)) and not isinstance(v, bool) for v in value[:2]
    ):
        x, y = float(value[0]), float(value[1])
        if not math.isfinite(x) or not math.isfinite(y):
            raise ValueError("AOI geometry contains non-finite coordinates")
        yield x, y
    elif isinstance(value, list):
        for item in value:
            yield from _positions(item)


def _load_zcta(zcta: str) -> tuple[dict[str, Any], dict[str, Any]]:
    if len(zcta) != 5 or not zcta.isdigit():
        raise ValueError("ZCTA must be exactly five digits")
    params = urllib.parse.urlencode({
        "where": f"GEOID='{zcta}'",
        "outFields": "GEOID,BASENAME,NAME,AREALAND,AREAWATER,INTPTLAT,INTPTLON",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    })
    url = f"{CENSUS_ZCTA_LAYER}/query?{params}"
    body, content_type = fetch(url, timeout=45)
    doc = json.loads(body.decode("utf-8"))
    if doc.get("error"):
        raise RuntimeError(f"Census TIGERweb query failed: {doc['error']}")
    features = doc.get("features")
    if not isinstance(features, list) or len(features) != 1:
        raise RuntimeError(f"Census TIGERweb returned {len(features or [])} features for ZCTA {zcta}; expected exactly one")
    feature = features[0]
    properties = feature.get("properties", {})
    actual = str(properties.get("GEOID") or properties.get("BASENAME") or "")
    if actual != zcta:
        raise RuntimeError(f"Census response identity mismatch: requested {zcta}, got {actual!r}")
    geometry = feature.get("geometry")
    if not isinstance(geometry, dict) or geometry.get("type") not in ("Polygon", "MultiPolygon"):
        raise RuntimeError("Census ZCTA response did not contain a Polygon/MultiPolygon")
    evidence = {
        "boundaryAuthority": "U.S. Census Bureau TIGERweb",
        "boundaryVintage": "2020 Census ZCTA",
        "boundaryLayerUrl": CENSUS_ZCTA_LAYER,
        "boundaryQueryUrl": url,
        "boundaryResponseSha256": sha256(body),
        "boundaryResponseBytes": len(body),
        "boundaryResponseContentType": content_type,
        "boundaryGEOID": actual,
        "boundaryName": properties.get("NAME"),
        "boundaryAreaLandSquareMeters": properties.get("AREALAND"),
        "boundaryAreaWaterSquareMeters": properties.get("AREAWATER"),
        "boundaryInternalPointLat": properties.get("INTPTLAT"),
        "boundaryInternalPointLon": properties.get("INTPTLON"),
        "boundaryCaveat": "Census ZCTA approximates ZIP-code geography and is not guaranteed to match USPS delivery boundaries.",
    }
    return feature, evidence


def _load_local_aoi(path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    doc = json.loads(path.read_text(encoding="utf-8"))
    features = doc.get("features") if isinstance(doc, dict) else None
    if not isinstance(features, list) or len(features) != 1:
        raise ValueError("AOI file must contain exactly one feature")
    feature = features[0]
    geometry = feature.get("geometry")
    if not isinstance(geometry, dict) or geometry.get("type") not in ("Polygon", "MultiPolygon"):
        raise ValueError("AOI feature must contain Polygon or MultiPolygon geometry")
    return feature, {
        "boundaryAuthority": "user/repository-provided AOI",
        "boundarySourceFile": str(path),
        "boundarySourceFileSha256": sha256(path.read_bytes()),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--aoi", type=Path, help="GeoJSON FeatureCollection containing exactly one polygon")
    source.add_argument("--zcta", help="five-digit Census ZCTA to fetch from TIGERweb (for example 47620)")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--width", type=int, default=1024)
    parser.add_argument("--height", type=int, default=1024)
    args = parser.parse_args()
    if not (64 <= args.width <= 4096 and 64 <= args.height <= 4096):
        parser.error("width/height must be in 64..4096")

    if args.zcta:
        feature, boundary_evidence = _load_zcta(args.zcta)
        aoi_id = f"US-ZCTA-{args.zcta}"
        approval = "UNAPPROVED"
    else:
        source_path = args.aoi or DEFAULT_AOI
        feature, boundary_evidence = _load_local_aoi(source_path)
        properties = feature.get("properties", {})
        aoi_id = str(feature.get("id") or properties.get("description") or source_path.stem)
        approval = str(properties.get("approval_status", "UNAPPROVED"))

    geometry = feature["geometry"]
    canonical_geometry = json.dumps(geometry, sort_keys=True, separators=(",", ":")).encode()
    geometry_hash = sha256(canonical_geometry)
    coords = list(_positions(geometry.get("coordinates")))
    if not coords:
        raise ValueError("AOI geometry has no coordinates")
    xs, ys = [p[0] for p in coords], [p[1] for p in coords]
    bbox = [min(xs), min(ys), max(xs), max(ys)]
    if bbox[0] >= bbox[2] or bbox[1] >= bbox[3]:
        raise ValueError("AOI geometry has invalid bounds")

    service_meta_url = SERVICE + "?f=json"
    service_meta_bytes, service_content_type = fetch(service_meta_url, timeout=30)
    service_meta = json.loads(service_meta_bytes.decode("utf-8"))
    if service_meta.get("error"):
        raise RuntimeError(f"USGS 3DEP service metadata error: {service_meta['error']}")
    query = urllib.parse.urlencode({
        "bbox": ",".join(map(str, bbox)),
        "bboxSR": "4326",
        "imageSR": "4326",
        "size": f"{args.width},{args.height}",
        "format": "tiff",
        "pixelType": "F32",
        "noData": "-999999",
        "f": "image",
    })
    image_url = SERVICE + "/exportImage?" + query
    image_bytes, image_content_type = fetch(image_url)
    if len(image_bytes) < 1024 or not (
        image_bytes[:4] in (b"II*\x00", b"MM\x00*")
        or image_bytes[:4] in (b"II+\x00", b"MM\x00+")
    ):
        raise RuntimeError(
            f"USGS 3DEP export was not a GeoTIFF (content-type={image_content_type!r}, "
            f"bytes={len(image_bytes)}); refusing to treat an error page as elevation data"
        )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    stem = f"zcta-{args.zcta}" if args.zcta else "candidate-aoi"
    boundary_path = args.output_dir / f"{stem}-boundary.geojson"
    boundary_document = {
        "type": "FeatureCollection",
        "name": stem,
        "metadata": {
            "boundaryAuthority": boundary_evidence.get("boundaryAuthority"),
            "boundaryVintage": boundary_evidence.get("boundaryVintage"),
            "boundaryResponseSha256": boundary_evidence.get("boundaryResponseSha256"),
            "approvalStatus": approval,
            "geometrySha256": geometry_hash,
        },
        "features": [feature],
    }
    boundary_path.write_text(json.dumps(boundary_document, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    raster_path = args.output_dir / f"{stem}-usgs-3dep-screening.tif"
    raster_path.write_bytes(image_bytes)
    with rasterio.open(raster_path) as dataset:
        if dataset.count < 1 or dataset.width < 1 or dataset.height < 1:
            raise RuntimeError("USGS export returned an empty raster")
        if dataset.crs is None:
            raise RuntimeError("USGS export raster has no CRS; refusing spatial coverage claims")
        mask_geometry = geometry if dataset.crs.to_epsg() == 4326 else transform_geom(
            "EPSG:4326", dataset.crs, geometry, precision=8
        )
        inside = geometry_mask(
            [mask_geometry],
            out_shape=(dataset.height, dataset.width),
            transform=dataset.transform,
            invert=True,
            all_touched=False,
        )
        values = dataset.read(1, masked=False)
        dataset_valid = dataset.dataset_mask() > 0
        valid = inside & dataset_valid & np.isfinite(values) & (values != -999999.0)
        if dataset.nodata is not None:
            valid &= values != dataset.nodata
        inside_count = int(np.count_nonzero(inside))
        valid_count = int(np.count_nonzero(valid))
        nodata_count = inside_count - valid_count
        if inside_count == 0:
            raise RuntimeError("AOI rasterization covered zero pixels; no coverage result can be reported")
        valid_fraction = valid_count / inside_count
        nodata_fraction = nodata_count / inside_count
        valid_values = values[valid]
        raster_info = {
            "width": dataset.width,
            "height": dataset.height,
            "crs": dataset.crs.to_string(),
            "transform": list(dataset.transform),
            "nodata_value": dataset.nodata,
            "pixel_count_inside_aoi": inside_count,
            "valid_pixel_count_inside_aoi": valid_count,
            "nodata_pixel_count_inside_aoi": nodata_count,
            "valid_data_fraction_within_aoi": valid_fraction,
            "nodata_fraction_within_aoi": nodata_fraction,
            "valid_elevation_min": float(valid_values.min()) if valid_count else None,
            "valid_elevation_max": float(valid_values.max()) if valid_count else None,
        }

    retrieved = datetime.now(timezone.utc).isoformat()
    report = {
        "schemaVersion": "1.1.0",
        "evidenceStatus": "CANDIDATE_AOI_SCREENING_ONLY",
        "retrievedAtUtc": retrieved,
        "aoi": {
            "id": aoi_id,
            "approvalStatus": approval,
            "geometryType": geometry.get("type"),
            "geometrySha256": geometry_hash,
            "bboxWgs84": bbox,
            **boundary_evidence,
        },
        "source": {
            "authority": "USGS 3D Elevation Program (3DEP)",
            "serviceUrl": SERVICE,
            "imageUrl": image_url,
            "serviceMetadataUrl": service_meta_url,
            "serviceMetadataSha256": sha256(service_meta_bytes),
            "serviceMetadataContentType": service_content_type,
            "serviceDescription": service_meta.get("serviceDescription"),
            "serviceCopyrightText": service_meta.get("copyrightText"),
            "servicePixelType": service_meta.get("pixelType"),
            "verticalDatum": "UNRESOLVED_DYNAMIC_MOSAIC",
            "accuracyClass": "NOT_ESTABLISHED_BY_THIS_SCREENING_EXPORT",
            "rasterSha256": sha256(image_bytes),
            "rasterBytes": len(image_bytes),
            "rasterContentType": image_content_type,
        },
        "raster": raster_info,
        "limitations": [
            "The AOI geometry remains unapproved for engineering design or flood-model conclusions.",
            "This is a resampled dynamic-mosaic screening raster, not a native 3DEP QL2 asset.",
            "The mosaic does not establish a single vertical datum, acquisition date, or accuracy class; verify product-level metadata.",
            "A Census ZCTA approximates postal ZIP geography and may not match USPS delivery boundaries.",
            "No watershed, parcel, outlet, flood model, or engineering design conclusion is authorized by this artifact.",
        ],
    }
    report_path = args.output_dir / f"{stem}-terrain-evidence.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if valid_count else 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"AOI terrain evidence acquisition failed closed: {exc}", file=sys.stderr)
        raise
