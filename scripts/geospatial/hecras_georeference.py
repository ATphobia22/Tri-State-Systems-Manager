#!/usr/bin/env python3
"""
hecras_georeference.py — Phase 1 georeferencing for legacy HEC-RAS models.

Problem: HEC-RAS 3.1x geometry files (.g01) store cross-sections in
river-station coordinates with NO CRS metadata and (in this model) NO
GIS cut-line coordinates. Model 4449 (JT Myers, Ohio River FIS) is in
this state: 47 cross-sections, RM -777.3 to -844.75, stations in feet,
no map projection anywhere in the archive.

Approach: least-squares affine transformation from source Cartesian
coordinates (legacy reach-schematic space) to destination project CRS
(e.g. EPSG:2968 Indiana State Plane West, feet) using user-supplied
control points (e.g. bridge centerlines, physical monuments).

This is a MATH-BASED transformation, not surveyed georeferencing.
All output is DERIVED. Never use for regulatory determinations,
construction, or flood-depth conclusions without qualified human review.

Model disposition: CANDIDATE_ARCHIVE_ONLY (user withdrew execution
approval 2026-10-17). This script does not authorize execution.

Usage:
    python hecras_georeference.py --g01 JTMyers.g01 \
        --control-points control_points.json --epsg 2968 \
        --output georeferenced_sections.gpkg

control_points.json format:
    {"src": [[x1, y1], [x2, y2], ...],
     "dst": [[easting1, northing1], [easting2, northing2], ...]}
    (src = legacy model Cartesian; dst = project CRS, same units as EPSG)

Requires: numpy (always). Optional: shapely (geometry ops), osgeo/gdal
(GeoPackage export — falls back to GeoJSON if absent).
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import tempfile
import zipfile
from pathlib import Path

try:
    import numpy as np
except ImportError:
    print("ERROR: numpy is required.", file=sys.stderr)
    sys.exit(2)

try:
    from shapely.geometry import LineString
    from shapely.affinity import affine_transform
    HAVE_SHAPELY = True
except ImportError:
    HAVE_SHAPELY = False

try:
    from osgeo import ogr, osr
    HAVE_OSGEO = True
except ImportError:
    HAVE_OSGEO = False

DERIVED_DISCLAIMER = (
    "DERIVED — math-based affine transformation of a non-georeferenced "
    "legacy HEC-RAS model. Not surveyed. Not for regulatory use. "
    "Model 4449 disposition: CANDIDATE_ARCHIVE_ONLY."
)


# ---------------------------------------------------------------------------
# 1. Affine computation
# ---------------------------------------------------------------------------

def compute_affine(src_pts, dst_pts):
    """Least-squares affine: [a, b, d, e, xoff, yoff] (shapely layout).

    src_pts, dst_pts: (N, 2) arrays, N >= 3, same units on each side.
    Solves dst = M @ src via np.linalg.lstsq.
    """
    src = np.asarray(src_pts, dtype=float)
    dst = np.asarray(dst_pts, dtype=float)
    if src.shape != dst.shape or src.ndim != 2 or src.shape[1] != 2:
        raise ValueError("src and dst must be (N, 2) arrays of matching shape")
    if src.shape[0] < 3:
        raise ValueError("need >= 3 control points for a 2D affine fit")
    X = np.hstack([src, np.ones((src.shape[0], 1))])   # (N, 3)
    M, residuals, rank, _ = np.linalg.lstsq(X, dst, rcond=None)
    if rank < 3:
        raise ValueError("control points are degenerate (rank < 3)")
    # M is (3, 2): rows [a, d], [b, e], [xoff, yoff]
    coeffs = [M[0, 0], M[1, 0], M[0, 1], M[1, 1], M[2, 0], M[2, 1]]
    rmse = float(np.sqrt(np.mean((X @ M - dst) ** 2)))
    return coeffs, rmse


def apply_affine_numpy(coords, coeffs):
    """Apply [a, b, d, e, xoff, yoff] to an (N, 2) coordinate array."""
    a, b, d, e, xoff, yoff = coeffs
    coords = np.asarray(coords, dtype=float)
    x = a * coords[:, 0] + b * coords[:, 1] + xoff
    y = d * coords[:, 0] + e * coords[:, 1] + yoff
    return np.column_stack([x, y])


def transform_geometry(coords, coeffs):
    """Transform a coordinate list; shapely when available, else numpy."""
    if HAVE_SHAPELY:
        geom = LineString([(float(x), float(y)) for x, y in coords])
        t = affine_transform(geom, coeffs)
        return list(t.coords)
    return [tuple(p) for p in apply_affine_numpy(coords, coeffs)]


# ---------------------------------------------------------------------------
# 2. HEC-RAS .g01 parsing
# ---------------------------------------------------------------------------

def parse_hecras_geometry(g01_path):
    """Parse a HEC-RAS 3.x .g01 geometry file.

    Returns dict with:
      geom_title, program_version, reach_xy (list of [x, y] schematic pts),
      sections: list of {river_mile, length_l, length_ch, length_r,
                         sta_elev: [(sta, elev), ...], bank_sta,
                         manning: [(sta, n), ...]}
    Note: no GIS cut-line coordinates exist in this model's file; station
    positions are cross-valley distances in feet, not map coordinates.
    """
    text = Path(g01_path).read_text(errors="replace")
    lines = text.splitlines()

    result = {
        "geom_title": None,
        "program_version": None,
        "reach_xy": [],
        "sections": [],
        "source_file": str(g01_path),
    }
    cur = None
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if line.startswith("Geom Title="):
            result["geom_title"] = line.split("=", 1)[1].strip()
        elif line.startswith("Program Version="):
            result["program_version"] = line.split("=", 1)[1].strip()
        elif line.startswith("Reach XY="):
            # "Reach XY= 2" then that many lines of x y pairs
            parts = line.split("=")[1].split()
            n = int(parts[0])
            vals = []
            j = i + 1
            while len(vals) < n * 2 and j < len(lines):
                for tok in lines[j].split():
                    try:
                        vals.append(float(tok))
                    except ValueError:
                        pass
                j += 1
            result["reach_xy"] = [
                [vals[k], vals[k + 1]] for k in range(0, len(vals) - 1, 2)
            ]
            i = j - 1
        elif line.startswith("Type RM Length"):
            # "Type RM Length L Ch R = 1 ,-777.3  ,2112,2112,2112"
            rhs = line.split("=", 1)[1]
            toks = [t.strip() for t in rhs.replace(",", " ").split() if t.strip()]
            cur = {
                "type": int(float(toks[0])),
                "river_mile": float(toks[1]),
                "length_l": float(toks[2]),
                "length_ch": float(toks[3]),
                "length_r": float(toks[4]),
                "sta_elev": [],
                "bank_sta": None,
                "manning": [],
                "description": None,
            }
            result["sections"].append(cur)
        elif line.startswith("BEGIN DESCRIPTION:") and cur is not None:
            desc_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("END DESCRIPTION"):
                desc_lines.append(lines[i].strip())
                i += 1
            cur["description"] = " ".join(desc_lines)
        elif line.startswith("#Sta/Elev=") and cur is not None:
            n = int(line.split("=")[1].split()[0])
            vals = []
            i += 1
            while len(vals) < n * 2 and i < len(lines):
                for tok in lines[i].split():
                    try:
                        vals.append(float(tok))
                    except ValueError:
                        pass
                i += 1
            cur["sta_elev"] = [
                [vals[k], vals[k + 1]] for k in range(0, len(vals) - 1, 2)
            ]
            i -= 1
        elif line.startswith("Bank Sta=") and cur is not None:
            toks = [t.strip() for t in line.split("=", 1)[1].split(",")]
            cur["bank_sta"] = [float(t) for t in toks if t]
        elif line.startswith("#Mann=") and cur is not None:
            i += 1
            vals = []
            while i < len(lines):
                toks = lines[i].split()
                if not toks:
                    i += 1
                    continue
                try:
                    float(toks[0])
                except ValueError:
                    break
                for tok in toks:
                    try:
                        vals.append(float(tok))
                    except ValueError:
                        pass
                i += 1
            cur["manning"] = [
                [vals[k], vals[k + 1]] for k in range(0, len(vals) - 1, 2)
            ]
            i -= 1
        i += 1

    return result


def section_centerline(section):
    """Approximate a section's plan position as a 2D line in
    (station, river-mile) space.

    Without GIS cut lines, each cross-section is a 1D station/elevation
    profile. We embed it in 2D as (sta_ft, river_mile): station across
    the valley (feet), river mile along the reach. The affine transform
    maps this space -> project CRS only where control points justify it
    (e.g. control measured at known stations AND known river miles).
    """
    rm = section["river_mile"]
    return [[sta, rm] for sta, _ in section["sta_elev"]]


# ---------------------------------------------------------------------------
# 3. Export
# ---------------------------------------------------------------------------

def export_georeferenced(sections, coeffs, output_path, target_epsg,
                         control_rmse=None):
    """Write transformed section lines. GeoPackage if osgeo present,
    else GeoJSON. Returns the path written."""
    out = Path(output_path)
    features = []
    for s in sections:
        src_line = section_centerline(s)
        if not src_line:
            continue
        dst_line = transform_geometry(src_line, coeffs)
        sta_elev = s["sta_elev"]
        features.append({
            "river_mile": s["river_mile"],
            "n_points": len(sta_elev),
            "min_elev": min(e for _, e in sta_elev) if sta_elev else None,
            "max_elev": max(e for _, e in sta_elev) if sta_elev else None,
            "coords": dst_line,
        })

    meta = {
        "disclaimer": DERIVED_DISCLAIMER,
        "target_epsg": target_epsg,
        "control_rmse": control_rmse,
        "affine_coeffs": coeffs,
        "n_sections": len(features),
        "model_disposition": "CANDIDATE_ARCHIVE_ONLY",
    }

    if HAVE_OSGEO and out.suffix.lower() in (".gpkg",):
        return _export_gpkg(features, meta, out, target_epsg)
    # GeoJSON fallback
    gj = {
        "type": "FeatureCollection",
        "properties": meta,
        "features": [
            {
                "type": "Feature",
                "properties": {k: v for k, v in f.items() if k != "coords"},
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[float(x), float(y)] for x, y in f["coords"]],
                },
            }
            for f in features
        ],
    }
    if out.suffix.lower() not in (".json", ".geojson"):
        out = out.with_suffix(".geojson")
    out.write_text(json.dumps(gj, indent=1))
    print(f"[ok] wrote GeoJSON (osgeo absent) -> {out}")
    return str(out)


def _export_gpkg(features, meta, out, target_epsg):
    if out.exists():
        out.unlink()
    driver = ogr.GetDriverByName("GPKG")
    ds = driver.CreateDataSource(str(out))
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(int(target_epsg))
    layer = ds.CreateLayer("georeferenced_sections", srs, ogr.wkbLineString)
    for name, ftype in [("river_mile", ogr.OFTReal),
                        ("n_points", ogr.OFTInteger),
                        ("min_elev", ogr.OFTReal),
                        ("max_elev", ogr.OFTReal)]:
        layer.CreateField(ogr.FieldDefn(name, ftype))
    for f in features:
        feat = ogr.Feature(layer.GetLayerDefn())
        feat.SetField("river_mile", float(f["river_mile"]))
        feat.SetField("n_points", int(f["n_points"]))
        if f["min_elev"] is not None:
            feat.SetField("min_elev", float(f["min_elev"]))
            feat.SetField("max_elev", float(f["max_elev"]))
        wkt = "LINESTRING (" + ", ".join(
            f"{x:.3f} {y:.3f}" for x, y in f["coords"]) + ")"
        feat.SetGeometry(ogr.CreateGeometryFromWkt(wkt))
        layer.CreateFeature(feat)
    ds = None
    # sidecar metadata
    Path(str(out) + ".meta.json").write_text(json.dumps(meta, indent=1))
    print(f"[ok] wrote GeoPackage -> {out} (EPSG:{target_epsg})")
    return str(out)


# ---------------------------------------------------------------------------
# 4. CLI
# ---------------------------------------------------------------------------

def load_control_points(path):
    data = json.loads(Path(path).read_text())
    return data["src"], data["dst"]


def resolve_g01(g01_arg):
    """Accept a .g01 path or a .zip containing one."""
    p = Path(g01_arg)
    if p.suffix.lower() == ".zip":
        z = zipfile.ZipFile(p)
        names = [n for n in z.namelist() if n.lower().endswith(".g01")]
        if not names:
            raise FileNotFoundError(f"no .g01 in {p}")
        tmp = Path(tempfile.mkdtemp(prefix="hecras_geo_"))
        out = tmp / Path(names[0]).name
        out.write_bytes(z.read(names[0]))
        return out
    return p


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Phase 1: affine georeferencing for legacy HEC-RAS .g01 "
                    "(math-based, DERIVED output).")
    ap.add_argument("--g01", required=True,
                    help=".g01 geometry file or .zip containing one")
    ap.add_argument("--control-points", required=True,
                    help='JSON {"src": [[x,y]...], "dst": [[e,n]...]}')
    ap.add_argument("--epsg", type=int, default=2968,
                    help="target EPSG (default 2968: IN State Plane West, ft)")
    ap.add_argument("--output", required=True, help="output .gpkg or .geojson")
    ap.add_argument("--print-matrix", action="store_true")
    args = ap.parse_args(argv)

    if not HAVE_SHAPELY:
        print("[warn] shapely absent; using pure-numpy transform", file=sys.stderr)
    if not HAVE_OSGEO:
        print("[warn] osgeo/gdal absent; exporting GeoJSON instead of "
              "GeoPackage", file=sys.stderr)

    g01_path = resolve_g01(args.g01)
    print(f"[info] parsing {g01_path}")
    geom = parse_hecras_geometry(g01_path)
    print(f"[info] title={geom['geom_title']!r} "
          f"version={geom['program_version']} "
          f"sections={len(geom['sections'])}")

    src, dst = load_control_points(args.control_points)
    coeffs, rmse = compute_affine(src, dst)
    print(f"[info] affine fit RMSE = {rmse:.4f} (destination units)")
    if args.print_matrix:
        print(f"[info] coeffs [a,b,d,e,xoff,yoff] = {coeffs}")

    out = export_georeferenced(geom["sections"], coeffs, args.output,
                               args.epsg, control_rmse=rmse)
    print(f"[done] {out}")
    print(f"[note] {DERIVED_DISCLAIMER}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
