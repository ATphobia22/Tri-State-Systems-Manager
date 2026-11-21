#!/usr/bin/env python3
"""Headless official-document acquisition. Do not infer zoning GIS or CRS from plan PDFs."""
import argparse
import hashlib
import json
import os
import tempfile
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse
from urllib.request import Request, urlopen

MAX_BYTES = 80 * 1024 * 1024
HOST = "www.poseycountyin.gov"

def allowed(url):
    p = urlparse(url)
    return (p.scheme == "https" and p.hostname == HOST and p.port is None
            and p.path.startswith("/wp-content/uploads/") and p.path.lower().endswith(".pdf")
            and not p.username and not p.password)

def acquire(url, destination):
    if not allowed(url):
        raise ValueError("Only source-hosted official PDF downloads allowed")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp_name = None
    try:
        with urlopen(Request(url, headers={"User-Agent": "TSM-municipal-evidence/1.0"}), timeout=45) as response:
            if not allowed(response.geturl()):
                raise ValueError("Unapproved redirected host")
            if "pdf" not in response.headers.get("Content-Type", "").lower():
                raise ValueError("Unexpected content type")
            sha, size, first = hashlib.sha256(), 0, b""
            with tempfile.NamedTemporaryFile(mode="wb", dir=destination.parent, delete=False) as tmp:
                temp_name = tmp.name
                while True:
                    chunk = response.read(65536)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise ValueError("Document exceeds allowed size")
                    if len(first) < 5:
                        first += chunk[:5-len(first)]
                    sha.update(chunk)
                    tmp.write(chunk)
            if first != b"%PDF-" or size < 100:
                raise ValueError("Invalid PDF signature or length")
        os.replace(temp_name, destination)
        temp_name = None
        return {"sha256": sha.hexdigest(), "bytes": size, "retrieved_utc": datetime.now(timezone.utc).isoformat(), "original_url": url, "source_crs": None, "zoning_geometry_verified": False}
    finally:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", type=Path, default=Path("evidence/municipal/mount-vernon/sources.json"))
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--include-county", action="store_true")
    args = parser.parse_args()
    sources = json.loads(args.registry.read_text(encoding="utf8"))["sources"]
    ids = {"mount-vernon-comprehensive-plan-2023"}
    if args.include_county:
        ids.add("posey-county-comprehensive-plan-2024")
    for record in sources:
        if record["id"] not in ids:
            continue
        target = args.output / (record["id"] + ".pdf")
        receipt = acquire(record["url"], target)
        receipt["source_id"] = record["id"]
        (target.parent / (target.name + ".receipt.json")).write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf8")
        print(record["id"], receipt["sha256"])

if __name__ == "__main__":
    main()
