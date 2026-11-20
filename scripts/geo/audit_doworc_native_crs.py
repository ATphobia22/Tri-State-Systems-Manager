#!/usr/bin/env python3
"""Read native CRS evidence from DNR shapefile ZIPs. Does not transform geometry."""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path
from datetime import datetime, timezone

def audit(path):
    from pyproj import CRS
    rows = []
    with zipfile.ZipFile(path) as z:
        entries = {n.lower(): n for n in z.namelist()}
        for shp in sorted(n for n in z.namelist() if n.lower().endswith(".shp")):
            prj = entries.get((shp[:-4] + ".prj").lower())
            row = {"shapefile": shp, "source_epsg": None, "source_wkt": None,
                   "horizontal_units": None, "vertical_datum": None,
                   "status": "MISSING_PRJ"}
            if prj:
                raw = z.read(prj)
                row["prj_sha256"] = hashlib.sha256(raw).hexdigest()
                try:
                    crs = CRS.from_wkt(raw.decode("utf-8-sig"))
                    row.update(source_epsg=crs.to_epsg(), source_wkt=crs.to_wkt(),
                               horizontal_units=[a.unit_name for a in crs.axis_info],
                               status="PARSED_HORIZONTAL" if crs.is_projected or crs.is_geographic else "REVIEW_COMPOUND")
                except (ValueError, UnicodeError) as exc:
                    row.update(status="INVALID_PRJ", error=str(exc))
            rows.append(row)
    return {"archive": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "layers": rows}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    files = sorted((args.source_root / "source-originals").rglob("*.zip"))
    results = [audit(p) for p in files]
    layers = [l for result in results for l in result["layers"]]
    report = {"schema": "tsm-doworc-native-crs-audit-v1",
              "audited_utc": datetime.now(timezone.utc).isoformat(),
              "target_crs": "EPSG:2966", "target_is_not_native_crs": True,
              "archives": results,
              "source_epsg_values": sorted({str(l["source_epsg"]) if l["source_epsg"] else "UNKNOWN" for l in layers}),
              "horizontal_crs_parsed": bool(layers) and all(l["status"] == "PARSED_HORIZONTAL" for l in layers),
              "vertical_datum_verified": False, "engineering_release_approved": False}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"archives": len(files), "layers": len(layers), "epsg": report["source_epsg_values"],
                      "horizontal_crs_parsed": report["horizontal_crs_parsed"]}))
    if not report["horizontal_crs_parsed"]:
        raise SystemExit(2)

if __name__ == "__main__":
    main()
