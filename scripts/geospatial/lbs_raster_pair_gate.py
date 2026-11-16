#!/usr/bin/env python3
"""Compare *actual GDAL-inspected* DEM and MSHR metadata under USGS LBS 2025 rev A.

This is a limited metadata consistency gate, not complete LBS compliance,
vertical accuracy validation, a survey, or a review of raw TIFF GeoKeys.
"""
import argparse
import hashlib
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

def require(test, why):
    if not test:
        raise ValueError(why)

def band_metadata(meta):
    require(isinstance(meta, dict), "Invalid GDAL JSON object")
    size = meta.get("size")
    require(isinstance(size, list) and len(size) == 2 and all(type(x) is int and x > 0 for x in size), "Missing raster grid size")
    transform = meta.get("geoTransform")
    require(isinstance(transform, list) and len(transform) == 6
            and all(isinstance(x, (int, float)) and math.isfinite(x) for x in transform), "Missing/invalid geotransform")
    cs = meta.get("coordinateSystem") or {}
    wkt = cs.get("wkt")
    require(isinstance(wkt, str) and wkt.strip(), "Missing CRS WKT")
    bands = meta.get("bands")
    require(isinstance(bands, list) and bands and isinstance(bands[0], dict), "Missing raster bands")
    nodata = bands[0].get("noDataValue")
    require(isinstance(nodata, (int, float)) and not isinstance(nodata, bool) and math.isfinite(nodata), "Missing/invalid NoData value")
    metadata = meta.get("metadata") or {}
    root = metadata.get("") if isinstance(metadata, dict) else None
    area_or_point = (root or {}).get("AREA_OR_POINT") if isinstance(root, dict) else None
    require(area_or_point in {"Area", "Point"}, "GDAL AREA_OR_POINT metadata absent; raw GeoKey requires independent check")
    return {"size": size, "transform": transform, "wkt": wkt, "nodata": float(nodata), "areaOrPoint": area_or_point}

def check_raster_pair(dem, mshr):
    a, b = band_metadata(dem), band_metadata(mshr)
    require(a["size"] == b["size"], "DEM/MSHR grid size mismatch")
    require(all(math.isclose(x, y, rel_tol=0, abs_tol=1e-9)
                for x, y in zip(a["transform"], b["transform"])), "DEM/MSHR geotransform mismatch")
    require(a["wkt"] == b["wkt"], "DEM/MSHR CRS WKT mismatch")
    require(a["nodata"] == b["nodata"], "DEM/MSHR NoData mismatch")
    require(a["areaOrPoint"] == b["areaOrPoint"], "DEM/MSHR AREA_OR_POINT mismatch")
    return {"status": "PAIR_GDAL_METADATA_CONSISTENT_NOT_LBS_COMPLIANCE",
            "noDataValue": a["nodata"], "areaOrPoint": a["areaOrPoint"],
            "gridDimensions": a["size"], "originalGeoKeyBytesInspected": False,
            "verticalAccuracyIndependentlyMeasured": False, "mappingReportVerified": False,
            "certified": False}

def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as inp:
        for block in iter(lambda: inp.read(1048576), b""):
            h.update(block)
    return h.hexdigest()

def gdal_info(path):
    require(path.is_file() and path.suffix.lower() in {".tif", ".tiff"}, "Expected real GeoTIFF file")
    require(shutil.which("gdalinfo") is not None, "gdalinfo is required for source-asset inspection")
    completed = subprocess.run(["gdalinfo", "-json", str(path)], capture_output=True, text=True, timeout=120, check=True)
    return json.loads(completed.stdout)

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dem", type=Path, required=True)
    parser.add_argument("--mshr", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        dem, mshr = args.dem.resolve(strict=True), args.mshr.resolve(strict=True)
        result = check_raster_pair(gdal_info(dem), gdal_info(mshr))
        result["demSha256"] = sha256(dem)
        result["mshrSha256"] = sha256(mshr)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (OSError, ValueError, subprocess.CalledProcessError, subprocess.TimeoutExpired, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "FAILED", "reason": str(exc)}), file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
