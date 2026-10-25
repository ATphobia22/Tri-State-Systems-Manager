#!/usr/bin/env python3
"""Bounded USDA NRCS Soil Data Access (SDA) acquisition and offline validation.

No HTTP requests without --live. Offline snapshots are independently retained;
soil map-unit characteristics are never site surveys or NAVD88 elevations.

  python tools/agriculture/scripts/query-ssurgo-soils.py --live --out /private/ssurgo-IN129.json
  python tools/agriculture/scripts/query-ssurgo-soils.py \
      --offline-mapunits /snapshot/mapunits.json \
      --offline-components /snapshot/components.json --out /private/ssurgo-IN129.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SDA_URL = "https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest"
POSEY_AREASYMBOL = "IN129"
AREASYMBOL = re.compile(r"^[A-Z]{2}[0-9]{3}$")
MAX_ROWS = 10000
MAX_RESPONSE_BYTES = 12 * 1024 * 1024
RESPONSE_FORMAT = "JSON+COLUMNNAME"

MAPUNIT_FIELDS = ("mukey", "musym", "muname", "muacres")
COMPONENT_FIELDS = ("mukey", "musym", "cokey", "compname", "comppct_r", "drainagecl", "hydgrp", "slope_r", "elev_r")


def area_symbol(value: str) -> str:
    if not isinstance(value, str) or AREASYMBOL.fullmatch(value) is None:
        raise ValueError("areasymbol must match the NRCS two-letter three-digit pattern (e.g. IN129)")
    return value


def query_text(kind: str, area: str, max_rows: int = MAX_ROWS) -> str:
    area_symbol(area)
    if type(max_rows) is not int or not 1 <= max_rows <= MAX_ROWS:
        raise ValueError("max_rows must be an integer in [1, 10000]")
    # SQL is not exposed to callers. Never interpolate free-form queries or
    # arbitrary identifiers into a remote USDA database.
    if kind == "mapunits":
        return (
            f"SELECT TOP {max_rows} mu.mukey, mu.musym, mu.muname, mu.muacres "
            "FROM legend AS l "
            "INNER JOIN mapunit AS mu ON mu.lkey = l.lkey "
            f"WHERE l.areasymbol = '{area}' AND l.areatypename = 'Non-MLRA Soil Survey Area' "
            "ORDER BY mu.mukey"
        )
    if kind == "components":
        return (
            f"SELECT TOP {max_rows} mu.mukey, mu.musym, c.cokey, c.compname, "
            "c.comppct_r, c.drainagecl, c.hydgrp, c.slope_r, c.elev_r "
            "FROM legend AS l "
            "INNER JOIN mapunit AS mu ON mu.lkey = l.lkey "
            "INNER JOIN component AS c ON c.mukey = mu.mukey "
            f"WHERE l.areasymbol = '{area}' AND l.areatypename = 'Non-MLRA Soil Survey Area' "
            "ORDER BY mu.mukey, c.cokey"
        )
    raise ValueError("unrecognized SDA query category")


def _payload(query: str) -> bytes:
    return json.dumps({"query": query, "format": RESPONSE_FORMAT}, separators=(",", ":")).encode("utf-8")


def fetch_snapshot(query: str, *, attempts: int = 3, timeout: int = 25) -> bytes:
    request = urllib.request.Request(
        SDA_URL, data=_payload(query), headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "TSM/1.0 evidence-first USDA soil importer"}, method="POST"
    )
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                if response.status != 200:
                    raise OSError(f"USDA SDA status {response.status}")
                raw = response.read(MAX_RESPONSE_BYTES + 1)
                if len(raw) > MAX_RESPONSE_BYTES:
                    raise ValueError("USDA SDA response exceeds byte ceiling")
                return raw
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            if attempt + 1 >= attempts:
                raise RuntimeError(f"USDA SDA unavailable after {attempts} attempts; do not fabricate missing soils: {exc}") from exc
            time.sleep(min(2 ** attempt, 4))
    raise RuntimeError("SDA retries exhausted")


def decode_snapshot(raw: bytes, required_columns: tuple[str, ...], max_rows: int = MAX_ROWS) -> list[dict[str, Any]]:
    try:
        doc = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeError) as exc:
        raise ValueError("SDA snapshot is not UTF-8 JSON") from exc
    rows = doc.get("Table") if isinstance(doc, dict) else None
    if not isinstance(rows, list) or len(rows) < 2 or not isinstance(rows[0], list):
        raise ValueError("SDA JSON+COLUMNNAME response requires column headers and at least one data row")
    columns = rows[0]
    if len(set(columns)) != len(columns) or not all(isinstance(v, str) for v in columns):
        raise ValueError("SDA response contains invalid/duplicate column names")
    if not set(required_columns).issubset(columns):
        raise ValueError(f"SDA response missing columns: {sorted(set(required_columns) - set(columns))}")
    if len(rows) - 1 >= max_rows:
        raise ValueError("SDA result hit the configured TOP row cap; partial county inventory prohibited")
    converted: list[dict[str, Any]] = []
    for n, cells in enumerate(rows[1:], 1):
        if not isinstance(cells, list) or len(cells) != len(columns):
            raise ValueError(f"SDA row {n} has inconsistent column cardinality")
        values = dict(zip(columns, cells))
        for key in ("mukey", "cokey"):
            if key in required_columns and (not isinstance(values[key], (str, int)) or not str(values[key]).isdigit()):
                raise ValueError(f"SDA row {n} lacks an exact numeric {key}")
        converted.append(values)
    return converted


def validate_inventory(mapunits: list[dict[str, Any]], components: list[dict[str, Any]]) -> None:
    keys = [str(m["mukey"]) for m in mapunits]
    if len(set(keys)) != len(keys):
        raise ValueError("duplicate source map-unit keys")
    component_ids = [str(c["cokey"]) for c in components]
    if len(set(component_ids)) != len(component_ids):
        raise ValueError("duplicate source component keys")
    unknown = set(str(c["mukey"]) for c in components) - set(keys)
    if unknown:
        raise ValueError("SDA components reference map units absent from the matching mapunit snapshot")


def build_record(area: str, mapunit_raw: bytes, component_raw: bytes, *, acquisition: str, max_rows: int) -> dict[str, Any]:
    mu = decode_snapshot(mapunit_raw, MAPUNIT_FIELDS, max_rows=max_rows)
    co = decode_snapshot(component_raw, COMPONENT_FIELDS, max_rows=max_rows)
    validate_inventory(mu, co)
    return {
        "schemaVersion": "tsm.usda.sda.county-snapshot.v1",
        "areaSymbol": area_symbol(area),
        "sourceAuthority": "USDA NRCS Soil Data Access",
        "sourceUrl": SDA_URL,
        "requestFormat": RESPONSE_FORMAT,
        "acquisitionMode": acquisition,
        "dataClassification": "GOVERNMENT_SOURCE_UNVALIDATED",
        "engineeringUse": False, "regulatoryUse": False,
        "soilDepthVerticalReference": "BELOW_LOCAL_SURFACE_NOT_NAVD88",
        "measurementNotice": "Soil survey map units are generalized component interpretations, not onsite boring or field-survey proof",
        "queries": {"mapunits": query_text("mapunits", area, max_rows), "components": query_text("components", area, max_rows)},
        "snapshotsSha256": {"mapunits": hashlib.sha256(mapunit_raw).hexdigest(), "components": hashlib.sha256(component_raw).hexdigest()},
        "counts": {"mapunits": len(mu), "components": len(co)},
        "mapunits": mu,
        "components": co,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    modes = ap.add_mutually_exclusive_group(required=True)
    modes.add_argument("--live", action="store_true", help="opt-in bounded live USDA SDA POST queries")
    modes.add_argument("--offline-mapunits", type=Path, help="previously acquired raw USDA SDA mapunit JSON+COLUMNNAME")
    ap.add_argument("--offline-components", type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--areasymbol", default=POSEY_AREASYMBOL)
    ap.add_argument("--max-rows", type=int, default=MAX_ROWS)
    args = ap.parse_args()
    try:
        area_symbol(args.areasymbol)
        if not 1 <= args.max_rows <= MAX_ROWS:
            raise ValueError("max-rows must be 1..10000")
        if args.live:
            if args.offline_components:
                raise ValueError("offline-components cannot be combined with --live")
            mu_raw = fetch_snapshot(query_text("mapunits", args.areasymbol, args.max_rows))
            co_raw = fetch_snapshot(query_text("components", args.areasymbol, args.max_rows))
            mode = "LIVE_OPT_IN"
        else:
            if not args.offline_components:
                raise ValueError("both offline raw snapshot files are required")
            mu_raw, co_raw = args.offline_mapunits.read_bytes(), args.offline_components.read_bytes()
            mode = "OFFLINE_REPLAY"
        record = build_record(args.areasymbol, mu_raw, co_raw, acquisition=mode, max_rows=args.max_rows)
        record["capturedAtUtc"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        args.out.parent.mkdir(parents=True, exist_ok=True)
        artifact = json.dumps(record, sort_keys=True, indent=2, ensure_ascii=False) + "\n"
        args.out.write_text(artifact, encoding="utf-8")
        sha = hashlib.sha256(artifact.encode("utf-8")).hexdigest()
        args.out.with_suffix(args.out.suffix + ".sha256").write_text(f"{sha}  {args.out.name}\n", encoding="utf-8")
        print(json.dumps({"status": "SNAPSHOT_CAPTURED_NOT_VALIDATED", "counts": record["counts"], "artifactSha256": sha, "sourceSha256": record["snapshotsSha256"]}, sort_keys=True))
        return 0
    except (ValueError, RuntimeError, OSError) as exc:
        print(f"UNAVAILABLE/INVALID USDA SDA: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
