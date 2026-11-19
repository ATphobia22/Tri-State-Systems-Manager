#!/usr/bin/env python3
"""Stage two checksum-verified imagery parts and DSM/evidence for private Drive.

This is transport chunking ONLY. Reassemble original imagery TIFF by concatenating
part00 then part01, verify the original SHA-256 and bytes from part-manifest.json,
and keep the original DSM GeoTIFF and metadata unchanged. None is engineering approved.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

DEFAULT_CHUNK_BYTES=60*1024*1024


def sha256(path: Path) -> str:
    digest=hashlib.sha256()
    with path.open("rb") as source:
        while True:
            data=source.read(1024*1024)
            if not data:
                return digest.hexdigest()
            digest.update(data)


def stage(source_dir: Path, destination: Path, *, chunk_bytes:int=DEFAULT_CHUNK_BYTES) -> dict:
    if chunk_bytes <= 0:
        raise ValueError("INVALID_CHUNK_BUDGET")
    receipt_path=source_dir/"acquisition-receipt.json"
    if not receipt_path.is_file():
        raise ValueError("SOURCE_RECEIPT_MISSING")
    receipt=json.loads(receipt_path.read_text(encoding="utf-8"))
    image=[x for x in receipt.get("downloaded_objects",[]) if x.get("role")=="imagery2025"]
    dsm=[x for x in receipt.get("downloaded_objects",[]) if x.get("role")=="dsm2025"]
    if len(image)!=1 or len(dsm)!=1:
        raise ValueError("ONE_IMAGE_AND_ONE_DSM_REQUIRED")
    root=source_dir.resolve()
    verified={}
    for role,entry in (("imagery",image[0]),("dsm",dsm[0])):
        source=Path(entry["file"])
        if not source.is_absolute():
            source=source.resolve()
        if not source.is_relative_to(root) or not source.is_file() or source.suffix.lower()!=".tif":
            raise ValueError("SOURCE_NOT_INSIDE_COUNTY_DIR")
        if source.stat().st_size!=entry["bytes"] or sha256(source)!=entry["sha256"]:
            raise ValueError("ORIGINAL_SHA256_MISMATCH")
        verified[role]=(source,entry)
    imagery_path,imagery_receipt=verified["imagery"]
    imagery_bytes=imagery_path.stat().st_size
    if not chunk_bytes<imagery_bytes<=2*chunk_bytes:
        raise ValueError("CHUNK_BUDGET_REQUIRES_EXACTLY_TWO_PARTS")
    destination.mkdir(parents=True,exist_ok=True)
    meta_dir=destination/"metadata"
    for source in source_dir.rglob("*"):
        if not source.is_file() or source.resolve()==imagery_path.resolve():
            continue
        relative=source.relative_to(source_dir)
        target=meta_dir/relative
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(source,target)
    parts=[]
    total=0
    with imagery_path.open("rb") as source:
        for idx in range(2):
            part=source.read(chunk_bytes)
            if not part:
                raise ValueError("CHUNK_BUDGET_REQUIRES_EXACTLY_TWO_PARTS")
            rel=f"part{idx:02d}/imagery.tif.part{idx:02d}"
            target=destination/rel
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(part)
            parts.append({"part_index":idx,"relative_path":rel,
                          "bytes":len(part),"sha256":hashlib.sha256(part).hexdigest()})
            total+=len(part)
        if source.read(1):
            raise ValueError("CHUNK_BUDGET_EXCEEDED")
    if total!=imagery_bytes:
        raise ValueError("CHUNK_REASSEMBLY_LENGTH_MISMATCH")
    result={"schema":"tsm.igio-2025-transport-chunks.v1",
            "original_county":receipt.get("county"),
            "original_county_fips":receipt.get("county_fips"),
            "original_image_relpath":str(imagery_path.relative_to(root)).replace("\\","/"),
            "original_image_sha256":imagery_receipt["sha256"],
            "original_image_bytes":imagery_bytes,
            "image_parts":parts,
            "dsm_bytes":verified["dsm"][1]["bytes"],
            "dsm_sha256":verified["dsm"][1]["sha256"],
            "original_image_complete_only_after_two_parts_reassembled":True,
            "vertical_datum_verified":False,
            "engineering_approved":False}
    (meta_dir/"part-manifest.json").write_text(json.dumps(result,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    (meta_dir/"image-parts.sha256").write_text("".join(f"{x['sha256']}  {x['relative_path']}\n" for x in parts),encoding="utf-8")
    return result


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source-dir",required=True,type=Path)
    p.add_argument("--output",required=True,type=Path)
    p.add_argument("--chunk-mib",type=int,default=60)
    args=p.parse_args()
    if not 1<=args.chunk_mib<=90:
        p.error("Chunk size must be from 1 to 90 MiB")
    receipt=stage(args.source_dir,args.output,chunk_bytes=args.chunk_mib*1024*1024)
    print(json.dumps({"county":receipt["original_county_fips"],
                     "parts":len(receipt["image_parts"]),
                     "image_bytes":receipt["original_image_bytes"],
                     "dsm_bytes":receipt["dsm_bytes"],
                     "engineering_approved":False}))


if __name__=="__main__":
    main()
