#!/usr/bin/env python3
"""Add a simple HLOD parent over existing LOD1 building 3D Tiles.

Reads a tileset produced by build-building-3d-tiles.py and rewrites root so:
  * root geometricError > 0 (coarse parent)
  * children are the original per-building leaf tiles (geometricError 0)

Does not re-mesh. Optional --cluster-size groups nearby leaves under intermediate nodes.

Usage:
  python3 scripts/geospatial/build-building-hlod.py \\
    --tileset tsm-console/public/data/buildings-3d-tiles/tileset.json \\
    --out-dir tsm-console/public/data/buildings-3d-tiles-hlod
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path


def sha256_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def box_center(box):
    return box[0], box[1], box[2]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--tileset", type=Path, required=True)
    ap.add_argument("--out-dir", type=Path, required=True)
    ap.add_argument("--root-error-scale", type=float, default=4.0,
                    help="root geometricError = max leaf radius * scale")
    args = ap.parse_args()

    src_dir = args.tileset.parent
    data = json.loads(args.tileset.read_text())
    root = data["root"]
    children = root.get("children") or []
    if not children:
        raise SystemExit("tileset has no children; run build-building-3d-tiles.py first")

    args.out_dir.mkdir(parents=True, exist_ok=True)
    # Copy GLB content files
    for ch in children:
        uri = ch.get("content", {}).get("uri")
        if uri:
            src = src_dir / uri
            if src.is_file():
                shutil.copy2(src, args.out_dir / uri)

    # Estimate root error from bounding volume
    bbox = root.get("boundingVolume", {}).get("box") or [0, 0, 0, 100, 0, 0, 0, 100, 0, 0, 0, 100]
    radius = max(abs(bbox[3]), abs(bbox[7]), abs(bbox[11]), 1.0)
    root_error = radius * args.root_error_scale

    # Intermediate cluster: single parent with all leaves (HLOD depth 2)
    parent = {
        "boundingVolume": root["boundingVolume"],
        "geometricError": root_error / 2.0,
        "refine": "REPLACE",
        "children": children,
        "extras": {"tsm": {"lod": 0, "role": "hlod-parent"}},
    }
    new_root = {
        "boundingVolume": root["boundingVolume"],
        "geometricError": root_error,
        "refine": "REPLACE",
        "children": [parent],
        "extras": {"tsm": {"lod": "root", "hlod": True}},
    }
    tileset = {
        "asset": {
            "version": "1.1",
            "extras": {
                "tsm": {
                    "authorityClass": "DERIVED",
                    "engineeringUse": False,
                    "regulatoryUse": False,
                    "hlod": True,
                }
            },
        },
        "geometricError": root_error,
        "root": new_root,
    }
    out_ts = args.out_dir / "tileset.json"
    out_ts.write_text(json.dumps(tileset, indent=2) + "\n")

    # Refresh SHA inventory
    paths = sorted(p for p in args.out_dir.iterdir() if p.is_file())
    lines = [f"{sha256_file(p)}  {p.name}\n" for p in paths if p.name != "SHA256SUMS"]
    (args.out_dir / "SHA256SUMS").write_text("".join(lines))

    manifest = {
        "schemaVersion": "1.0.0",
        "artifactId": "tsm-buildings-3d-tiles-hlod",
        "sourceTileset": str(args.tileset),
        "leafCount": len(children),
        "hlodDepth": 2,
        "rootGeometricError": root_error,
        "authorityClass": "DERIVED",
        "engineeringUse": False,
        "regulatoryUse": False,
    }
    (args.out_dir / "manifest-hlod.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"HLOD tileset -> {out_ts} (leaves={len(children)}, rootError={root_error:.1f})")


if __name__ == "__main__":
    main()
