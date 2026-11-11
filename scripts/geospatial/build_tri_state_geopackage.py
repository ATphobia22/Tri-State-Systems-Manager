#!/usr/bin/env python3
"""Build a GeoPackage from a hash-checked eight-county TSM offline GeoJSON bundle.

This is a distribution format, not a survey, flood, or engineering validation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sqlite3

import fiona


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as input_file:
        for block in iter(lambda: input_file.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def build(manifest_path: Path) -> dict:
    manifest_path = manifest_path.resolve()
    root = manifest_path.parent
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema") != "tsm.tristate.offline-screening-layers.v1":
        raise ValueError("Unsupported manifest")
    if manifest.get("regulatory_use") is not False or manifest.get("default_enabled") is not False:
        raise ValueError("Unreviewed data cannot be a default authoritative layer")
    records = manifest.get("vector_assets", [])
    if len(records) != 16:
        raise ValueError("All 16 source vectors are mandatory")
    target = root / "vector/tri-state-roads-water-2024.gpkg"
    if target.exists():
        raise ValueError("Do not silently overwrite an existing GeoPackage")
    target.parent.mkdir(parents=True, exist_ok=True)
    schema = {"geometry": "Unknown", "properties": {
        "feature_id": "str:100", "county_geoid": "str:5",
        "state": "str:2", "source_kind": "str:16", "source_year": "str:4",
    }}
    counts = {}
    try:
        for kind, layer in (("roads", "roads_2024"), ("linearwater", "linearwater_2024")):
            total = 0
            with fiona.open(target, mode="w", driver="GPKG", crs="EPSG:4326",
                            schema=schema, layer=layer) as writer:
                for source in records:
                    if source.get("kind") != "vector" or source.get("path", "").split("-")[-1] != kind + ".geojson":
                        continue
                    rel = Path(source["path"])
                    if rel.is_absolute() or ".." in rel.parts:
                        raise ValueError("Unsafe source path")
                    path = (root / rel).resolve()
                    if root not in path.parents or path.is_symlink():
                        raise ValueError("Source path escaped bundle")
                    if sha256(path) != source.get("sha256"):
                        raise ValueError("Source GeoJSON SHA-256 mismatch")
                    data = json.loads(path.read_text(encoding="utf-8"))
                    if data.get("type") != "FeatureCollection":
                        raise ValueError("Not a GeoJSON FeatureCollection")
                    features = data.get("features")
                    if not isinstance(features, list) or len(features) != source.get("feature_count"):
                        raise ValueError("Source feature count mismatch")
                    for feature in features:
                        geometry = feature.get("geometry")
                        props = feature.get("properties", {})
                        if geometry is None or geometry.get("type") not in ("LineString", "MultiLineString"):
                            raise ValueError("Expected only 2D line geometry")
                        if props.get("county_geoid") != source.get("county_geoid") or props.get("kind") != kind:
                            raise ValueError("County/kind attribution mismatch")
                        writer.write({"geometry": geometry, "properties": {
                            "feature_id": str(feature.get("id", "")),
                            "county_geoid": props["county_geoid"],
                            "state": props["state"], "source_kind": kind,
                            "source_year": "2024",
                        }})
                        total += 1
            counts[layer] = total
        with sqlite3.connect(f"file:{target}?mode=ro", uri=True) as db:
            for layer, count in counts.items():
                if db.execute(f"SELECT COUNT(*) FROM {layer}").fetchone()[0] != count:
                    raise ValueError("GeoPackage row-count mismatch")
        result = {"path": target.relative_to(root).as_posix(),
                  "sha256": sha256(target), "bytes": target.stat().st_size,
                  "format": "OGC_GPKG", "crs": "EPSG:4326", "layers": counts,
                  "authority": "US_CENSUS_TIGER2024",
                  "source_review": "ACQUIRED_SOURCE_UNREVIEWED",
                  "enabled": False, "regulatory_use": False}
        manifest["geopackage"] = result
        manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return result
    except BaseException:
        target.unlink(missing_ok=True)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    result = build(args.manifest)
    print(json.dumps({"status": "GPKG_GENERATED_UNREVIEWED",
                      "sha256": result["sha256"], "layers": result["layers"]},
                     sort_keys=True))


if __name__ == "__main__":
    main()
