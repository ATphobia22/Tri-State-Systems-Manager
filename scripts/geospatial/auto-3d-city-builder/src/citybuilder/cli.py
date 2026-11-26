"""GeoJSON → LoD1 glTF 3D Tiles 1.1, with strict CRS/datum and evidence metadata.

Local projected GeoJSON footprints become traceable, visual-only LoD1 3D Tiles.
Optional estimates are permitted for world-building, never engineering decisions.
"""
import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import sys

import numpy as np
from pyproj import CRS, Transformer
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.ops import transform as transform_geometry, triangulate
import trimesh


def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _finite_positive(v, label, positive=True):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
        raise ValueError(f"{label} must be a finite number")
    if positive and v <= 0:
        raise ValueError(f"{label} must be greater than zero")
    return float(v)


def _rings(poly):
    # Separate triangulation is clipped to the polygon so holes remain empty.
    for tri in triangulate(poly):
        cut = tri.intersection(poly)
        for geom in getattr(cut, "geoms", [cut]):
            if isinstance(geom, Polygon) and geom.area > 1e-12:
                yield geom


def _polygon_mesh(poly, zbase, ztop):
    vertices, faces = [], []
    def add_face(points):
        if len(points) != 3:
            return
        j = len(vertices)
        vertices.extend([[p[0], p[1], p[2]] for p in points])
        faces.append([j, j + 1, j + 2])
    for t in _rings(poly):
        c = list(t.exterior.coords)
        if len(c) == 4:
            add_face([(x, y, ztop) for x, y in c[:3]])
            add_face([(x, y, zbase) for x, y in reversed(c[:3])])
    for ring in [poly.exterior, *poly.interiors]:
        c = list(ring.coords)
        for a, b in zip(c[:-1], c[1:]):
            add_face([(a[0], a[1], zbase), (b[0], b[1], zbase), (b[0], b[1], ztop)])
            add_face([(a[0], a[1], zbase), (b[0], b[1], ztop), (a[0], a[1], ztop)])
    if not faces:
        raise ValueError("Polygon could not be triangulated")
    return trimesh.Trimesh(vertices=np.asarray(vertices), faces=np.asarray(faces), process=False)


def build(input_path, output_dir, crs, horizontal_units, vertical_datum, vertical_units,
          height_field="height_m", ground_field="ground_m", source_url="", source_date="",
          require_all=True, estimate_missing=False, estimate_radius_m=250):
    input_path, output_dir = Path(input_path), Path(output_dir)
    if not input_path.exists():
        raise ValueError(f"Input missing: {input_path}")
    if vertical_datum.lower() in {"unknown", "", "unspecified"}:
        raise ValueError("An explicit source vertical datum is mandatory")
    if vertical_units != "m":
        raise ValueError("Only metre-valued building height/ground fields are supported")
    src = CRS.from_user_input(crs)
    if src.is_geographic:
        raise ValueError("Input CRS must be a projected CRS with metres as axis units")
    if not all(a.unit_conversion_factor and abs(a.unit_conversion_factor - 1) < 1e-8 for a in src.axis_info[:2]):
        raise ValueError("Input CRS axes must be metres; reproject before building")
    if horizontal_units != "m":
        raise ValueError("horizontal_units must be m")
    obj = json.loads(input_path.read_text(encoding="utf-8"))
    if obj.get("type") != "FeatureCollection":
        raise ValueError("GeoJSON FeatureCollection required")
    features = obj.get("features", [])
    if not features:
        raise ValueError("Empty feature collection")
    transformer = Transformer.from_crs(src, CRS.from_epsg(4326), always_xy=True)
    valid, errors, ids, parsed, estimates = [], [], set(), [], []
    for n, f in enumerate(features):
        p = f.get("properties") or {}
        ident = str(p.get("source_id") or f.get("id") or "")
        try:
            if not ident or ident in ids:
                raise ValueError("Missing or duplicate source_id")
            ids.add(ident)
            geometry = shape(f["geometry"])
            if geometry.is_empty or not geometry.is_valid or not isinstance(geometry, (Polygon, MultiPolygon)):
                raise ValueError("Geometry must be valid Polygon/MultiPolygon")
            parsed.append((ident, geometry, p))
        except Exception as e:
            errors.append({"index": n, "source_id": ident, "error": str(e)})
    known = []
    for ident, geom, props in parsed:
        try:
            height = _finite_positive(props.get(height_field), height_field)
            known.append((ident, geom.centroid, height))
        except (ValueError, TypeError):
            pass
    for ident, geometry, p in parsed:
        try:
            height_state, ground_state = "SOURCE_DECLARED", "SOURCE_DECLARED_NOT_GEOID_CONVERTED"
            try:
                height = _finite_positive(p.get(height_field), height_field)
            except ValueError:
                if not estimate_missing:
                    raise
                nearby = sorted(((geometry.centroid.distance(c), sid, h) for sid, c, h in known if sid != ident), key=lambda v: v[0])
                neighbors = [n for n in nearby if n[0] <= estimate_radius_m][:5]
                if neighbors:
                    weights = [1 / max(n[0], 1) for n in neighbors]
                    height = sum(w*n[2] for w,n in zip(weights,neighbors)) / sum(weights)
                    height_state = "ESTIMATED_FROM_NEARBY"
                    method = "inverse_distance_weighted_nearby_heights"
                    dependencies = [n[1] for n in neighbors]
                    confidence = "LOW"
                else:
                    # Visual massing only; footprint area does NOT determine height.
                    # These arbitrary story counts are never accepted as engineering inputs.
                    area = geometry.area
                    height = 3.2 * (1 if area < 140 else 2 if area < 900 else 3)
                    height_state = "ESTIMATED_FROM_FOOTPRINT"
                    method = "visual_typology_heuristic_story_count"
                    dependencies = []
                    confidence = "VERY_LOW"
                estimates.append({"source_id": ident, "field": height_field, "estimated_value": round(height, 3),
                    "units": "m", "status": height_state, "method": method,
                    "confidence": confidence, "references": dependencies,
                    "replacement_requirement": "Validated height evidence tied to the same source_id and vertical reference",
                    "review_status": "NEEDS_VERIFICATION", "allowed_use": "VISUAL_ONLY_NOT_ENGINEERING"})
            try:
                ground = _finite_positive(p.get(ground_field), ground_field, positive=False)
            except ValueError:
                if not estimate_missing:
                    raise
                ground = 0.0
                ground_state = "ASSUMED_ZERO_VISUAL"
                estimates.append({"source_id": ident, "field": ground_field, "estimated_value": 0.0,
                    "units": "m", "status": ground_state, "method": "local_relative_ground_zero_no_vertical_reference",
                    "confidence": "NONE", "references": [],
                    "replacement_requirement": "Terrain sample and verified vertical-datum-to-WGS84-ellipsoid transformation",
                    "review_status": "NEEDS_VERIFICATION", "allowed_use": "VISUAL_ONLY_NOT_ENGINEERING"})
            valid.append((ident, geometry, ground, height, height_state, ground_state))
        except Exception as e:
            errors.append({"source_id": ident, "error": str(e)})
    if errors and require_all:
        raise ValueError(f"{len(errors)} invalid features: {json.dumps(errors[:8])}")
    if not valid:
        raise ValueError("No valid building features")
    bounds = [g.bounds for _, g, _, _, _, _ in valid]
    xmid = (min(b[0] for b in bounds) + max(b[2] for b in bounds)) / 2
    ymid = (min(b[1] for b in bounds) + max(b[3] for b in bounds)) / 2
    lon, lat = transformer.transform(xmid, ymid)
    # The model is locally ENU. Source ground elevations are used as geometry
    # relative to a declared vertical reference, but cannot be interpreted as
    # WGS84 ellipsoid heights without a validated geoid transformation.
    # Therefore z is based at zero and only relative building heights are used.
    # Ground offsets are recorded but NOT applied to globe elevations.
    mesh_scene = trimesh.Scene()
    scenes = {"SOURCE_DECLARED": trimesh.Scene(), "ESTIMATED": trimesh.Scene()}
    minx = miny = minz = float("inf")
    maxx = maxy = maxz = float("-inf")
    data = []
    for ident, geom, ground, height, height_state, ground_state in valid:
        parts = list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]
        for i, poly in enumerate(parts):
            local = transform_geometry(lambda x,y,z=None: (np.asarray(x)-xmid, np.asarray(y)-ymid), poly)
            mesh = _polygon_mesh(local, 0., height)
            mesh.visual.vertex_colors = [238, 158, 67, 255] if height_state.startswith("ESTIMATED") else [178, 185, 197, 255]
            mesh_scene.add_geometry(mesh, geom_name=f"{ident}_{i}")
            scenes["ESTIMATED" if height_state.startswith("ESTIMATED") else "SOURCE_DECLARED"].add_geometry(mesh.copy(), geom_name=f"{ident}_{i}")
            b = mesh.bounds
            minx,miny,minz = min(minx,b[0,0]),min(miny,b[0,1]),min(minz,b[0,2])
            maxx,maxy,maxz = max(maxx,b[1,0]),max(maxy,b[1,1]),max(maxz,b[1,2])
        data.append({"source_id":ident,"height_m":height,"ground_m":ground,"height_evidence":height_state,"ground_evidence":ground_state})
    output_dir.mkdir(parents=True,exist_ok=True)
    mesh_scene.export(output_dir / "buildings.glb", file_type="glb")
    # East, North and Up unit vectors in ECEF. Translation is ECEF position
    # at ellipsoid height zero; this is an explicit ellipsoidal visualization
    # anchor, NOT a conversion from the source vertical datum.
    lonr, latr = math.radians(lon), math.radians(lat)
    sl,cl,sp,cp=math.sin(lonr),math.cos(lonr),math.sin(latr),math.cos(latr)
    anchor = Transformer.from_crs("EPSG:4979","EPSG:4978",always_xy=True).transform(lon,lat,0.)
    east=(-sl,cl,0); north=(-sp*cl,-sp*sl,cp); up=(cp*cl,cp*sl,sp)
    transform=[east[0],east[1],east[2],0,north[0],north[1],north[2],0,up[0],up[1],up[2],0,*anchor,1]
    cx,cy,cz=(minx+maxx)/2,(miny+maxy)/2,(minz+maxz)/2
    ex,ey,ez=(maxx-minx)/2+1,(maxy-miny)/2+1,(maxz-minz)/2+1
    tileset={"asset":{"version":"1.1","generator":"auto-3d-city-builder/0.2.1"},
       "geometricError":max(ex,ey,ez)*2,"root":{"boundingVolume":{"box":[cx,cy,cz,ex,0,0,0,ey,0,0,0,ez]},
       "geometricError":0,"refine":"ADD","transform":transform,"content":{"uri":"buildings.glb"}}}
    (output_dir/"tileset.json").write_text(json.dumps(tileset,indent=2)+"\n")
    # Two independent 3D Tiles layers make visual estimates genuinely hideable.
    layer_files = {}
    for group, grouped_scene in scenes.items():
        if not grouped_scene.geometry:
            continue
        name = "estimated" if group == "ESTIMATED" else "verified"
        filename = f"buildings_{name}.glb"
        grouped_scene.export(output_dir / filename, file_type="glb")
        layer_tiles = json.loads(json.dumps(tileset))
        layer_tiles["root"]["content"]["uri"] = filename
        layer_tiles["asset"]["generator"] += f"/{name}"
        (output_dir / f"tileset_{name}.json").write_text(json.dumps(layer_tiles, indent=2)+"\n")
        layer_files[name] = f"tileset_{name}.json"

    ledger = {"schema_version": "1.0.0", "estimates": estimates,
              "visual_alignment_warning": "Ground may be visual zero; not projected to NAVD88/ellipsoidal terrain; local relative building models only.",
              "engineering_eligibility": False,
              "policy": "Replace estimates by authoritative evidence using immutable source_id; never use guesses for flood elevations, setbacks, permits or utilities."}
    (output_dir/"estimate_ledger.json").write_text(json.dumps(ledger, indent=2)+"\n")
    manifest={"status":"VISUAL_ESTIMATES_PRESENT" if estimates else "DERIVED_LOD1_NOT_SURVEY_GRADE", "estimate_count":len(estimates),
       "estimates_file":"estimate_ledger.json", "geometry_use":"VISUAL_ONLY", "height_estimation_opt_in":bool(estimate_missing),"visual_layers":layer_files,"generated_at_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
       "input_name":input_path.name,"input_sha256":_sha256(input_path),"input_crs":src.to_string(),
       "horizontal_units":"m","source_vertical_datum":vertical_datum,"vertical_units":"m",
       "globe_anchor":"EPSG:4978/WGS84 ellipsoid h=0; NO geoid shift applied",
       "rendering_warning":"Relative heights only: source ground elevations are NOT placed in ellipsoidal ECEF. Terrain alignment requires validated geoid and terrain sampling.",
       "source_url":source_url,"source_publication_date":source_date,"features_input":len(features),
       "features_built":len(valid),"errors":errors,"objects":data,"output_hashes":{
       "buildings.glb":_sha256(output_dir/"buildings.glb"),"tileset.json":_sha256(output_dir/"tileset.json"), "estimate_ledger.json":_sha256(output_dir/"estimate_ledger.json")}}
    for layer_name, tiles_name in layer_files.items():
        manifest["output_hashes"][tiles_name] = _sha256(output_dir / tiles_name)
        manifest["output_hashes"][f"buildings_{layer_name}.glb"] = _sha256(output_dir / f"buildings_{layer_name}.glb")
    (output_dir/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    return manifest


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input",type=Path)
    parser.add_argument("output",type=Path)
    parser.add_argument("--crs",required=True,help="Projected CRS with metre axes, e.g. EPSG:32616")
    parser.add_argument("--horizontal-units",default="m",choices=["m"])
    parser.add_argument("--vertical-datum",required=True)
    parser.add_argument("--vertical-units",default="m",choices=["m"])
    parser.add_argument("--source-url",default="")
    parser.add_argument("--source-date",default="")
    parser.add_argument("--allow-partial",action="store_true")
    parser.add_argument("--estimate-missing", action="store_true", help="Visual-only estimated heights and ground; every assumption recorded")
    ns=parser.parse_args(argv)
    try:
        m=build(ns.input,ns.output,ns.crs,ns.horizontal_units,ns.vertical_datum,ns.vertical_units,
                source_url=ns.source_url,source_date=ns.source_date,require_all=not ns.allow_partial,estimate_missing=ns.estimate_missing)
        print(json.dumps({"built":m["features_built"],"errors":len(m["errors"]),"output":str(ns.output)},indent=2))
        return 0
    except (ValueError,KeyError,TypeError) as e:
        print(f"BUILD FAILED: {e}",file=sys.stderr)
        return 2

if __name__=="__main__":
    raise SystemExit(main())
