#!/usr/bin/env python3
"""Strict source-by-source DoWORC CRS audit of nested DNR ZIP archives.

Does not rewrite geometry or substitute ballpark NAD27->NAD83 operations.
"""
import argparse
import hashlib
import io
import json
import math
import zipfile
from collections import Counter
from pathlib import Path

def sha(data):
    return hashlib.sha256(data).hexdigest()

def audit(bundle):
    from pyproj import CRS, Transformer
    from pyproj.transformer import TransformerGroup
    import shapefile

    outer = zipfile.ZipFile(bundle)
    if outer.testzip() is not None:
        raise ValueError("INVALID_OUTER_ZIP_CRC")
    receipt = json.loads(outer.read("source-acquisition-receipt.json"))
    expected = {r["relativePath"]: r["sha256"] for r in receipt["records"]}
    details, archives = [], []
    for path in sorted(n for n in outer.namelist() if n.lower().endswith(".zip")):
        raw = outer.read(path)
        pkg = zipfile.ZipFile(io.BytesIO(raw))
        if pkg.testzip() is not None:
            raise ValueError("INNER_ZIP_CRC_FAILED: " + path)
        archives.append({"path": path, "sha256": sha(raw),
                         "receiptMatch": sha(raw) == expected.get(path)})
        names = {n.lower(): n for n in pkg.namelist()}
        for name in sorted(n for n in pkg.namelist() if n.lower().endswith(".shp")):
            key = name[:-4]
            row = {"archive": path, "shapefile": name, "sourceEPSG": None,
                   "sourceUnits": None, "sampleSourceXY": None,
                   "sampleTarget2966XY": None, "roundTripResidualMeters": None,
                   "verticalDatum": "UNVERIFIED", "state": "MISSING_PRJ",
                   "sourcePrjSHA256": None, "sourceWKT": None,
                   "bestTransformationAvailable": False}
            prj = names.get((key + ".prj").lower())
            if prj:
                try:
                    raw_prj = pkg.read(prj)
                    crs = CRS.from_wkt(raw_prj.decode("utf-8-sig"))
                    row.update(sourceEPSG=crs.to_epsg(), sourceWKT=crs.to_wkt(),
                               sourceUnits=[a.unit_name for a in crs.axis_info],
                               sourcePrjSHA256=sha(raw_prj), state="CRS_PARSED")
                    shape = shapefile.Reader(
                        shp=io.BytesIO(pkg.read(name)),
                        shx=io.BytesIO(pkg.read(names[(key + ".shx").lower()])),
                        dbf=io.BytesIO(pkg.read(names[(key + ".dbf").lower()])))
                    for i in range(len(shape)):
                        points = shape.shape(i).points
                        if not points:
                            continue
                        x, y = points[len(points)//2]
                        row["sampleSourceXY"] = [x, y]
                        group = TransformerGroup(crs, CRS.from_epsg(2966),
                                                 always_xy=True, allow_ballpark=False)
                        row["bestTransformationAvailable"] = group.best_available
                        row["unavailableOperations"] = [o.name for o in group.unavailable_operations]
                        if not group.best_available or not group.transformers:
                            row["state"] = "GRID_OR_TRANSFORMATION_UNAVAILABLE"
                            break
                        tx, ty = group.transformers[0].transform(x, y, errcheck=True)
                        rx, ry = Transformer.from_crs(
                            CRS.from_epsg(2966), crs, always_xy=True,
                            allow_ballpark=False).transform(tx, ty, errcheck=True)
                        row["sampleTarget2966XY"] = [tx, ty]
                        row["roundTripResidualMeters"] = math.dist(
                            (x, y), (rx, ry)) * crs.axis_info[0].unit_conversion_factor
                        row["state"] = "NUMERIC_HORIZONTAL_SAMPLE_VALIDATED"
                        break
                except (ValueError, KeyError, UnicodeError) as exc:
                    row["state"] = "SOURCE_INVALID"
                    row["reason"] = str(exc)
            details.append(row)
    summary = {
        "zipCount": len(archives),
        "shapefileCount": len(details),
        "sourceEPSGCounts": dict(Counter(str(x["sourceEPSG"]) for x in details)),
        "transformedLayerSampleCount": sum(x["state"] == "NUMERIC_HORIZONTAL_SAMPLE_VALIDATED" for x in details),
        "blockedDatumGridCount": sum(x["state"] == "GRID_OR_TRANSFORMATION_UNAVAILABLE" for x in details),
        "missingProjectionCount": sum(x["state"] == "MISSING_PRJ" for x in details),
        "zipHashesVerified": all(x["receiptMatch"] for x in archives),
    }
    return {
        "schema": "tsm-doworc-strict-horizontal-transform-v1",
        "sourceBundleSHA256": sha(Path(bundle).read_bytes()),
        "targetEPSG": 2966, "noBallparkTransforms": True,
        "surveyControlValidated": False, "verticalDatumValidated": False,
        "engineeringPromotionApproved": False,
        "summary": summary, "archives": archives, "layers": details,
    }

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--bundle", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    result = audit(args.bundle)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n",
                           encoding="utf-8")
    print(json.dumps(result["summary"], sort_keys=True))
    if (result["summary"]["blockedDatumGridCount"]
            or result["summary"]["missingProjectionCount"]
            or not result["summary"]["zipHashesVerified"]):
        raise SystemExit(2)

if __name__ == "__main__":
    main()
