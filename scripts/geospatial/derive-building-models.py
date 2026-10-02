#!/usr/bin/env python3
"""
derive-building-models.py — Parcel -> terrain -> building derivation (LOD1 screening).

Reads posey-parcels.geojson, samples the self-hosted Terrain-RGB DEM pyramid
at parcel centroids and across parcel interiors, derives ground-elevation
statistics, estimates a building footprint (documented estimate, not surveyed),
and computes flood depth from a USER-SUPPLIED water-surface elevation (WSE).

Fail-closed rules:
  * --wse-ft is REQUIRED. The script never invents a WSE value.
  * Missing terrain samples are reported as null (unavailable), never zero
    and never interpolated guesses.
  * All derived values carry _derivationProvenance and _uncertainty metadata.

Terrain-RGB decoding (Mapbox spec):
    elevation_m = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
Elevations are converted to feet (x 3.28084) for output.

Usage:
    python3 scripts/geospatial/derive-building-models.py --wse-ft 375.0 \\
        --wse-source "Point Township target BFE 375.0 ft NAVD88 (screening scenario)"
    python3 scripts/geospatial/derive-building-models.py --wse-ft 375.0 --limit 20
"""

import argparse
import json
import math
import os
import sys
from datetime import datetime, timezone

import numpy as np
from PIL import Image
from pyproj import Transformer

SCRIPT_VERSION = "1.0.0"
M_TO_FT = 3.28084
SQFT_TO_SQM = 1.0 / 10.7639

# Conservative building-footprint fraction of parcel area.
# DOCUMENTED ESTIMATE: not surveyed, not per-parcel verified. Screening-grade
# only. Typical single-family residential footprints occupy ~10-20% of a
# rural/suburban parcel; 0.15 is the midpoint. Override with
# --footprint-fraction if a better local estimate exists.
DEFAULT_FOOTPRINT_FRACTION = 0.15

GRID_SAMPLES = 25          # 5x5 interior grid per parcel
ZOOM_CHAIN = (12, 11, 10, 9, 8)  # prefer finest, fall back coarser

# WGS84 -> Indiana State Plane West (ftUS) for parcel-area computation.
_wgs84_to_inwest = Transformer.from_crs("EPSG:4326", "EPSG:2966", always_xy=True)


# --------------------------------------------------------------------------
# Terrain sampling
# --------------------------------------------------------------------------

class TerrainSampler:
    """Samples elevation (ft) from a local Terrain-RGB tile pyramid."""

    def __init__(self, terrain_dir):
        self.terrain_dir = terrain_dir
        self.cache = {}
        self.tiles_loaded = 0
        self.samples_ok = 0
        self.samples_missed = 0

    def _load_tile(self, z, x, y):
        key = (z, x, y)
        if key in self.cache:
            return self.cache[key]
        path = os.path.join(self.terrain_dir, str(z), str(x), "%d.png" % y)
        if not os.path.exists(path):
            self.cache[key] = None
            return None
        try:
            arr = np.asarray(Image.open(path).convert("RGB"))
        except Exception:
            self.cache[key] = None
            return None
        self.cache[key] = arr
        self.tiles_loaded += 1
        return arr

    def sample_ft(self, lon, lat):
        """Elevation in feet at lon/lat, or None when no tile covers the point."""
        for z in ZOOM_CHAIN:
            n = 2 ** z
            xtile = int((lon + 180.0) / 360.0 * n)
            lat_rad = math.radians(lat)
            ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
            arr = self._load_tile(z, xtile, ytile)
            if arr is None:
                continue
            lon_w = xtile / n * 360.0 - 180.0
            lat_n = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * ytile / n))))
            lat_s = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (ytile + 1) / n))))
            span = lat_n - lat_s
            if span <= 0:
                continue
            px = int((lon - lon_w) / 360.0 * n * 256)
            py = int((lat_n - lat) / span * 256)
            px = max(0, min(255, px))
            py = max(0, min(255, py))
            r, g, b = (int(v) for v in arr[py, px])
            elev_m = -10000.0 + ((r * 256 * 256 + g * 256 + b) * 0.1)
            self.samples_ok += 1
            return elev_m * M_TO_FT
        self.samples_missed += 1
        return None


# --------------------------------------------------------------------------
# Geometry helpers (pure Python, no shapely)
# --------------------------------------------------------------------------

def shoelace(ring):
    s = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        s += x1 * y2 - x2 * y1
    return s / 2.0


def largest_polygon_coords(geom):
    """Return coordinate list of the largest polygon (handles Polygon/MultiPolygon)."""
    t = geom.get("type")
    if t == "Polygon":
        return geom["coordinates"]
    if t == "MultiPolygon":
        best, best_a = None, -1.0
        for poly in geom["coordinates"]:
            a = abs(shoelace(poly[0]))
            if a > best_a:
                best, best_a = poly, a
        return best
    return None


def ring_centroid(ring):
    a = shoelace(ring)
    if a == 0:
        return (ring[0][0], ring[0][1])
    cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        cross = x1 * y2 - x2 * y1
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    return (cx / (6.0 * a), cy / (6.0 * a))


def point_in_ring(lon, lat, ring):
    """Ray-casting point-in-polygon. Interior rings (holes) are ignored."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > lat) != (yj > lat)) and \
                (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def polygon_area_sqft(coords):
    """Parcel area in sq ft via Indiana State Plane West (ftUS)."""
    ring = coords[0]
    pts = [_wgs84_to_inwest.transform(lon, lat) for lon, lat in ring]
    return abs(shoelace(pts))


# --------------------------------------------------------------------------
# Derivation
# --------------------------------------------------------------------------

def derive_feature(feature, sampler, wse_ft, wse_source, footprint_fraction,
                   grid_n, run_ts):
    geom = feature.get("geometry") or {}
    coords = largest_polygon_coords(geom)
    props = dict(feature.get("properties") or {})

    if coords is None:
        props.update({
            "groundElevationFt": None,
            "groundElevationMinFt": None,
            "groundElevationMaxFt": None,
            "groundElevationMeanFt": None,
            "elevationSampleCount": 0,
            "elevationCoverage": "NO_GEOMETRY",
            "parcelAreaSqFt": None,
            "parcelAreaSqM": None,
            "buildingFootprintAreaSqFt": None,
            "buildingFootprintAreaSqM": None,
            "footprintFractionUsed": footprint_fraction,
            "floodDepthFt": None,
            "isFlooded": None,
            "wseUsedFt": wse_ft,
            "wseProvenance": wse_source,
        })
    else:
        ring = coords[0]
        clon, clat = ring_centroid(ring)

        # Interior grid samples (bbox -> 5x5), kept only when inside the ring.
        lons = [p[0] for p in ring]
        lats = [p[1] for p in ring]
        w, s, e, n_ = min(lons), min(lats), max(lons), max(lats)
        side = int(math.sqrt(grid_n))
        xs = [w + (e - w) * (i + 0.5) / side for i in range(side)] if e > w \
            else [w]
        ys = [s + (n_ - s) * (j + 0.5) / side for j in range(side)] if n_ > s \
            else [s]

        elevations = []
        for gx in xs:
            for gy in ys:
                if point_in_ring(gx, gy, ring):
                    v = sampler.sample_ft(gx, gy)
                    if v is not None:
                        elevations.append(v)

        centroid_elev = sampler.sample_ft(clon, clat)
        if centroid_elev is not None and centroid_elev not in elevations:
            elevations.append(centroid_elev)

        if elevations:
            emin = min(elevations)
            emax = max(elevations)
            emean = sum(elevations) / len(elevations)
            coverage = "FULL" if len(elevations) >= 3 else "PARTIAL"
        else:
            emin = emax = emean = None
            coverage = "UNAVAILABLE"

        area_sqft = polygon_area_sqft(coords)
        area_sqm = area_sqft * SQFT_TO_SQM
        fp_sqft = area_sqft * footprint_fraction

        # Flood depth: WSE minus mean ground elevation. Negative -> dry (0.0).
        # Unavailable ground elevation -> null depth (missing is not "dry").
        if emean is None:
            depth = None
            flooded = None
        else:
            raw = wse_ft - emean
            depth = round(max(0.0, raw), 2)
            flooded = bool(raw > 0)

        props.update({
            "groundElevationFt": round(centroid_elev, 2) if centroid_elev is not None else None,
            "groundElevationMinFt": round(emin, 2) if emin is not None else None,
            "groundElevationMaxFt": round(emax, 2) if emax is not None else None,
            "groundElevationMeanFt": round(emean, 2) if emean is not None else None,
            "elevationSampleCount": len(elevations),
            "elevationCoverage": coverage,
            "parcelAreaSqFt": round(area_sqft, 1),
            "parcelAreaSqM": round(area_sqm, 1),
            "buildingFootprintAreaSqFt": round(fp_sqft, 1),
            "buildingFootprintAreaSqM": round(fp_sqft * SQFT_TO_SQM, 1),
            "footprintFractionUsed": footprint_fraction,
            "floodDepthFt": depth,
            "isFlooded": flooded,
            "wseUsedFt": wse_ft,
            "wseProvenance": wse_source,
        })

    props["_derivationProvenance"] = {
        "script": "scripts/geospatial/derive-building-models.py",
        "scriptVersion": SCRIPT_VERSION,
        "runTimestampUtc": run_ts,
        "demSource": "Self-hosted Terrain-RGB tile pyramid tsm-console/public/terrain_3dep "
                     "(USGS 3DEP-derived, zooms 8-12, Mapbox Terrain-RGB encoding). "
                     "Screening-grade, not survey-grade.",
        "wseSource": wse_source,
        "wseFtNavd88": wse_ft,
        "crs": "EPSG:4326 (input/output); EPSG:2966 used for parcel-area computation",
    }
    props["_uncertainty"] = {
        "terrainRgbQuantizationM": 0.1,
        "note": "Terrain-RGB quantization is ~0.1 m; tile pyramid is a screening "
                "derivative, not survey-grade elevation evidence. Parcel centroid "
                "and interior grid samples are approximate; interior rings (holes) "
                "ignored in sampling. Building footprint fraction is an estimate "
                "(see footprintFractionUsed), not a surveyed footprint. Flood "
                "depth is screening-grade: WSE minus mean ground elevation. "
                "Null elevations/depths mean unavailable, not zero.",
    }

    return {
        "type": "Feature",
        "geometry": geom,
        "properties": props,
    }


def main():
    ap = argparse.ArgumentParser(
        description="Parcel -> terrain -> building derivation (LOD1 screening).")
    ap.add_argument("--wse-ft", type=float, required=True,
                    help="REQUIRED: water-surface elevation in ft NAVD88. "
                         "The script never invents this value.")
    ap.add_argument("--wse-source", default="USER_PROVIDED",
                    help="Provenance string describing where the WSE came from.")
    ap.add_argument("--input",
                    default="tsm-console/public/data/posey-parcels.geojson")
    ap.add_argument("--output",
                    default="tsm-console/public/data/posey-buildings-derived.geojson")
    ap.add_argument("--terrain-dir",
                    default="tsm-console/public/terrain_3dep")
    ap.add_argument("--limit", type=int, default=0,
                    help="Process only the first N parcels (testing). 0 = all.")
    ap.add_argument("--footprint-fraction", type=float,
                    default=DEFAULT_FOOTPRINT_FRACTION)
    ap.add_argument("--grid", type=int, default=GRID_SAMPLES,
                    help="Interior sample points per parcel (default 25).")
    args = ap.parse_args()

    if not (0.0 < args.footprint_fraction <= 1.0):
        sys.exit("error: --footprint-fraction must be in (0, 1]")

    with open(args.input) as f:
        fc = json.load(f)
    features = fc.get("features", [])
    if args.limit > 0:
        features = features[:args.limit]

    sampler = TerrainSampler(args.terrain_dir)
    run_ts = datetime.now(timezone.utc).isoformat()

    derived = []
    n_flooded = 0
    n_no_elev = 0
    for i, feat in enumerate(features):
        d = derive_feature(feat, sampler, args.wse_ft, args.wse_source,
                           args.footprint_fraction, args.grid, run_ts)
        derived.append(d)
        if d["properties"].get("isFlooded") is True:
            n_flooded += 1
        if d["properties"].get("elevationCoverage") == "UNAVAILABLE":
            n_no_elev += 1
        if (i + 1) % 500 == 0:
            print("  ... %d/%d" % (i + 1, len(features)), flush=True)

    out = dict(fc)
    out["features"] = derived
    out["featureCount"] = len(derived)
    out["derivation"] = {
        "script": "scripts/geospatial/derive-building-models.py",
        "scriptVersion": SCRIPT_VERSION,
        "runTimestampUtc": run_ts,
        "inputFile": args.input,
        "inputFeatureCount": len(fc.get("features", [])),
        "outputFeatureCount": len(derived),
        "wseFtNavd88": args.wse_ft,
        "wseSource": args.wse_source,
        "footprintFraction": args.footprint_fraction,
        "gridSamplesPerParcel": args.grid,
        "parcelsFlooded": n_flooded,
        "parcelsWithoutElevation": n_no_elev,
        "terrainTilesLoaded": sampler.tiles_loaded,
        "provisional": True,
        "humanReviewRequired": True,
        "note": "LOD1 screening derivation. Not survey-grade. Null = unavailable.",
    }

    with open(args.output, "w") as f:
        json.dump(out, f)

    print("done: %d features -> %s" % (len(derived), args.output))
    print("  flooded (depth>0): %d" % n_flooded)
    print("  without elevation: %d" % n_no_elev)
    print("  terrain tiles loaded: %d" % sampler.tiles_loaded)


if __name__ == "__main__":
    main()
