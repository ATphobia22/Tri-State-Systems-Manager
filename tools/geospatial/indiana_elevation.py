#!/usr/bin/env python3
"""Consume Indiana GIO dynamic ArcGIS elevation ImageServer data.

This client treats the service as raster elevation data and records the
service metadata used for each export. It never infers a vertical datum from
a service name or applies an unverified vertical transformation.

The export is requested in EPSG:2966, the TSM horizontal CRS. Nearest-neighbor
resampling is the default because it avoids silently inventing intermediate
elevation values. Callers can explicitly request bilinear interpolation when
that behavior is required by a documented processing workflow.

Example:
    python tools/geospatial/indiana_elevation.py \
        --bbox -87.95,37.84,-87.90,37.90 \
        --bbox-sr 4326 \
        --output artifacts/indiana-elevation.tif

The vertical datum must be explicitly supplied only after authoritative
verification of the requested service/product.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

DEFAULT_IMAGE_SERVER = (
    "https://di-ingov.img.arcgis.com/arcgis/rest/services/"
    "DynamicWebMercator/Indiana_2016_2020_Elevation/ImageServer"
)
DEFAULT_OUTPUT_SRID = 2966
MAX_PIXELS = 16_000_000
MAX_DOWNLOAD_BYTES = 512 * 1024 * 1024
DEFAULT_TIMEOUT_SECONDS = 60
DEFAULT_USER_AGENT = "TSM-Indiana-Elevation/1.1"


@dataclass(frozen=True)
class BoundingBox:
    xmin: float
    ymin: float
    xmax: float
    ymax: float

    def as_query_value(self) -> str:
        return f"{self.xmin:.12g},{self.ymin:.12g},{self.xmax:.12g},{self.ymax:.12g}"

    def validate(self) -> None:
        values = (self.xmin, self.ymin, self.xmax, self.ymax)
        if not all(math.isfinite(value) for value in values):
            raise ValueError("Bounding-box coordinates must be finite.")
        if self.xmin >= self.xmax or self.ymin >= self.ymax:
            raise ValueError("Bounding-box minimums must be below maximums.")


def parse_bbox(value: str) -> BoundingBox:
    parts = [part.strip() for part in value.split(",")]
    if len(parts) != 4:
        raise ValueError("--bbox must be xmin,ymin,xmax,ymax.")
    try:
        bbox = BoundingBox(*(float(part) for part in parts))
    except ValueError as exc:
        raise ValueError("--bbox coordinates must be numeric.") from exc
    bbox.validate()
    return bbox


def http_json(url: str, timeout: int) -> dict[str, Any]:
    request = Request(
        url,
        headers={"Accept": "application/json", "User-Agent": DEFAULT_USER_AGENT},
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            content_type = response.headers.get("Content-Type", "").lower()
            raw = response.read()
    except HTTPError as exc:
        raise RuntimeError(f"ArcGIS metadata request failed with HTTP {exc.code}.") from exc
    except URLError as exc:
        raise RuntimeError(f"ArcGIS metadata request failed: {exc.reason}.") from exc

    if "json" not in content_type:
        raise RuntimeError(
            f"ArcGIS metadata response has unexpected content type: {content_type or 'unknown'}."
        )

    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError("ArcGIS metadata response was not valid UTF-8 JSON.") from exc

    if not isinstance(payload, dict):
        raise RuntimeError("ArcGIS metadata response was not a JSON object.")
    if "error" in payload:
        raise RuntimeError(f"ArcGIS service returned an error: {payload['error']}")
    return payload


def validate_service_metadata(metadata: dict[str, Any]) -> None:
    service_type = metadata.get("type")
    if service_type is not None and service_type != "ImageServer":
        raise RuntimeError(
            f"Configured elevation endpoint is not an ImageServer: {service_type!r}."
        )

    capabilities = metadata.get("capabilities")
    if isinstance(capabilities, str):
        capability_names = {
            item.strip().lower()
            for item in capabilities.split(",")
            if item.strip()
        }
        if "image" not in capability_names and "export" not in capability_names:
            raise RuntimeError(
                "Configured ImageServer does not advertise image/export capability."
            )

    spatial_reference = metadata.get("spatialReference")
    if spatial_reference is not None and not isinstance(spatial_reference, dict):
        raise RuntimeError("ArcGIS service spatialReference metadata is malformed.")

    if spatial_reference:
        wkid = spatial_reference.get("latestWkid", spatial_reference.get("wkid"))
        if wkid is not None and not isinstance(wkid, int):
            raise RuntimeError("ArcGIS service spatialReference WKID is malformed.")


def build_export_url(
    image_server: str,
    bbox: BoundingBox,
    bbox_srid: int,
    width: int,
    height: int,
    interpolation: str,
) -> str:
    params = {
        "f": "image",
        "bbox": bbox.as_query_value(),
        "bboxSR": str(bbox_srid),
        "imageSR": str(DEFAULT_OUTPUT_SRID),
        "size": f"{width},{height}",
        "format": "tiff",
        "pixelType": "F32",
        "interpolation": interpolation,
        "renderingRule": json.dumps(
            {"rasterFunction": "None"},
            separators=(",", ":"),
        ),
    }
    return f"{image_server.rstrip('/')}/exportImage?{urlencode(params)}"


def download_raster(url: str, output: Path, timeout: int) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".part")
    request = Request(
        url,
        headers={
            "Accept": "image/tiff,application/octet-stream;q=0.9",
            "User-Agent": DEFAULT_USER_AGENT,
        },
    )

    try:
        with urlopen(request, timeout=timeout) as response:
            content_type = response.headers.get("Content-Type", "").lower()
            if "json" in content_type or "text" in content_type:
                raw_error = response.read(64 * 1024)
                try:
                    payload = json.loads(raw_error.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    payload = {"response": raw_error.decode("utf-8", errors="replace")}
                raise RuntimeError(f"ArcGIS export returned a non-raster response: {payload}")

            with temporary.open("wb") as stream:
                total = 0
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > MAX_DOWNLOAD_BYTES:
                        raise RuntimeError(
                            f"Downloaded raster exceeded the {MAX_DOWNLOAD_BYTES // (1024 * 1024)} MiB safety limit."
                        )
                    stream.write(chunk)

        if temporary.stat().st_size < 4:
            raise RuntimeError("ArcGIS export returned an empty or truncated raster.")
        temporary.replace(output)
    except HTTPError as exc:
        raise RuntimeError(f"ArcGIS raster export failed with HTTP {exc.code}.") from exc
    except URLError as exc:
        raise RuntimeError(f"ArcGIS raster export failed: {exc.reason}.") from exc
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def inspect_output(path: Path) -> dict[str, Any]:
    try:
        import rasterio
    except ImportError as exc:
        raise RuntimeError(
            "rasterio is required to inspect the GeoTIFF. "
            "Install the repository backend spatial dependencies."
        ) from exc

    with rasterio.open(path) as dataset:
        if dataset.crs is None or dataset.crs.to_epsg() != DEFAULT_OUTPUT_SRID:
            raise RuntimeError(
                f"Output CRS mismatch: expected EPSG:{DEFAULT_OUTPUT_SRID}, "
                f"got {dataset.crs}."
            )
        if dataset.count < 1:
            raise RuntimeError("Elevation export contains no raster bands.")
        if dataset.width * dataset.height > MAX_PIXELS:
            raise RuntimeError("Raster exceeds the maximum configured pixel count.")
        if dataset.dtypes[0] != "float32":
            raise RuntimeError(
                f"Elevation export dtype mismatch: expected float32, got {dataset.dtypes[0]}."
            )
        return {
            "width": dataset.width,
            "height": dataset.height,
            "count": dataset.count,
            "dtype": dataset.dtypes[0],
            "nodata": dataset.nodata,
            "crs": dataset.crs.to_string(),
            "bounds": [
                dataset.bounds.left,
                dataset.bounds.bottom,
                dataset.bounds.right,
                dataset.bounds.top,
            ],
            "transform": list(dataset.transform)[:6],
        }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bbox", required=True, help="xmin,ymin,xmax,ymax")
    parser.add_argument(
        "--bbox-sr",
        type=int,
        default=4326,
        help="WKID of --bbox (default: 4326)",
    )
    parser.add_argument("--width", type=int, default=1024)
    parser.add_argument("--height", type=int, default=1024)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--service-url", default=DEFAULT_IMAGE_SERVER)
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument(
        "--interpolation",
        choices=("RSP_NearestNeighbor", "RSP_BilinearInterpolation"),
        default="RSP_NearestNeighbor",
        help="ArcGIS raster resampling method (default: nearest neighbor).",
    )
    parser.add_argument(
        "--vertical-datum",
        default=None,
        help="Explicitly verified vertical datum label; never inferred automatically.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.width <= 0 or args.height <= 0:
        raise ValueError("--width and --height must be positive.")
    if args.width * args.height > MAX_PIXELS:
        raise ValueError(f"Requested raster exceeds {MAX_PIXELS:,} pixels.")
    if args.bbox_sr <= 0:
        raise ValueError("--bbox-sr must be a positive EPSG/WKID value.")
    if args.timeout <= 0:
        raise ValueError("--timeout must be positive.")

    bbox = parse_bbox(args.bbox)
    metadata = http_json(
        f"{args.service_url.rstrip('/')}?{urlencode({'f': 'json'})}",
        args.timeout,
    )
    validate_service_metadata(metadata)

    export_url = build_export_url(
        args.service_url,
        bbox,
        args.bbox_sr,
        args.width,
        args.height,
        args.interpolation,
    )
    download_raster(export_url, args.output, args.timeout)
    output_metadata = inspect_output(args.output)

    report = {
        "status": "PASSED",
        "source_authority": "Indiana Office of the Geographic Information Officer",
        "source_service": args.service_url,
        "source_service_name": metadata.get("name"),
        "source_service_type": metadata.get("type"),
        "source_spatial_reference": metadata.get("spatialReference"),
        "source_capabilities": metadata.get("capabilities"),
        "source_extent": metadata.get("fullExtent"),
        "requested_bbox": [bbox.xmin, bbox.ymin, bbox.xmax, bbox.ymax],
        "requested_bbox_srid": args.bbox_sr,
        "output_crs": f"EPSG:{DEFAULT_OUTPUT_SRID}",
        "vertical_datum": args.vertical_datum,
        "vertical_datum_verified": args.vertical_datum is not None,
        "output": str(args.output),
        "output_metadata": output_metadata,
        "provenance": {
            "operation": "ArcGIS ImageServer exportImage",
            "pixel_type": "F32",
            "interpolation": args.interpolation,
            "rendering_rule": "None",
            "synthetic_elevation": False,
        },
    }
    print(json.dumps(report, indent=2, default=str))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, RuntimeError) as exc:
        print(
            json.dumps(
                {"status": "FAILED", "error": type(exc).__name__, "message": str(exc)},
                indent=2,
            ),
            file=sys.stderr,
        )
        raise SystemExit(1)
