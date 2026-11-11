#!/usr/bin/env python3
"""Bounded, evidence-first TSM source harvester.

This utility records the exact bytes received from explicitly allowlisted HTTPS
endpoints. A local digest is NOT an upstream checksum match, and declared CRS
metadata is NOT a validation of a downloaded dataset's embedded CRS.
"""
from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import os
import socket
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

MAX_BYTES = 64 * 1024 * 1024
CHUNK = 128 * 1024
ALLOWED_HOSTS = frozenset({
    "api.water.noaa.gov", "api.waterdata.usgs.gov",
    "rockyweb.usgs.gov", "hazards.fema.gov",
})


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise ValueError("redirects disabled: destination not approved")


def validate_url(url: str, hosts=ALLOWED_HOSTS) -> str:
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or not parsed.hostname
            or parsed.hostname.lower() not in hosts
            or parsed.username or parsed.password or parsed.port not in (None, 443)):
        raise ValueError("endpoint must be an allowlisted HTTPS host")
    # Guard against DNS answers pointing to private or link-local infrastructure.
    for result in socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM):
        addr = ipaddress.ip_address(result[4][0])
        if not addr.is_global:
            raise ValueError("endpoint resolved to a non-public address")
    return url


def crs_declaration(epsg):
    if epsg is None:
        return {"state": "NOT_DECLARED"}
    try:
        from pyproj import CRS
        crs = CRS.from_epsg(int(epsg))
        return {
            "state": "DECLARATION_RESOLVES_ONLY",
            "epsg": int(epsg),
            "name": crs.name,
            "axis_units": [axis.unit_name for axis in crs.axis_info],
            "dataset_crs_verified": False,
        }
    except (ImportError, ValueError, TypeError) as exc:
        return {"state": "UNVERIFIED", "reason": str(exc)}


def harvest_one(item, max_bytes=MAX_BYTES, opener=None, hosts=ALLOWED_HOSTS):
    record = {
        "dataset_id": item["dataset_id"],
        "agency": item.get("agency"),
        "layer_id": item.get("layer_id"),
        "source_url": item["source_url"],
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "declared_vertical_datum": item.get("vertical_datum"),
        "declared_vertical_units": item.get("vertical_units"),
        "declared_transformation_model": item.get("transformation_model"),
        "crs_declaration": crs_declaration(item.get("expected_epsg")),
        "sha256": None, "size_bytes": None,
        "verification_state": "NOT_VERIFIED",
        "upstream_checksum_match": False,
        "dataset_crs_verified": False,
        "vertical_datum_verified": False,
    }
    try:
        validate_url(item["source_url"], hosts)
        req = Request(item["source_url"], headers={
            "User-Agent": "TSM-evidence-harvester/1.0",
            "Accept-Encoding": "identity",
        })
        digest = hashlib.sha256()
        size = 0
        with (opener or build_opener(NoRedirect())).open(req, timeout=20) as response:
            record["http_status"] = response.status
            record["content_type"] = response.headers.get("Content-Type")
            while True:
                block = response.read(min(CHUNK, max_bytes + 1 - size))
                if not block:
                    break
                size += len(block)
                if size > max_bytes:
                    raise ValueError("response exceeds configured byte limit")
                digest.update(block)
        record["sha256"] = digest.hexdigest()
        record["size_bytes"] = size
        record["verification_state"] = "RETRIEVED_HASHED_UNVERIFIED_UPSTREAM"
        expected = item.get("expected_sha256")
        if expected is not None:
            if not isinstance(expected, str) or len(expected) != 64 or any(c not in "0123456789abcdefABCDEF" for c in expected):
                raise ValueError("expected_sha256 must be a 64-digit hex digest")
            record["upstream_checksum_match"] = digest.hexdigest() == expected.lower()
            record["verification_state"] = ("EXPECTED_DIGEST_MATCH" if record["upstream_checksum_match"]
                                             else "EXPECTED_DIGEST_MISMATCH")
    except (ValueError, HTTPError, URLError, OSError) as exc:
        record["verification_state"] = "VERIFICATION_FAILED"
        record["error"] = str(exc)
        record["sha256"] = None
        record["size_bytes"] = None
    return record


def build_manifest(registry, max_bytes=MAX_BYTES, opener=None, hosts=ALLOWED_HOSTS):
    if not isinstance(registry, list):
        raise ValueError("registry must be a JSON array")
    records = [harvest_one(item, max_bytes=max_bytes, opener=opener, hosts=hosts)
               for item in registry]
    return {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "purpose": "Reproducible acquisition receipts, not regulatory certification",
        "records": records,
        "total_datasets": len(records),
        "human_authority_final": True,
    }


def write_atomic(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix=".tsm-manifest-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            json.dump(payload, out, indent=2, sort_keys=True)
            out.write("\n")
            out.flush()
            os.fsync(out.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", required=True, help="JSON array of explicitly approved endpoints")
    parser.add_argument("--output", required=True, help="write-once output path")
    parser.add_argument("--max-bytes", type=int, default=MAX_BYTES)
    args = parser.parse_args()
    if args.max_bytes <= 0 or args.max_bytes > MAX_BYTES:
        parser.error("max-bytes must be in (0, 67108864]")
    if Path(args.output).exists():
        parser.error("output already exists; use a new receipt filename")
    registry = json.loads(Path(args.registry).read_text(encoding="utf-8"))
    payload = build_manifest(registry, max_bytes=args.max_bytes)
    write_atomic(args.output, payload)
    print(json.dumps({"output": args.output, "states": [r["verification_state"] for r in payload["records"]]}))
    return 1 if any(r["verification_state"] in ("VERIFICATION_FAILED", "EXPECTED_DIGEST_MISMATCH") for r in payload["records"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
