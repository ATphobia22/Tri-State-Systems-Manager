#!/usr/bin/env python3
"""Download reproducible USGS 3DEP elevation screening data for ZIP 47620 ∩ Posey County, Indiana.

The AOI is the intersection of Census 2020 ZCTA 47620 and the Census TIGER/Line
Posey County boundary (FIPS 18129). It is a data-availability product, not an
approved hydraulic AOI or a substitute for project-specific high-resolution DEM.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
import shapefile  # pyshp
from rasterio.features import geometry_mask
from rasterio.warp import transform_geom
from shapely.geometry import mapping, shape
from shapely.validation import explain_validity

ZCTA_URL = "https://www2.census.gov/geo/tiger/TIGER2020/ZCTA5/tl_2020_us_zcta520.zip"
COUNTY_URL = "https://www2.census.gov/geo/tiger/TIGER2024/COUNTY/tl_2024_us_county.zip"
USGS_SERVICE = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer"
ZIP_CODE = "47620"
COUNTY_FIPS = "18129"
COUNTY_NAME = "Posey"
STATE_FIPS = "18"
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


def read_shapefile_from_zip(archive_bytes: bytes, wanted_stem: str, output_dir: Path, label: str):
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        names = archive.namelist()
        shp_name = next((n for n in names if n.lower().endswith(".shp") and Path(n).stem.lower() == wanted_stem.lower()), None)
        if shp_name is None:
            shp_name = next((n for n in names if n.lower().endswith(".shp")), None)
        if shp_name is None:
            raise RuntimeError(f"{label} archive contains no shapefile")
        stem = str(Path(shp_name).with_suffix(""))
        def member(ext: str) -> bytes:
            name = next((n for n in names if n.lower() == (stem + ext).lower()), None)
            if name is None:
                raise RuntimeError(f"{label} shapefile missing {ext}")
            return archive.read(name)
        reader = shapefile.Reader(
            shp=io.BytesIO(member(".shp")),
            shx=io.BytesIO(member(".shx")),
            dbf=io.BytesIO(member(".dbf")),
        )
        fields = [field[0] for field in reader.fields[1:]]
        records = reader.shapeRecords()
        return fields, records


def field_value(record: Any, fields: list[str], candidates: tuple[str, ...]) -> str | None:
    lower = {name.lower(): i for i, name in enumerate(fields)}
    for candidate in candidates:
        index = lower.get(candidate.lower())
        if index is not None:
            value = record.record[index]
            return str(value).strip() if value is not None else None
    return None


def select_geometry(fields: list[str], records: list[Any], field_candidates: tuple[str, ...], value: str, label: str):
    matches = []
    for record in records:
        found = field_value(record, fields, field_candidates)
        if found == value:
            geom = shape(record.shape.__geo_interface__)
            if not geom.is_empty and geom.is_valid:
                matches.append(geom)
            elif not geom.is_empty:
                raise ValueError(f"{label} geometry is invalid: {explain_validity(geom)}")
    if len(matches) != 1:
        raise RuntimeError(f"Expected exactly one {label} geometry matching {value}; found {len(matches)}")
    return matches[0]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--width", type=int, default=2048)
    parser.add_argument("--height", type=int, default=2048)
    args = parser.parse_args()
    if not (256 <= args.width <= 4096 and 256 <= args.height <= 4096):
        parser.error("width and height must be in 256..4096")
    args.output_dir.mkdir(parents=True, exist_ok=True)

    zcta_bytes, zcta_type = fetch(ZCTA_URL)
    county_bytes, county_type = fetch(COUNTY_URL)
    (args.output_dir / "census-2020-zcta5.zip").write_bytes(zcta_bytes)
    (args.output_dir / "census-2024-county.zip").write_bytes(county_bytes)

    zcta_fields, zcta_records = read_shapefile_from_zip(zcta_bytes, "tl_2020_us_zcta520", args.output_dir, "Census ZCTA")
    county_fields, county_records = read_shapefile_from_zip(county_bytes, "tl_2024_us_county", args.output_dir, "Census county")
    zcta = select_geometry(zcta_fields, zcta_records, ("ZCTA5CE20", "GEOID20", "GEOID"), ZIP_CODE, f"ZIP/ZCTA {ZIP_CODE}")
    county = select_geometry(county_fields, county_records, ("GEOID", "GEOIDFP"), COUNTY_FIPS, f"{COUNTY_NAME} County, {STATE_NAME}")
    aoi = zcta.intersection(county)
    if aoi.is_empty or aoi.area <= 0 or not aoi.is_valid:
        raise RuntimeError(f"ZIP {ZIP_CODE} has no valid polygonal intersection with Posey County: {explain_validity(aoi)}")
    if aoi.geom_type not in ("Polygon", "MultiPolygon"):
        raise RuntimeError(f"Expected polygon AOI, got {aoi.geom_type}")
    # Geometry is from Census TIGER/Line shapefiles in geographic coordinates (NAD83).
    geometry = mapping(aoi)
    minx, miny, maxx, maxy = aoi.bounds
    bbox = [minx, miny, maxx, maxy]
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
            "zcta_vintage": 2020,
            "county_boundary_vintage": 2024,
            "source_crs": "NAD83 geographic (Census TIGER/Line)",
            "approval_warning": "ZIP Code Tabulation Area is a Census statistical approximation of postal geography; not a parcel, surveyed boundary, watershed, or approved hydraulic AOI."
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
    aoi_path = args.output_dir / "posey-county-47620-aoi.geojson"
    aoi_path.write_bytes(aoi_bytes)

    metadata_url = USGS_SERVICE + "?f=json"
    metadata_bytes, metadata_type = fetch(metadata_url, timeout=45)
    service_metadata = json.loads(metadata_bytes.decode("utf-8"))
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
            "geometrySha256": sha256(aoi_bytes), "geojsonSha256": sha256(aoi_bytes),
            "censusZctaVintage": 2020, "countyBoundaryVintage": 2024,
            "zctaArchiveSha256": sha256(zcta_bytes), "countyArchiveSha256": sha256(county_bytes),
        },
        "sources": [
            {"authority": "U.S. Census Bureau", "dataset": "2020 TIGER/Line ZIP Code Tabulation Areas", "url": ZCTA_URL, "contentType": zcta_type, "sha256": sha256(zcta_bytes)},
            {"authority": "U.S. Census Bureau", "dataset": "2024 TIGER/Line County Boundaries", "url": COUNTY_URL, "contentType": county_type, "sha256": sha256(county_bytes)},
            {"authority": "U.S. Geological Survey", "dataset": "3D Elevation Program dynamic ImageServer", "url": USGS_SERVICE, "metadataUrl": metadata_url, "metadataContentType": metadata_type, "metadataSha256": sha256(metadata_bytes), "exportImageUrl": image_url, "rasterContentType": image_type, "rasterSha256": sha256(image_bytes), "rasterBytes": len(image_bytes), "serviceDescription": service_metadata.get("serviceDescription"), "servicePixelType": service_metadata.get("pixelType"), "verticalDatum": "NOT_CERTIFIED_FROM_DYNAMIC_MOSAIC_METADATA", "accuracyClass": "NOT_ESTABLISHED_BY_THIS_EXPORT"},
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
