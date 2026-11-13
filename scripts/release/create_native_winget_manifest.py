#!/usr/bin/env python3
"""Emit an optional WinGet manifest ONLY from a locally signed native installer receipt.

This does not upload or publish anything and does not independently verify the
Authenticode signature; signed-artifact evidence MUST come from the Windows
signing gate. The offline installer is the authoritative release product.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

REPOSITORY = "ATphobia22/Tri-State-Systems-Manager"
PACKAGE_ID = "TriStateSystemsManager.TSMNative"
VERSION_RE = re.compile(r"\d+\.\d+\.\d+(?:\.\d+)?\Z")
COMMIT_RE = re.compile(r"[0-9a-fA-F]{40}\Z")
SHA256_RE = re.compile(r"[0-9a-fA-F]{64}\Z")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def generate_manifest(installer: Path, signed_receipt: Path,
                      release_url: str, version: str) -> str:
    if not isinstance(version, str) or not VERSION_RE.fullmatch(version):
        raise ValueError("invalid version: expected numeric release version")
    if not isinstance(installer, Path) or not isinstance(signed_receipt, Path):
        raise ValueError("installer and signed receipt must be filesystem Paths")
    filename = f"TSM-Native-Setup-{version}-windows-x64.exe"
    if installer.name != filename:
        raise ValueError("installer filename/version mismatch")
    expected_url = (f"https://github.com/{REPOSITORY}/releases/"
                    f"download/v{version}/{filename}")
    if release_url != expected_url:
        raise ValueError("release URL must be exact versioned HTTPS GitHub asset URL")
    if (not installer.is_file() or installer.is_symlink()
            or installer.stat().st_size < 1024):
        raise ValueError("missing, symlinked or implausibly small installer")
    if signed_receipt.is_symlink() or not signed_receipt.is_file():
        raise ValueError("signed release receipt is missing or unsafe")
    if signed_receipt.stat().st_size > 2 * 1024 * 1024:
        raise ValueError("signed release receipt too large")
    with installer.open("rb") as handle:
        if handle.read(2) != b"MZ":
            raise ValueError("installer does not have a PE executable header")
    digest = _sha256(installer)
    try:
        receipt = json.loads(signed_receipt.read_text(encoding="utf-8-sig"))
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("invalid signed release receipt") from exc
    if (not isinstance(receipt, dict)
            or receipt.get("schema") != "tsm.native.signed-artifact-inventory.v1"
            or receipt.get("state") !=
                "SIGNED_ARTIFACT_INTEGRITY_VERIFIED_OFFLINE_RUNTIME_PENDING"
            or not isinstance(receipt.get("source_commit"), str)
            or not COMMIT_RE.fullmatch(receipt["source_commit"])):
        raise ValueError("release receipt lacks pinned signing provenance")
    signed_files = receipt.get("signed_files")
    if not isinstance(signed_files, list):
        raise ValueError("missing signed artifact entries")
    matched = [
        record for record in signed_files
        if isinstance(record, dict) and record.get("role") == "offline_installer"
    ]
    if len(matched) != 1 or matched[0].get("filename") != filename:
        raise ValueError("exactly one matching signed offline installer is required")
    record = matched[0]
    reported = record.get("sha256")
    if (not isinstance(reported, str) or not SHA256_RE.fullmatch(reported)
            or reported.lower() != digest):
        raise ValueError("installer SHA-256 differs from independent signed artifact receipt")
    if (record.get("authenticode") != "Valid"
            or record.get("timestamp_certificate_present") is not True
            or not isinstance(record.get("signer_thumbprint"), str)
            or not COMMIT_RE.fullmatch(record["signer_thumbprint"])):
        raise ValueError("missing valid Authenticode signer and timestamp evidence")
    if "bytes" in record and record["bytes"] != installer.stat().st_size:
        raise ValueError("signed receipt byte length does not match installer")
    return (
        f"# Generated from signed Windows build evidence; not published or verified online.\n"
        f"PackageIdentifier: {PACKAGE_ID}\n"
        f"PackageVersion: {version}\n"
        f"PackageLocale: en-US\n"
        f"Publisher: Tri-State Systems Manager\n"
        f"PackageName: Tri-State Systems Manager Native\n"
        f"License: Apache-2.0\n"
        f"LicenseUrl: https://github.com/{REPOSITORY}/blob/main/LICENSE\n"
        f"ShortDescription: Offline-capable native river-valley engineering digital twin\n"
        f"Installers:\n"
        f"  - Architecture: x64\n"
        f"    InstallerType: inno\n"
        f"    Scope: machine\n"
        f"    MinimumOSVersion: 10.0.22000.0\n"
        f"    InstallerUrl: {release_url}\n"
        f"    InstallerSha256: {digest.upper()}\n"
        f"ManifestType: singleton\n"
        f"ManifestVersion: 1.12.0\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--installer", required=True, type=Path)
    parser.add_argument("--signed-receipt", required=True, type=Path)
    parser.add_argument("--version", required=True)
    parser.add_argument("--release-url", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if (args.output.exists()
            or args.output.resolve() in (args.installer.resolve(),
                                        args.signed_receipt.resolve())):
        parser.error("refusing to overwrite source or an existing manifest")
    try:
        content = generate_manifest(args.installer, args.signed_receipt,
                                    args.release_url, args.version)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("x", encoding="utf-8") as handle:
            handle.write(content)
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    print(f"Created LOCAL publication candidate: {args.output} (not uploaded).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
