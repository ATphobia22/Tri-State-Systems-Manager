#!/usr/bin/env python3
"""Convert the EXISTING TSM source-bound WGS84 Mount Vernon scene to UE local cm.

Input: scene.json emitted by scripts/geospatial/build_mount_vernon_scene.py.
No height fabrication, no silent EPSG substitution, no extrapolated DEM pixels.
Optional heightmap needs FULL DEM coverage and explicit source vertical units.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

SCHEMA = "tsm.mount-vernon.scene.v1"
RESOLUTIONS = (1009, 2017, 4033, 8129)
UNIT_TO_CM = {"meter": 100.0, "us_survey_foot": 120000.0 / 3937.0}


def sha_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for part in iter(lambda: f.read(1048576), b""):
            h.update(part)
    return h.hexdigest()


def encoded_heightmap(elevation, centimeters_per_vertical_unit):
    """Return (16bit array, UE Z-scale, source center), with 32768 at center.

    The import Landscape's world Z=0 must correspond to the returned source
    center elevation; source vertical datum is never inferred by this function.
    """
    import numpy as np
    if elevation.ndim != 2 or not np.all(np.isfinite(elevation)):
        raise ValueError("DEM coverage has NoData/NaN/Inf; do not fill")
    minimum, maximum = float(np.min(elevation)), float(np.max(elevation))
    if maximum <= minimum:
        raise ValueError("DEM vertical range is empty")
    center = (minimum + maximum) / 2.0
    z_scale = (maximum - minimum) * centimeters_per_vertical_unit / 512.0
    encoded = np.clip(np.rint(
        32768.0 + (elevation - center) * centimeters_per_vertical_unit * 128.0 / z_scale),
        0, 65535).astype(np.uint16)
    return encoded, z_scale, center


def reproject_dem(path, anchor_x, anchor_y, target_crs, size_m, resolution):
    import numpy as np
    import rasterio
    from affine import Affine
    from pyproj import CRS
    from rasterio.warp import reproject, Resampling

    target = CRS.from_user_input(target_crs)
    if not target.is_projected:
        raise ValueError("Landscape requires a projected local CRS")
    meters_per_horizontal_unit = float(target.axis_info[0].unit_conversion_factor)
    if not math.isfinite(meters_per_horizontal_unit) or meters_per_horizontal_unit <= 0:
        raise ValueError("Target CRS unit conversion is unavailable")
    half = size_m / meters_per_horizontal_unit / 2.0
    x0, y0 = anchor_x - half, anchor_y + half
    step = size_m / meters_per_horizontal_unit / (resolution - 1)
    # Pixel centers of the raster align with UE Landscape VERTICES.
    grid = Affine(step, 0, x0 - step / 2, 0, -step, y0 + step / 2)
    values = np.full((resolution, resolution), np.nan, dtype=np.float32)
    with rasterio.open(path) as source:
        if source.crs is None or source.count != 1:
            raise ValueError("DEM must provide a single raster band and horizontal CRS")
        reproject(
            source=rasterio.band(source, 1), destination=values,
            src_transform=source.transform, src_crs=source.crs, src_nodata=source.nodata,
            dst_transform=grid, dst_crs=target, dst_nodata=np.nan,
            resampling=Resampling.bilinear, init_dest_nodata=True)
    if not np.all(np.isfinite(values)):
        raise ValueError("DEM does not cover the requested AOI; rejected instead of infilling")
    return values, meters_per_horizontal_unit


def make_local_scene(source_scene, target_crs, anchor_x, anchor_y, meters_per_unit):
    from pyproj import Transformer
    transformer = Transformer.from_crs("EPSG:4326", target_crs, always_xy=True)
    layers = {"buildings": [], "roads": [], "trees": []}
    source_counts = {}
    for role in ("buildings", "roads"):
        group = source_scene.get(role) or {}
        features = group.get("features")
        if group.get("type") != "FeatureCollection" or not isinstance(features, list):
            raise ValueError("Source scene has no FeatureCollection for " + role)
        source_counts[role] = len(features)
        for ft in features:
            geometry = ft.get("geometry") or {}
            props = ft.get("properties") or {}
            source_id = props.get("tsm_id") or ft.get("id")
            if not isinstance(source_id, str) or not source_id:
                raise ValueError("Missing stable official source feature identifier")
            shape_type = geometry.get("type")
            coords = geometry.get("coordinates")
            if role == "buildings":
                if shape_type == "Polygon":
                    parts = [coords]
                elif shape_type == "MultiPolygon":
                    parts = coords
                else:
                    raise ValueError("Unsupported building geometry " + str(shape_type))
            else:
                if shape_type == "LineString":
                    parts = [coords]
                elif shape_type == "MultiLineString":
                    parts = coords
                else:
                    raise ValueError("Unsupported road geometry " + str(shape_type))
            if not isinstance(parts, list) or not parts:
                raise ValueError("Empty source geometry: " + source_id)
            for index, part in enumerate(parts):
                if role == "buildings":
                    if not isinstance(part, list) or len(part) != 1:
                        raise ValueError("Building has holes; requires a reviewed tessellator: " + source_id)
                    vertices = part[0]
                else:
                    vertices = part
                points = []
                for vertex in vertices:
                    if len(vertex) < 2:
                        raise ValueError("Invalid source coordinate")
                    lon, lat = float(vertex[0]), float(vertex[1])
                    if not (math.isfinite(lon) and math.isfinite(lat)):
                        raise ValueError("Nonfinite source coordinate")
                    easting, northing = transformer.transform(lon, lat)
                    # Y is south in this explicitly declared UE-local frame.
                    points.append([
                        round((easting - anchor_x) * meters_per_unit * 100.0, 4),
                        round(-(northing - anchor_y) * meters_per_unit * 100.0, 4)
                    ])
                key = source_id + (":part:" + str(index) if len(parts) > 1 else "")
                out_props = {"id": key, "source_feature_sha256": props.get("source_feature_sha256"),
                             "height_status": "NOT_EVIDENCED"}
                # Convert ONLY reviewed/derived reported heights, never stories/default guess.
                h = props.get("height_m")
                if (isinstance(h, (float, int)) and not isinstance(h, bool) and
                        math.isfinite(h) and h > 0 and
                        props.get("height_status") in ("OBSERVED", "DERIVED")):
                    out_props["height_cm"] = round(h * 100.0, 2)
                    out_props["height_status"] = props["height_status"]
                if role == "roads" and isinstance(props.get("width_cm"), (int, float)):
                    out_props["width_cm"] = float(props["width_cm"])
                if role == "buildings":
                    out_geom = {"type": "Polygon", "coordinates": [points]}
                else:
                    out_geom = {"type": "LineString", "coordinates": points}
                layers[role].append({
                    "type": "Feature", "properties": out_props, "geometry": out_geom})
    return layers, source_counts


def run(args):
    from pyproj import CRS
    target = CRS.from_user_input(args.target_crs)
    if not target.is_projected or not target.to_epsg():
        raise ValueError("Choose a reviewed projected EPSG CRS")
    if args.resolution not in RESOLUTIONS:
        raise ValueError("Unsupported Landscape vertex resolution")
    if not all(math.isfinite(v) for v in (args.anchor_x, args.anchor_y)):
        raise ValueError("Survey anchor must be finite")
    meters_per_unit = float(target.axis_info[0].unit_conversion_factor)
    if not (abs(meters_per_unit - 1.0) < 1e-9 or
            abs(meters_per_unit - 1200.0 / 3937.0) < 1e-9):
        raise ValueError("Only meter and US survey foot projected CRS units are supported")
    src = Path(args.scene).resolve(strict=True)
    output = Path(args.output).resolve()
    if output.exists() and any(output.iterdir()):
        raise FileExistsError("Refusing to overwrite an existing source/derived scene directory")
    scene = json.loads(src.read_text(encoding="utf-8"))
    if scene.get("schema") != "tsm.mount-vernon-city-scene.v1" or scene.get("crs") != "EPSG:4326":
        raise ValueError("Expected provenance-bound TSM source scene in EPSG:4326")
    layers, source_counts = make_local_scene(
        scene, target.to_string(), args.anchor_x, args.anchor_y, meters_per_unit)
    # Validate DEM coverage before any outputs are created, so missing survey
    # evidence never leaves an apparently complete scene directory.
    height = None
    if args.dem:
        if not args.vertical_unit:
            raise ValueError("DEM needs explicit --vertical-unit")
        values, _ = reproject_dem(
            args.dem, args.anchor_x, args.anchor_y,
            target.to_string(), args.size_m, args.resolution)
        height = encoded_heightmap(values, UNIT_TO_CM[args.vertical_unit])
    output.mkdir(parents=True, exist_ok=True)
    hashes = {}
    for role in ("buildings", "roads", "trees"):
        filename = role + ".geojson"
        path = output / filename
        path.write_text(json.dumps(
            {"type": "FeatureCollection", "features": layers[role]},
            allow_nan=False, sort_keys=True, separators=(",", ":")), encoding="utf-8")
        hashes[role] = {"path": filename, "sha256": sha_file(path)}
    manifest = {
        "schema": SCHEMA, "coordinate_frame": "UE_LOCAL_CM", "axes": "EAST_SOUTH_UP",
        "input_horizontal_crs": "EPSG:4326", "source_horizontal_crs": target.to_string(),
        "source_anchor": {"easting": args.anchor_x, "northing": args.anchor_y,
                          "units": "us_survey_foot" if abs(meters_per_unit - 1200 / 3937) < 1e-8 else "meter"},
        "vertical_datum": args.vertical_datum, "evidence_status": "PENDING_EVIDENCE",
        "source_scene_sha256": sha_file(src), "source_counts": source_counts,
        "files": hashes}
    if args.dem:
        pixels, z_scale, midpoint = height
        from PIL import Image
        height_path = output / ("Heightmap_" + str(args.resolution) + ".png")
        Image.fromarray(pixels).save(height_path)
        height_metadata = {
            "heightmap_filename": height_path.name,
            "heightmap_sha256": sha_file(height_path),
            "source_dem_sha256": sha_file(Path(args.dem)),
            "source_dem_vertical_unit_claim": args.vertical_unit,
            "vertical_datum_review_status": args.vertical_datum,
            "horizontal_crs": target.to_string(),
            "landscape_size_m": args.size_m,
            "landscape_vertex_resolution": args.resolution,
            "landscape_xy_scale_cm": args.size_m * 100.0 / (args.resolution - 1),
            "landscape_z_scale": z_scale,
            "landscape_world_z_cm": 0.0,
            "world_z_zero_source_elevation": midpoint,
            "landscape_actor_location_cm": [0.0, 0.0, 0.0],
            "validation": "PENDING_SURVEY_CONTROL_AND_UE_EDITOR_IMPORT",
        }
        (output / "heightmap-metadata.json").write_text(
            json.dumps(height_metadata, indent=2, sort_keys=True), encoding="utf-8")
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    # Independently check that the complete converted scene is consumable by EUW.
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tsm-native/Content/Python"))
    from tsm_mv_scene_contract import load_scene
    load_scene(output)
    return {"counts": {role: len(layers[role]) for role in layers},
            "manifest_sha256": sha_file(output / "manifest.json"),
            "heightmap_generated": bool(args.dem)}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("scene", help="Downloaded TSM source scene.json, EPSG:4326")
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--target-crs", required=True, help="Reviewed projected EPSG CRS, e.g. EPSG:2968")
    p.add_argument("--anchor-x", type=float, required=True)
    p.add_argument("--anchor-y", type=float, required=True)
    p.add_argument("--vertical-datum", required=True,
                   choices=("UNVERIFIED", "NAVD88_REVIEW_PENDING", "NAVD88_REVIEWED"))
    p.add_argument("--dem", type=Path, default=None, help="Optional complete authoritative DEM mosaic")
    p.add_argument("--vertical-unit", choices=tuple(UNIT_TO_CM), default=None)
    p.add_argument("--size-m", type=float, default=8000.0)
    p.add_argument("--resolution", type=int, default=4033)
    args = p.parse_args()
    if args.size_m <= 0 or args.size_m > 10000:
        p.error("size-m must be >0 and <=10000")
    print(json.dumps(run(args), indent=2))


if __name__ == "__main__":
    main()
