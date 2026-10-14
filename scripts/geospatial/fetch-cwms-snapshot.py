#!/usr/bin/env python3
"""
USACE CWMS Data API client for TSM.

Fetches river gauge data from the Corps Water Management System.
API: https://cwms-data.usace.army.mil/cwms-data/

IMPORTANT: Per TSM river-data policy, live values are ONLY fetched
via user-initiated "Fetch live snapshot" action. No automatic polling.
This script is a manual utility, not a background service.

Usage:
  python3 fetch-cwms-snapshot.py --office SWL --location "Wabash*"
  python3 fetch-cwms-snapshot.py --help
"""

import argparse
import json
import sys
import urllib.request
import urllib.parse
from datetime import datetime, timezone

BASE_URL = "https://cwms-data.usace.army.mil/cwms-data"


def fetch_locations(office=None, location_mask=None):
    """Fetch locations from CWMS API."""
    params = {}
    if office:
        params["office"] = office
    if location_mask:
        params["location-mask"] = location_mask

    url = f"{BASE_URL}/locations?{urllib.parse.urlencode(params)}"
    print(f"Fetching: {url}", file=sys.stderr)

    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def fetch_timeseries(name, office, begin=None, end=None):
    """Fetch time series data for a location."""
    params = {"name": name, "office": office, "unit": "EN"}
    if begin:
        params["begin"] = begin
    if end:
        params["end"] = end

    url = f"{BASE_URL}/timeseries?{urllib.parse.urlencode(params)}"
    print(f"Fetching: {url}", file=sys.stderr)

    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def main():
    parser = argparse.ArgumentParser(
        description="Fetch USACE CWMS river data (user-initiated only)"
    )
    parser.add_argument("--office", help="Office ID (e.g., SWL, MVS)")
    parser.add_argument("--location", help="Location mask (e.g., 'Wabash*')")
    parser.add_argument("--timeseries", help="Time series name")
    parser.add_argument("--out", help="Output JSON file")

    args = parser.parse_args()

    if args.timeseries and args.office:
        data = fetch_timeseries(args.timeseries, args.office)
    else:
        data = fetch_locations(args.office, args.location)

    # Add metadata
    result = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "USACE CWMS Data API",
        "source_url": BASE_URL,
        "policy": "User-initiated snapshot only. No automatic polling.",
        "data": data,
    }

    output = json.dumps(result, indent=2)
    if args.out:
        with open(args.out, "w") as f:
            f.write(output)
        print(f"Wrote {args.out}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
