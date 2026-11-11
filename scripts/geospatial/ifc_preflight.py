#!/usr/bin/env python3
"""Offline IFC evidence preflight. No geometry or regulatory authority is inferred.

Requires an explicitly installed and license-reviewed IfcOpenShell runtime for
IFC parsing. No network access, geometry exports, or automatic dependencies.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys

SCHEMA = "tsm.geobim.ifc-preflight.v1"
MAX_BYTES = 512 * 1024 * 1024
MAX_PRODUCTS = 250_000
SHA256 = re.compile(r"^[0-9a-f]{64}$")
CRS = re.compile(r"^EPSG:[1-9][0-9]{2,5}$")
GLOBAL_ID = re.compile(r"^[0-9A-Za-z_$]{22}$")


class PreflightError(ValueError):
    """Input or evidence contract violation."""


def inspect_source(path: Path, max_bytes: int = MAX_BYTES) -> dict:
    if path.is_symlink() or not path.is_file():
        raise PreflightError("IFC input must be a regular non-symlink file")
    size = path.stat().st_size
    if size <= 0 or size > max_bytes:
        raise PreflightError("IFC size is empty or exceeds the configured bound")
    digest = hashlib.sha256()
    prefix = b""
    counted = 0
    with path.open("rb") as src:
        for chunk in iter(lambda: src.read(1024 * 1024), b""):
            counted += len(chunk)
            if counted > max_bytes:
                raise PreflightError("IFC changed or exceeded configured size while hashing")
            if len(prefix) < 4096:
                prefix += chunk[:4096 - len(prefix)]
            digest.update(chunk)
    if counted != size or path.stat().st_size != size:
        raise PreflightError("IFC file changed during validation")
    # Only STEP IFC is supported. IFCZIP/IFCXML require separate reviewed adapters.
    if not prefix.lstrip(b"\xef\xbb\xbf \t\r\n").upper().startswith(b"ISO-10303-21;"):
        raise PreflightError("Expected STEP IFC (ISO-10303-21), not IFCZIP/IFCXML")
    return {"sha256": digest.hexdigest(), "bytes": size}


def _numeric(value, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise PreflightError("Missing or invalid " + label)
    result = float(value)
    if not math.isfinite(result):
        raise PreflightError("Nonfinite " + label)
    return result


def inspect_model(model, source: dict, declared_vertical_datum: str | None = None,
                  expected_crs: str | None = None) -> dict:
    """Testable core: consume an actual IfcOpenShell model object, never heuristics."""
    products = model.by_type("IfcProduct")
    if len(products) > MAX_PRODUCTS:
        raise PreflightError("IFC product count exceeds bounded inventory")
    items = []
    seen = set()
    for product in products:
        gid = getattr(product, "GlobalId", None)
        if not isinstance(gid, str) or not GLOBAL_ID.fullmatch(gid) or gid in seen:
            raise PreflightError("Missing, malformed, or duplicate IFC GlobalId")
        seen.add(gid)
        items.append({"globalId": gid, "ifcClass": product.is_a(),
                      "hasRepresentation": getattr(product, "Representation", None) is not None})
    items.sort(key=lambda item: item["globalId"])

    crs_entities = model.by_type("IfcProjectedCRS")
    conversion_entities = model.by_type("IfcMapConversion")
    crs_name = None
    map_conversion = None
    if len(crs_entities) == 1 and len(conversion_entities) == 1:
        crs_name = str(getattr(crs_entities[0], "Name", "") or "")
        operation = conversion_entities[0]
        map_conversion = {
            "eastings": _numeric(getattr(operation, "Eastings", None), "Eastings"),
            "northings": _numeric(getattr(operation, "Northings", None), "Northings"),
            "orthogonalHeight": _numeric(getattr(operation, "OrthogonalHeight", None), "OrthogonalHeight"),
            "scale": _numeric(getattr(operation, "Scale", None) or 1.0, "Scale"),
            "axisAbscissa": _numeric(getattr(operation, "XAxisAbscissa", None) if getattr(operation, "XAxisAbscissa", None) is not None else 1.0, "XAxisAbscissa"),
            "axisOrdinate": _numeric(getattr(operation, "XAxisOrdinate", None) if getattr(operation, "XAxisOrdinate", None) is not None else 0.0, "XAxisOrdinate"),
        }
        if map_conversion["scale"] <= 0:
            raise PreflightError("MapConversion scale must be positive")
        if math.hypot(map_conversion["axisAbscissa"], map_conversion["axisOrdinate"]) <= 1e-12:
            raise PreflightError("MapConversion axis is degenerate")
    elif crs_entities or conversion_entities:
        raise PreflightError("Ambiguous or incomplete IFC georeferencing entities")

    crs_supported = crs_name is not None and CRS.fullmatch(crs_name) is not None
    matches_expected = expected_crs is None or crs_name == expected_crs
    if expected_crs and not CRS.fullmatch(expected_crs):
        raise PreflightError("expected CRS must be an EPSG code")
    if declared_vertical_datum is not None and not declared_vertical_datum.strip():
        raise PreflightError("vertical datum cannot be empty")
    # A vertical datum declaration is not source evidence of coordinate alignment.
    placement = "CANDIDATE_FOR_CONTROL_POINT_REVIEW" if (
        crs_supported and matches_expected and declared_vertical_datum and map_conversion
    ) else "UNRESOLVED_DATUM_OR_CRS"
    return {
        "schema": SCHEMA,
        "authorityClass": "DERIVED",
        "engineeringUse": False,
        "regulatoryUse": False,
        "source": source,
        "ifcSchema": str(getattr(model, "schema", "UNKNOWN")),
        "productCount": len(items),
        "products": items,
        "georeferencing": {
            "projectedCrs": crs_name,
            "expectedCrs": expected_crs,
            "mapConversion": map_conversion,
            "verticalDatumDeclared": declared_vertical_datum,
            "verticalDatumSourceVerified": False,
            "placementState": placement,
            "controlPointsVerified": False,
            "lengthUnitsVerified": False,
        },
        "geometry": {
            "meshesExported": 0,
            "lod": "NOT_ASSIGNED",
            "materialProvenance": "UNVERIFIED",
            "tilesetGenerated": False,
        },
    }


def preflight(path: Path, output: Path, expected_sha256: str,
              expected_crs: str | None, vertical_datum: str | None,
              max_bytes: int = MAX_BYTES) -> dict:
    if not SHA256.fullmatch(expected_sha256):
        raise PreflightError("expected SHA-256 must be 64 lowercase hex characters")
    source = inspect_source(path, max_bytes=max_bytes)
    if source["sha256"] != expected_sha256:
        raise PreflightError("IFC source checksum mismatch")
    try:
        import ifcopenshell
    except ImportError as exc:
        raise PreflightError("IfcOpenShell is required; install separately after license review") from exc
    model = ifcopenshell.open(str(path))
    report = inspect_model(model, source, vertical_datum, expected_crs)
    if output.is_symlink() or output.exists():
        raise PreflightError("output exists or is a symlink; refusing overwrite")
    if output.parent.is_symlink() or not output.parent.is_dir():
        raise PreflightError("output parent must already exist and not be a symlink")
    with output.open("x", encoding="utf-8") as fp:
        json.dump(report, fp, indent=2, sort_keys=True, allow_nan=False)
        fp.write("\n")
    return report


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--expected-sha256", required=True)
    parser.add_argument("--expected-crs", default=None)
    parser.add_argument("--declared-vertical-datum", default=None)
    parser.add_argument("--max-bytes", type=int, default=MAX_BYTES)
    args = parser.parse_args(argv)
    try:
        if args.max_bytes < 1 or args.max_bytes > MAX_BYTES:
            raise PreflightError("invalid --max-bytes")
        report = preflight(args.input, args.output, args.expected_sha256,
                           args.expected_crs, args.declared_vertical_datum, args.max_bytes)
    except (PreflightError, OSError, ValueError) as exc:
        print("IFC preflight rejected: " + str(exc), file=sys.stderr)
        return 2
    print(json.dumps({"status": "PRECHECK_ONLY", "productCount": report["productCount"],
                      "placementState": report["georeferencing"]["placementState"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
