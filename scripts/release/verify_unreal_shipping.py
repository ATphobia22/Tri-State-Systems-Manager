#!/usr/bin/env python3
"""Verify *actual* UE 5.8 Windows Shipping outputs; never equate Tauri with Unreal.

Usage: python scripts/release/verify_unreal_shipping.py --root PATH --receipt PATH
The input is an unpacked, authorized UE 5.8 BuildCookRun/BuildGraph Windows
Shipping output. This does NOT build Unreal, sign an executable, or attest an
unknown producer. Run it on the same Windows UE 5.8 runner that packages the
project and retain the resulting SHA-256 inventory with the build provenance.
"""
import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

MAX_FILES = 150000
BLOCK = 1024 * 1024
EXCLUDE = {".git", "Intermediate", "Saved", "DerivedDataCache"}
REQUIRED_EXT = {".exe", ".pak", ".ucas", ".utoc"}
def verify(root: Path):
    if not root.is_dir():
        raise ValueError("Missing UE Shipping output directory")
    files = []
    for p in sorted(root.rglob("*")):
        if not p.is_file() or any(x in EXCLUDE for x in p.relative_to(root).parts):
            continue
        if p.is_symlink():
            raise ValueError("Symlink forbidden in release inventory")
        files.append(p)
        if len(files) > MAX_FILES:
            raise ValueError("Too many files in Shipping package")
    exes = [p for p in files if p.suffix.lower() == ".exe"]
    containers = [p for p in files if p.suffix.lower() in {".pak", ".ucas"}]
    if not exes or not containers:
        raise ValueError("Missing Windows executable or cooked Unreal content (.pak/.ucas)")
    if any(p.stat().st_size == 0 for p in exes + containers):
        raise ValueError("Empty executable or cooked-content container")
    # This is only an artifact presence and integrity gate. Engine version,
    # Shipping target, source commit, cooking and signing require separately
    # authenticated BuildGraph/AutomationTool receipts.
    inventory = []
    for p in files:
        digest = hashlib.sha256()
        with p.open("rb") as src:
            while chunk := src.read(BLOCK):
                digest.update(chunk)
        inventory.append({"relativePath":p.relative_to(root).as_posix(),
                          "bytes":p.stat().st_size, "sha256":digest.hexdigest()})
    return {"schemaVersion":"tsm-unreal-windows-shipping-artifact-inventory-v1",
            "status":"ARTIFACT_INTEGRITY_VERIFIED_BUILD_PROVENANCE_PENDING",
            "engineVersionVerified":False, "shippingConfigurationVerified":False,
            "codeSignatureVerified":False, "sourceCommitVerified":False,
            "fullReleaseAccepted":False,
            "executableCount":len(exes), "cookedContainerCount":len(containers),
            "fileCount":len(inventory), "files":inventory}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",required=True,type=Path)
    parser.add_argument("--receipt",required=True,type=Path)
    a=parser.parse_args()
    if a.receipt.resolve().is_relative_to(a.root.resolve()):
        parser.error("Receipt must be outside the inspected package")
    try:
        result=verify(a.root)
    except (ValueError, OSError) as exc:
        print("UNREAL_SHIPPING_ARTIFACT_GATE_FAILED: "+str(exc),file=sys.stderr)
        return 1
    a.receipt.parent.mkdir(parents=True,exist_ok=True)
    a.receipt.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print("Artifact integrity verified; Unreal version/Shipping provenance/signing remain UNVERIFIED")
    return 0

if __name__=="__main__":
    sys.exit(main())
