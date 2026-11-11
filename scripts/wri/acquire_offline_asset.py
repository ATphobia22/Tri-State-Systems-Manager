#!/usr/bin/env python3
"""Acquire an operator-reviewed official WRI file into a bounded offline staging area.

Does not scrape around logins or silently identify a source URL. A hash receipt
establishes integrity of bytes received, not scientific validity or licence.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler

ALLOWED_HOSTS = frozenset({"files.wri.org", "wri-projects.s3.amazonaws.com"})
MAX_BYTES = 512 * 1024 * 1024
DIGEST_RE = re.compile(r"^[a-f0-9]{64}$")


def validate_url(url: str) -> None:
    parts = urlsplit(url)
    if parts.scheme != "https" or parts.hostname not in ALLOWED_HOSTS:
        raise ValueError("HTTPS URL must use an explicitly allowed WRI asset host")
    if parts.username or parts.password or parts.port or not parts.path.startswith("/"):
        raise ValueError("URL may not contain credentials, custom ports or invalid path")
    if parts.query or parts.fragment:
        raise ValueError("Signed or parameterized URLs require separate manual review")


class OfficialOnlyRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def acquire(*, url: str, destination: Path, source_id: str, registry: dict,
            max_bytes: int = MAX_BYTES, expected_sha256: str | None = None,
            opener=None) -> dict:
    validate_url(url)
    datasets = {row["id"]: row for row in registry["datasets"]}
    if source_id not in datasets:
        raise ValueError("Dataset ID is not in the reviewed WRI registry")
    if datasets[source_id]["downloadPolicy"] in {
        "EARTH_ENGINE_AUTHENTICATED_EXPORT_REQUIRED", "API_OR_BULK_ACCESS_NOT_VERIFIED"
    }:
        raise ValueError("This source does not have a verified direct-download contract")
    if max_bytes < 1 or max_bytes > MAX_BYTES:
        raise ValueError("Unsafe max_bytes")
    if expected_sha256 and not DIGEST_RE.fullmatch(expected_sha256):
        raise ValueError("Expected SHA-256 must be 64 lowercase hexadecimal characters")
    destination = destination.resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    client = opener or build_opener(OfficialOnlyRedirect())
    request = Request(url, headers={"User-Agent": "TSM-WRI-offline-acquisition/1.0"})
    temp = None
    try:
        with client.open(request, timeout=60) as response:
            validate_url(response.geturl())
            declared = response.headers.get("Content-Length")
            if declared and int(declared) > max_bytes:
                raise ValueError("WRI file exceeds configured download limit")
            with tempfile.NamedTemporaryFile(dir=destination.parent, prefix=".wri-", delete=False) as out:
                temp = Path(out.name)
                digest = hashlib.sha256()
                total = 0
                while True:
                    part = response.read(min(1024 * 1024, max_bytes - total + 1))
                    if not part:
                        break
                    total += len(part)
                    if total > max_bytes:
                        raise ValueError("WRI transfer exceeded byte cap")
                    digest.update(part)
                    out.write(part)
                out.flush()
                os.fsync(out.fileno())
        if total == 0:
            raise ValueError("WRI transfer was empty")
        sha = digest.hexdigest()
        if expected_sha256 and sha != expected_sha256:
            raise ValueError("WRI transfer SHA-256 mismatch")
        os.replace(temp, destination)
        temp = None
        evidence = {"schema":"tsm.wri.acquisition.v1","source_id":source_id,
                    "authority":"World Resources Institute","source_url":url,
                    "bytes":total,"sha256":sha,
                    "status":"ACQUIRED_UNREVIEWED",
                    "digest_matched_expected":expected_sha256 is not None,
                    "local_path":destination.name,"license_review":"REQUIRED",
                    "geographic_coverage":"UNVERIFIED_FOR_AOI",
                    "crs":"UNVERIFIED","vertical_datum":"UNVERIFIED",
                    "render_ready":False,"engineering_authority":False}
        receipt = destination.with_name(destination.name + ".evidence.json")
        receipt.write_text(json.dumps(evidence, indent=2, sort_keys=True)+"\n",encoding="utf-8")
        return evidence
    finally:
        if temp is not None:
            temp.unlink(missing_ok=True)


def main() -> None:
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--registry",type=Path,default=Path(__file__).resolve().parents[2] /
                    "data/registries/wri-environmental-catalog-v1.json")
    ap.add_argument("--source-id",required=True)
    ap.add_argument("--url",required=True,help="Operator-confirmed direct WRI asset URL")
    ap.add_argument("--output",type=Path,required=True,help="File path in offline staging cache")
    ap.add_argument("--max-mib",type=int,default=512)
    ap.add_argument("--expected-sha256")
    ap.add_argument("--acknowledge-license-review",action="store_true")
    args=ap.parse_args()
    if not args.acknowledge_license_review:
        ap.error("Must explicitly acknowledge dataset-specific license review")
    registry=json.loads(args.registry.read_text(encoding="utf-8"))
    result=acquire(url=args.url,destination=args.output,source_id=args.source_id,
                   registry=registry,max_bytes=args.max_mib*1024*1024,
                   expected_sha256=args.expected_sha256)
    print(json.dumps(result,sort_keys=True,indent=2))


if __name__=="__main__":
    main()
