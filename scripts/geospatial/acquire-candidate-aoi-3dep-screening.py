#!/usr/bin/env python3
"""Acquire a reproducible, screening-only USGS 3DEP raster for the candidate Lower Wabash-Ohio AOI.

This downloads real pixel values from the authoritative USGS 3DEP dynamic ImageServer.
It is a coarse 1024x1024 AOI data-availability screen, not a native QL2 download,
vertical-datum certification, engineering surface, or permission to run a flood model.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.warp import transform_geom

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_AOI = ROOT / "data/posey-county/aoi/lower-wabash-ohio-core-candidate.geojson"
SERVICE = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer"


def fetch(url: str, timeout: int = 120) -> tuple[bytes, str]:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "TSM-AOI-Terrain-Evidence/1.0", "Accept": "*/*"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read()
        return body, response.headers.get("Content-Type", "")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--aoi", type=Path, default=DEFAULT_AOI)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--width", type=int, default=1024)
    parser.add_argument("--height", type=int, default=1024)
    args = parser.parse_args()
    if args.width < 64 or args.height < 64 or args.width > 4096 or args.height > 4096:
        parser.error("width/height must be in 64..4096")
    aoi_doc = json.loads(args.aoi.read_text(encoding="utf-8"))
    features = aoi_doc.get("features")
    if not isinstance(features, list) or len(features) != 1:
        raise ValueError("AOI file must contain exactly one candidate feature")
    feature = features[0]
    geometry = feature.get("geometry")
    properties = feature.get("properties", {})
    if not isinstance(geometry, dict) or geometry.get("type") != "Polygon":
        raise ValueError("AOI feature must have a Polygon geometry")
    approval = properties.get("approval_status", "UNAPPROVED")
    canonical_geometry = json.dumps(geometry, sort_keys=True, separators=(",", ":")).encode()
    geometry_hash = sha256(canonical_geometry)
    ring = geometry["coordinates"][0]
    xs = [float(point[0]) for point in ring]
    ys = [float(point[1]) for point in ring]
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
    raster_path = args.output_dir / "candidate-aoi-usgs-3dep-screening.tif"
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
        valid = inside & dataset_valid & np.isfinite(values)
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
        "schemaVersion": "1.0.0",
        "evidenceStatus": "CANDIDATE_AOI_SCREENING_ONLY",
        "retrievedAtUtc": retrieved,
        "aoi": {
            "id": feature.get("id"),
            "approvalStatus": approval,
            "geometryType": geometry.get("type"),
            "geometrySha256": geometry_hash,
            "bboxWgs84": bbox,
            "sourceFileSha256": sha256(args.aoi.read_bytes()),
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
            "The AOI geometry remains a candidate and is not approved for design or modeling.",
            "This is a resampled dynamic-mosaic screening raster, not a native 3DEP QL2 asset.",
            "The mosaic does not establish a single vertical datum, acquisition date, or accuracy class.",
            "No watershed, parcel, outlet, flood model, or engineering design conclusion is authorized by this artifact.",
        ],
    }
    report_path = args.output_dir / "candidate-aoi-terrain-evidence.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if valid_count else 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"AOI terrain evidence acquisition failed closed: {exc}", file=sys.stderr)
        raise
