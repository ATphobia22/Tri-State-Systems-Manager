#!/usr/bin/env python3
"""FEMA FIRM Database schema validation for NFHL layers.

Validates ingested NFHL vector data against the FEMA FIRM Database
Technical Reference (Nov 2024) physical schema for three core tables:

  S_XS            Cross Sections (LineString)
  S_Fld_Haz_Ar    Flood Hazard Zones (Polygon)
  L_Profil_Baswn  Cross-Section Hydraulic Lookups (non-spatial table)

Usage:
    python firm_schema_validation.py --input data.geojson --layer S_XS
    python firm_schema_validation.py --input data.gpkg --layer S_Fld_Haz_Ar --gdal-layer S_Fld_Haz_Ar
    python firm_schema_validation.py --input lookups.csv --layer L_Profil_Baswn

Input formats: GeoJSON (stdlib json), CSV (stdlib csv), GPKG/SHP
(via geopandas or fiona when installed). Without geospatial libs,
pass records as a list of dicts to the validate_* functions directly.

Validators return dicts:
    {"valid": bool, "errors": [...], "warnings": [...], "checked_fields": [...]}
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Schema definitions — FEMA FIRM Database Technical Reference (Nov 2024)
# ---------------------------------------------------------------------------
# Each column: {type: str, required: bool, description: str}
# Types: "text", "numeric", "integer", "date"

FIRM_SCHEMAS: dict[str, dict] = {
    "S_XS": {
        "geometry": "LineString",
        "description": "Cross Sections — vector lines intercepting river "
                       "centerlines; source for Floodway Data Tables.",
        "columns": {
            "XS_LN_ID": {"type": "text", "required": True,
                         "description": "Primary key for the cross-section line."},
            "WTR_NM": {"type": "text", "required": True,
                       "description": "Name of the stream or water body."},
            "STREAM_STN": {"type": "numeric", "required": True,
                           "description": "River station tracking identifier."},
            "WSEL_REG": {"type": "numeric", "required": False,
                         "description": "Regulatory water surface elevation "
                                        "(base flood elevation)."},
            "BFE": {"type": "numeric", "required": False,
                    "description": "Base flood elevation (alias/legacy of "
                                   "WSEL_REG; at least one of BFE or "
                                   "WSEL_REG should be present)."},
        },
    },
    "S_Fld_Haz_Ar": {
        "geometry": "Polygon",
        "description": "Flood Hazard Zones — polygons mapping FIRM panel "
                       "boundaries (e.g., Zone AE, Zone X, Regulatory Floodway).",
        "columns": {
            "FLD_AR_ID": {"type": "text", "required": True,
                          "description": "Primary key for the hazard area polygon."},
            "FL_ZONE": {"type": "text", "required": True,
                        "description": "Flood zone designation code "
                                       "(e.g., 'AE', 'A', 'X', 'VE')."},
            "ZONE_SUBTY": {"type": "text", "required": False,
                           "description": "Zone sub-type; 'FLOODWAY' marks the "
                                          "regulatory floodway."},
        },
        "valid_zones": {"A", "AE", "AH", "AO", "AR", "A99", "V", "VE",
                        "X", "B", "C", "D", "X (SHADED)", "X (UNSHADED)"},
    },
    "L_Profil_Baswn": {
        "geometry": None,  # non-spatial lookup table
        "description": "Cross-Section Hydraulic Lookups — bridges S_XS "
                       "features into FIS text profiles.",
        "columns": {
            "S_XS_ID": {"type": "text", "required": True,
                        "description": "Foreign key to S_XS.XS_LN_ID."},
            "VELOCITY": {"type": "numeric", "required": False,
                         "description": "Mean velocity of the 1% annual "
                                        "chance flood event."},
            "FLD_WAY_WD": {"type": "numeric", "required": False,
                           "description": "Calculated regulatory width of "
                                          "the floodway."},
        },
    },
}

# Acceptable case-insensitive aliases for common field-name variants.
FIELD_ALIASES: dict[str, dict[str, str]] = {
    "S_XS": {
        "xs_ln_id": "XS_LN_ID",
        "wtr_nm": "WTR_NM",
        "stream_stn": "STREAM_STN",
        "wsel_reg": "WSEL_REG",
        "bfe": "BFE",
    },
    "S_Fld_Haz_Ar": {
        "fld_ar_id": "FLD_AR_ID",
        "fl_zone": "FL_ZONE",
        "zone_subty": "ZONE_SUBTY",
    },
    "L_Profil_Baswn": {
        "s_xs_id": "S_XS_ID",
        "velocity": "VELOCITY",
        "fld_way_wd": "FLD_WAY_WD",
    },
}


# ---------------------------------------------------------------------------
# Record helpers (work with plain dicts; geopandas optional)
# ---------------------------------------------------------------------------

def records_from_geojson(path: str | Path) -> list[dict]:
    """Read GeoJSON features into a list of flat attribute dicts."""
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    features = data.get("features", [])
    records = []
    for feat in features:
        props = dict(feat.get("properties") or {})
        geom = feat.get("geometry") or {}
        props["_geometry_type"] = geom.get("type")
        records.append(props)
    return records


def records_from_csv(path: str | Path) -> list[dict]:
    """Read a CSV into a list of dicts."""
    with open(path, "r", encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def records_from_geopandas(path: str | Path, layer: str | None = None) -> list[dict]:
    """Read any geopandas-supported vector file into flat dicts."""
    import geopandas as gpd  # noqa: PLC0415
    kwargs: dict = {}
    if layer:
        kwargs["layer"] = layer
    gdf = gpd.read_file(path, **kwargs)
    records = []
    for _, row in gdf.iterrows():
        rec = {k: (None if v is None or (isinstance(v, float) and v != v) else v)
               for k, v in row.items() if k != gdf.geometry.name}
        geom = getattr(row, gdf.geometry.name, None)
        rec["_geometry_type"] = getattr(getattr(geom, "geom_type", None), "__str__", lambda: None)() \
            if geom is not None else None
        # Simpler: use geom_type attribute directly
        try:
            rec["_geometry_type"] = geom.geom_type if geom is not None else None
        except Exception:
            rec["_geometry_type"] = None
        records.append(rec)
    return records


def load_records(path: str | Path, layer: str | None = None) -> list[dict]:
    """Auto-detect format and load records."""
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == ".geojson" or suffix == ".json":
        return records_from_geojson(path)
    if suffix == ".csv":
        return records_from_csv(path)
    # Try geopandas, then fiona, for GPKG/SHP/etc.
    try:
        return records_from_geopandas(path, layer)
    except ImportError:
        pass
    try:
        import fiona  # noqa: PLC0415
        recs = []
        with fiona.open(str(path), layer=layer) as src:
            for feat in src:
                props = dict(feat.get("properties") or {})
                geom = feat.get("geometry") or {}
                props["_geometry_type"] = geom.get("type")
                recs.append(props)
        return recs
    except ImportError:
        pass
    raise RuntimeError(
        f"Cannot read {path}: no geopandas or fiona installed. "
        "Convert to GeoJSON or CSV first, or pip install geopandas."
    )


# ---------------------------------------------------------------------------
# Core validation
# ---------------------------------------------------------------------------

def _normalize_fields(records: list[dict], layer: str) -> list[dict]:
    """Map case-insensitive aliases to canonical field names."""
    aliases = FIELD_ALIASES.get(layer, {})
    out = []
    for rec in records:
        new = {}
        for k, v in rec.items():
            if k.startswith("_"):
                new[k] = v
                continue
            canon = aliases.get(k.lower(), k)
            new[canon] = v
        out.append(new)
    return out


def _is_numeric(v) -> bool:
    if v is None or v == "":
        return False
    try:
        float(v)
        return True
    except (TypeError, ValueError):
        return False


def _validate_records(records: list[dict], layer: str) -> dict:
    schema = FIRM_SCHEMAS[layer]
    columns = schema["columns"]
    errors: list[str] = []
    warnings: list[str] = []
    checked: list[str] = list(columns.keys())

    records = _normalize_fields(records, layer)
    if not records:
        return {"valid": False, "errors": ["No records to validate."],
                "warnings": [], "checked_fields": checked}

    # 1. Required columns present (in at least one record).
    present = set()
    for rec in records:
        present.update(k for k, v in rec.items() if v is not None and v != "")
    for col, spec in columns.items():
        if spec["required"] and col not in present:
            errors.append(f"Required column '{col}' missing from all records.")

    # 2. Geometry type check (when geometry info available).
    expected_geom = schema.get("geometry")
    if expected_geom:
        geom_types = {r.get("_geometry_type") for r in records
                      if r.get("_geometry_type")}
        # Normalize Multi* to base type for tolerance.
        base = {g.replace("Multi", "") if isinstance(g, str) else g
                for g in geom_types}
        if geom_types and expected_geom not in base:
            warnings.append(
                f"Expected geometry '{expected_geom}', found {sorted(geom_types)}.")

    # 3. Per-record checks.
    pk_col = {"S_XS": "XS_LN_ID", "S_Fld_Haz_Ar": "FLD_AR_ID"}.get(layer)
    seen_pks: set = set()
    for i, rec in enumerate(records):
        tag = f"record {i}"
        # Primary-key uniqueness / presence.
        if pk_col:
            pk = rec.get(pk_col)
            if pk is None or pk == "":
                errors.append(f"{tag}: missing primary key '{pk_col}'.")
            elif pk in seen_pks:
                errors.append(f"{tag}: duplicate primary key "
                              f"'{pk_col}' = {pk!r}.")
            else:
                seen_pks.add(pk)
        # Type checks.
        for col, spec in columns.items():
            v = rec.get(col)
            if v is None or v == "":
                continue
            if spec["type"] == "numeric" and not _is_numeric(v):
                errors.append(f"{tag}: column '{col}' expected numeric, "
                              f"got {v!r}.")
            if spec["type"] == "text" and not isinstance(v, str):
                warnings.append(f"{tag}: column '{col}' expected text, "
                                f"got {type(v).__name__}.")

    # 4. Layer-specific rules.
    if layer == "S_XS":
        has_bfe = "BFE" in present
        has_wsel = "WSEL_REG" in present
        if not has_bfe and not has_wsel:
            warnings.append("Neither 'BFE' nor 'WSEL_REG' present; "
                            "cross-sections carry no elevation.")
    if layer == "S_Fld_Haz_Ar":
        valid_zones = schema.get("valid_zones", set())
        zones = {str(r.get("FL_ZONE", "")).strip().upper()
                 for r in records if r.get("FL_ZONE")}
        unknown = zones - {z.upper() for z in valid_zones}
        # Tolerate common variants not in the strict list.
        tolerated = {"0.2 PCT ANNUAL CHANCE FLOOD HAZARD", "AREA OF MINIMAL FLOOD HAZARD"}
        unknown = {z for z in unknown if z not in tolerated}
        if unknown:
            warnings.append(f"Unrecognized FL_ZONE values: {sorted(unknown)}.")
    if layer == "L_Profil_Baswn":
        for i, rec in enumerate(records):
            v = rec.get("VELOCITY")
            if _is_numeric(v) and float(v) < 0:
                errors.append(f"record {i}: VELOCITY negative ({v}).")
            w = rec.get("FLD_WAY_WD")
            if _is_numeric(w) and float(w) < 0:
                errors.append(f"record {i}: FLD_WAY_WD negative ({w}).")

    return {"valid": not errors, "errors": errors, "warnings": warnings,
            "checked_fields": checked}


def validate_s_xs(records: list[dict]) -> dict:
    """Validate records against the S_XS (Cross Sections) schema."""
    return _validate_records(records, "S_XS")


def validate_s_fld_haz_ar(records: list[dict]) -> dict:
    """Validate records against the S_Fld_Haz_Ar (Flood Hazard Zones) schema."""
    return _validate_records(records, "S_Fld_Haz_Ar")


def validate_l_profil_baswn(records: list[dict]) -> dict:
    """Validate records against the L_Profil_Baswn (Hydraulic Lookups) schema."""
    return _validate_records(records, "L_Profil_Baswn")


VALIDATORS = {
    "S_XS": validate_s_xs,
    "S_Fld_Haz_Ar": validate_s_fld_haz_ar,
    "L_Profil_Baswn": validate_l_profil_baswn,
}


def validate_nfhl_dataset(path: str | Path, layer: str | None = None,
                          gdal_layer: str | None = None) -> dict:
    """Auto-detect layer type (or use --layer) and validate a dataset file."""
    path = Path(path)
    if layer is None:
        # Guess from filename.
        name = path.stem.upper()
        for cand in VALIDATORS:
            if cand.upper().replace("_", "") in name.replace("_", ""):
                layer = cand
                break
        if layer is None:
            return {"valid": False,
                    "errors": [f"Could not infer layer from filename '{path.name}'. "
                               "Pass --layer S_XS | S_Fld_Haz_Ar | L_Profil_Baswn."],
                    "warnings": [], "checked_fields": []}
    if layer not in VALIDATORS:
        return {"valid": False,
                "errors": [f"Unknown layer '{layer}'. Choose from "
                           f"{sorted(VALIDATORS)}."],
                "warnings": [], "checked_fields": []}
    try:
        records = load_records(path, gdal_layer)
    except RuntimeError as e:
        return {"valid": False, "errors": [str(e)],
                "warnings": [], "checked_fields": []}
    result = VALIDATORS[layer](records)
    result["layer"] = layer
    result["record_count"] = len(records)
    result["source"] = str(path)
    return result


def check_referential_integrity(xs_records: list[dict],
                                lookup_records: list[dict]) -> dict:
    """Check L_Profil_Baswn.S_XS_ID values exist in S_XS.XS_LN_ID."""
    xs_ids = {str(r.get("XS_LN_ID")) for r in _normalize_fields(xs_records, "S_XS")
              if r.get("XS_LN_ID") not in (None, "")}
    lookups = _normalize_fields(lookup_records, "L_Profil_Baswn")
    errors, warnings = [], []
    for i, rec in enumerate(lookups):
        fk = rec.get("S_XS_ID")
        if fk in (None, ""):
            errors.append(f"lookup record {i}: missing S_XS_ID.")
        elif str(fk) not in xs_ids:
            errors.append(f"lookup record {i}: S_XS_ID {fk!r} not found in S_XS.")
    orphans = len([e for e in errors if "not found" in e])
    if orphans:
        warnings.append(f"{orphans} lookup rows reference unknown cross-sections.")
    return {"valid": not errors, "errors": errors, "warnings": warnings,
            "checked_fields": ["S_XS_ID -> XS_LN_ID"]}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="Validate NFHL data against the FEMA FIRM Database schema.")
    ap.add_argument("--input", required=True,
                    help="Input file (GeoJSON, CSV, GPKG, SHP).")
    ap.add_argument("--layer", choices=sorted(VALIDATORS),
                    help="FIRM layer to validate against.")
    ap.add_argument("--gdal-layer",
                    help="GDAL sublayer name (for GPKG with multiple layers).")
    ap.add_argument("--json", action="store_true",
                    help="Emit machine-readable JSON.")
    args = ap.parse_args(argv)

    result = validate_nfhl_dataset(args.input, args.layer, args.gdal_layer)
    if args.json:
        print(json.dumps(result, indent=2, default=str))
    else:
        print(f"Layer:  {result.get('layer', '?')}")
        print(f"Source: {result.get('source', args.input)}")
        print(f"Records: {result.get('record_count', '?')}")
        print(f"Valid:  {result['valid']}")
        for e in result["errors"]:
            print(f"  ERROR: {e}")
        for w in result["warnings"]:
            print(f"  WARN:  {w}")
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    sys.exit(main())
