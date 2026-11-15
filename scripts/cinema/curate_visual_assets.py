#!/usr/bin/env python3
"""License-gated, bounded, headless CC0 visual asset intake for TSM.

No blind Fab/BlenderKit downloads, no logins, no site scraping, no engineering
claims. Explicitly pins official file hashes (MD5 or SHA256), verifies
downloaded bytes, writes source receipts and leaves asset positioning to a
separate headed visual review. Run without --download for an offline dry run.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

MAX_FILE_BYTES = 32 * 1024 * 1024
MAX_BUNDLE_BYTES = 128 * 1024 * 1024
UA = "TriStateSystemsManager-CC0-AssetIntake/1.0"
HOSTS = {
    "polyhaven": frozenset({"dl.polyhaven.org"}),
    "ambientcg": frozenset({"ambientcg.com", "cdn.ambientcg.com"}),
}
REGISTRY_SCHEMA = "tsm.cinematic-asset-sources.v1"


class IntakeError(ValueError):
    pass


def safe_name(value: str) -> bool:
    return (isinstance(value, str) and bool(value) and
            not value.startswith(("/", ".")) and "\\" not in value and ":" not in value
            and all(p not in ("", ".", "..") for p in PurePosixPath(value).parts)
            and bool(re.fullmatch(r"[a-zA-Z0-9_./-]+", value)))


def validate_url(url: str, provider: str) -> None:
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or parsed.hostname not in HOSTS.get(provider, ())
            or parsed.username or parsed.password or parsed.port
            or parsed.query or parsed.fragment or not parsed.path.startswith("/")):
        raise IntakeError("Download URL is not on an explicitly approved provider HTTPS host")


class PinnedRedirect(HTTPRedirectHandler):
    def __init__(self, provider: str):
        self.provider = provider

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_url(newurl, self.provider)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def validate_registry(data: dict) -> list[dict]:
    if not isinstance(data, dict) or data.get("schemaVersion") != REGISTRY_SCHEMA:
        raise IntakeError("Invalid source registry schema")
    assets = data.get("assets")
    if not isinstance(assets, list) or not assets:
        raise IntakeError("Registry assets required")
    seen = set()
    for asset in assets:
        if not isinstance(asset, dict) or not safe_name(asset.get("id")) or "/" in asset["id"]:
            raise IntakeError("Unsafe asset identifier")
        if asset["id"] in seen:
            raise IntakeError("Duplicate asset ID")
        seen.add(asset["id"])
        if asset.get("provider") not in (*HOSTS, "fab", "blenderkit"):
            raise IntakeError("Unsupported asset provider")
        if not isinstance(asset.get("source_uri"), str) or not asset["source_uri"].startswith("https://"):
            raise IntakeError("Missing HTTPS source citation")
        if not isinstance(asset.get("license"), str) or not asset["license"]:
            raise IntakeError("Missing asset license")
        if asset.get("classification") != "VISUALIZATION_ONLY":
            raise IntakeError("Asset cannot claim engineering authority")
        if asset.get("engineeringUse") is not False or asset.get("regulatoryUse") is not False:
            raise IntakeError("Rendering assets must remain non-authoritative")
        files = asset.get("files")
        if not isinstance(files, list):
            raise IntakeError("Asset file declarations must be a list")
        file_names = set()
        for file in files:
            if not isinstance(file, dict) or not safe_name(file.get("name")):
                raise IntakeError("Unsafe asset file path")
            if file["name"] in file_names:
                raise IntakeError("Duplicate asset file")
            file_names.add(file["name"])
            if asset["provider"] in HOSTS:
                validate_url(file.get("download_url"), asset["provider"])
            size = file.get("max_bytes")
            if isinstance(size, bool) or not isinstance(size, int) or not (1 <= size <= MAX_FILE_BYTES):
                raise IntakeError("File must have a bounded maximum size")
            sha = file.get("sha256")
            md5 = file.get("md5")
            if not (isinstance(sha, str) and re.fullmatch(r"[a-f0-9]{64}", sha) or
                    isinstance(md5, str) and re.fullmatch(r"[a-f0-9]{32}", md5)):
                raise IntakeError("File must pin an independent SHA256 or MD5")
    return assets


def plan(registry: dict, asset_id: str) -> dict:
    matching = [a for a in validate_registry(registry) if a["id"] == asset_id]
    if not matching:
        raise IntakeError("Unknown asset ID")
    asset = matching[0]
    eligible = (asset["provider"] in HOSTS and asset["license"] == "CC0-1.0"
                and asset.get("license_reviewed") is True
                and bool(asset["files"]))
    return {"asset": asset_id, "provider": asset["provider"],
            "license": asset["license"], "eligible_for_cc0_intake": eligible,
            "file_count": len(asset["files"]), "download_executed": False,
            "reason": "PINNED_CC0" if eligible else "MANUAL_LICENSE_OR_FILE_REVIEW_REQUIRED"}


def acquire(registry: dict, asset_id: str, destination: Path, *,
            opener=None, now=None) -> dict:
    eligibility = plan(registry, asset_id)
    if not eligibility["eligible_for_cc0_intake"]:
        raise IntakeError("Asset not approved for automatic CC0 acquisition")
    asset = next(a for a in registry["assets"] if a["id"] == asset_id)
    dest = destination.resolve()
    if dest.exists():
        raise IntakeError("Immutable staged destination already exists")
    if dest.is_symlink():
        raise IntakeError("Symlink destinations prohibited")
    if not dest.parent.is_dir():
        raise IntakeError("Stage root must exist (no implicit directory creation)")
    opener = opener or build_opener(PinnedRedirect(asset["provider"])).open
    receipt_files = []
    total = 0
    with tempfile.TemporaryDirectory(prefix=".tsm-asset-", dir=dest.parent) as tmp:
        temp_root = Path(tmp)
        for f in asset["files"]:
            validate_url(f["download_url"], asset["provider"])
            local = temp_root.joinpath(*PurePosixPath(f["name"]).parts)
            local.parent.mkdir(parents=True, exist_ok=True)
            request = Request(f["download_url"], headers={"User-Agent": UA, "Accept": "*/*"})
            try:
                with opener(request, timeout=60) as response:
                    validate_url(response.geturl(), asset["provider"])
                    declared = response.headers.get("Content-Length")
                    if declared and int(declared) > f["max_bytes"]:
                        raise IntakeError("Content length exceeds file budget")
                    sha256, md5 = hashlib.sha256(), hashlib.md5()
                    count = 0
                    with local.open("xb") as out:
                        while True:
                            part = response.read(min(1024 * 1024, f["max_bytes"] - count + 1))
                            if not part:
                                break
                            count += len(part)
                            total += len(part)
                            if count > f["max_bytes"] or total > MAX_BUNDLE_BYTES:
                                raise IntakeError("Asset exceeds configured download budget")
                            sha256.update(part)
                            md5.update(part)
                            out.write(part)
                        out.flush()
                        os.fsync(out.fileno())
            except (HTTPError, URLError, TimeoutError, OSError) as exc:
                raise IntakeError("Asset download unavailable") from None
            if count == 0:
                raise IntakeError("Empty asset download")
            if f.get("sha256") and f["sha256"] != sha256.hexdigest():
                raise IntakeError("Pinned SHA256 mismatch")
            if f.get("md5") and f["md5"] != md5.hexdigest():
                raise IntakeError("Pinned source MD5 mismatch")
            receipt_files.append({"path": f["name"], "bytes": count,
                                  "sha256": sha256.hexdigest(), "source_uri": f["download_url"],
                                  "pinned_source_digest_verified": True})
        receipt = {
            "schemaVersion": "tsm.cinematic-cc0-acquisition.v1",
            "id": asset_id, "provider": asset["provider"], "license": "CC0-1.0",
            "source_uri": asset["source_uri"],
            "retrieved_at": (now or datetime.now(timezone.utc)).isoformat(),
            "classification": "VISUALIZATION_ONLY",
            "crs": "NOT_GEORREFERENCED", "vertical_datum": "NOT_APPLICABLE",
            "geometry_alignment": "NOT_VERIFIED", "engineeringUse": False,
            "regulatoryUse": False, "render_ready": False,
            "public_redistribution_eligible": True,
            "files": receipt_files,
        }
        (temp_root / "acquisition-receipt.json").write_text(
            json.dumps(receipt, sort_keys=True, indent=2) + "\n", encoding="utf-8")
        # Atomic on the same volume; staged bytes cannot replace existing evidence.
        temp_root.rename(dest)
    return receipt


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--registry", type=Path, default=Path(__file__).resolve().parents[2] /
                   "data/cinematic/cc0-visual-asset-source-registry.json")
    p.add_argument("--asset", required=True)
    p.add_argument("--stage-dir", type=Path)
    p.add_argument("--download", action="store_true")
    args = p.parse_args()
    try:
        registry = json.loads(args.registry.read_text(encoding="utf-8"))
        if args.download:
            if args.stage_dir is None:
                raise IntakeError("--stage-dir required for downloads")
            value = acquire(registry, args.asset, args.stage_dir)
        else:
            value = plan(registry, args.asset)
        print(json.dumps(value, indent=2, sort_keys=True))
    except (IntakeError, OSError, ValueError) as exc:
        p.exit(2, f"asset intake blocked: {exc}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
