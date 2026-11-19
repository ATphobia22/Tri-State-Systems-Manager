#!/usr/bin/env python3
"""Acquire official 2020 ISGS White/Gallatin LiDAR metadata and tile-index ZIPs.

These are source catalogs to choose individual DTM/DEM and LAS tiles rather
than downloading enormous countywide archives. They are not terrain rasters,
verified NAVD88 elevations, or engineering-suitable height observations.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timezone
from pathlib import Path

BASE="https://chf.isgs.illinois.edu/distribute/district9"
SOURCES={
    "White":{"fips":"17193",
             "metadata":BASE+"/white/2020/white_2020_metadata.xml",
             "index":BASE+"/white/2020/white_tile_index.zip"},
    "Gallatin":{"fips":"17059",
                "metadata":BASE+"/gallatin/2020/gallatin_2020_metadata.xml",
                "index":BASE+"/gallatin/2020/gallatin_tile_index.zip"},
}
MAX_FILE_BYTES=20*1024*1024
MAX_UNPACKED_BYTES=200*1024*1024


def allowed_url(url:str)->bool:
    return url in {s[k] for s in SOURCES.values() for k in ("metadata","index")}


def download(url:str, dest:Path) -> dict:
    if not allowed_url(url):
        raise ValueError("SOURCE_URL_NOT_ALLOWLISTED")
    dest.parent.mkdir(parents=True,exist_ok=True)
    fd,name=tempfile.mkstemp(prefix=".isgs-2020-",suffix=".part",dir=str(dest.parent))
    os.close(fd)
    temp=Path(name)
    digest=hashlib.sha256()
    size=0
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"TSM-ISGS-Official-Source-2020/1.0"})
        with urllib.request.urlopen(req,timeout=120) as response:
            if response.geturl()!=url:
                raise ValueError("SOURCE_REDIRECT_OFF_ALLOWLIST")
            declared=response.headers.get("Content-Length")
            if declared and int(declared)>MAX_FILE_BYTES:
                raise ValueError("SOURCE_SIZE_BUDGET_EXCEEDED")
            modified=response.headers.get("Last-Modified")
            with temp.open("wb") as target:
                while True:
                    block=response.read(1024*1024)
                    if not block:
                        break
                    size+=len(block)
                    if size>MAX_FILE_BYTES:
                        raise ValueError("SOURCE_SIZE_BUDGET_EXCEEDED")
                    target.write(block)
                    digest.update(block)
        if declared and size!=int(declared):
            raise ValueError("SOURCE_CONTENT_LENGTH_MISMATCH")
        if size<=0:
            raise ValueError("SOURCE_EMPTY")
        os.replace(temp,dest)
    finally:
        temp.unlink(missing_ok=True)
    return {"source_url":url,"bytes":size,"sha256":digest.hexdigest(),
            "last_modified":modified}


def validate_xml(data:bytes) -> str:
    try:
        root=ET.fromstring(data)
    except ET.ParseError as exc:
        raise ValueError("SOURCE_XML_MALFORMED") from exc
    if not root.tag or root.tag.lower() not in ("metadata","fgdc"):
        raise ValueError("SOURCE_XML_UNEXPECTED_ROOT")
    return root.tag


def validate_index(path:Path) -> dict:
    with zipfile.ZipFile(path) as archive:
        entries=archive.infolist()
        names={}
        unpacked=0
        for item in entries:
            if item.is_dir():
                continue
            name=item.filename.replace("\\","/")
            pieces=name.split("/")
            if (not name or name.startswith("/") or any(p in ("","..",".") for p in pieces)
                    or ":" in name or len(pieces)>4):
                raise ValueError("UNTRUSTED_ZIP_MEMBER")
            if name.lower() in names:
                raise ValueError("DUPLICATE_ZIP_MEMBER")
            names[name.lower()]=item.filename
            unpacked+=item.file_size
            if unpacked>MAX_UNPACKED_BYTES:
                raise ValueError("UNCOMPRESSED_SIZE_BUDGET")
        if archive.testzip() is not None:
            raise ValueError("ZIP_CRC_MISMATCH")
        bases={name[:-4] for name in names if name.endswith(".shp")}
        if not bases:
            raise ValueError("NO_INDEX_SHAPEFILES")
        import shapefile
        from pyproj import CRS
        total=0
        source_crs=[]
        for base in sorted(bases):
            needed={base+ext for ext in (".shp",".shx",".dbf",".prj")}
            if not needed<=set(names):
                raise ValueError("MISSING_SHAPEFILE_SIDECAR")
            prj=archive.read(names[base+".prj"])
            shape=archive.read(names[base+".shp"])
            shx=archive.read(names[base+".shx"])
            dbf=archive.read(names[base+".dbf"])
            crs=CRS.from_wkt(prj.decode("utf-8-sig"))
            with shapefile.Reader(shp=io.BytesIO(shape),shx=io.BytesIO(shx),
                                  dbf=io.BytesIO(dbf)) as reader:
                count=len(reader)
            total+=count
            source_crs.append({"layer_base":base,
                               "name":crs.name,
                               "epsg":crs.to_epsg(),
                               "wkt_sha256":hashlib.sha256(prj).hexdigest(),
                               "features":count})
        return {"zip_crc_verified":True,"zip_members":len(names),
                "shapefile_count":len(bases),
                "shapefile_feature_count":total,
                "source_crs":source_crs,
                "vertical_datum_independently_verified":False}


def acquire(root:Path) -> dict:
    root.mkdir(parents=True,exist_ok=True)
    records=[]
    sha_lines=[]
    for county, urls in SOURCES.items():
        country=root/county.lower()
        xml_path=country/Path(urls["metadata"]).name
        index_path=country/Path(urls["index"]).name
        metadata=download(urls["metadata"],xml_path)
        metadata["xml_root"]=validate_xml(xml_path.read_bytes())
        index=download(urls["index"],index_path)
        index.update(validate_index(index_path))
        for role,path,info in (("metadata",xml_path,metadata),("tile_index",index_path,index)):
            relative=str(path.relative_to(root)).replace("\\","/")
            sha_lines.append(f"{info['sha256']}  {relative}\n")
            records.append({"county":county,"county_fips":urls["fips"],
                            "source_year":2020,"role":role,"relative_path":relative,**info})
    receipt={"schema":"tsm.isgs-2020-white-gallatin-tile-index-receipt.v1",
             "agency":"Illinois State Geological Survey / ILHMP",
             "official_index":"https://clearinghouse.isgs.illinois.edu/data/elevation/lidar/",
             "retrieved_at_utc":datetime.now(timezone.utc).isoformat(),
             "sources":records,"source_objects":len(records),
             "original_las_dtm_dem_dsm_rasters_downloaded":False,
             "tile_footprints_not_clipped_to_requested_parcels":True,
             "navd88_and_geoid_transfer_verified":False,
             "engineering_approved":False}
    (root/"source-acquisition-receipt.json").write_text(json.dumps(receipt,indent=2,sort_keys=True)+"\n")
    (root/"SHA256SUMS.txt").write_text("".join(sha_lines),encoding="utf-8")
    return receipt


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,default=Path("isgs-il2020-tile-indexes"))
    args=parser.parse_args()
    r=acquire(args.output)
    print(json.dumps({"acquired_source_objects":r["source_objects"],
                      "county_fips":sorted({x["county_fips"] for x in r["sources"]}),
                      "tile_index_feature_count":sum(x.get("shapefile_feature_count",0) for x in r["sources"]),
                      "large_terrain_datasets_downloaded":False},sort_keys=True))


if __name__=="__main__":
    main()
