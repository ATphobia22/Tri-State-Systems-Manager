"""Convert bbox-extracted OSM GeoJSON into UE-local centimetre GeoJSON.

Requires pyproj; input must be made from osmium export --attributes=type,id.
OSM is crowd-sourced, ODbL 1.0; never elevate its dimensions to survey data.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

ROLES = ("buildings", "roads", "trees")


def checksum(file):
    h = hashlib.sha256()
    with Path(file).open("rb") as source:
        for block in iter(lambda: source.read(1048576), b""):
            h.update(block)
    return h.hexdigest()


def to_local_geojson(input_path, output_dir, *, crs, easting, northing, units, bounds):
    from pyproj import CRS, Transformer
    target = CRS.from_user_input(crs)
    if target.to_epsg() is None or not target.is_projected:
        raise ValueError("Target must be a projected EPSG CRS")
    target_unit = target.axis_info[0].unit_name.lower()
    expected = "us_survey_foot" if "foot" in target_unit else "meter"
    if units != expected:
        raise ValueError("Selected units mismatch target CRS")
    if not all(math.isfinite(v) for v in [easting, northing, *bounds]):
        raise ValueError("Nonfinite source anchor/AOI")
    west, south, east, north = bounds
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise ValueError("Invalid AOI bounds")
    converter = Transformer.from_crs("EPSG:4326", target, always_xy=True)
    factor = 30.4800609601219 if units == "us_survey_foot" else 100.0

    def local(pt):
        x, y = converter.transform(pt[0], pt[1])
        x, y = round((x-easting)*factor, 2), round((northing-y)*factor, 2)
        if not (math.isfinite(x) and math.isfinite(y) and abs(x) < 1000000 and abs(y) < 1000000):
            raise ValueError("Geographic coordinate is outside 10km UE-local origin")
        return [x, y]

    data = json.loads(Path(input_path).read_text(encoding="utf-8"))
    if data.get("type") != "FeatureCollection":
        raise ValueError("Expected FeatureCollection")
    fc = {r: [] for r in ROLES}
    seen = {r: set() for r in ROLES}
    unsupported = 0
    for feature in data.get("features", []):
        props = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        kind = geometry.get("type")
        role = ("buildings" if props.get("building") not in (None, "", "no") and kind == "Polygon"
                else "roads" if props.get("highway") and kind == "LineString"
                else "trees" if props.get("natural") == "tree" and kind == "Point" else None)
        if role is None:
            if props.get("building") and kind in ("MultiPolygon", "Polygon"):
                unsupported += 1
            continue
        osm_type = props.get("@type")
        osm_id = props.get("@id")
        if osm_type not in ("node", "way", "relation") or not re.fullmatch(r"\d+", str(osm_id)):
            raise ValueError("Expected @type and @id. Use osmium export --attributes=type,id")
        stable = f"osm-{osm_type}-{osm_id}"
        if stable in seen[role]:
            raise ValueError("Repeated OSM identity " + stable)
        seen[role].add(stable)
        coord = geometry.get("coordinates")
        if role == "buildings":
            if len(coord) != 1 or len(coord[0]) < 4:
                unsupported += 1
                continue
            points = [local(p) for p in coord[0]]
            if points[0] != points[-1]:
                raise ValueError("Unclosed building ring " + stable)
            out_geometry = {"type": "Polygon", "coordinates": [points]}
        elif role == "roads":
            if len(coord) < 2:
                raise ValueError("Road has fewer than 2 vertices " + stable)
            out_geometry = {"type": "LineString", "coordinates": [local(p) for p in coord]}
        else:
            out_geometry = {"type": "Point", "coordinates": local(coord)}
        attrs = {"id": stable, "osm_type": osm_type, "osm_id": str(osm_id),
                 "evidence_status": "CROWDSOURCED_UNVERIFIED"}
        if role == "roads":
            attrs.update({"highway": str(props["highway"]), "name": str(props.get("name") or "")})
        if role == "buildings":
            attrs["roof_type"] = str(props.get("roof:shape") or "unknown")
        fc[role].append({"type": "Feature", "properties": attrs, "geometry": out_geometry})
    if unsupported:
        raise ValueError(f"{unsupported} OSM building polygon(s) need review/splitting; no silent loss")
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    names = [r + ".geojson" for r in ROLES] + ["manifest.json"]
    if any((output / name).exists() for name in names):
        raise FileExistsError("Refusing to overwrite immutable source snapshot")
    files = {}
    for role in ROLES:
        path = output / (role + ".geojson")
        fc[role].sort(key=lambda f: f["properties"]["id"])
        path.write_text(json.dumps({"type": "FeatureCollection", "features": fc[role]},
                                   separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
        files[role] = {"path": path.name, "sha256": checksum(path)}
    manifest = {
        "schema": "tsm.mount-vernon.scene.v1",
        "coordinate_frame": "UE_LOCAL_CM", "axes": "EAST_SOUTH_UP",
        "source_horizontal_crs": crs, "vertical_datum": "UNVERIFIED",
        "evidence_status": "PENDING_EVIDENCE",
        "source_anchor": {"easting": easting, "northing": northing, "units": units},
        "files": files,
        "source": {"provider": "Geofabrik / OpenStreetMap", "license": "ODbL-1.0",
                   "attribution": "(c) OpenStreetMap contributors",
                   "input_sha256": checksum(input_path), "bbox_epsg4326": list(bounds),
                   "quality": "crowdsourced; not survey or engineering authoritative"},
        "counts": {r: len(fc[r]) for r in ROLES},
    }
    (output / "manifest.json").write_text(json.dumps(manifest, sort_keys=True, indent=2) + "\n",
                                          encoding="utf-8")
    return manifest


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--geojson", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--crs", required=True)
    p.add_argument("--anchor-x", type=float, required=True)
    p.add_argument("--anchor-y", type=float, required=True)
    p.add_argument("--units", choices=("us_survey_foot", "meter"), required=True)
    p.add_argument("--bbox", type=float, nargs=4, required=True,
                   metavar=("WEST", "SOUTH", "EAST", "NORTH"))
    args = p.parse_args()
    result = to_local_geojson(args.geojson, args.out, crs=args.crs,
                              easting=args.anchor_x, northing=args.anchor_y,
                              units=args.units, bounds=args.bbox)
    print(json.dumps({"counts": result["counts"], "manifest": str(args.out/"manifest.json")},
                     sort_keys=True))


if __name__ == "__main__":
    main()
