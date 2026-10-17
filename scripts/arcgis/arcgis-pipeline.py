#!/usr/bin/env python3
"""
TSM ArcGIS data pipeline using arcgis-python-api.

Automates:
- Querying source FeatureServers for tri-state data
- Publishing derived layers
- QA checks on hosted layers

Requires: pip install arcgis

Usage:
    python arcgis-pipeline.py --action query-parcels --apn 65-19-08-100-008.001-010
    python arcgis-pipeline.py --action refresh-flood --county 18129
"""

import argparse
import json
import sys

try:
    from arcgis.gis import GIS
    from arcgis.features import FeatureLayer
except ImportError:
    print("Install arcgis: pip install arcgis", file=sys.stderr)
    sys.exit(1)

# Anonymous GIS for public services (no credentials needed)
GIS_ANON = GIS()

# Service URLs
SERVICES = {
    "indiana_parcels": "https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0",
    "posey_cslf": "https://gisdata.in.gov/server/rest/services/Hosted/Posey_CSLF_Feb2025/FeatureServer",
    "dnr_flood": "https://gisdata.in.gov/server/rest/services/Hosted/FloodHazard_BestAvai_DNR_Water_PROD/FeatureServer/0",
    "nld_leveed": "https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer/16",
}

TRI_STATE_GEOIDS = ["18129", "18163", "18051", "18173", "17059", "17193", "21101", "21225"]


def query_parcels(apn: str):
    """Query Indiana parcels by APN."""
    layer = FeatureLayer(SERVICES["indiana_parcels"], gis=GIS_ANON)
    result = layer.query(where=f"APN = '{apn}'", out_fields="*", return_geometry=True)
    print(f"Found {len(result.features)} parcel(s)")
    for f in result.features:
        attrs = f.attributes
        print(f"  APN: {attrs.get('APN')}")
        print(f"  Address: {attrs.get('ADDRESS', 'N/A')}")
    return result


def count_features(service_key: str, where: str = "1=1"):
    """Count features in a service."""
    layer = FeatureLayer(SERVICES[service_key], gis=GIS_ANON)
    count = layer.query(where=where, return_count_only=True)
    print(f"{service_key}: {count} features (where: {where})")
    return count


def qa_check():
    """Run QA checks on key services."""
    print("Running QA checks...")
    checks = [
        ("indiana_parcels", "1=1"),
        ("posey_cslf", "1=1"),
        ("dnr_flood", "1=1"),
        ("nld_leveed", "STATES='Indiana'"),
    ]
    results = {}
    for service_key, where in checks:
        try:
            count = count_features(service_key, where)
            results[service_key] = {"status": "OK", "count": count}
        except Exception as e:
            results[service_key] = {"status": "FAIL", "error": str(e)[:100]}
            print(f"  FAIL: {service_key}: {e}")
    
    # Save results
    with open("arcgis-qa-results.json", "w") as f:
        json.dump(results, f, indent=2)
    print("Results saved to arcgis-qa-results.json")
    return results


def main():
    parser = argparse.ArgumentParser(description="TSM ArcGIS pipeline")
    parser.add_argument("--action", required=True,
                        choices=["query-parcels", "qa-check", "count"],
                        help="Action to perform")
    parser.add_argument("--apn", help="Parcel APN for query-parcels")
    parser.add_argument("--service", help="Service key for count")
    parser.add_argument("--where", default="1=1", help="Where clause for count")
    
    args = parser.parse_args()
    
    if args.action == "query-parcels":
        if not args.apn:
            print("--apn required", file=sys.stderr)
            sys.exit(1)
        query_parcels(args.apn)
    elif args.action == "qa-check":
        qa_check()
    elif args.action == "count":
        if not args.service:
            print("--service required", file=sys.stderr)
            sys.exit(1)
        count_features(args.service, args.where)


if __name__ == "__main__":
    main()
