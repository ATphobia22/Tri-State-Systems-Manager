#!/usr/bin/env python3
"""Download USGS 3DEP elevation screening data for ZIP 47620 ∩ Posey County, Indiana.

Uses official Census TIGERweb query services for a single ZCTA and county boundary,
then downloads real elevation pixels from the USGS 3DEP dynamic ImageServer. The AOI
is an unapproved screening polygon, not a surveyed parcel or hydrologic catchment.
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
from typing import Any

import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.warp import transform_geom
from shapely.geometry import mapping, shape
from shapely.validation import explain_validity

ZCTA_LAYER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/2"
COUNTY_LAYER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1"
USGS_SERVICE = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer"
ZIP_CODE = "47620"
COUNTY_FIPS = "18129"
COUNTY_NAME = "Posey"
STATE_NAME = "Indiana"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(url: str, timeout: int = 180, attempts: int = 4) -> tuple[bytes, str]:
    request = urllib.request.Request(url, headers={
        "User-Agent": "Tri-State-Systems-Manager/1.0 (USGS 3DEP AOI evidence)",
        "Accept": "*/*",
    })
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
    raise RuntimeError("bounded retry loop exited unexpectedly")


def query_one_polygon(layer_url: str, where: str, label: str) -> tuple[dict[str, Any], bytes, str]:
    query = urllib.parse.urlencode({
        "where": where,
        "outFields": "*",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    })
    url = layer_url + "/query?" + query
    raw, content_type = fetch(url, timeout=90)
    payload = json.loads(raw.decode("utf-8"))
    if payload.get("error"):
        raise RuntimeError(f"Census TIGERweb {label} query error: {payload['error']}")
    features = payload.get("features")
    if not isinstance(features, list) or len(features) != 1:
        raise RuntimeError(f"Expected exactly one {label} polygon for {where}; received {len(features) if isinstance(features, list) else 'no feature list'}")
    feature = features[0]
    geometry = feature.get("geometry")
    if not isinstance(geometry, dict):
        raise RuntimeError(f"Census TIGERweb {label} response has no geometry")
    geom = shape(geometry)
    if geom.is_empty or not geom.is_valid:
        raise RuntimeError(f"Census TIGERweb {label} geometry is invalid: {explain_validity(geom)}")
    if geom.geom_type not in ("Polygon", "MultiPolygon"):
        raise RuntimeError(f"Expected {label} polygon, got {geom.geom_type}")
    return feature, raw, content_type


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--width", type=int, default=2048)
    parser.add_argument("--height", type=int, default=2048)
    args = parser.parse_args()
    if not (256 <= args.width <= 4096 and 256 <= args.height <= 4096):
        parser.error("width and height must be in 256..4096")
    args.output_dir.mkdir(parents=True, exist_ok=True)

    zcta_feature, zcta_raw, zcta_type = query_one_polygon(
        ZCTA_LAYER, f"ZCTA5='{ZIP_CODE}'", f"2020 ZCTA {ZIP_CODE}"
    )
    county_feature, county_raw, county_type = query_one_polygon(
        COUNTY_LAYER, f"GEOID='{COUNTY_FIPS}'", f"{COUNTY_NAME} County, {STATE_NAME}"
    )
    (args.output_dir / "census-tigerweb-zcta-47620-response.json").write_bytes(zcta_raw)
    (args.output_dir / "census-tigerweb-posey-county-response.json").write_bytes(county_raw)
    zcta = shape(zcta_feature["geometry"])
    county = shape(county_feature["geometry"])
    aoi = zcta.intersection(county)
    if aoi.is_empty or aoi.area <= 0 or not aoi.is_valid:
        raise RuntimeError(f"ZIP {ZIP_CODE} has no valid polygonal intersection with Posey County: {explain_validity(aoi)}")
    if aoi.geom_type not in ("Polygon", "MultiPolygon"):
        raise RuntimeError(f"Expected polygon AOI, got {aoi.geom_type}")
    geometry = mapping(aoi)
    geometry_bytes = json.dumps(geometry, sort_keys=True, separators=(",", ":")).encode()
    geometry_hash = sha256(geometry_bytes)
    minx, miny, maxx, maxy = aoi.bounds
    bbox = [minx, miny, maxx, maxy]

    zcta_metadata_url = ZCTA_LAYER + "?f=json"
    county_metadata_url = COUNTY_LAYER + "?f=json"
    zcta_metadata_raw, zcta_metadata_type = fetch(zcta_metadata_url, timeout=45)
    county_metadata_raw, county_metadata_type = fetch(county_metadata_url, timeout=45)
    zcta_metadata = json.loads(zcta_metadata_raw.decode("utf-8"))
    county_metadata = json.loads(county_metadata_raw.decode("utf-8"))
    if zcta_metadata.get("error") or county_metadata.get("error"):
        raise RuntimeError("Census TIGERweb layer metadata request failed")

    aoi_json = {
        "type": "FeatureCollection",
        "name": "zip-47620-posey-county-intersection",
        "metadata": {
            "aoi_id": "TSM-IN-POSEY-47620",
            "status": "UNAPPROVED_SCREENING_AOI",
            "zip_code": ZIP_CODE,
            "county": COUNTY_NAME,
            "state": STATE_NAME,
            "county_fips": COUNTY_FIPS,
            "zcta_source_vintage": zcta_metadata.get("name"),
            "county_source_vintage": county_metadata.get("name"),
            "source_crs": "EPSG:4326; Census TIGERweb query output",
            "important": "ZIP Code Tabulation Area is a Census statistical approximation of postal geography; not a parcel, surveyed boundary, watershed, or approved hydraulic AOI.",
        },
        "bbox": bbox,
        "features": [{
            "type": "Feature",
            "id": "TSM-IN-POSEY-47620",
            "properties": {"zip_code": ZIP_CODE, "county": COUNTY_NAME, "state": STATE_NAME, "approval_status": "UNAPPROVED"},
            "geometry": geometry,
        }],
    }
    aoi_bytes = (json.dumps(aoi_json, indent=2, sort_keys=True) + "\n").encode()
    (args.output_dir / "posey-county-47620-aoi.geojson").write_bytes(aoi_bytes)

    service_metadata_url = USGS_SERVICE + "?f=json"
    service_metadata_raw, service_metadata_type = fetch(service_metadata_url, timeout=45)
    service_metadata = json.loads(service_metadata_raw.decode("utf-8"))
    if service_metadata.get("error"):
        raise RuntimeError(f"USGS 3DEP service metadata error: {service_metadata['error']}")
    query = urllib.parse.urlencode({
        "bbox": ",".join(format(v, ".12g") for v in bbox),
        "bboxSR": "4326",
        "imageSR": "4326",
        "size": f"{args.width},{args.height}",
        "format": "tiff",
        "pixelType": "F32",
        "noData": "-999999",
        "f": "image",
    })
    image_url = USGS_SERVICE + "/exportImage?" + query
    image_bytes, image_type = fetch(image_url)
    if len(image_bytes) < 1024 or image_bytes[:4] not in (b"II*\x00", b"MM\x00*", b"II+\x00", b"MM\x00+"):
        raise RuntimeError(f"USGS 3DEP did not return a GeoTIFF (type={image_type!r}, bytes={len(image_bytes)}); refusing to publish error content")
    raster_path = args.output_dir / "posey-county-47620-usgs-3dep-screening.tif"
    raster_path.write_bytes(image_bytes)

    with rasterio.open(raster_path) as ds:
        if ds.crs is None or ds.count < 1 or ds.width < 1 or ds.height < 1:
            raise RuntimeError("USGS raster is missing a valid CRS, band, or dimensions")
        raster_geom = geometry if ds.crs.to_epsg() == 4326 else transform_geom("EPSG:4326", ds.crs, geometry, precision=8)
        inside = geometry_mask([raster_geom], out_shape=(ds.height, ds.width), transform=ds.transform, invert=True, all_touched=False)
        values = ds.read(1, masked=False)
        valid = inside & (ds.dataset_mask() > 0) & np.isfinite(values)
        if ds.nodata is not None:
            valid &= values != ds.nodata
        inside_count = int(np.count_nonzero(inside))
        valid_count = int(np.count_nonzero(valid))
        if inside_count == 0:
            raise RuntimeError("Raster grid contains zero pixel centers inside the ZIP/county AOI")
        nodata_count = inside_count - valid_count
        valid_values = values[valid]
        raster_report = {
            "width": ds.width, "height": ds.height, "crs": ds.crs.to_string(),
            "transform": list(ds.transform), "band_count": ds.count, "band_dtype": ds.dtypes[0],
            "nodata_value": ds.nodata, "pixel_count_inside_aoi": inside_count,
            "valid_pixel_count_inside_aoi": valid_count, "nodata_pixel_count_inside_aoi": nodata_count,
            "valid_data_fraction_within_aoi": valid_count / inside_count,
            "nodata_fraction_within_aoi": nodata_count / inside_count,
            "valid_elevation_min": float(valid_values.min()) if valid_count else None,
            "valid_elevation_max": float(valid_values.max()) if valid_count else None,
        }

    report = {
        "schemaVersion": "1.0.0",
        "evidenceStatus": "REAL_DATA_SCREENING_ONLY",
        "retrievedAtUtc": datetime.now(timezone.utc).isoformat(),
        "requestedLocation": {"zipCode": ZIP_CODE, "county": "Posey County", "state": "Indiana"},
        "aoi": {
            "id": "TSM-IN-POSEY-47620", "approvalStatus": "UNAPPROVED",
            "geometryType": aoi.geom_type, "bboxWgs84": bbox, "areaSquareDegrees": aoi.area,
            "geometrySha256": geometry_hash, "geojsonSha256": sha256(aoi_bytes),
            "zctaQuerySha256": sha256(zcta_raw), "countyQuerySha256": sha256(county_raw),
        },
        "sources": [
            {"authority": "U.S. Census Bureau", "dataset": zcta_metadata.get("name"), "url": ZCTA_LAYER, "queryContentType": zcta_type, "metadataContentType": zcta_metadata_type, "metadataSha256": sha256(zcta_metadata_raw), "querySha256": sha256(zcta_raw), "queryWhere": f"ZCTA5='{ZIP_CODE}'", "vintage": "2020 Census ZCTA"},
            {"authority": "U.S. Census Bureau", "dataset": county_metadata.get("name"), "url": COUNTY_LAYER, "queryContentType": county_type, "metadataContentType": county_metadata_type, "metadataSha256": sha256(county_metadata_raw), "querySha256": sha256(county_raw), "queryWhere": f"GEOID='{COUNTY_FIPS}'"},
            {"authority": "U.S. Geological Survey", "dataset": "3D Elevation Program dynamic ImageServer", "url": USGS_SERVICE, "metadataUrl": service_metadata_url, "metadataContentType": service_metadata_type, "metadataSha256": sha256(service_metadata_raw), "exportImageUrl": image_url, "rasterContentType": image_type, "rasterSha256": sha256(image_bytes), "rasterBytes": len(image_bytes), "serviceDescription": service_metadata.get("serviceDescription"), "servicePixelType": service_metadata.get("pixelType"), "verticalDatum": "NOT_CERTIFIED_FROM_DYNAMIC_MOSAIC_METADATA", "accuracyClass": "NOT_ESTABLISHED_BY_THIS_EXPORT"},
        ],
        "raster": raster_report,
        "limitations": [
            "This is a USGS 3DEP dynamic-mosaic resampled screening export, not native high-resolution lidar/QL2.",
            "A Census ZCTA is a statistical representation of ZIP geography, not a postal carrier route, parcel, surveyed boundary, or watershed.",
            "Vertical datum, acquisition vintage, and accuracy class must be verified from source-specific metadata before engineering or hydrologic modeling.",
            "AOI is unapproved; this artifact does not authorize flood modeling or engineering design.",
        ],
    }
    report_path = args.output_dir / "posey-county-47620-terrain-evidence.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if raster_report["valid_pixel_count_inside_aoi"] > 0 else 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Posey 47620 terrain acquisition failed closed: {exc}", file=sys.stderr)
        raise
