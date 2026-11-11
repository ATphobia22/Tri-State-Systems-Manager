#!/usr/bin/env python3
"""Convert checked-in eight-county TIGER sources and Posey DEM to offline scene assets.

Administrative 8-county discovery footprint, NOT an approved hydrologic AOI.
No survey, flood-zone, datum transformation, or FEMA regulatory claims.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import zipfile

COUNTIES = {
    "17059": ("IL", "Gallatin"), "17193": ("IL", "White"),
    "18051": ("IN", "Gibson"), "18129": ("IN", "Posey"),
    "18163": ("IN", "Vanderburgh"), "18173": ("IN", "Warrick"),
    "21101": ("KY", "Henderson"), "21225": ("KY", "Union"),
}
KINDS = ("roads", "linearwater")
MAX_ZIP_MEMBER = 150 * 1024 * 1024
MAX_SOURCE_BYTES = 100 * 1024 * 1024
MAX_FEATURES = 350_000
MAX_RASTER_PIXELS = 4096 * 4096


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def output_record(out: Path, path: Path, source_sha: str, **fields) -> dict:
    return {"path": path.relative_to(out).as_posix(), "bytes": path.stat().st_size,
            "sha256": sha256(path), "source_sha256": source_sha, **fields}


def read_tiger(path: Path, county: str, kind: str) -> list[dict]:
    import shapefile
    from shapely.geometry import shape, mapping
    from shapely.ops import transform
    from pyproj import CRS, Transformer

    if not path.is_file() or path.is_symlink() or path.stat().st_size > MAX_SOURCE_BYTES:
        raise ValueError(f"Missing or invalid source ZIP: {path}")
    with zipfile.ZipFile(path) as archive:
        members = archive.infolist()
        if len(members) > 24 or any(
            m.file_size > MAX_ZIP_MEMBER or m.filename.startswith("/") or
            ".." in Path(m.filename).parts for m in members
        ):
            raise ValueError("Unsafe TIGER ZIP archive")
        by_suffix = {}
        for m in members:
            suffix = Path(m.filename).suffix.lower()
            if suffix in (".shp", ".shx", ".dbf", ".prj"):
                if suffix in by_suffix:
                    raise ValueError("Ambiguous shapefile member")
                by_suffix[suffix] = m.filename
        if set(by_suffix) != {".shp", ".shx", ".dbf", ".prj"}:
            raise ValueError("Incomplete SHP/SHX/DBF/PRJ package")
        crs = CRS.from_wkt(archive.read(by_suffix[".prj"]).decode("utf-8"))
        if not crs.is_geographic and not crs.is_projected:
            raise ValueError("Unsupported TIGER source CRS")
        project = Transformer.from_crs(crs, CRS.from_epsg(4326), always_xy=True).transform
        reader = shapefile.Reader(
            shp=io.BytesIO(archive.read(by_suffix[".shp"])),
            shx=io.BytesIO(archive.read(by_suffix[".shx"])),
            dbf=io.BytesIO(archive.read(by_suffix[".dbf"])),
        )
        field_names = [f[0] for f in reader.fields[1:]]
        output = []
        for seq, record in enumerate(reader.iterShapeRecords()):
            if seq >= MAX_FEATURES:
                raise ValueError("Feature cap exceeded")
            props = dict(zip(field_names, record.record))
            line = shape(record.shape.__geo_interface__)
            if line.is_empty or line.geom_type not in {"LineString", "MultiLineString"}:
                raise ValueError("Invalid TIGER line geometry")
            geo = transform(project, line)
            if not geo.is_valid or geo.is_empty:
                raise ValueError("TIGER transformed geometry invalid")
            w, s, e, n = geo.bounds
            if not (-92 < w <= e < -84 and 35 < s <= n < 42):
                raise ValueError("Geometry falls outside regional sanity bounds")
            identifier = str(props.get("LINEARID", props.get("TLID", seq)))
            output.append({
                "type": "Feature", "id": f"TIGER2024:{county}:{kind}:{identifier}",
                "properties": {
                    "source_id": identifier, "county_geoid": county,
                    "state": COUNTIES[county][0], "kind": kind,
                    "source_authority": "U.S. Census Bureau",
                    "source_vintage": "2024", "source_review": "UNREVIEWED",
                },
                "geometry": mapping(geo),
            })
        if not output:
            raise ValueError(f"No {kind} features from {path}")
        output.sort(key=lambda f: f["id"])
        return output


def build_vectors(root: Path, out: Path) -> tuple[list[dict], dict]:
    base = root / "data/fabrics/downloads/tiger-2024"
    records: list[dict] = []
    counts: dict[str, dict] = {}
    for county in COUNTIES:
        counts[county] = {}
        for kind in KINDS:
            path = base / f"tl_2024_{county}_{kind}.zip"
            features = read_tiger(path, county, kind)
            target = out / "vector" / f"{county}-{kind}.geojson"
            target.parent.mkdir(parents=True, exist_ok=True)
            source_sha = sha256(path)
            fc = {
                "type": "FeatureCollection",
                "metadata": {
                    "source": str(path.relative_to(root)), "sourceSHA256": source_sha,
                    "sourceCRS": "Validated from TIGER PRJ", "outputCRS": "EPSG:4326",
                    "countyGEOID": county, "vintage": "2024",
                    "reviewState": "ACQUIRED_SOURCE_UNREVIEWED",
                    "engineeringUse": False, "regulatoryUse": False,
                },
                "features": features,
            }
            target.write_text(json.dumps(fc, separators=(",", ":"), ensure_ascii=False,
                                         allow_nan=False) + "\n", encoding="utf-8")
            counts[county][kind] = len(features)
            records.append(output_record(out, target, source_sha, kind="vector",
                                         authority="US_CENSUS_TIGER2024", county_geoid=county,
                                         feature_count=len(features), crs="EPSG:4326",
                                         datum="NOT_APPLICABLE_2D", enabled=False))
    return records, counts


def build_posey_terrain(root: Path, out: Path) -> dict:
    import numpy as np
    import rasterio
    from rasterio.mask import mask
    from rasterio.enums import Resampling
    from rasterio.warp import transform_geom
    from rasterio.transform import array_bounds
    from PIL import Image

    dem = root / "data/fabrics/downloads/indiana-dem-2020/posey-dem-2020-2k.tif"
    boundary = root / "data/posey-county/boundaries/posey-county.geojson"
    if not dem.is_file() or not boundary.is_file():
        raise FileNotFoundError("Posey DEM or source boundary missing")
    aoi = json.loads(boundary.read_text(encoding="utf-8"))
    features = [f for f in aoi.get("features", []) if
                str(f.get("properties", {}).get("GEOID", "")) == "18129"]
    if len(features) != 1:
        raise ValueError("Expected one Posey County GEOID 18129 boundary")
    with rasterio.open(dem) as src:
        if not src.crs or src.count < 1:
            raise ValueError("DEM has no CRS or data bands")
        polygon = transform_geom("EPSG:4326", src.crs, features[0]["geometry"])
        arr, transform_out = mask(src, [polygon], crop=True, indexes=1, filled=True)
        if arr.size == 0 or arr.size > MAX_RASTER_PIXELS:
            raise ValueError("Unsafe or empty DEM clip")
        nodata = src.nodata
        valid = np.isfinite(arr)
        if nodata is not None:
            valid &= arr != nodata
        if not np.any(valid):
            raise ValueError("No real DEM samples intersect the Posey boundary")
        if arr.shape[0] < 2 or arr.shape[1] < 2:
            raise ValueError("DEM clip is too small")
        path = out / "raster" / "posey-dem-screening-2020.tif"
        path.parent.mkdir(parents=True, exist_ok=True)
        profile = src.profile.copy()
        profile.update(driver="GTiff", count=1, height=arr.shape[0], width=arr.shape[1],
                       transform=transform_out, compress="deflate", tiled=True)
        with rasterio.open(path, "w", **profile) as dst:
            dst.write(arr, 1)
            dst.update_tags(TSM_REVIEW_STATE="UNREVIEWED", TSM_CLASS="SCREENING_ONLY",
                            TSM_VERTICAL_DATUM="REQUIRES_SOURCE_VALIDATION")
        values = arr[valid].astype("float64")
        lo, hi = float(np.percentile(values, 2)), float(np.percentile(values, 98))
        if not math.isfinite(lo + hi) or hi <= lo:
            raise ValueError("Invalid DEM display range")
        normalized = np.clip((arr.astype("float64") - lo) / (hi - lo), 0, 1)
        # Exact RGB/alpha display product; elevation remains in original GeoTIFF.
        rgba = np.stack((30 + normalized * 90, 52 + normalized * 100,
                         59 + normalized * 95, valid * 255), axis=-1).astype("uint8")
        png = out / "raster" / "posey-dem-screening-2020.png"
        Image.fromarray(rgba, "RGBA").save(png, optimize=True)
        return {
            "source_raster": str(dem.relative_to(root)),
            "source_boundary": str(boundary.relative_to(root)),
            "source_sha256": sha256(dem), "boundary_sha256": sha256(boundary),
            "geoTIFF": output_record(out, path, sha256(dem), kind="raster",
                                     authority="INDIANA_GIO", crs=str(src.crs),
                                     vertical_datum="UNVERIFIED_FROM_SOURCE", enabled=False),
            "previewPNG": output_record(out, png, sha256(dem), kind="display_texture",
                                        crs=str(src.crs), vertical_datum="NOT_A_VALUE_PRODUCT",
                                        enabled=False),
            "bounds_native": list(array_bounds(arr.shape[0], arr.shape[1], transform_out)),
            "source_crs": str(src.crs), "pixel_units": str(src.units[0]) if src.units else "UNVERIFIED",
            "valid_pixels": int(valid.sum()), "total_pixels": int(arr.size),
            "visual_percentile_min": lo, "visual_percentile_max": hi,
        }


def build(root: Path, out: Path) -> dict:
    root, out = root.resolve(), out.resolve()
    if out == root or root in out.parents:
        raise ValueError("Write outputs outside the repository, not to Git history")
    out.mkdir(parents=True, exist_ok=True)
    vectors, counts = build_vectors(root, out)
    raster = build_posey_terrain(root, out)
    manifest = {
        "schema": "tsm.tristate.offline-screening-layers.v1",
        "region": "Eight-county IN/IL/KY TIGER 2024 administrative data scope",
        "counties": COUNTIES, "coverage": "COUNTY_SCOPED_LINEWORK_ONLY",
        "hydrologic_aoi_approved": False, "fema_nfh_l_complete": False,
        "source_review": "ACQUIRED_SOURCE_UNREVIEWED",
        "regulatory_use": False, "engineering_use": False,
        "renderer_ready": "VIEWER_INTEGRATION_NOT_VERIFIED",
        "default_enabled": False, "vector_assets": vectors,
        "vector_counts": counts, "posey_raster": raster,
        "limitations": [
            "TIGER roads and linear water are not a parcel or surveyed boundary dataset",
            "Posey raster does not supply IL/KY terrain coverage",
            "Vertical units and source geoid require separate verification",
            "WRI/FEMA/IL/KY unavailable assets are not silently substituted",
            "MapLibre/Unreal/SceneKit headed rendering not validated by this build",
        ],
    }
    (out / "offline-layers-manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    manifest = build(args.repo_root, args.output)
    print(json.dumps({"status": "GENERATED_UNREVIEWED",
                      "vector_counties": len(manifest["vector_counts"]),
                      "vector_files": len(manifest["vector_assets"]),
                      "raster_clip_valid_pixels": manifest["posey_raster"]["valid_pixels"]},
                     sort_keys=True))


if __name__ == "__main__":
    main()
