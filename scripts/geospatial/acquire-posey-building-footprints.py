#!/usr/bin/env python3
"""Acquire Posey AOI building footprints from permitted free sources.

Sources (in priority order):
  1. Microsoft US Building Footprints — Indiana.geojson.zip (ODbL)
     https://minedbuildings.z5.web.core.windows.net/legacy/usbuildings-v2/Indiana.geojson.zip
  2. Existing repo parcel-derived screening set (fallback only)

IGIO Data Harvest does NOT publish free statewide building outlines;
building outlines are typically an imagery-program buy-up product.
This script never claims survey or IGIO authority.

Usage:
  python3 scripts/geospatial/acquire-posey-building-footprints.py
  python3 scripts/geospatial/acquire-posey-building-footprints.py --ms-zip /path/Indiana.geojson.zip

Output:
  data/buildings/posey-ms-buildings-aoi.geojson
  data/buildings/SOURCE_MANIFEST.json
  data/buildings/SHA256SUMS
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

# Point Township / Posey AOI (WGS84) — slightly expanded Bonebank envelope
AOI = {
    "west": -88.05,
    "south": 37.80,
    "east": -87.90,
    "north": 37.95,
}

MS_INDIANA_URL = (
    "https://minedbuildings.z5.web.core.windows.net/legacy/usbuildings-v2/Indiana.geojson.zip"
)
MS_LICENSE = "Open Data Commons Open Database License (ODbL)"
MS_ATTRIBUTION = "Microsoft US Building Footprints"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ring_in_aoi(coords) -> bool:
    """True if any vertex of exterior ring is inside AOI bbox."""
    if not coords:
        return False
    ring = coords[0] if isinstance(coords[0][0], (list, tuple)) else coords
    for pt in ring:
        lon, lat = pt[0], pt[1]
        if AOI["west"] <= lon <= AOI["east"] and AOI["south"] <= lat <= AOI["north"]:
            return True
    return False


def clip_ms_geojson(src_path: Path, out_path: Path) -> dict:
    """Stream-filter MS Indiana GeoJSON FeatureCollection or NDJSON to AOI."""
    text = src_path.read_text(encoding="utf-8", errors="replace")
    features = []
    if text.lstrip().startswith("{"):
        data = json.loads(text)
        raw = data.get("features", [])
        for i, ft in enumerate(raw):
            geom = ft.get("geometry") or {}
            coords = geom.get("coordinates")
            if geom.get("type") in ("Polygon", "MultiPolygon") and ring_in_aoi(coords):
                props = dict(ft.get("properties") or {})
                props["sourceObjectId"] = props.get("sourceObjectId", i)
                props["footprintSource"] = "MICROSOFT_US_BUILDING_FOOTPRINTS"
                props["authorityClass"] = "DERIVED"
                props["engineeringUse"] = False
                props["regulatoryUse"] = False
                features.append({"type": "Feature", "geometry": geom, "properties": props})
    else:
        # NDJSON / geojsonl
        for i, line in enumerate(text.splitlines()):
            line = line.strip()
            if not line:
                continue
            try:
                ft = json.loads(line)
            except json.JSONDecodeError:
                continue
            geom = ft.get("geometry") or {}
            if geom.get("type") in ("Polygon", "MultiPolygon") and ring_in_aoi(
                geom.get("coordinates")
            ):
                props = dict(ft.get("properties") or {})
                props["sourceObjectId"] = props.get("sourceObjectId", i)
                props["footprintSource"] = "MICROSOFT_US_BUILDING_FOOTPRINTS"
                props["authorityClass"] = "DERIVED"
                props["engineeringUse"] = False
                props["regulatoryUse"] = False
                features.append({"type": "Feature", "geometry": geom, "properties": props})

    fc = {
        "type": "FeatureCollection",
        "featureCount": len(features),
        "features": features,
        "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        "aoi": AOI,
        "provenance": {
            "source": MS_ATTRIBUTION,
            "sourceUrl": MS_INDIANA_URL,
            "license": MS_LICENSE,
            "authorityClass": "DERIVED",
            "engineeringUse": False,
            "regulatoryUse": False,
            "note": "Computer-vision footprints, not survey. Not IGIO framework data.",
            "acquiredUtc": datetime.now(timezone.utc).isoformat(),
        },
    }
    out_path.write_text(json.dumps(fc, separators=(",", ":")))
    return fc


def extract_zip_geojson(zip_path: Path, work: Path) -> Path:
    with zipfile.ZipFile(zip_path, "r") as zf:
        names = [n for n in zf.namelist() if n.lower().endswith((".geojson", ".json", ".geojsonl"))]
        if not names:
            raise SystemExit(f"no geojson inside {zip_path}")
        target = names[0]
        zf.extract(target, work)
        return work / target


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ms-zip", type=Path, help="Local path to Indiana.geojson.zip")
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=Path("data/buildings"),
    )
    ap.add_argument(
        "--fallback-derived",
        type=Path,
        default=Path("tsm-console/public/data/posey-buildings-derived.geojson"),
        help="Use existing parcel-derived set if MS zip not provided",
    )
    args = ap.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)

    manifest = {
        "schemaVersion": "1.0.0",
        "artifactId": "posey-building-footprints",
        "aoi": AOI,
        "authorityClass": "DERIVED",
        "engineeringUse": False,
        "regulatoryUse": False,
        "igioNote": (
            "IGIO Data Harvest publishes parcels/addresses/roads/elevation; "
            "statewide free building outlines are not a standard harvest product. "
            "LiDAR building outlines are typically an imagery-program buy-up."
        ),
        "sources": [],
        "acquiredUtc": datetime.now(timezone.utc).isoformat(),
    }

    out_geo = args.out_dir / "posey-ms-buildings-aoi.geojson"

    if args.ms_zip and args.ms_zip.is_file():
        work = args.out_dir / "_extract"
        work.mkdir(exist_ok=True)
        geo_path = extract_zip_geojson(args.ms_zip, work)
        fc = clip_ms_geojson(geo_path, out_geo)
        manifest["sources"].append(
            {
                "id": "MICROSOFT_US_BUILDING_FOOTPRINTS",
                "url": MS_INDIANA_URL,
                "license": MS_LICENSE,
                "localZipSha256": sha256_file(args.ms_zip),
                "featureCount": fc["featureCount"],
            }
        )
        print(f"clipped {fc['featureCount']} MS footprints -> {out_geo}")
    elif args.fallback_derived.is_file():
        # Documented fallback: parcel-derived screening (already in repo)
        data = json.loads(args.fallback_derived.read_text())
        # Re-tag authority
        for ft in data.get("features", []):
            props = ft.setdefault("properties", {})
            props.setdefault("footprintSource", "PARCEL_FRACTION_DERIVED")
            props["authorityClass"] = "DERIVED"
            props["engineeringUse"] = False
            props["regulatoryUse"] = False
        data["provenance"] = {
            "source": "TSM parcel-fraction screening derivation",
            "sourceFile": str(args.fallback_derived),
            "authorityClass": "DERIVED",
            "note": "NOT Microsoft or IGIO building outlines. Footprints estimated from parcels.",
            "acquiredUtc": datetime.now(timezone.utc).isoformat(),
        }
        out_geo.write_text(json.dumps(data, separators=(",", ":")))
        manifest["sources"].append(
            {
                "id": "PARCEL_FRACTION_DERIVED",
                "path": str(args.fallback_derived),
                "featureCount": data.get("featureCount", len(data.get("features", []))),
                "sha256": sha256_file(args.fallback_derived),
            }
        )
        print(
            f"fallback: copied parcel-derived set ({manifest['sources'][0]['featureCount']} features)"
        )
        print(
            "HINT: download MS Indiana zip and re-run with --ms-zip for true building polygons:"
        )
        print(f"  {MS_INDIANA_URL}")
    else:
        print(
            "ERROR: provide --ms-zip path to Indiana.geojson.zip or ensure fallback derived exists",
            file=sys.stderr,
        )
        print(f"Download: {MS_INDIANA_URL}", file=sys.stderr)
        sys.exit(1)

    man_path = args.out_dir / "SOURCE_MANIFEST.json"
    man_path.write_text(json.dumps(manifest, indent=2) + "\n")

    sums = []
    for p in sorted(args.out_dir.glob("*")):
        if p.is_file() and p.name not in ("SHA256SUMS",):
            sums.append(f"{sha256_file(p)}  {p.name}\n")
    (args.out_dir / "SHA256SUMS").write_text("".join(sums))
    print(f"manifest -> {man_path}")


if __name__ == "__main__":
    main()
