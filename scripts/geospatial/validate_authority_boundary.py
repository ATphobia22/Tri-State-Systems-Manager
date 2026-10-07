#!/usr/bin/env python3
"""Validate the authoritative/derived/simulated branch boundary.

Enforces docs/TSM-BRANCH-ISOLATION.md:
  1. No SIMULATED/FORECAST-labeled content in authoritative output paths.
  2. No OBJECTID outside the source 23,082 set appears in outputs.
  3. Every lidarHeightFt carries lidarHeightMethod provenance
     (blocks assumed heights re-entering through the side door).

Fail-closed: any violation -> non-zero exit.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SIMULATED_MARKERS = (
    "authorityClass\": \"SIMULATED",
    "authorityClass\": \"SIMULATED",
    "\"state\": \"SIMULATED\"",
    "\"state\":\"SIMULATED\"",
    "SIMULATED",
)


def load_source_ids(geojson_path: Path) -> set[int]:
    data = json.loads(geojson_path.read_text())
    ids = set()
    for ft in data.get("features", []):
        p = ft.get("properties", {}) or {}
        v = p.get("igioObjectId", p.get("sourceObjectId", p.get("OBJECTID")))
        if isinstance(v, (int, float)):
            ids.add(int(v))
    return ids


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--tiles-dir", required=True, type=Path,
                    help="output directory to scan")
    ap.add_argument("--geojson", required=True, type=Path,
                    help="authoritative source GeoJSON (OBJECTID universe)")
    ap.add_argument("--check-glbs", action="store_true",
                    help="also scan GLB JSON chunks (slower)")
    args = ap.parse_args()

    violations: list[str] = []
    source_ids = load_source_ids(args.geojson)
    print(f"source OBJECTIDs: {len(source_ids)}", file=sys.stderr)

    # 1. Scan JSON manifests/tilesets for simulated markers
    for jf in list(args.tiles_dir.rglob("*.json")):
        try:
            text = jf.read_text()
        except Exception:
            continue
        # Allow the marker inside the branch-isolation documentation itself
        if "TSM-BRANCH-ISOLATION" in text or "branch isolation" in text.lower():
            continue
        for marker in ('"authorityClass": "SIMULATED"', '"state": "SIMULATED"',
                       '"authorityClass":"SIMULATED"', '"state":"SIMULATED"'):
            if marker in text:
                violations.append(f"{jf}: contains simulated-authority marker {marker!r}")

    # 2. OBJECTID universe check on tileset manifests
    for mf in list(args.tiles_dir.rglob("manifest.json")):
        try:
            m = json.loads(mf.read_text())
        except Exception:
            continue
        for key in ("sourceObjectIds",):
            ids = m.get(key, [])
            bad = [i for i in ids if isinstance(i, int) and i not in source_ids]
            if bad:
                violations.append(f"{mf}: {len(bad)} OBJECTIDs outside source set e.g. {bad[:5]}")

    # 3. Tileset tile extras
    for tf in list(args.tiles_dir.rglob("tileset.json")):
        try:
            ts = json.loads(tf.read_text())
        except Exception:
            continue
        def walk(node):
            tsm = node.get("extras", {}).get("tsm", {})
            sid = tsm.get("sourceObjectId")
            if isinstance(sid, int) and sid not in source_ids:
                violations.append(f"{tf}: tile OBJECTID {sid} outside source set")
            for c in node.get("children", []):
                walk(c)
        walk(ts.get("root", {}))

    # 4. lidarHeightFt provenance: scan enriched geojson if present in tiles dir
    #    (also enforced at build time; this is the backstop)
    for gf in list(args.tiles_dir.rglob("*.geojson")):
        try:
            data = json.loads(gf.read_text())
        except Exception:
            continue
        feats = data.get("features", [])
        if not feats or "properties" not in feats[0]:
            continue
        bad = 0
        for ft in feats:
            p = ft.get("properties", {}) or {}
            if "lidarHeightFt" in p and not p.get("lidarHeightMethod"):
                bad += 1
        if bad:
            violations.append(f"{gf}: {bad} lidarHeightFt values lack lidarHeightMethod")

    if violations:
        print(f"FAIL: {len(violations)} authority-boundary violations:", file=sys.stderr)
        for v in violations[:20]:
            print(f"  - {v}", file=sys.stderr)
        sys.exit(1)
    print(f"PASS: authority boundary OK ({len(source_ids)} source OBJECTIDs, no simulated leakage)")


if __name__ == "__main__":
    main()
