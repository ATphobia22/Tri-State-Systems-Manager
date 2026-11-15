#!/usr/bin/env python3
"""Headless text/facet/extent discovery over previously normalized source metadata.

The catalog is descriptive only; reported bounding boxes are NOT measured or
verified geometry, and a match does not establish data acquisition or validity.
"""
import argparse
import json
import math
import sys
from pathlib import Path

SCHEMA = "tsm-normalized-geospatial-metadata"
FAMILIES = {"FGDC_CSDGM", "ISO_19139", "ARCGIS_METADATA"}


def bounded_extent(values):
    if values is None:
        return None
    if not isinstance(values, list) or len(values) != 4 or any(
        not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value)
        for value in values
    ):
        raise ValueError("Extent must be four finite numeric [west,south,east,north] values")
    w, s, e, n = values
    if not (-180 <= w < e <= 180 and -90 <= s < n <= 90):
        raise ValueError("Invalid longitude/latitude extent")
    return values


def overlaps(left, right):
    a, b, c, d = left
    e, f, g, h = right
    return a <= g and e <= c and b <= h and f <= d


def search(catalog, keyword="", family=None, extent=None):
    if catalog.get("schema") != SCHEMA or not isinstance(catalog.get("records"), list):
        raise ValueError("Not a TSM normalized metadata catalog")
    if family is not None and family not in FAMILIES:
        raise ValueError("Unsupported metadata family")
    extent = bounded_extent(extent)
    needle = keyword.strip().casefold()
    matches = []
    for record in catalog["records"]:
        if record.get("verificationStatus") != "PARSED_UNVERIFIED":
            raise ValueError("Catalog has unexpected verification status; refuse promotion")
        if family and record.get("metadataFamily") != family:
            continue
        text = " ".join(str(record.get(key) or "") for key in ("title", "abstract", "sourceReportedOrganization"))
        text += " " + " ".join(record.get("themeKeywordsReported") or [])
        if needle and needle not in text.casefold():
            continue
        if extent:
            reported = record.get("geographicExtentReported")
            if reported is None:
                continue  # unknown extent is not evidence of spatial coverage
            bounded_extent(reported)
            if not overlaps(reported, extent):
                continue
        matches.append(record)
    return {
        "schema": "tsm-descriptive-metadata-search-v1",
        "matchCount": len(matches),
        "matchingRecords": matches,
        "spatialMatchScope": "REPORTED_METADATA_BBOX_ONLY_NOT_VERIFIED" if extent else "NOT_SPATIALLY_FILTERED",
        "authority": "NOT_ESTABLISHED",
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("catalog", type=Path)
    parser.add_argument("--keyword", default="")
    parser.add_argument("--family", choices=sorted(FAMILIES))
    parser.add_argument("--bbox", nargs=4, type=float, metavar=("W", "S", "E", "N"))
    args = parser.parse_args(argv)
    try:
        if args.catalog.is_symlink() or args.catalog.stat().st_size > 4 * 1024 * 1024:
            raise ValueError("Catalog input must be regular and at most 4 MiB")
        result = search(json.loads(args.catalog.read_text(encoding="utf-8")), args.keyword, args.family, args.bbox)
    except (OSError, ValueError, TypeError, KeyError) as error:
        print(json.dumps({"error": str(error), "status": "FAILED"}), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
