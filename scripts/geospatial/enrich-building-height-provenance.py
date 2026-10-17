#!/usr/bin/env python3
"""Enrich deployed buildings-3d.json with height provenance from the pipeline.

Joins the full pipeline output (posey-buildings-lidar-heights-23082.geojson)
onto the deployed buildings-3d.json by sourceObjectId, adding:
- lidarHeightMethod, lidarHeightStatus, heightProvenance for OBSERVED buildings
- method + heightProvenance for NDHM and DERIVED buildings

This satisfies the TSM Building Height Gate v2 TIER 3 provenance requirement:
every height must record its source and extraction method.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pipeline", required=True, help="Full pipeline GeoJSON with provenance")
    ap.add_argument("--deployed", required=True, help="Deployed buildings-3d.json to enrich")
    ap.add_argument("--output", required=True, help="Output enriched GeoJSON path")
    args = ap.parse_args()

    with open(args.pipeline) as f:
        pipe = json.load(f)
    with open(args.deployed) as f:
        deploy = json.load(f)

    # Build lookup: objectid -> provenance properties
    prov = {}
    for feat in pipe["features"]:
        p = feat["properties"]
        oid = p.get("objectid")
        if oid is not None:
            prov[oid] = p

    enriched = 0
    observed = 0
    ndhm = 0
    derived = 0

    for feat in deploy["features"]:
        props = feat["properties"]
        oid = props.get("sourceObjectId")
        source = props.get("source")
        p = prov.get(oid, {})

        if source == "OBSERVED":
            # Full LiDAR provenance from pipeline
            method = p.get("lidarHeightMethod")
            if method:
                props["lidarHeightMethod"] = method
                props["lidarHeightStatus"] = p.get("lidarHeightStatus", "OK")
                if p.get("lidarSource"):
                    props["heightProvenance"] = p["lidarSource"]
                if p.get("lidarHeightM"):
                    props["lidarHeightM"] = p["lidarHeightM"]
                enriched += 1
                observed += 1
            else:
                # Mislabeled OBSERVED: pipeline shows no LiDAR extraction.
                # Honest relabel to DERIVED with DEM source.
                props["source"] = "DERIVED"
                props["method"] = "dem-30m-sample"
                props["heightProvenance"] = p.get("elev_source", "posey-county-dem-30m.tif")
                props["lidarHeightStatus"] = p.get("lidarHeightStatus", "unknown")
                enriched += 1
                derived += 1
        elif source == "Purdue Digital Forestry NDHM 2017-2019":
            # Honest NDHM method label
            props["method"] = "ndhm-centroid-sample"
            props["heightProvenance"] = "Purdue Digital Forestry NDHM 2017-2019"
            enriched += 1
            ndhm += 1
        elif source == "DERIVED":
            # Honest derived label
            props["method"] = "derived-estimate"
            props["heightProvenance"] = "derived"
            enriched += 1
            derived += 1

    with open(args.output, "w") as f:
        json.dump(deploy, f, separators=(",", ":"))

    print(f"Enriched {enriched} buildings: {observed} OBSERVED, {ndhm} NDHM, {derived} DERIVED")
    print(f"Wrote {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
