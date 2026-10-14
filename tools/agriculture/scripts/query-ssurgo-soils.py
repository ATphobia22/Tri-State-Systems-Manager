#!/usr/bin/env python3
"""
Query USDA SSURGO soils data for Posey County, Indiana via the
Soil Data Access (SDA) REST API. No authentication required.

API: https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest
Docs: https://sdmdataaccess.sc.egov.usda.gov/

This script fetches map unit symbols, component names, and key
soil properties for the Posey County survey area.

Usage:
    python3 query-ssurgo-soils.py --out ./datasets/ssurgo-posey.json
"""

import argparse
import json
import os
import urllib.request

SDA_URL = "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest"

# Posey County, IN soil survey area symbol
POSEY_AREASYMBOL = "IN129"


def sda_query(sql):
    """Execute a SQL query against the SDA Tabular API."""
    payload = json.dumps({"query": sql, "format": "JSON"}).encode()
    req = urllib.request.Request(
        SDA_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def fetch_mapunits(areasymbol):
    """Fetch map units for a soil survey area."""
    sql = f"""
    SELECT musym, muname, muacres
    FROM mapunit
    WHERE areasymbol = '{areasymbol}'
    ORDER BY musym
    """
    return sda_query(sql)


def fetch_components(areasymbol, limit=50):
    """Fetch soil components with key properties."""
    sql = f"""
    SELECT TOP {limit}
        mu.musym, c.compname, c.comppct_r,
        c.drainagecl, c.hydgrp,
        c.slope_r, c.elev_r
    FROM mapunit mu
    JOIN component c ON mu.mukey = c.mukey
    WHERE mu.areasymbol = '{areasymbol}'
    ORDER BY mu.musym, c.comppct_r DESC
    """
    return sda_query(sql)


def main():
    ap = argparse.ArgumentParser(description="Query SSURGO soils for Posey County")
    ap.add_argument("--out", default="./datasets/ssurgo-posey.json",
                    help="Output JSON path")
    ap.add_argument("--areasymbol", default=POSEY_AREASYMBOL,
                    help="Soil survey area symbol")
    args = ap.parse_args()

    print(f"Querying SSURGO for survey area {args.areasymbol}...")
    
    try:
        mapunits = fetch_mapunits(args.areasymbol)
        print(f"  Found {len(mapunits.get('Table', []))} map units")
        
        components = fetch_components(args.areasymbol)
        print(f"  Found {len(components.get('Table', []))} component records")
        
        result = {
            "areasymbol": args.areasymbol,
            "source": "USDA NRCS SSURGO via Soil Data Access API",
            "url": "https://sdmdataaccess.sc.egov.usda.gov/",
            "license": "Public domain (US federal)",
            "mapunits": mapunits,
            "components": components,
        }
        
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w") as f:
            json.dump(result, f, indent=2)
        print(f"  Wrote {args.out}")
        
    except Exception as e:
        print(f"Error querying SDA: {e}", file=__import__("sys").stderr)
        print("The SDA API may be temporarily unavailable. Try again later,")
        print("or use Web Soil Survey: https://websoilsurvey.nrcs.usda.gov/")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
