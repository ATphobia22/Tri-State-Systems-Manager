#!/usr/bin/env python3
"""Fetch official DNR public county hydrogeology originals and traceable metadata.

No DoWORC individual permit records, private owner info or FARA generation.
No model or regulatory/geodetic validation is asserted.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from datetime import datetime, timezone
import zipfile

CATALOG = Path(__file__).resolve().parents[2] / "data/authorities/indiana-dnr/doworc-hydrogeology-source-urls-20261119.json"
ALLOWED_HOSTS = frozenset(("www.in.gov", "in.gov", "www.arcgis.com", "gisdata.in.gov"))
MAX_BYTES = 12 * 1024 * 1024

def validate_url(url):
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS or parsed.username or parsed.password:
        raise ValueError("SOURCE_HOST_NOT_ALLOWLISTED")
    return url

def fetch(url):
    validate_url(url)
    req = Request(url, headers={"User-Agent":"TSM-open-data-acquisition/1.0 (+public-source-citation)", "Accept":"*/*"})
    with urlopen(req, timeout=90) as response:
        actual_url = response.geturl()
        validate_url(actual_url)
        content_type = response.headers.get("Content-Type", "")
        data = bytearray()
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            data.extend(chunk)
            if len(data) > MAX_BYTES:
                raise ValueError("SOURCE_EXCEEDS_BOUNDED_FILE_SIZE")
        return bytes(data), actual_url, content_type

def verify_shapefile_zip(path):
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        for info in z.infolist():
            name = info.filename
            if name.startswith("/") or name.startswith("\\") or any(x == ".." for x in Path(name.replace("\\","/")).parts):
                raise ValueError("ZIP_PATH_TRAVERSAL")
            if (info.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError("ZIP_SYMLINK_REJECTED")
        if not any(x.lower().endswith(".shp") for x in names):
            raise ValueError("NO_SHAPEFILE_IN_SOURCE_ZIP")
        if z.testzip() is not None:
            raise ValueError("ZIP_CRC_FAILURE")
        return {"zipEntryCount":len(names),"shapefiles":[x for x in names if x.lower().endswith(".shp")]}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    config = json.loads(CATALOG.read_text(encoding="utf-8"))
    root = Path(args.output)
    root.mkdir(parents=True, exist_ok=True)
    report = {"schema":"tsm-doworc-original-acquisition-receipt-v1",
              "sourceAuthority":config["authority"],"sourceCatalog":str(CATALOG),
              "retrievedUtc":datetime.now(timezone.utc).isoformat(),
              "status":"SOURCE_ACQUIRED_UNVALIDATED", "regulatoryDetermination":False,
              "verticalDatumVerified":False,"countyExactPolygonValidated":False,
              "records":[],"metadata":[],"failures":[]}
    checks = []
    for row in config["datasets"]:
        county,kind,url = row["county"],row["kind"],row["url"]
        filename = urlparse(url).path.split("/")[-1]
        destination = root / "source-originals" / county / kind / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        try:
            data,actual,mime=fetch(url)
            if not data.startswith(b"PK\\x03\\x04"):
                raise ValueError("NOT_A_ZIP_FILE")
            destination.write_bytes(data)
            zip_details=verify_shapefile_zip(destination)
            digest=hashlib.sha256(data).hexdigest()
            checks.append((digest,str(destination.relative_to(root))))
            report["records"].append({"county":county,"fips":row["fips"],"kind":kind,
                "sourceUrl":url,"resolvedSourceUrl":actual,"contentType":mime,
                "relativePath":str(destination.relative_to(root)),"sizeBytes":len(data),
                "sha256":digest,**zip_details,"engineeringValidated":False})
        except Exception as err:
            report["failures"].append({"county":county,"kind":kind,"sourceUrl":url,
                                       "errorType":type(err).__name__,"reason":str(err)})
            if destination.exists(): destination.unlink()
    for row in config["metadata"]:
        try:
            data,actual,mime=fetch(row["url"])
            if not data or not isinstance(json.loads(data),dict):
                raise ValueError("EMPTY_OR_INVALID_JSON_METADATA")
            dest=root/"source-metadata"/row["name"]
            dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_bytes(data)
            digest=hashlib.sha256(data).hexdigest()
            checks.append((digest,str(dest.relative_to(root))))
            report["metadata"].append({"sourceUrl":row["url"],"resolvedSourceUrl":actual,
                "relativePath":str(dest.relative_to(root)),"contentType":mime,
                "sizeBytes":len(data),"sha256":digest})
        except Exception as err:
            report["failures"].append({"sourceUrl":row["url"],"metadata":row["name"],
                                       "errorType":type(err).__name__,"reason":str(err)})
    report["sourceZipCount"]=len(report["records"])
    report["expectedSourceZipCount"]=len(config["datasets"])
    report["status"]="SOURCE_ACQUIRED_UNVALIDATED" if report["sourceZipCount"]==8 else "INCOMPLETE_SOURCE_ACQUISITION"
    (root/"source-acquisition-receipt.json").write_text(json.dumps(report,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    (root/"SHA256SUMS.txt").write_text("".join(f"{digest}  {path}\n" for digest,path in checks),encoding="utf-8")
    print(json.dumps({"status":report["status"],"sourceZipCount":report["sourceZipCount"],
                      "metadataCount":len(report["metadata"]),"failures":report["failures"]},sort_keys=True))
    if report["status"] != "SOURCE_ACQUIRED_UNVALIDATED":
        raise SystemExit("REQUIRED_ORIGINAL_SOURCE_ZIP_MISSING")

if __name__ == "__main__":
    main()
