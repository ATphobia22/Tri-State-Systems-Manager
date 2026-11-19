#!/usr/bin/env python3
"""Acquire nine-county official 2026 TIGER/Line roads and water source shapefiles.

Preserves 27 exact-source ZIPs from the Census Bureau, validates member names,
required shapefile members, embedded NAD83 CRS, feature count, byte lengths and
SHA-256. Census reference roads are not official road-grade surveys. Hydrography
is not bathymetry or a calibrated flood model.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import tempfile
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ENGINEERING_EIGHT={"18129","18163","18051","18173","17193","17059","21101","21225"}
EXTRA_REGIONAL={"17185"}
COUNTIES={
    "18129":"Posey, IN", "18163":"Vanderburgh, IN",
    "18051":"Gibson, IN", "18173":"Warrick, IN",
    "17193":"White, IL", "17059":"Gallatin, IL",
    "21101":"Henderson, KY", "21225":"Union, KY",
    "17185":"Wabash, IL",
}
KINDS=("roads","linearwater","areawater")
MAX_ARCHIVE_BYTES=20*1024*1024
MAX_UNCOMPRESSED_BYTES=100*1024*1024
MAX_TOTAL_BYTES=300*1024*1024


def tiger_source_url(fips: str, kind: str) -> str:
    if fips not in COUNTIES or kind not in KINDS:
        raise ValueError("COUNTY_OR_KIND_NOT_ALLOWLISTED")
    return f"https://www2.census.gov/geo/tiger/TIGER2026/{kind.upper()}/tl_2026_{fips}_{kind}.zip"


def download(url: str, target: Path) -> dict:
    if url not in {tiger_source_url(c,k) for c in COUNTIES for k in KINDS}:
        raise ValueError("SOURCE_URL_NOT_ALLOWLISTED")
    target.parent.mkdir(parents=True,exist_ok=True)
    fd, temp_name=tempfile.mkstemp(prefix=".tsm-tiger-source-",suffix=".part",dir=target.parent)
    os.close(fd)
    temporary=Path(temp_name)
    digest=hashlib.sha256()
    total=0
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"Tri-State-Systems-Manager/2026 Census source acquisition"})
        with urllib.request.urlopen(req,timeout=120) as response:
            if response.geturl()!=url:
                raise ValueError("SOURCE_REDIRECT_OUTSIDE_OFFICIAL_EXACT_URL")
            declared=response.headers.get("Content-Length")
            if declared and int(declared)>MAX_ARCHIVE_BYTES:
                raise ValueError("SOURCE_EXCEEDS_SIZE_BUDGET")
            last_modified=response.headers.get("Last-Modified")
            with temporary.open("wb") as out:
                while True:
                    chunk=response.read(1024*1024)
                    if not chunk:
                        break
                    total+=len(chunk)
                    if total>MAX_ARCHIVE_BYTES:
                        raise ValueError("SOURCE_EXCEEDS_SIZE_BUDGET")
                    digest.update(chunk)
                    out.write(chunk)
        if declared and total!=int(declared):
            raise ValueError("SOURCE_CONTENT_LENGTH_MISMATCH")
        if not total:
            raise ValueError("SOURCE_EMPTY")
        with temporary.open("rb") as inp:
            if inp.read(4)!=b"PK\x03\x04":
                raise ValueError("SOURCE_NOT_ZIP")
        os.replace(temporary,target)
    finally:
        temporary.unlink(missing_ok=True)
    return {"source_url":url,"sha256":digest.hexdigest(),"bytes":total,"last_modified":last_modified}


def validate_archive(path: Path, fips: str, kind: str) -> dict:
    if fips not in COUNTIES or kind not in KINDS:
        raise ValueError("COUNTY_OR_KIND_NOT_ALLOWLISTED")
    prefix=f"tl_2026_{fips}_{kind}"
    expected={prefix+"."+e for e in ("shp","shx","dbf","prj")}
    with zipfile.ZipFile(path) as archive:
        entries=archive.infolist()
        names=set()
        uncompressed=0
        for e in entries:
            name=e.filename
            if not name.startswith(prefix+".") or "/" in name or "\\" in name or ".." in name or e.is_dir():
                raise ValueError("UNTRUSTED_ZIP_MEMBER")
            if name in names:
                raise ValueError("DUPLICATE_ZIP_MEMBER")
            names.add(name)
            uncompressed+=e.file_size
            if uncompressed>MAX_UNCOMPRESSED_BYTES:
                raise ValueError("ARCHIVE_UNCOMPRESSED_SIZE_BUDGET")
        if not expected<=names:
            raise ValueError("MISSING_SHAPEFILE_SIDECAR")
        # Only these 4 members are read for inspection; original ZIP remains unchanged.
        prj=archive.read(prefix+".prj")
        shp=archive.read(prefix+".shp")
        shx=archive.read(prefix+".shx")
        dbf=archive.read(prefix+".dbf")
    from pyproj import CRS
    import shapefile
    crs=CRS.from_wkt(prj.decode("utf-8-sig"))
    if crs.to_epsg()!=4269:
        raise ValueError("UNEXPECTED_SOURCE_CRS_NOT_NAD83_4269")
    with shapefile.Reader(shp=io.BytesIO(shp),shx=io.BytesIO(shx),dbf=io.BytesIO(dbf)) as reader:
        n=len(reader)
        geometry_type=reader.shapeTypeName
    if n<0:
        raise ValueError("INVALID_RECORD_COUNT")
    return {"feature_count":n,"source_crs_epsg":4269,
            "geometry_type":geometry_type,"file_members_verified":len(expected),
            "total_zip_members":len(names),"uncompressed_bytes":uncompressed}


def acquire(root: Path, counties: list[str]) -> dict:
    if not counties or len(counties)!=len(set(counties)) or set(counties)-set(COUNTIES):
        raise ValueError("INVALID_COUNTIES")
    root.mkdir(parents=True,exist_ok=True)
    receipts=[]
    sha_lines=[]
    total=0
    for fips in counties:
        for kind in KINDS:
            relative=f"{fips}/{kind}/tl_2026_{fips}_{kind}.zip"
            path=root/relative
            source=download(tiger_source_url(fips,kind),path)
            total+=source["bytes"]
            if total>MAX_TOTAL_BYTES:
                raise ValueError("TOTAL_DOWNLOAD_BUDGET_EXCEEDED")
            content=validate_archive(path,fips,kind)
            receipts.append({"fips":fips,"county":COUNTIES[fips],
                            "scope":"additional-regional" if fips in EXTRA_REGIONAL else "engineering-eight",
                            "kind":kind,"relative_path":relative,
                            **source,**content})
            sha_lines.append(f"{source['sha256']}  {relative}\n")
    report={"schema":"tsm.tiger2026-county-roads-hydro-acquisition.v1",
        "retrieved_at_utc":datetime.now(timezone.utc).isoformat(),
        "publisher":"U.S. Census Bureau",
        "source_year":2026,
        "record_count":len(receipts),
        "total_source_bytes":total,
        "engineering_fips":sorted(ENGINEERING_EIGHT),
        "separate_regional_fips":sorted(EXTRA_REGIONAL),
        "spatial_coverage_against_exact_county_polygon_verified":False,
        "road_elevations_or_bathymetry_verified":False,
        "engineering_or_regulatory_approved":False,
        "datasets":receipts}
    (root/"acquisition-receipt.json").write_text(json.dumps(report,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    (root/"SHA256SUMS.txt").write_text("".join(sha_lines),encoding="utf-8")
    return report


def main() -> None:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--output",type=Path,default=Path("tiger2026-nine-county-roads-hydro"))
    p.add_argument("--fips",action="append",choices=sorted(COUNTIES))
    args=p.parse_args()
    r=acquire(args.output,args.fips or list(COUNTIES))
    print(json.dumps({"status":"OFFICIAL_SOURCE_ARCHIVED_SHA256_VERIFIED",
                      "source_archive_count":r["record_count"],
                      "total_source_bytes":r["total_source_bytes"],
                      "engineered_certified":False}))


if __name__=="__main__":
    main()
